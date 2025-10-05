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
chai.use(require("sinon-chai"));
chai.use(require("chai-fs"));
chai.use(require("chai-json-schema"));

const { cleanProject, _internal } = require("../../../../app/core/projectController.js");
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
    describe("#cleanProject", ()=>{
        beforeEach(()=>{
          sinon.stub(_internal, "gitResetHEAD").resolves();
          sinon.stub(_internal, "gitClean").resolves();
        });
        afterEach(()=>{
          sinon.restore();
        });
        it("should call gitResetHEAD and gitClean", async ()=>{
          await cleanProject("/test/project");
          sinon.assert.calledOnceWithExactly(_internal.gitResetHEAD, "/test/project", undefined);
          sinon.assert.calledOnceWithExactly(_internal.gitClean, "/test/project", undefined);
        });
    });
});