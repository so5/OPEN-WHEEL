/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import path from "path";
import fs from "fs-extra";
import sinon from "sinon";

//setup test framework
import chai, { expect } from "chai";
import sinonChai from "sinon-chai";
import chaiFs from "chai-fs";
import chaiJsonSchema from "chai-json-schema";

import { updateProjectState, _internal } from "../../../../app/core/projectController.js";
import { _internal as gitOpe2Internal } from "../../../../app/core/gitOperator2.js";

//test data
const testDirRoot = "WHEEL_TEST_TMP";
const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");

//helper functions
import { createNewProject } from "../../../../app/core/projectFilesOperator.js";

chai.use(sinonChai);
chai.use(chaiFs);
chai.use(chaiJsonSchema);

describe("project Controller UT", function () {
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
    let setProjectStateStub, eventEmitStub, eventEmitterStub;
    beforeEach(()=>{
      setProjectStateStub = sinon.stub(_internal, "setProjectState");
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
      setProjectStateStub.resolves(mockProjectJson);
      eventEmitStub.withArgs(projectRootDir).returns(eventEmitterStub);
      await updateProjectState(projectRootDir, state);
      sinon.assert.calledOnceWithExactly(setProjectStateStub, projectRootDir, state, false, undefined);
      sinon.assert.calledOnceWithExactly(eventEmitStub, projectRootDir);
      sinon.assert.calledOnceWithExactly(eventEmitterStub.emit, "projectStateChanged", mockProjectJson);
    });
    it("should update project state but not emit event if no emitter exists", async ()=>{
      const projectRootDir = "/test/project";
      const state = "stopped";
      const mockProjectJson = { state: "stopped" };
      setProjectStateStub.resolves(mockProjectJson);
      eventEmitStub.withArgs(projectRootDir).returns(undefined);
      await updateProjectState(projectRootDir, state);
      sinon.assert.calledOnceWithExactly(setProjectStateStub, projectRootDir, state, false, undefined);
      sinon.assert.calledOnceWithExactly(eventEmitStub, projectRootDir);
      sinon.assert.notCalled(eventEmitterStub.emit);
    });
    it("should handle errors if setProjectState fails", async ()=>{
      const projectRootDir = "/test/project";
      const state = "failed";
      setProjectStateStub.rejects(new Error("Failed to update project state"));
      eventEmitStub.withArgs(projectRootDir).returns(eventEmitterStub);

      try {
        await updateProjectState(projectRootDir, state);
        throw new Error("Expected function to throw");
      } catch (error) {
        expect(error.message).to.equal("Failed to update project state");
      }
      sinon.assert.calledOnceWithExactly(setProjectStateStub, projectRootDir, state, false, undefined);
      sinon.assert.notCalled(eventEmitStub);
      sinon.assert.notCalled(eventEmitterStub.emit);
    });
  });
});