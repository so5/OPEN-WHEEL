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


describe.skip("#createNewProject", ()=>{
  let createNewProject;
  let getUnusedProjectDirMock;
  let gitInitMock;
  let writeComponentJsonMock;
  let writeJsonWrapperMock;
  let gitAddMock;
  let gitCommitMock;
  let fsMock;

  beforeEach(()=>{
    createNewProject = projectFilesOperator._internal.createNewProject;

    getUnusedProjectDirMock = sinon.stub();
    gitInitMock = sinon.stub();
    writeComponentJsonMock = sinon.stub();
    writeJsonWrapperMock = sinon.stub();
    gitAddMock = sinon.stub();
    gitCommitMock = sinon.stub();

    fsMock = {
      ensureDir: sinon.stub()
    };

    projectFilesOperator._internal.getUnusedProjectDir = getUnusedProjectDirMock;
    projectFilesOperator._internal.gitInit = gitInitMock;
    projectFilesOperator._internal.writeComponentJson = writeComponentJsonMock;
    projectFilesOperator._internal.writeJsonWrapper = writeJsonWrapperMock;
    projectFilesOperator._internal.gitAdd = gitAddMock;
    projectFilesOperator._internal.gitCommit = gitCommitMock;
    projectFilesOperator._internal.fs = fsMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should create a new project with a unique directory and initialize it", async ()=>{
    const mockRootDir = "/mock/project/root";
    const mockProjectName = "test_project";
    const mockDescription = "Mock project description";
    const mockUser = "test_user";
    const mockMail = "test@example.com";
    const mockTimestamp = "20250102-120000";

    getUnusedProjectDirMock.resolves(mockRootDir);
    gitInitMock.resolves();
    writeComponentJsonMock.resolves();
    writeJsonWrapperMock.resolves();
    gitAddMock.resolves();
    gitCommitMock.resolves();

    fsMock.ensureDir.resolves();

    const getDateStringMock = sinon.stub().returns(mockTimestamp);
    projectFilesOperator._internal.getDateString = getDateStringMock;

    const result = await createNewProject(mockRootDir, mockProjectName, mockDescription, mockUser, mockMail);

    expect(result).to.equal(mockRootDir);
    expect(getUnusedProjectDirMock.calledOnceWithExactly(mockRootDir, mockProjectName)).to.be.true;
    expect(fsMock.ensureDir.calledOnceWithExactly(mockRootDir)).to.be.true;
    expect(gitInitMock.calledOnceWithExactly(mockRootDir, mockUser, mockMail)).to.be.true;
    expect(writeComponentJsonMock.calledOnce).to.be.true;
    expect(writeJsonWrapperMock.calledOnce).to.be.true;
    expect(gitAddMock.calledOnceWithExactly(mockRootDir, "./")).to.be.true;
    expect(gitCommitMock.calledOnceWithExactly(mockRootDir, "create new project")).to.be.true;
  });

  it("should handle errors during project creation", async ()=>{
    const mockRootDir = "/mock/project/root";
    const mockProjectName = "test_project";
    const mockDescription = "Mock project description";
    const mockUser = "test_user";
    const mockMail = "test@example.com";

    getUnusedProjectDirMock.rejects(new Error("Directory error"));

    try {
      await createNewProject(mockRootDir, mockProjectName, mockDescription, mockUser, mockMail);
      throw new Error("Expected createNewProject to throw");
    } catch (err) {
      expect(err.message).to.equal("Directory error");
    }

    expect(getUnusedProjectDirMock.calledOnceWithExactly(mockRootDir, mockProjectName)).to.be.true;

    expect(fsMock.ensureDir.called).to.be.false;
    expect(gitInitMock.called).to.be.false;
  });
});
