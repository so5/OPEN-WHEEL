/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";

import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinonChai from "sinon-chai";
import path from "path";
import sinon from "sinon";
import fs from "fs-extra";
import { EventEmitter } from "events";


import executerManager, { removeExecuters, register, _internal } from "../../../app/core/executerManager.js";

const { executers } = _internal;
const testDirRoot = "WHEEL_TEST_TMP";
let loggerMock;

chai.use(sinonChai);
chai.use(chaiAsPromised);


describe("UT for executerManager class", function () {
  afterEach(function () {
    sinon.restore();
  });
  describe("removeExecuters", async ()=>{
    const mockProjectRootDir = path.resolve("WHEEL_TEST_TMP", "testProject.wheel");
    const otherProjectRootDir = path.resolve("WHEEL_TEST_TMP", "otherProject.wheel");
    let executerMock;

    beforeEach(function () {
      executerMock = {
        stop: sinon.stub(),
        start: sinon.stub()
      };
      executers.set(`${mockProjectRootDir}-localhost-false`, executerMock);
      executers.set(`${mockProjectRootDir}-remoteHost-true`, executerMock);
      executers.set(`${otherProjectRootDir}-localhost-false`, executerMock);

      expect(executers.size).to.be.greaterThan(0); //事前確認
    });
    after(async ()=>{
      if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
        await fs.remove(testDirRoot);
      }
    });

    it("should remove all executers associated with a given projectRootDir", async function () {
      removeExecuters(mockProjectRootDir);
      expect(executers.has(`${mockProjectRootDir}-localhost-false`)).to.be.false;
      expect(executers.has(`${mockProjectRootDir}-remoteHost-true`)).to.be.false;
      expect(executers.size).to.equal(1);
    });

    it("should not remove executers from other projects", function () {
      removeExecuters(mockProjectRootDir);
      expect(executers.has(`${otherProjectRootDir}-localhost-false`)).to.be.true;
    });

    it("should not throw an error if no matching executers exist", function () {
      executers.clear();

      expect(()=>{ return removeExecuters(mockProjectRootDir); }).to.not.throw();
      expect(executers.size).to.equal(0);
    });
  });
  describe("isExceededLimit", function () {
    it("should return true if rt is in exceededRtList", function () {
      const JS = { exceededRtList: [1, 2, 3] };
      const rt = 2;
      const outputText = "No errors";

      expect(_internal.isExceededLimit(JS, rt, outputText)).to.be.true;
    });

    it("should return false if rt is not in exceededRtList", function () {
      const JS = { exceededRtList: [1, 2, 3] };
      const rt = 4;
      const outputText = "No errors";

      expect(_internal.isExceededLimit(JS, rt, outputText)).to.be.false;
    });

    it("should return true if reExceededLimitError matches outputText", function () {
      const JS = { reExceededLimitError: "Limit exceeded" };
      const rt = 0;
      const outputText = "Error: Limit exceeded in queue";

      expect(_internal.isExceededLimit(JS, rt, outputText)).to.be.true;
    });

    it("should return false if reExceededLimitError does not match outputText", function () {
      const JS = { reExceededLimitError: "Limit exceeded" };
      const rt = 0;
      const outputText = "No errors";

      expect(_internal.isExceededLimit(JS, rt, outputText)).to.be.false;
    });

    it("should return false if neither exceededRtList nor reExceededLimitError matches", function () {
      const JS = { exceededRtList: [1, 2, 3], reExceededLimitError: "Limit exceeded" };
      const rt = 4;
      const outputText = "No errors";

      expect(_internal.isExceededLimit(JS, rt, outputText)).to.be.false;
    });
  });
  describe("makeEnv", function () {
    it("should return an empty string if task.env is undefined", function () {
      const task = {};
      expect(_internal.makeEnv(task)).to.equal("");
    });
    it("should return an empty string if task.env is an empty object", function () {
      const task = { env: {} };
      expect(_internal.makeEnv(task)).to.equal("");
    });
    it("should return a string with a single environment variable", function () {
      const task = { env: { KEY: "value" } };
      expect(_internal.makeEnv(task)).to.equal("env KEY=value");
    });
    it("should return a string with multiple environment variables", function () {
      const task = { env: { KEY1: "value1", KEY2: "value2" } };
      const result = _internal.makeEnv(task);
      //`result` 内の変数順序が一定でない可能性があるため、複数のパターンを考慮
      expect(result).to.satisfy((str)=>{
        return str === "env KEY1=value1 KEY2=value2" || str === "env KEY2=value2 KEY1=value1";
      }
      );
    });
    it("should handle environment variables with special characters", function () {
      const task = { env: { SPECIAL: "value with spaces" } };
      expect(_internal.makeEnv(task)).to.equal("env SPECIAL=value with spaces");
    });
  });
  describe("makeQueueOpt", function () {
    const JS = { queueOpt: "-q " };
    it("should return an empty string if queues is not a string", function () {
      const task = { queue: "default" };
      expect(_internal.makeQueueOpt(task, JS, undefined)).to.equal("");
      expect(_internal.makeQueueOpt(task, JS, null)).to.equal("");
      expect(_internal.makeQueueOpt(task, JS, 123)).to.equal("");
    });
    it("should return an empty string if queues is an empty string", function () {
      const task = { queue: "default" };
      expect(_internal.makeQueueOpt(task, JS, "")).to.equal("");
    });
    it("should return the correct queue option if task.queue matches a queue in the list", function () {
      const task = { queue: "high" };
      expect(_internal.makeQueueOpt(task, JS, "low,high,medium")).to.equal(" -q high");
    });
    it("should use the first queue in the list if task.queue does not match any queue", function () {
      const task = { queue: "nonexistent" };
      expect(_internal.makeQueueOpt(task, JS, "low,high,medium")).to.equal(" -q low");
    });
    it("should trim spaces in the queue list", function () {
      const task = { queue: "high" };
      expect(_internal.makeQueueOpt(task, JS, "  low ,  high , medium ")).to.equal(" -q high");
    });
    it("should return an empty string if the selected queue is an empty string", function () {
      const task = { queue: "" };
      expect(_internal.makeQueueOpt(task, JS, " , , ,")).to.equal("");
    });
  });
  describe("makeStepOpt", function () {
    it("should return an empty string if task.type is not 'stepjobTask'", function () {
      const task = { type: "regularTask" };
      expect(_internal.makeStepOpt(task)).to.equal("");
    });
    it("should return stepjob option without dependency if useDependency is false", function () {
      const task = {
        type: "stepjobTask",
        parentName: "testJob",
        stepnum: 1,
        useDependency: false
      };
      expect(_internal.makeStepOpt(task)).to.equal("--step --sparam \"jnam=testJob,sn=1\"");
    });
    it("should return stepjob option with dependency if useDependency is true", function () {
      const task = {
        type: "stepjobTask",
        parentName: "testJob",
        stepnum: 1,
        dependencyForm: "afterok",
        useDependency: true
      };
      expect(_internal.makeStepOpt(task)).to.equal("--step --sparam \"jnam=testJob,sn=1,afterok\"");
    });
    it("should handle missing or empty parentName and stepnum gracefully", function () {
      const task = {
        type: "stepjobTask",
        parentName: "",
        stepnum: "",
        useDependency: false
      };
      expect(_internal.makeStepOpt(task)).to.equal("--step --sparam \"jnam=,sn=\"");
    });
    it("should exclude dependency form if it is not provided", function () {
      const task = {
        type: "stepjobTask",
        parentName: "testJob",
        stepnum: 1,
        useDependency: true,
        dependencyForm: ""
      };
      expect(_internal.makeStepOpt(task)).to.equal("--step --sparam \"jnam=testJob,sn=1,\"");
    });
  });
  describe("makeBulkOpt", function () {
    it("should return an empty string if task.type is not 'bulkjobTask'", function () {
      const task = { type: "regularTask" };
      expect(_internal.makeBulkOpt(task)).to.equal("");
    });
    it("should return the correct bulkjob option if task.type is 'bulkjobTask'", function () {
      const task = {
        type: "bulkjobTask",
        startBulkNumber: 1,
        endBulkNumber: 10
      };
      expect(_internal.makeBulkOpt(task)).to.equal("--bulk --sparam \"1-10\"");
    });
    it("should return the range even if startBulkNumber and endBulkNumber are the same", function () {
      const task = {
        type: "bulkjobTask",
        startBulkNumber: 5,
        endBulkNumber: 5
      };
      expect(_internal.makeBulkOpt(task)).to.equal("--bulk --sparam \"5-5\"");
    });
    it("should handle missing startBulkNumber or endBulkNumber", function () {
      const taskWithMissingStart = {
        type: "bulkjobTask",
        endBulkNumber: 10
      };
      expect(_internal.makeBulkOpt(taskWithMissingStart)).to.equal("--bulk --sparam \"undefined-10\"");
      const taskWithMissingEnd = {
        type: "bulkjobTask",
        startBulkNumber: 1
      };
      expect(_internal.makeBulkOpt(taskWithMissingEnd)).to.equal("--bulk --sparam \"1-undefined\"");
    });
    it("should handle negative or special values", function () {
      const task = {
        type: "bulkjobTask",
        startBulkNumber: -1,
        endBulkNumber: 0
      };
      expect(_internal.makeBulkOpt(task)).to.equal("--bulk --sparam \"-1-0\"");
    });
  });
  describe("decideFinishState", function () {
    const mockTask = {
      projectRootDir: "/mock/project",
      condition: "mock condition",
      workingDir: "/mock/workingDir",
      currentIndex: 0,
      name: "mockTask",
      ID: "mockID"
    };
    beforeEach(()=>{
      sinon.stub(_internal, "evalCondition").resolves(true);
      loggerMock = {
        info: sinon.stub()
      };
      sinon.stub(_internal, "getLogger").returns(loggerMock);
    });
    it("should return true if evalCondition returns true", async function () {
      const result = await _internal.decideFinishState(mockTask);
      expect(result).to.be.true;
    });
    it("should return false if evalCondition returns false", async function () {
      _internal.evalCondition.resolves(false);
      const result = await _internal.decideFinishState(mockTask);
      expect(result).to.be.false;
    });
    it("should return false if evalCondition throws an error", async function () {
      _internal.evalCondition.rejects(new Error("Mock error"));
      const result = await _internal.decideFinishState(mockTask);
      expect(result).to.be.false;
      expect(loggerMock.info).to.have.been.calledWith(`manualFinishCondition of ${mockTask.name}(${mockTask.ID}) is set but exception occurred while evaluting it.`);
    });
    it("should handle missing task properties gracefully", async function () {
      const incompleteTask = { projectRootDir: "/mock/project" }; //必須プロパティ不足
      _internal.evalCondition.rejects(new Error("Mock error"));
      const result = await _internal.decideFinishState(incompleteTask);
      expect(result).to.be.false;
      expect(loggerMock.info).to.have.been.called;
    });
  });
  describe("needsRetry", function () {
    const mockTask = {
      projectRootDir: "/mock/project",
      workingDir: "/mock/workingDir",
      currentIndex: 0,
      name: "mockTask",
      ID: "mockID"
    };
    beforeEach(()=>{
      sinon.stub(_internal, "evalCondition").resolves(false);
      loggerMock = {
        info: sinon.stub()
      };
      sinon.stub(_internal, "getLogger").returns(loggerMock);
    });
    it("should return false if neither retry nor retryCondition is defined", async function () {
      const result = await _internal.needsRetry(mockTask);
      expect(result).to.be.false;
    });
    it("should return true if retry is a positive integer", async function () {
      const taskWithRetry = { ...mockTask, retry: 2 };
      const result = await _internal.needsRetry(taskWithRetry);
      expect(result).to.be.true;
    });
    it("should return false if retry is not a positive integer", async function () {
      const taskWithInvalidRetry = { ...mockTask, retry: -1 };
      const result = await _internal.needsRetry(taskWithInvalidRetry);
      expect(result).to.be.false;
    });
    it("should return true if retryCondition is defined and evalCondition returns true", async function () {
      _internal.evalCondition.resolves(true);
      const taskWithCondition = { ...mockTask, retryCondition: "mock condition" };
      const result = await _internal.needsRetry(taskWithCondition);
      expect(result).to.be.true;
    });
    it("should return false if retryCondition is defined and evalCondition returns false", async function () {
      const taskWithCondition = { ...mockTask, retryCondition: "mock condition" };
      const result = await _internal.needsRetry(taskWithCondition);
      expect(result).to.be.false;
    });
    it("should return false and log an error if evalCondition throws an error", async function () {
      _internal.evalCondition.rejects(new Error("Mock error"));
      const taskWithCondition = { ...mockTask, retryCondition: "mock condition" };
      const result = await _internal.needsRetry(taskWithCondition);
      expect(result).to.be.false;
      expect(loggerMock.info).to.have.been.calledWith(`retryCondition of ${mockTask.name}(${mockTask.ID}) is set but exception occurred while evaluting it. so give up retring`);
    });
    it("should log a message if evalCondition returns true and task is retried", async function () {
      _internal.evalCondition.resolves(true);
      const taskWithCondition = { ...mockTask, retryCondition: "mock condition" };
      const result = await _internal.needsRetry(taskWithCondition);
      expect(result).to.be.true;
      expect(loggerMock.info).to.have.been.calledWith(`${mockTask.name}(${mockTask.ID}) failed but retring`);
    });
  });
  describe("promisifiedSpawn", function () {
    let spawnMock;
    let loggerMock;
    beforeEach(()=>{
      spawnMock = new EventEmitter();
      spawnMock.stdout = new EventEmitter();
      spawnMock.stderr = new EventEmitter();

      sinon.stub(_internal.childProcess, "spawn").returns(spawnMock);
      loggerMock = {
        stdout: sinon.stub(),
        stderr: sinon.stub(),
        debug: sinon.stub()
      };
      sinon.stub(_internal, "getLogger").returns(loggerMock);
    });
    it("should resolve with the exit code when the script finishes successfully", async function () {
      const task = { projectRootDir: "/mock/project", name: "mockTask" };
      setTimeout(()=>{
        spawnMock.emit("exit", 0);
      }, 100);
      const result = await _internal.promisifiedSpawn(task, "mockScript.sh", {});
      expect(result).to.equal(0);
    });
    it("should log stdout data", function (done) {
      loggerMock.stdout = (data)=>{
        expect(data).to.equal("mock stdout data\n");
        done();
      };
      _internal.promisifiedSpawn({ projectRootDir: "/mock/project" }, "mockScript.sh", {});
      spawnMock.stdout.emit("data", "mock stdout data\n");
    });
    it("should log stderr data", function (done) {
      loggerMock.stderr = (data)=>{
        expect(data).to.equal("mock stderr data\n");
        done();
      };
      _internal.promisifiedSpawn({ projectRootDir: "/mock/project" }, "mockScript.sh", {});
      spawnMock.stderr.emit("data", "mock stderr data\n");
    });
    it("should reject the promise if an error occurs", async function () {
      setTimeout(()=>{
        spawnMock.emit("error", new Error("Mock error"));
      }, 100);

      try {
        await _internal.promisifiedSpawn({ projectRootDir: "/mock/project" }, "mockScript.sh", {});
        throw new Error("Expected promise to be rejected");
      } catch (err) {
        expect(err.message).to.equal("Mock error");
      }
    });
    it("should reject the promise if the process emits an error event", async function () {
      setTimeout(()=>{
        spawnMock.emit("error", new Error("Mock error"));
      }, 100);

      try {
        await _internal.promisifiedSpawn({ projectRootDir: "/mock/project" }, "mockScript.sh", {});
        throw new Error("Expected promise to be rejected");
      } catch (err) {
        expect(err.message).to.equal("Mock error");
      }
    });
  });
  describe("getExecutersKey", function () {
    it("full task properties", function () {
      const task = {
        projectRootDir: "/mock/project",
        remotehostID: "remoteHost",
        useJobScheduler: true
      };
      const result = _internal.getExecutersKey(task);
      expect(result).to.equal("/mock/project-remoteHost-true");
    });
    it("missing remotehostID", function () {
      const task = {
        projectRootDir: "/mock/project",
        useJobScheduler: false
      };
      const result = _internal.getExecutersKey(task);
      expect(result).to.equal("/mock/project-undefined-false");
    });
    it("missing projectRootDir", function () {
      const task = {
        remotehostID: "remoteHost",
        useJobScheduler: false
      };
      const result = _internal.getExecutersKey(task);
      expect(result).to.equal("undefined-remoteHost-false");
    });
  });
  describe("getMaxNumJob", function () {
    let originalNumJobOnLocal;
    beforeEach(()=>{
      originalNumJobOnLocal = _internal.numJobOnLocal;
      _internal.numJobOnLocal = 5;
    });
    afterEach(()=>{
      _internal.numJobOnLocal = originalNumJobOnLocal;
    });
    it("should return numJobOnLocal if hostinfo is null", function () {
      const result = _internal.getMaxNumJob(null);
      expect(result).to.equal(5);
    });
    it("should return the parsed numJob if it is a valid number", function () {
      const hostinfo = { numJob: "10" };
      const result = _internal.getMaxNumJob(hostinfo);
      expect(result).to.equal(10);
    });
    it("should return 1 if numJob is not a valid number", function () {
      const hostinfo = { numJob: "invalid" };
      const result = _internal.getMaxNumJob(hostinfo);
      expect(result).to.equal(1);
    });
    it("should return at least 1 even if numJob is 0 or negative", function () {
      const hostinfo = { numJob: "0" };
      const result = _internal.getMaxNumJob(hostinfo);
      expect(result).to.equal(1);
      const negativeHostinfo = { numJob: "-5" };
      const negativeResult = _internal.getMaxNumJob(negativeHostinfo);
      expect(negativeResult).to.equal(1);
    });
  });
  describe("createExecuter", function () {
    let mockLogger;
    let RemoteJobExecuter, RemoteTaskExecuter, RemoteJobWebAPIExecuter, LocalTaskExecuter;
    beforeEach(()=>{
      mockLogger = {
        debug: sinon.stub(),
        error: sinon.stub()
      };
      sinon.stub(_internal, "getLogger").returns(mockLogger);
      sinon.stub(_internal, "jobScheduler").value({
        validScheduler: {
          submit: "mockSubmitCommand",
          queueOpt: "--queue=",
          reJobID: "mockJobIDPattern"
        }
      });
      RemoteJobExecuter = _internal.RemoteJobExecuter;
      RemoteTaskExecuter = _internal.RemoteTaskExecuter;
      RemoteJobWebAPIExecuter = _internal.RemoteJobWebAPIExecuter;
      LocalTaskExecuter = _internal.LocalTaskExecuter;
    });
    it("should create a LocalTaskExecuter for a local task", function () {
      const task = { projectRootDir: "/test/project", remotehostID: "localhost", useJobScheduler: false };
      const hostinfo = null;
      const executer = _internal.createExecuter(task, hostinfo);
      expect(executer).to.be.an.instanceof(LocalTaskExecuter);
      expect(mockLogger.debug).to.have.been.calledWith("create new executer for localhost");
    });
    it("should create a RemoteTaskExecuter for a remote task without job scheduler", function () {
      const task = { projectRootDir: "/test/project", remotehostID: "remoteHost", useJobScheduler: false, host: "remoteHost" };
      const hostinfo = { host: "remoteHost", jobScheduler: null };
      const executer = _internal.createExecuter(task, hostinfo);
      expect(executer).to.be.an.instanceof(RemoteTaskExecuter);
      expect(mockLogger.debug).to.have.been.calledWith("create new executer for remoteHost without job scheduler");
    });
    it("should create a RemoteJobExecuter for a remote task using a job scheduler", function () {
      const task = { projectRootDir: "/test/project", remotehostID: "remoteHost", useJobScheduler: true, host: "remoteHost" };
      const hostinfo = { host: "remoteHost", jobScheduler: "validScheduler" };
      const executer = _internal.createExecuter(task, hostinfo);
      expect(executer).to.be.an.instanceof(RemoteJobExecuter);
      expect(mockLogger.debug).to.have.been.calledWith("create new executer for remoteHost with job scheduler");
    });
    it("should create a RemoteJobWebAPIExecuter for a remote task using web API", function () {
      const task = { projectRootDir: "/test/project", remotehostID: "remoteHost", useJobScheduler: true, host: "remoteHost" };
      const hostinfo = { host: "remoteHost", jobScheduler: "validScheduler", useWebAPI: true };
      const executer = _internal.createExecuter(task, hostinfo);
      expect(executer).to.be.an.instanceof(RemoteJobWebAPIExecuter);
      expect(mockLogger.debug).to.have.been.calledWith("create new executer for remoteHost with web API");
    });
    it("should throw an error if an invalid job scheduler is specified", function () {
      const task = { projectRootDir: "/test/project", remotehostID: "remoteHost", useJobScheduler: true };
      const hostinfo = { host: "remoteHost", jobScheduler: "invalidScheduler" };
      expect(()=>{ return _internal.createExecuter(task, hostinfo); }).to.throw("illegal job Scheduler specifies");
      expect(mockLogger.error).to.have.been.calledOnce;
    });
  });
  describe("register", function () {
    let mockExecuter, mockTask, mockHostInfo, mockLogger;
    beforeEach(()=>{
      mockExecuter = {
        submit: sinon.stub().resolves("submitted"),
        setMaxNumJob: sinon.stub(),
        setJS: sinon.stub(),
        setQueues: sinon.stub(),
        setGrpName: sinon.stub()
      };
      mockTask = {
        projectRootDir: "/test/project",
        remotehostID: "remoteHost",
        useJobScheduler: true,
        host: "remoteHost",
        queue: "default"
      };
      mockHostInfo = {
        host: "remoteHost",
        jobScheduler: "validScheduler",
        queue: "default",
        grpName: "testGroup"
      };
      mockLogger = {
        debug: sinon.stub(),
        error: sinon.stub()
      };
      sinon.stub(_internal, "jobScheduler").value({
        validScheduler: {
          submit: "mockSubmitCommand",
          queueOpt: "--queue=",
          reJobID: "mockJobIDPattern"
        }
      });
      _internal.executers.clear();
      sinon.stub(_internal, "getSshHostinfo").returns(mockHostInfo);
      sinon.stub(_internal, "getLogger").returns(mockLogger);
      sinon.stub(_internal, "createExecuter").returns(mockExecuter);
    });
    it("should create a new executer and submit the task", async function () {
      const result = await register(mockTask);
      expect(result).to.equal("submitted");
      expect(_internal.executers.size).to.equal(1);
      expect(_internal.executers.get(`${mockTask.projectRootDir}-${mockTask.remotehostID}-${mockTask.useJobScheduler}`)).to.equal(mockExecuter);
      expect(mockExecuter.submit).to.have.been.calledOnceWith(mockTask);
    });
    it("should reuse existing executer and submit the task", async function () {
      _internal.executers.set(`${mockTask.projectRootDir}-${mockTask.remotehostID}-${mockTask.useJobScheduler}`, mockExecuter);
      const result = await register(mockTask);
      expect(result).to.equal("submitted");
      expect(mockExecuter.submit).to.have.been.calledOnceWith(mockTask);
      expect(mockExecuter.setMaxNumJob).to.have.been.calledOnce;
      expect(mockExecuter.setJS).to.have.been.calledOnce;
      expect(mockExecuter.setQueues).to.have.been.calledOnceWith(mockHostInfo.queue);
      expect(mockExecuter.setGrpName).to.have.been.calledOnceWith(mockHostInfo.grpName);
    });
    it("should throw an error if an invalid job scheduler is specified", async function () {
      _internal.executers.set(`${mockTask.projectRootDir}-${mockTask.remotehostID}-${mockTask.useJobScheduler}`, mockExecuter);
      _internal.getSshHostinfo.returns({ jobScheduler: "invalidScheduler" });
      await expect(register(mockTask)).to.be.rejectedWith(Error, "illegal job scheduler");
    });
  });
  describe("cancel", function () {
    let mockLogger;
    beforeEach(()=>{
      _internal.executers.clear();
      mockLogger = {
        warn: sinon.stub()
      };
      sinon.stub(_internal, "getLogger").returns(mockLogger);
      sinon.stub(_internal, "remoteHost").value({
        getID: sinon.stub().returns("localhost")
      });
    });
    it("should return false if task does not have sbsID", function () {
      const task = {
        projectRootDir: "/test/project",
        remotehostID: "localhost",
        useJobScheduler: false
      };
      const result = executerManager.cancel(task);
      expect(result).to.be.false;
    });
    it("should return false if executer is not found", function () {
      const task = {
        projectRootDir: "/test/project",
        remotehostID: "remoteHost",
        useJobScheduler: true,
        sbsID: "12345",
        host: "nonexistent"
      };
      const result = executerManager.cancel(task);
      expect(result).to.be.false;
      expect(mockLogger.warn).to.have.been.calledWith(
        "executer for",
        "localhost",
        " with job scheduler",
        true,
        "is not found"
      );
    });
  });
});