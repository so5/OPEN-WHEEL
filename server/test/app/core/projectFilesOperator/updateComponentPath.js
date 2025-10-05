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

describe("#updateComponentPath", ()=>{
  let updateComponentPath;
  let readJsonGreedyMock;
  let writeJsonWrapperMock;
  let gitAddMock;

  beforeEach(()=>{
    readJsonGreedyMock = sinon.stub();
    writeJsonWrapperMock = sinon.stub();
    gitAddMock = sinon.stub();

    projectFilesOperator._internal.readJsonGreedy = readJsonGreedyMock;
    projectFilesOperator._internal.writeJsonWrapper = writeJsonWrapperMock;
    projectFilesOperator._internal.gitAdd = gitAddMock;

    updateComponentPath = projectFilesOperator._internal.updateComponentPath;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should add a new componentPath entry for a new ID", async ()=>{
    const projectRootDir = "/mock/project/root";
    const ID = "newID";
    const absPath = "/mock/project/root/newComponent";
    const mockProjectJson = { componentPath: {} };

    readJsonGreedyMock.resolves(mockProjectJson);
    writeJsonWrapperMock.resolves();
    gitAddMock.resolves();

    const result = await updateComponentPath(projectRootDir, ID, absPath);

    expect(readJsonGreedyMock.calledOnceWithExactly(`${projectRootDir}/prj.wheel.json`)).to.be.true;
    expect(writeJsonWrapperMock.calledOnceWithExactly(
          `${projectRootDir}/prj.wheel.json`,
          { componentPath: { newID: "./newComponent" } }
    )).to.be.true;
    expect(gitAddMock.calledOnceWithExactly(projectRootDir, `${projectRootDir}/prj.wheel.json`)).to.be.true;
    expect(result).to.deep.equal({ newID: "./newComponent" });
  });

  it("should update descendants paths when ID exists", async ()=>{
    const projectRootDir = "/mock/project/root";
    const ID = "existingID";
    const absPath = "/mock/project/root/newPath";
    const mockProjectJson = {
      componentPath: {
        existingID: "./oldPath",
        childID: "./oldPath/child"
      }
    };

    readJsonGreedyMock.resolves(mockProjectJson);
    writeJsonWrapperMock.resolves();
    gitAddMock.resolves();

    const result = await updateComponentPath(projectRootDir, ID, absPath);

    expect(writeJsonWrapperMock.calledOnceWithExactly(
          `${projectRootDir}/prj.wheel.json`,
          { componentPath: { existingID: "./newPath", childID: "./newPath/child" } }
    )).to.be.true;
    expect(gitAddMock.calledOnceWithExactly(projectRootDir, `${projectRootDir}/prj.wheel.json`)).to.be.true;
    expect(result).to.deep.equal({
      existingID: "./newPath",
      childID: "./newPath/child"
    });
  });

  it("should throw an error if readJsonGreedy fails", async ()=>{
    const projectRootDir = "/mock/project/root";
    const ID = "someID";
    const absPath = "/mock/project/root/somePath";

    readJsonGreedyMock.rejects(new Error("File not found"));

    try {
      await updateComponentPath(projectRootDir, ID, absPath);
      throw new Error("Expected updateComponentPath to throw");
    } catch (err) {
      expect(err.message).to.equal("File not found");
    }

    expect(readJsonGreedyMock.calledOnceWithExactly(`${projectRootDir}/prj.wheel.json`)).to.be.true;
  });

  it("should normalize paths correctly", async ()=>{
    const projectRootDir = "/mock/project/root";
    const ID = "normalizeTestID";
    const absPath = "/mock/project/root//normalizedPath/";
    const mockProjectJson = { componentPath: {} };

    readJsonGreedyMock.resolves(mockProjectJson);
    writeJsonWrapperMock.resolves();
    gitAddMock.resolves();

    const result = await updateComponentPath(projectRootDir, ID, absPath);

    expect(writeJsonWrapperMock.calledOnceWithExactly(
          `${projectRootDir}/prj.wheel.json`,
          { componentPath: { normalizeTestID: "./normalizedPath" } }
    )).to.be.true;
    expect(gitAddMock.calledOnceWithExactly(projectRootDir, `${projectRootDir}/prj.wheel.json`)).to.be.true;
    expect(result).to.deep.equal({ normalizeTestID: "./normalizedPath" });
  });
});
