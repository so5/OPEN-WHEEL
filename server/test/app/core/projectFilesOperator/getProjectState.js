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


describe.skip("#getProjectState", ()=>{
  let getProjectState;
  let readJsonGreedyMock;

  beforeEach(()=>{
    getProjectState = projectFilesOperator._internal.getProjectState;

    readJsonGreedyMock = sinon.stub();
    projectFilesOperator._internal.readJsonGreedy = readJsonGreedyMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return the project state when the project JSON is valid", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockProjectJson = { state: "not-started" };

    readJsonGreedyMock.resolves(mockProjectJson);

    const result = await getProjectState(mockProjectRootDir);

    expect(readJsonGreedyMock.calledOnceWithExactly(
      "/mock/project/root/prj.wheel.json"
    )).to.be.true;
    expect(result).to.equal("not-started");
  });

  it("should throw an error when the project JSON cannot be read", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockError = new Error("read failed");

    readJsonGreedyMock.rejects(mockError);

    try {
      await getProjectState(mockProjectRootDir);
      throw new Error("Expected getProjectState to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readJsonGreedyMock.calledOnceWithExactly(
      "/mock/project/root/prj.wheel.json"
    )).to.be.true;
  });

  it("should return undefined when the state property is missing", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockProjectJson = { name: "test_project" };

    readJsonGreedyMock.resolves(mockProjectJson);

    const result = await getProjectState(mockProjectRootDir);

    expect(result).to.be.undefined;

    expect(readJsonGreedyMock.calledOnceWithExactly(
      "/mock/project/root/prj.wheel.json"
    )).to.be.true;
  });
});
