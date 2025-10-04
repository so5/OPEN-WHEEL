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


describe.skip("#removeComponentPath", ()=>{
  let removeComponentPath;
  let readJsonGreedyMock;
  let writeJsonWrapperMock;
  let gitAddMock;
  let pathExistsMock;

  beforeEach(()=>{
    removeComponentPath = projectFilesOperator._internal.removeComponentPath;

    readJsonGreedyMock = sinon.stub();
    writeJsonWrapperMock = sinon.stub();
    gitAddMock = sinon.stub();
    pathExistsMock = sinon.stub();

    projectFilesOperator._internal.readJsonGreedy = readJsonGreedyMock;
    projectFilesOperator._internal.writeJsonWrapper = writeJsonWrapperMock;
    projectFilesOperator._internal.gitAdd = gitAddMock;
    projectFilesOperator._internal.fs = { pathExists: pathExistsMock };
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should remove specified component IDs from componentPath and update the project JSON", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockProjectJson = {
      componentPath: {
        comp1: "path/to/comp1",
        comp2: "path/to/comp2",
        comp3: "path/to/comp3"
      }
    };
    const IDsToRemove = ["comp2"];

    readJsonGreedyMock.resolves(mockProjectJson);
    writeJsonWrapperMock.resolves();
    gitAddMock.resolves();
    pathExistsMock.resolves(false);

    await removeComponentPath(mockProjectRootDir, IDsToRemove);

    expect(readJsonGreedyMock.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(writeJsonWrapperMock.calledOnceWithExactly(
      path.resolve(mockProjectRootDir, "prj.wheel.json"),
      {
        componentPath: {
          comp1: "path/to/comp1",
          comp3: "path/to/comp3"
        }
      }
    )).to.be.true;
    expect(gitAddMock.calledOnceWithExactly(
      mockProjectRootDir,
      path.resolve(mockProjectRootDir, "prj.wheel.json")
    )).to.be.true;
  });

  it("should not remove components if their directories exist and force is false", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockProjectJson = {
      componentPath: {
        comp1: "path/to/comp1",
        comp2: "path/to/comp2"
      }
    };
    const IDsToRemove = ["comp2"];

    readJsonGreedyMock.resolves(mockProjectJson);
    writeJsonWrapperMock.resolves();
    gitAddMock.resolves();
    pathExistsMock.resolves(true);

    await removeComponentPath(mockProjectRootDir, IDsToRemove, false);

    expect(readJsonGreedyMock.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(writeJsonWrapperMock.calledOnceWithExactly(
      path.resolve(mockProjectRootDir, "prj.wheel.json"),
      {
        componentPath: {
          comp1: "path/to/comp1",
          comp2: "path/to/comp2"
        }
      }
    )).to.be.true;
    expect(gitAddMock.calledOnceWithExactly(
      mockProjectRootDir,
      path.resolve(mockProjectRootDir, "prj.wheel.json")
    )).to.be.true;
  });

  it("should forcefully remove components even if their directories exist when force is true", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockProjectJson = {
      componentPath: {
        comp1: "path/to/comp1",
        comp2: "path/to/comp2"
      }
    };
    const IDsToRemove = ["comp2"];

    readJsonGreedyMock.resolves(mockProjectJson);
    writeJsonWrapperMock.resolves();
    gitAddMock.resolves();
    pathExistsMock.resolves(true);

    await removeComponentPath(mockProjectRootDir, IDsToRemove, true);

    expect(readJsonGreedyMock.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(writeJsonWrapperMock.calledOnceWithExactly(
      path.resolve(mockProjectRootDir, "prj.wheel.json"),
      {
        componentPath: {
          comp1: "path/to/comp1"
        }
      }
    )).to.be.true;
    expect(gitAddMock.calledOnceWithExactly(
      mockProjectRootDir,
      path.resolve(mockProjectRootDir, "prj.wheel.json")
    )).to.be.true;
  });

  it("should handle an empty componentPath gracefully", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockProjectJson = { componentPath: {} };
    const IDsToRemove = ["comp1"];

    readJsonGreedyMock.resolves(mockProjectJson);
    writeJsonWrapperMock.resolves();
    gitAddMock.resolves();

    await removeComponentPath(mockProjectRootDir, IDsToRemove);

    expect(readJsonGreedyMock.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(writeJsonWrapperMock.calledOnceWithExactly(
      path.resolve(mockProjectRootDir, "prj.wheel.json"),
      { componentPath: {} }
    )).to.be.true;
    expect(gitAddMock.calledOnceWithExactly(
      mockProjectRootDir,
      path.resolve(mockProjectRootDir, "prj.wheel.json")
    )).to.be.true;
  });

  it("should throw an error if reading the project JSON fails", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const IDsToRemove = ["comp1"];

    const mockError = new Error("Read error");
    readJsonGreedyMock.rejects(mockError);

    try {
      await removeComponentPath(mockProjectRootDir, IDsToRemove);
      throw new Error("Expected removeComponentPath to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readJsonGreedyMock.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(writeJsonWrapperMock.notCalled).to.be.true;
    expect(gitAddMock.notCalled).to.be.true;
  });
});
