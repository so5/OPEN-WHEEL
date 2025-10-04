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


describe.skip("#updateProjectDescription", ()=>{
  let updateProjectDescription;
  let readJsonGreedyMock;
  let writeJsonWrapperMock;
  let gitAddMock;

  beforeEach(()=>{
    updateProjectDescription = projectFilesOperator._internal.updateProjectDescription;

    readJsonGreedyMock = sinon.stub();
    writeJsonWrapperMock = sinon.stub();
    gitAddMock = sinon.stub();

    projectFilesOperator._internal.readJsonGreedy = readJsonGreedyMock;
    projectFilesOperator._internal.writeJsonWrapper = writeJsonWrapperMock;
    projectFilesOperator._internal.gitAdd = gitAddMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should update the description in the project JSON and stage the changes", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockDescription = "New project description";
    const mockProjectJson = { name: "test_project", version: 2, description: "Old description" };

    readJsonGreedyMock.resolves(mockProjectJson);
    writeJsonWrapperMock.resolves();
    gitAddMock.resolves();

    await updateProjectDescription(mockProjectRootDir, mockDescription);

    expect(readJsonGreedyMock.calledOnceWithExactly(
      path.resolve(mockProjectRootDir, "prj.wheel.json")
    )).to.be.true;

    expect(writeJsonWrapperMock.calledOnceWithExactly(
      path.resolve(mockProjectRootDir, "prj.wheel.json"),
      { ...mockProjectJson, description: mockDescription }
    )).to.be.true;

    expect(gitAddMock.calledOnceWithExactly(
      mockProjectRootDir,
      path.resolve(mockProjectRootDir, "prj.wheel.json")
    )).to.be.true;
  });

  it("should throw an error if reading the JSON fails", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockDescription = "New project description";
    const mockError = new Error("Failed to read JSON");

    readJsonGreedyMock.rejects(mockError);

    try {
      await updateProjectDescription(mockProjectRootDir, mockDescription);
      throw new Error("Expected updateProjectDescription to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readJsonGreedyMock.calledOnce).to.be.true;
    expect(writeJsonWrapperMock.notCalled).to.be.true;
    expect(gitAddMock.notCalled).to.be.true;
  });

  it("should throw an error if writing the JSON fails", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockDescription = "New project description";
    const mockProjectJson = { name: "test_project", version: 2, description: "Old description" };
    const mockError = new Error("Failed to write JSON");

    readJsonGreedyMock.resolves(mockProjectJson);
    writeJsonWrapperMock.rejects(mockError);

    try {
      await updateProjectDescription(mockProjectRootDir, mockDescription);
      throw new Error("Expected updateProjectDescription to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readJsonGreedyMock.calledOnce).to.be.true;
    expect(writeJsonWrapperMock.calledOnce).to.be.true;
    expect(gitAddMock.notCalled).to.be.true;
  });

  it("should throw an error if gitAdd fails", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockDescription = "New project description";
    const mockProjectJson = { name: "test_project", version: 2, description: "Old description" };
    const mockError = new Error("Failed to stage changes");

    readJsonGreedyMock.resolves(mockProjectJson);
    writeJsonWrapperMock.resolves();
    gitAddMock.rejects(mockError);

    try {
      await updateProjectDescription(mockProjectRootDir, mockDescription);
      throw new Error("Expected updateProjectDescription to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readJsonGreedyMock.calledOnce).to.be.true;
    expect(writeJsonWrapperMock.calledOnce).to.be.true;
    expect(gitAddMock.calledOnce).to.be.true;
  });
});
