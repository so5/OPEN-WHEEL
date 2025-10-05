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

describe("#createNewProject", ()=>{
  let getUnusedProjectDirStub;
  let ensureDirStub;
  let gitInitStub;
  let componentFactoryStub;
  let writeComponentJsonStub;
  let getDateStringStub;
  let writeJsonWrapperStub;
  let gitAddStub;
  let gitCommitStub;
  let getLoggerStub;
  let debugStub;

  const mockRootDir = "/mock/project/root";
  const mockProjectName = "test_project";
  const mockDescription = "Mock project description";
  const mockUser = "test_user";
  const mockMail = "test@example.com";
  const mockTimestamp = "20250102-120000";
  const mockRootWorkflow = { ID: "root-id", name: "workflowName" };

  beforeEach(()=>{
    getUnusedProjectDirStub = sinon.stub(projectFilesOperator._internal, "getUnusedProjectDir").resolves(mockRootDir);
    ensureDirStub = sinon.stub(projectFilesOperator._internal.fs, "ensureDir").resolves();
    gitInitStub = sinon.stub(projectFilesOperator._internal, "gitInit").resolves();
    componentFactoryStub = sinon.stub(projectFilesOperator._internal, "componentFactory").returns(mockRootWorkflow);
    writeComponentJsonStub = sinon.stub(projectFilesOperator._internal, "writeComponentJson").resolves();
    getDateStringStub = sinon.stub(projectFilesOperator._internal, "getDateString").returns(mockTimestamp);
    writeJsonWrapperStub = sinon.stub(projectFilesOperator._internal, "writeJsonWrapper").resolves();
    gitAddStub = sinon.stub(projectFilesOperator._internal, "gitAdd").resolves();
    gitCommitStub = sinon.stub(projectFilesOperator._internal, "gitCommit").resolves();
    debugStub = sinon.spy();
    getLoggerStub = sinon.stub(projectFilesOperator._internal, "getLogger").returns({ debug: debugStub });
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should create a new project with a unique directory and initialize it", async ()=>{
    const result = await projectFilesOperator._internal.createNewProject(mockRootDir, mockProjectName, mockDescription, mockUser, mockMail);

    expect(result).to.equal(mockRootDir);
    expect(getUnusedProjectDirStub.calledOnceWith(mockRootDir, mockProjectName)).to.be.true;
    expect(ensureDirStub.calledOnceWith(mockRootDir)).to.be.true;
    expect(gitInitStub.calledOnceWith(mockRootDir, mockUser, mockMail)).to.be.true;
    expect(writeComponentJsonStub.calledOnce).to.be.true;
    expect(writeJsonWrapperStub.calledOnce).to.be.true;
    expect(gitAddStub.calledOnceWith(mockRootDir, "./")).to.be.true;
    expect(gitCommitStub.calledOnceWith(mockRootDir, "create new project")).to.be.true;
  });

  it("should handle errors during project creation and not proceed", async ()=>{
    const dirError = new Error("Directory error");
    getUnusedProjectDirStub.rejects(dirError);

    try {
      await projectFilesOperator._internal.createNewProject(mockRootDir, mockProjectName, mockDescription, mockUser, mockMail);
      throw new Error("Expected createNewProject to throw");
    } catch (err) {
      expect(err).to.equal(dirError);
    }

    expect(getUnusedProjectDirStub.calledOnce).to.be.true;
    expect(ensureDirStub.notCalled).to.be.true;
    expect(gitInitStub.notCalled).to.be.true;
    expect(writeComponentJsonStub.notCalled).to.be.true;
  });
});