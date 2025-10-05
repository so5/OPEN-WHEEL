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

describe("#setProjectState", ()=>{
  let setProjectState;
  let readJsonGreedyMock;
  let writeJsonWrapperMock;
  let gitAddMock;
  let getDateStringMock;

  beforeEach(()=>{
    setProjectState = projectFilesOperator._internal.setProjectState;

    readJsonGreedyMock = sinon.stub();
    writeJsonWrapperMock = sinon.stub();
    gitAddMock = sinon.stub();
    getDateStringMock = sinon.stub().returns("20250101-123456");

    projectFilesOperator._internal.readJsonGreedy = readJsonGreedyMock;
    projectFilesOperator._internal.writeJsonWrapper = writeJsonWrapperMock;
    projectFilesOperator._internal.gitAdd = gitAddMock;
    projectFilesOperator._internal.getDateString = getDateStringMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should update the project state if it is different and return the updated metadata", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockState = "running";
    const mockMetadata = {
      state: "not-started",
      mtime: "20240101-000000"
    };

    readJsonGreedyMock.resolves(mockMetadata);

    const updatedMetadata = {
      ...mockMetadata,
      state: mockState,
      mtime: "20250101-123456"
    };

    const result = await setProjectState(mockProjectRootDir, mockState, false);

    expect(result).to.deep.equal(updatedMetadata);
    expect(writeJsonWrapperMock.calledOnceWithExactly(
          `${mockProjectRootDir}/prj.wheel.json`,
          updatedMetadata
    )).to.be.true;
    expect(gitAddMock.calledOnceWithExactly(mockProjectRootDir, `${mockProjectRootDir}/prj.wheel.json`)).to.be.true;
  });

  it("should not update the project state if it is the same and force is false", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockState = "not-started";
    const mockMetadata = {
      state: "not-started",
      mtime: "20240101-000000"
    };

    readJsonGreedyMock.resolves(mockMetadata);

    const result = await setProjectState(mockProjectRootDir, mockState, false);

    expect(result).to.be.false;
    expect(writeJsonWrapperMock.notCalled).to.be.true;
    expect(gitAddMock.notCalled).to.be.true;
  });

  it("should force update the project state even if it is the same", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockState = "not-started";
    const mockMetadata = {
      state: "not-started",
      mtime: "20240101-000000"
    };

    readJsonGreedyMock.resolves(mockMetadata);

    const updatedMetadata = {
      ...mockMetadata,
      mtime: "20250101-123456"
    };

    const result = await setProjectState(mockProjectRootDir, mockState, true);

    expect(result).to.deep.equal(updatedMetadata);
    expect(writeJsonWrapperMock.calledOnceWithExactly(
          `${mockProjectRootDir}/prj.wheel.json`,
          updatedMetadata
    )).to.be.true;
    expect(gitAddMock.calledOnceWithExactly(mockProjectRootDir, `${mockProjectRootDir}/prj.wheel.json`)).to.be.true;
  });

  it("should throw an error if readJsonGreedy fails", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockError = new Error("Read error");

    readJsonGreedyMock.rejects(mockError);

    try {
      await setProjectState(mockProjectRootDir, "running", false);
      throw new Error("Expected setProjectState to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }
  });

  it("should throw an error if writeJsonWrapper fails", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockState = "running";
    const mockMetadata = {
      state: "not-started",
      mtime: "20240101-000000"
    };

    readJsonGreedyMock.resolves(mockMetadata);
    writeJsonWrapperMock.rejects(new Error("Write error"));

    try {
      await setProjectState(mockProjectRootDir, mockState, false);
      throw new Error("Expected setProjectState to throw");
    } catch (err) {
      expect(err.message).to.equal("Write error");
    }
  });
});
