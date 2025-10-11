/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";

//setup test framework
import sinon from "sinon";
import chai, { expect } from "chai";
import chaiFs from "chai-fs";
import { jobScheduler } from "../../../app/db/db.js";

//testee
import { cancelDispatchedTasks, killTask, _internal } from "../../../app/core/taskUtil.js";

chai.use(chaiFs);

describe("UT for taskUtil class", function () {
  describe("#cancelDispatchedTasks", ()=>{
    let cancelStub, killTaskStub;
    beforeEach(()=>{
      sinon.restore();
      cancelStub = sinon.stub(_internal, "cancel");
      killTaskStub = sinon.stub(_internal, "killTask");
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should not cancel tasks that are finished or failed", async ()=>{
      const tasks = [
        { state: "finished" },
        { state: "failed" }
      ];
      await cancelDispatchedTasks(tasks);
      sinon.assert.notCalled(cancelStub);
      sinon.assert.notCalled(killTaskStub);
      expect(tasks[0].state).to.equal("finished");
      expect(tasks[1].state).to.equal("failed");
    });
    it("should cancel tasks that are not finished or failed", async ()=>{
      const tasks = [
        { state: "running", projectRootDir: "/test/project", remotehostID: "localhost" },
        { state: "queued", projectRootDir: "/test/project", remotehostID: "localhost" }
      ];
      cancelStub.returns(true);
      await cancelDispatchedTasks(tasks);
      sinon.assert.calledTwice(cancelStub);
      sinon.assert.notCalled(killTaskStub);
      expect(tasks[0].state).to.equal("not-started");
      expect(tasks[1].state).to.equal("not-started");
    });
    it("should call killTask if cancel returns false", async ()=>{
      const tasks = [
        { state: "running", projectRootDir: "/test/project", remotehostID: "localhost" },
        { state: "queued", projectRootDir: "/test/project", remotehostID: "localhost" }
      ];
      cancelStub.returns(false);
      killTaskStub.resolves();
      await cancelDispatchedTasks(tasks);
      sinon.assert.calledTwice(cancelStub);
      sinon.assert.calledTwice(killTaskStub);
      expect(tasks[0].state).to.equal("not-started");
      expect(tasks[1].state).to.equal("not-started");
    });
    it("should handle a mix of cancel returning true and false", async ()=>{
      const tasks = [
        { state: "running", projectRootDir: "/test/project", remotehostID: "localhost" },
        { state: "queued", projectRootDir: "/test/project", remotehostID: "localhost" }
      ];
      cancelStub.onFirstCall().returns(true);
      cancelStub.onSecondCall().returns(false);
      killTaskStub.resolves();
      await cancelDispatchedTasks(tasks);
      sinon.assert.calledTwice(cancelStub);
      sinon.assert.calledOnce(killTaskStub);
      expect(tasks[0].state).to.equal("not-started");
      expect(tasks[1].state).to.equal("not-started");
    });
  });
  describe("#killTask", ()=>{
    let cancelLocalJobStub, killLocalProcessStub, cancelRemoteJobStub;
    beforeEach(()=>{
      cancelLocalJobStub = sinon.stub(_internal, "cancelLocalJob");
      killLocalProcessStub = sinon.stub(_internal, "killLocalProcess");
      cancelRemoteJobStub = sinon.stub(_internal, "cancelRemoteJob");
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should call cancelLocalJob for local job scheduler tasks", async ()=>{
      const task = { remotehostID: "localhost", useJobScheduler: true };
      await killTask(task);
      sinon.assert.calledOnce(cancelLocalJobStub);
      sinon.assert.notCalled(killLocalProcessStub);
      sinon.assert.notCalled(cancelRemoteJobStub);
    });
    it("should call killLocalProcess for local tasks without job scheduler", async ()=>{
      const task = { remotehostID: "localhost", useJobScheduler: false };
      await killTask(task);
      sinon.assert.notCalled(cancelLocalJobStub);
      sinon.assert.calledOnce(killLocalProcessStub);
      sinon.assert.notCalled(cancelRemoteJobStub);
    });
    it("should call cancelRemoteJob for remote tasks using job scheduler", async ()=>{
      const task = { remotehostID: "remote1", useJobScheduler: true };
      await killTask(task);
      sinon.assert.notCalled(cancelLocalJobStub);
      sinon.assert.notCalled(killLocalProcessStub);
      sinon.assert.calledOnce(cancelRemoteJobStub);
    });
    it("should do nothing for remote tasks using remote execution", async ()=>{
      const task = { remotehostID: "remote1", useJobScheduler: false };
      await killTask(task);
      sinon.assert.notCalled(cancelLocalJobStub);
      sinon.assert.notCalled(killLocalProcessStub);
      sinon.assert.notCalled(cancelRemoteJobStub);
    });
  });
  describe("#killLocalProcess", ()=>{
    let task;
    beforeEach(()=>{
      task = { handler: { kill: sinon.stub(), killed: false } };
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should call kill() on the task handler if it is not already killed", async ()=>{
      await _internal.killLocalProcess(task);
      sinon.assert.calledOnce(task.handler.kill);
    });
    it("should not call kill() if the task handler is already killed", async ()=>{
      task.handler.killed = true;
      await _internal.killLocalProcess(task);
      sinon.assert.notCalled(task.handler.kill);
    });
    it("should not throw an error if handler is undefined", async ()=>{
      task.handler = undefined;
      await expect(_internal.killLocalProcess(task)).to.not.be.rejected;
    });
  });
  describe("#cancelRemoteJob", ()=>{
    let task, sshStub, getSshStub, getSshHostinfoStub, loggerStub, getLoggerStub;
    beforeEach(()=>{
      task = {
        jobID: "12345",
        projectRootDir: "/test/project",
        remotehostID: "host1",
        name: "testTask"
      };
      sshStub = {
        exec: sinon.stub().resolves()
      };
      getSshStub = sinon.stub(_internal, "getSsh").returns(sshStub);
      getSshHostinfoStub = sinon.stub(_internal, "getSshHostinfo").returns({
        jobScheduler: "SLURM"
      });
      _internal.jobScheduler = jobScheduler;
      jobScheduler.SLURM = { del: "scancel" };
      loggerStub = {
        debug: sinon.stub()
      };
      getLoggerStub = sinon.stub(_internal, "getLogger").returns(loggerStub);
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should execute the cancel command on SSH when jobID is present", async ()=>{
      await _internal.cancelRemoteJob(task);
      sinon.assert.calledOnce(sshStub.exec);
      sinon.assert.calledWith(sshStub.exec, "scancel 12345", 60, sinon.match.func);
      sinon.assert.calledTwice(loggerStub.debug);
      sinon.assert.calledWith(loggerStub.debug, "cancel job: scancel 12345");
      sinon.assert.calledWith(loggerStub.debug, "cacnel done", "");
    });
    it("should log a debug message and return if jobID is missing", async ()=>{
      task.jobID = null;
      await _internal.cancelRemoteJob(task);
      sinon.assert.calledOnce(loggerStub.debug);
      sinon.assert.calledWith(loggerStub.debug, "try to cancel testTask but it have not been submitted.");
      sinon.assert.notCalled(sshStub.exec);
    });
    it("should handle SSH execution errors gracefully", async ()=>{
      sshStub.exec.rejects(new Error("SSH execution failed"));
      await expect(_internal.cancelRemoteJob(task)).to.be.rejectedWith("SSH execution failed");
      sinon.assert.calledOnce(loggerStub.debug);
      sinon.assert.calledWith(loggerStub.debug, "cancel job: scancel 12345");
    });
  });
});
