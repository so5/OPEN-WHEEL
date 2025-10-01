/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const path = require("path");
const projectFilesOperator = require("../../../../app/core/projectFilesOperator.js");

describe("#removeComponentPath", ()=>{
  let readJsonGreedyStub;
  let writeJsonWrapperStub;
  let gitAddStub;
  let pathExistsStub;
  const projectRootDir = "/mock/project/root";
  const projectJsonPath = path.resolve(projectRootDir, "prj.wheel.json");

  beforeEach(()=>{
    readJsonGreedyStub = sinon.stub(projectFilesOperator._internal, "readJsonGreedy");
    writeJsonWrapperStub = sinon.stub(projectFilesOperator._internal, "writeJsonWrapper").resolves();
    gitAddStub = sinon.stub(projectFilesOperator._internal, "gitAdd").resolves();
    pathExistsStub = sinon.stub(projectFilesOperator._internal.fs, "pathExists");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should remove specified component IDs if their paths do not exist", async ()=>{
    const projectJson = { componentPath: { comp1: "path1", comp2: "path2", comp3: "path3" } };
    readJsonGreedyStub.resolves(projectJson);
    pathExistsStub.resolves(false); //All paths do not exist

    await projectFilesOperator._internal.removeComponentPath(projectRootDir, ["comp2"]);

    expect(readJsonGreedyStub.calledOnceWith(projectJsonPath)).to.be.true;
    const expectedJson = { componentPath: { comp1: "path1", comp3: "path3" } };
    expect(writeJsonWrapperStub.calledOnceWith(projectJsonPath, expectedJson)).to.be.true;
    expect(gitAddStub.calledOnceWith(projectRootDir, projectJsonPath)).to.be.true;
  });

  it("should not remove components if their directories exist and force is false", async ()=>{
    const projectJson = { componentPath: { comp1: "path1", comp2: "path2" } };
    readJsonGreedyStub.resolves(projectJson);
    pathExistsStub.resolves(true); //All paths exist

    await projectFilesOperator._internal.removeComponentPath(projectRootDir, ["comp2"], false);

    const expectedJson = { componentPath: { comp1: "path1", comp2: "path2" } };
    expect(writeJsonWrapperStub.calledOnceWith(projectJsonPath, expectedJson)).to.be.true;
  });

  it("should remove components if their directories exist and force is true", async ()=>{
    const projectJson = { componentPath: { comp1: "path1", comp2: "path2" } };
    readJsonGreedyStub.resolves(projectJson);
    pathExistsStub.resolves(true); //All paths exist

    await projectFilesOperator._internal.removeComponentPath(projectRootDir, ["comp2"], true);

    const expectedJson = { componentPath: { comp1: "path1" } };
    expect(writeJsonWrapperStub.calledOnceWith(projectJsonPath, expectedJson)).to.be.true;
  });

  it("should handle an empty componentPath gracefully", async ()=>{
    const projectJson = { componentPath: {} };
    readJsonGreedyStub.resolves(projectJson);

    await projectFilesOperator._internal.removeComponentPath(projectRootDir, ["comp1"]);

    expect(writeJsonWrapperStub.calledOnceWith(projectJsonPath, projectJson)).to.be.true;
  });

  it("should throw an error if reading the project JSON fails", async ()=>{
    const readError = new Error("Read error");
    readJsonGreedyStub.rejects(readError);

    try {
      await projectFilesOperator._internal.removeComponentPath(projectRootDir, ["comp1"]);
      throw new Error("should have been rejected");
    } catch (err) {
      expect(err).to.equal(readError);
    }
    expect(writeJsonWrapperStub.notCalled).to.be.true;
    expect(gitAddStub.notCalled).to.be.true;
  });
});
