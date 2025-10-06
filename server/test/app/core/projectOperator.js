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

const projectFilesOperator = require("../../../app/core/projectFilesOperator.js");
const { createNewProject } = projectFilesOperator;
const originalFs = projectFilesOperator._internal.fs;
const senders = require("../../../app/handlers/senders.js");

//testee
const projectController = require("../../../app/handlers/projectController.js");
const { onProjectOperation } = projectController;
const { _internal } = projectController;
const onRunProject = sinon.stub(_internal, "onRunProject");
const onStopProject = sinon.stub(_internal, "onStopProject");
const onCleanProject = sinon.stub(_internal, "onCleanProject");
const onRevertProject = sinon.stub(_internal, "onRevertProject");
const onSaveProject = sinon.stub(_internal, "onSaveProject");
const queues = _internal.projectOperationQueues;

sinon.stub(senders, "sendWorkflow");
sinon.stub(senders, "sendTaskStateList");
sinon.stub(senders, "sendProjectJson");
sinon.stub(senders, "sendComponentTree");

const ack = sinon.stub();
async function sleep(time) {
  return new Promise((resolve)=>{
    setTimeout(resolve, time);
  });
}

//test data
const testDirRoot = "WHEEL_TEST_TMP";
const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");

describe("UT for projectOperation callback function", function () {
  this.timeout(10000);
  beforeEach(async ()=>{
    projectFilesOperator._internal.fs = originalFs;
    await fs.remove(testDirRoot);
    await createNewProject(projectRootDir, "test project", null, "test", "test@example.com");
    const sbs = queues.get(projectRootDir);
    if (sbs) {
      sbs.clear();
    }
    queues.clear();
    onRunProject.resetHistory();
    onStopProject.resetHistory();
    onCleanProject.resetHistory();
    onRevertProject.resetHistory();
    onSaveProject.resetHistory();
  });
  after(async ()=>{
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
    sinon.restore();
  });
  describe("test with not-started project", ()=>{
    it("should call onRunProject", async ()=>{
      await onProjectOperation("dummy", projectRootDir, "runProject", ack);
      await sleep(2000);
      expect(onRunProject).to.be.calledOnce;
    });
    it("should not call onStopProject", async ()=>{
      await onProjectOperation("dummy", projectRootDir, "stopProject", ack);
      expect(onStopProject).not.to.be.called;
    });
    it("should not call onCleanProject", async ()=>{
      await onProjectOperation("dummy", projectRootDir, "cleanProject", ack);
      expect(onCleanProject).not.to.be.called;
    });
    it("should call onRevertProject", async ()=>{
      await onProjectOperation("dummy", projectRootDir, "revertProject", ack);
      await sleep(2000);
      expect(onRevertProject).to.be.calledOnce;
    });
    it("should call onSaveProject", async ()=>{
      await onProjectOperation("dummy", projectRootDir, "saveProject", ack);
      await sleep(2000);
      expect(onSaveProject).to.be.calledOnce;
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
      const numberOfRunProjectCalled = onRunProject.getCalls().length;
      const numberOfStopProjectCalled = onStopProject.getCalls().length;

      expect(numberOfRunProjectCalled).to.be.below(8);
      expect(numberOfStopProjectCalled).to.be.below(8);
    });
    it("should call onece if 2 consecutive API called", async ()=>{
      await onProjectOperation("dummy", projectRootDir, "revertProject", ack);
      await onProjectOperation("dummy", projectRootDir, "revertProject", ack);
      await sleep(2000);
      expect(onRevertProject).to.be.calledOnce;
    });
  });
});