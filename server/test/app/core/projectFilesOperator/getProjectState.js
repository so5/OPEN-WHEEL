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

describe("#getProjectState", ()=>{
  let readJsonGreedyStub;

  beforeEach(()=>{
    readJsonGreedyStub = sinon.stub(projectFilesOperator._internal, "readJsonGreedy");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return the project state when the project JSON is valid", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockProjectJson = { state: "not-started" };
    const expectedPath = path.resolve(mockProjectRootDir, "prj.wheel.json");
    readJsonGreedyStub.resolves(mockProjectJson);

    const result = await projectFilesOperator.getProjectState(mockProjectRootDir);

    expect(readJsonGreedyStub.calledOnceWith(expectedPath)).to.be.true;
    expect(result).to.equal("not-started");
  });

  it("should throw an error when the project JSON cannot be read", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockError = new Error("read failed");
    const expectedPath = path.resolve(mockProjectRootDir, "prj.wheel.json");
    readJsonGreedyStub.rejects(mockError);

    try {
      await projectFilesOperator.getProjectState(mockProjectRootDir);
      throw new Error("Expected getProjectState to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readJsonGreedyStub.calledOnceWith(expectedPath)).to.be.true;
  });

  it("should return undefined when the state property is missing", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockProjectJson = { name: "test_project" };
    const expectedPath = path.resolve(mockProjectRootDir, "prj.wheel.json");
    readJsonGreedyStub.resolves(mockProjectJson);

    const result = await projectFilesOperator.getProjectState(mockProjectRootDir);

    expect(result).to.be.undefined;
    expect(readJsonGreedyStub.calledOnceWith(expectedPath)).to.be.true;
  });
});