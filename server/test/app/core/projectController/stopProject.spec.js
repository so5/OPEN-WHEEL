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

import { stopProject, _internal } from "../../../../app/core/projectController.js";
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
  describe("#stopProject", ()=>{
    const projectRootDir = "/test/project";
    let mockDispatcher;
    beforeEach(()=>{
      mockDispatcher = { remove: sinon.stub().resolves() };
      _internal.rootDispatchers.set(projectRootDir, mockDispatcher);
    });
    afterEach(()=>{
      sinon.restore();
      _internal.rootDispatchers.clear();
    });
    it("should remove the dispatcher, executers, transferrers, and SSH", async ()=>{
      await stopProject(projectRootDir);
      sinon.assert.calledOnce(mockDispatcher.remove);
      expect(_internal.rootDispatchers.has(projectRootDir)).to.be.false;
    });
    it("should handle the case where the dispatcher does not exist", async ()=>{
      _internal.rootDispatchers.delete(projectRootDir);
      await stopProject(projectRootDir);
      sinon.assert.notCalled(mockDispatcher.remove);
    });
  });
});