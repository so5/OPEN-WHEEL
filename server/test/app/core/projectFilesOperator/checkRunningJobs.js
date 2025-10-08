/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const projectFilesOperator = require("../../../../app/core/projectFilesOperator.js");

describe("#checkRunningJobs", ()=>{
  let globStub;
  let readJsonStub;
  let loggerWarnStub;

  beforeEach(()=>{
    globStub = sinon.stub(projectFilesOperator._internal, "glob");
    readJsonStub = sinon.stub(projectFilesOperator._internal.fs, "readJson");
    loggerWarnStub = sinon.spy();
    sinon.stub(projectFilesOperator._internal, "getLogger").returns({ warn: loggerWarnStub });
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return tasks and jmFiles when all job manager files are valid", async ()=>{
    const projectRootDir = "/mock/project/root";
    const mockFiles = ["job1.json", "job2.json"];
    const mockTask1 = [{ id: 1, name: "Task1" }];
    const mockTask2 = [{ id: 2, name: "Task2" }];

    globStub.resolves(mockFiles);
    readJsonStub.onFirstCall().resolves(mockTask1);
    readJsonStub.onSecondCall().resolves(mockTask2);

    const result = await projectFilesOperator._internal.checkRunningJobs(projectRootDir);

    expect(result.tasks).to.deep.equal([...mockTask1, ...mockTask2]);
    expect(result.jmFiles).to.deep.equal(mockFiles);
    expect(loggerWarnStub.notCalled).to.be.true;
  });

  it("should handle and log errors for invalid job manager files", async ()=>{
    const projectRootDir = "/mock/project/root";
    const mockFiles = ["job1.json", "job2.json"];
    const mockTask = [{ id: 1, name: "Task1" }];
    const readError = new Error("Invalid JSON");

    globStub.resolves(mockFiles);
    readJsonStub.onFirstCall().resolves(mockTask);
    readJsonStub.onSecondCall().rejects(readError);

    const result = await projectFilesOperator._internal.checkRunningJobs(projectRootDir);

    expect(result.tasks).to.deep.equal(mockTask);
    expect(result.jmFiles).to.deep.equal(["job1.json"]);
    expect(loggerWarnStub.calledOnce).to.be.true;
    expect(loggerWarnStub.firstCall.args).to.deep.equal(["read job manager file failed", readError]);
  });

  it("should return empty tasks and jmFiles when no job manager files are found", async ()=>{
    const projectRootDir = "/mock/project/root";
    globStub.resolves([]);

    const result = await projectFilesOperator._internal.checkRunningJobs(projectRootDir);

    expect(result.tasks).to.deep.equal([]);
    expect(result.jmFiles).to.deep.equal([]);
    expect(loggerWarnStub.notCalled).to.be.true;
  });

  it("should skip files that do not contain a valid task array", async ()=>{
    const projectRootDir = "/mock/project/root";
    const mockFiles = ["job1.json", "job2.json", "job3.json"];
    const validTask = [{ id: 1, name: "Task1" }];

    globStub.resolves(mockFiles);
    readJsonStub.withArgs("/mock/project/root/job1.json").resolves([]); //empty array
    readJsonStub.withArgs("/mock/project/root/job2.json").resolves({ notArray: true }); //not an array
    readJsonStub.withArgs("/mock/project/root/job3.json").resolves(validTask);

    const result = await projectFilesOperator._internal.checkRunningJobs(projectRootDir);

    expect(result.tasks).to.deep.equal(validTask);
    expect(result.jmFiles).to.deep.equal(["job3.json"]);
    expect(loggerWarnStub.notCalled).to.be.true;
  });
});
