/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const fs = require("fs-extra");
const path = require("path");

//setup test framework
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
chai.use(require("sinon-chai"));

const { createNewProject } = require("../../../app/core/projectFilesOperator.js");
//testee
const projectController = require("../../../app/handlers/projectController.js");
const { onProjectOperation, _internal } = projectController;
const { projectOperationQueues } = _internal;

const ack = sinon.stub();
async function sleep(time) {
  return new Promise((resolve)=>{
    setTimeout(resolve, time);
  });
}

//test data
const testDirRoot = "WHEEL_TEST_TMP";
const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");

describe("UT for projectOperation callback function", function() {
  this.timeout(10000);
  let sandbox;
  beforeEach(async ()=>{
    sandbox = sinon.createSandbox();
    sandbox.stub(_internal, "onRunProject");
    sandbox.stub(_internal, "onStopProject");
    sandbox.stub(_internal, "onCleanProject");
    sandbox.stub(_internal, "onRevertProject");
    sandbox.stub(_internal, "onSaveProject");
    sandbox.stub(_internal.senders, "sendWorkflow");
    sandbox.stub(_internal.senders, "sendTaskStateList");
    sandbox.stub(_internal.senders, "sendProjectJson");
    sandbox.stub(_internal.senders, "sendComponentTree");

    await fs.remove(testDirRoot);
    await createNewProject(projectRootDir, "test project", null, "test", "test@example.com");
    const sbs = projectOperationQueues.get(projectRootDir);
    if (sbs) {
      sbs.clear();
    }
    projectOperationQueues.clear();
  });
  afterEach(()=>{
    sandbox.restore();
  });
  after(async ()=>{
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
  });
  describe("test with not-started project", ()=>{
    it("should call onRunProject", async ()=>{
      await onProjectOperation("dummy", projectRootDir, "runProject", ack);
      await sleep(2000);
      expect(_internal.onRunProject).to.be.calledOnce;
    });
    it("should not call onStopProject", async ()=>{
      await onProjectOperation("dummy", projectRootDir, "stopProject", ack);
      expect(_internal.onStopProject).not.to.be.called;
    });
    it("should not call onCleanProject", async ()=>{
      await onProjectOperation("dummy", projectRootDir, "cleanProject", ack);
      expect(_internal.onCleanProject).not.to.be.called;
    });
    it("should call onRevertProject", async ()=>{
      await onProjectOperation("dummy", projectRootDir, "revertProject", ack);
      await sleep(2000);
      expect(_internal.onRevertProject).to.be.calledOnce;
    });
    it("should call onSaveProject", async ()=>{
      await onProjectOperation("dummy", projectRootDir, "saveProject", ack);
      await sleep(2000);
      expect(_internal.onSaveProject).to.be.calledOnce;
    });
  });
  describe("queue operation", ()=>{
    it("should not call all handler before submit cleanProject", async ()=>{
      onProjectOperation("dummy", projectRootDir, "runProject", ack);
      onProjectOperation("dummy", projectRootDir, "stopProject", ack);
      onProjectOperation("dummy", projectRootDir, "runProject", ack);
      onProjectOperation("dummy", projectRootDir, "stopProject", ack);
      onProjectOperation("dummy", projectRootDir, "runProject", ack);
      onProjectOperation("dummy", projectRootDir, "stopProject", ack);
      onProjectOperation("dummy", projectRootDir, "runProject", ack);
      onProjectOperation("dummy", projectRootDir, "stopProject", ack);
      onProjectOperation("dummy", projectRootDir, "runProject", ack);
      onProjectOperation("dummy", projectRootDir, "stopProject", ack);
      onProjectOperation("dummy", projectRootDir, "runProject", ack);
      onProjectOperation("dummy", projectRootDir, "stopProject", ack);
      onProjectOperation("dummy", projectRootDir, "runProject", ack);
      onProjectOperation("dummy", projectRootDir, "stopProject", ack);
      onProjectOperation("dummy", projectRootDir, "runProject", ack);
      onProjectOperation("dummy", projectRootDir, "stopProject", ack);
      await onProjectOperation("dummy", projectRootDir, "cleanProject", ack);
      const numberOfRunProjectCalled = _internal.onRunProject.getCalls().length;
      const numberOfStopProjectCalled = _internal.onStopProject.getCalls().length;

      expect(numberOfRunProjectCalled).to.be.below(8);
      expect(numberOfStopProjectCalled).to.be.below(8);
    });
    it("should call onece if 2 consecutive API called", async ()=>{
      await onProjectOperation("dummy", projectRootDir, "revertProject", ack);
      await onProjectOperation("dummy", projectRootDir, "revertProject", ack);
      await sleep(2000);
      expect(_internal.onRevertProject).to.be.calledOnce;
    });
  });
});
