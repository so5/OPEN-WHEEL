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
const projectFilesOperator = require("../../../../app/core/projectFilesOperator.js");

describe("#renameProject", ()=>{
  let renameProject;
  let isValidNameMock;
  let readJsonGreedyMock;
  let writeProjectJsonMock;
  let writeComponentJsonMock;
  let gitCommitMock;

  beforeEach(()=>{
    renameProject = projectFilesOperator._internal.renameProject;

    isValidNameMock = sinon.stub(projectFilesOperator._internal, "isValidName");
    sinon.stub(projectFilesOperator._internal.fs, "move").resolves();
    sinon.stub(projectFilesOperator._internal.fs, "pathExists").resolves(false);
    readJsonGreedyMock = sinon.stub(projectFilesOperator._internal, "readJsonGreedy");
    writeProjectJsonMock = sinon.stub(projectFilesOperator._internal, "writeProjectJson");
    writeComponentJsonMock = sinon.stub(projectFilesOperator._internal, "writeComponentJson");
    gitCommitMock = sinon.stub(projectFilesOperator._internal, "gitCommit");
    sinon.stub(projectFilesOperator._internal.projectList, "get");
    sinon.stub(projectFilesOperator._internal.projectList, "update");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should rename a project successfully", async ()=>{
    const mockId = "1234";
    const mockOldDir = "/old/project/path";
    const mockNewName = "newProjectName";
    const mockNewDir = "/old/project/newProjectName";
    const mockProjectJson = { name: "oldProjectName" };
    const mockRootWorkflow = { name: "oldWorkflowName" };
    const mockProjectListEntry = { id: mockId, path: mockOldDir };

    isValidNameMock.returns(true);
    projectFilesOperator._internal.fs.pathExists.resolves(false);
    projectFilesOperator._internal.fs.move.resolves();
    readJsonGreedyMock.onCall(0).resolves(mockProjectJson);
    readJsonGreedyMock.onCall(1).resolves(mockRootWorkflow);
    writeProjectJsonMock.resolves();
    writeComponentJsonMock.resolves();
    gitCommitMock.resolves();
    projectFilesOperator._internal.projectList.get.returns(mockProjectListEntry);

    await renameProject(mockId, mockNewName, mockOldDir);

    expect(isValidNameMock.calledOnceWithExactly(mockNewName)).to.be.true;
    expect(projectFilesOperator._internal.fs.pathExists.calledOnceWithExactly(`${mockNewDir}.wheel`)).to.be.true;
    expect(projectFilesOperator._internal.fs.move.calledOnceWithExactly(mockOldDir, `${mockNewDir}.wheel`)).to.be.true;
    expect(readJsonGreedyMock.calledTwice).to.be.true;
    expect(writeProjectJsonMock.calledOnce).to.be.true;
    expect(writeComponentJsonMock.calledOnce).to.be.true;
    expect(gitCommitMock.calledOnce).to.be.true;
    expect(projectFilesOperator._internal.projectList.get.calledOnceWithExactly(mockId)).to.be.true;
    expect(projectFilesOperator._internal.projectList.update.calledOnceWithExactly({ id: mockId, path: `${mockNewDir}.wheel` })).to.be.true;
  });

  it("should throw an error if the new name is invalid", async ()=>{
    const mockId = "1234";
    const mockOldDir = "/old/project/path";
    const mockNewName = "invalid/name";

    isValidNameMock.returns(false);

    try {
      await renameProject(mockId, mockNewName, mockOldDir);
      throw new Error("Expected renameProject to throw");
    } catch (err) {
      expect(err.message).to.equal("illegal project name");
      expect(isValidNameMock.calledOnceWithExactly(mockNewName)).to.be.true;
    }
  });

  it("should throw an error if the new directory already exists", async ()=>{
    const mockId = "1234";
    const mockOldDir = "/old/project/path";
    const mockNewName = "existingProjectName";
    const mockNewDir = "/old/project/existingProjectName";

    isValidNameMock.returns(true);
    projectFilesOperator._internal.fs.pathExists.withArgs(`${mockNewDir}.wheel`).resolves(true);

    try {
      await renameProject(mockId, mockNewName, mockOldDir);
      throw new Error("Expected renameProject to throw");
    } catch (err) {
      expect(err.message).to.equal("already exists");
      expect(isValidNameMock.calledOnceWithExactly(mockNewName)).to.be.true;
    }
  });

  it("should handle file system errors during directory move", async ()=>{
    const mockId = "1234";
    const mockOldDir = "/old/project/path";
    const mockNewName = "validProjectName";
    const mockNewDir = "/old/project/validProjectName";

    isValidNameMock.returns(true);
    projectFilesOperator._internal.fs.pathExists.resolves(false);
    projectFilesOperator._internal.fs.move.rejects(new Error("File system error"));

    try {
      await renameProject(mockId, mockNewName, mockOldDir);
      throw new Error("Expected renameProject to throw");
    } catch (err) {
      expect(err.message).to.equal("File system error");
      expect(projectFilesOperator._internal.fs.pathExists.calledOnceWithExactly(`${mockNewDir}.wheel`)).to.be.true;
      expect(isValidNameMock.calledOnceWithExactly(mockNewName)).to.be.true;
      expect(projectFilesOperator._internal.fs.move.calledOnceWithExactly(mockOldDir, `${mockNewDir}.wheel`)).to.be.true;
    }
  });
});
