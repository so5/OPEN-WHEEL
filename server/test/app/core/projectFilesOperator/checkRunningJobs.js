/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it } = require("mocha");
const sinon = require("sinon");
const path = require("path");
const { promisify } = require("util");
const projectFilesOperator = require("../../../app/core/projectFilesOperator.js");


describe.skip("#checkRunningJobs", ()=>{
  let checkRunningJobs;
  let globStub;
  let fsStub;
  let getLoggerStub;

  beforeEach(()=>{
    checkRunningJobs = projectFilesOperator._internal.checkRunningJobs;

    globStub = sinon.stub();
    fsStub = {
      readJson: sinon.stub()
    };
    getLoggerStub = {
      warn: sinon.spy()
    };

    projectFilesOperator._internal.promisify = ()=>globStub;
    projectFilesOperator._internal.fs = fsStub;
    projectFilesOperator._internal.getLogger = ()=>getLoggerStub;
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
    fsStub.readJson.onFirstCall().resolves(mockTask1);
    fsStub.readJson.onSecondCall().resolves(mockTask2);

    const result = await checkRunningJobs(projectRootDir);

    expect(result.tasks).to.deep.equal([...mockTask1, ...mockTask2]);
    expect(result.jmFiles).to.deep.equal(mockFiles);
    expect(getLoggerStub.warn.notCalled).to.be.true;
  });

  it("should handle and log errors for invalid job manager files", async ()=>{
    const projectRootDir = "/mock/project/root";
    const mockFiles = ["job1.json", "job2.json"];
    const mockTask = [{ id: 1, name: "Task1" }];

    globStub.resolves(mockFiles);
    fsStub.readJson.onFirstCall().resolves(mockTask);
    fsStub.readJson.onSecondCall().rejects(new Error("Invalid JSON"));

    const result = await checkRunningJobs(projectRootDir);

    expect(result.tasks).to.deep.equal(mockTask);
    expect(result.jmFiles).to.deep.equal(["job1.json"]);
    expect(getLoggerStub.warn.calledOnce).to.be.true;
    expect(getLoggerStub.warn.firstCall.args[0]).to.equal("read job manager file failed");
  });

  it("should return empty tasks and jmFiles when no job manager files are found", async ()=>{
    const projectRootDir = "/mock/project/root";

    globStub.resolves([]);

    const result = await checkRunningJobs(projectRootDir);

    expect(result.tasks).to.deep.equal([]);
    expect(result.jmFiles).to.deep.equal([]);
    expect(getLoggerStub.warn.notCalled).to.be.true;
  });

  it("should skip files without valid task arrays", async ()=>{
    const projectRootDir = "/mock/project/root";
    const mockFiles = ["job1.json", "job2.json"];
    const mockInvalidContent = { notArray: true };

    globStub.resolves(mockFiles);
    fsStub.readJson.onFirstCall().resolves([]);
    fsStub.readJson.onSecondCall().resolves(mockInvalidContent);

    const result = await checkRunningJobs(projectRootDir);

    expect(result.tasks).to.deep.equal([]);
    expect(result.jmFiles).to.deep.equal([]);
    expect(getLoggerStub.warn.notCalled).to.be.true;
  });
});
