/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const path = require("path");
const fs = require("fs-extra");
const sinon = require("sinon");

//setup test framework
const chai = require("chai");
const expect = chai.expect;
chai.use(require("sinon-chai"));
chai.use(require("chai-fs"));
chai.use(require("chai-json-schema"));

const { updateProjectState, _internal } = require("../../../../app/core/projectController.js");
const { _internal: gitOpe2Internal } = require("../../../../app/core/gitOperator2.js");

//test data
const testDirRoot = "WHEEL_TEST_TMP";
const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");

//helper functions
const { createNewProject } = require("../../../../app/core/projectFilesOperator.js");

describe("project Controller UT", function() {
    this.timeout(0);
    beforeEach(async ()=>{
      const originalGitPromise = gitOpe2Internal.gitPromise;
      sinon.stub(gitOpe2Internal, "gitPromise").callsFake(async (cwd, args, rootDir)=>{
        if (Array.isArray(args) && args[0] === "lfs" && args[1] === "install") {
          return Promise.resolve();
        }
        return originalGitPromise(cwd, args, rootDir);
      });
      await fs.remove(testDirRoot);
      await createNewProject(projectRootDir, "test project", null, "test", "test@example.com");
    });
    afterEach(()=>{
      sinon.restore();
    });
    after(async ()=>{
      if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
        await fs.remove(testDirRoot);
      }
    });
    describe("#updateProjectState", ()=>{
        let eventEmitStub, eventEmitterStub;
        beforeEach(()=>{
          sinon.stub(_internal, "setProjectState");
          eventEmitterStub = { emit: sinon.stub() };
          eventEmitStub = sinon.stub(_internal.eventEmitters, "get");
        });
        afterEach(()=>{
          sinon.restore();
        });
        it("should update project state and emit projectStateChanged event", async ()=>{
          const projectRootDir = "/test/project";
          const state = "running";
          const mockProjectJson = { state: "running" };
          _internal.setProjectState.resolves(mockProjectJson);
          eventEmitStub.withArgs(projectRootDir).returns(eventEmitterStub);
          await updateProjectState(projectRootDir, state);
          sinon.assert.calledOnceWithExactly(_internal.setProjectState, projectRootDir, state);
          sinon.assert.calledOnceWithExactly(eventEmitStub, projectRootDir);
          sinon.assert.calledOnceWithExactly(eventEmitterStub.emit, "projectStateChanged", mockProjectJson);
        });
        it("should update project state but not emit event if no emitter exists", async ()=>{
          const projectRootDir = "/test/project";
          const state = "stopped";
          const mockProjectJson = { state: "stopped" };
          _internal.setProjectState.resolves(mockProjectJson);
          eventEmitStub.withArgs(projectRootDir).returns(undefined);
          await updateProjectState(projectRootDir, state);
          sinon.assert.calledOnceWithExactly(_internal.setProjectState, projectRootDir, state);
          sinon.assert.calledOnceWithExactly(eventEmitStub, projectRootDir);
          sinon.assert.notCalled(eventEmitterStub.emit);
        });
        it("should handle errors if setProjectState fails", async ()=>{
          const projectRootDir = "/test/project";
          const state = "failed";
          _internal.setProjectState.rejects(new Error("Failed to update project state"));
          eventEmitStub.withArgs(projectRootDir).returns(eventEmitterStub);

          try {
            await updateProjectState(projectRootDir, state);
            throw new Error("Expected function to throw");
          } catch (error) {
            expect(error.message).to.equal("Failed to update project state");
          }
          sinon.assert.calledOnceWithExactly(_internal.setProjectState, projectRootDir, state);
          sinon.assert.notCalled(eventEmitStub);
          sinon.assert.notCalled(eventEmitterStub.emit);
        });
    });
});