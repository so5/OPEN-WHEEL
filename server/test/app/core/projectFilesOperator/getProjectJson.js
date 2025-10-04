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


describe.skip("#getProjectJson", ()=>{
  let getProjectJson;
  let readJsonGreedyMock;

  beforeEach(()=>{
    getProjectJson = projectFilesOperator._internal.getProjectJson;

    readJsonGreedyMock = sinon.stub();
    projectFilesOperator._internal.readJsonGreedy = readJsonGreedyMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return the project JSON data when readJsonGreedy resolves", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockProjectJson = { name: "test_project", version: 2 };

    readJsonGreedyMock.resolves(mockProjectJson);

    const result = await getProjectJson(mockProjectRootDir);

    expect(readJsonGreedyMock.calledOnceWithExactly(
            `${mockProjectRootDir}/prj.wheel.json`
    )).to.be.true;
    expect(result).to.deep.equal(mockProjectJson);
  });

  it("should throw an error when readJsonGreedy rejects", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockError = new Error("File not found");

    readJsonGreedyMock.rejects(mockError);

    try {
      await getProjectJson(mockProjectRootDir);
      throw new Error("Expected getProjectJson to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readJsonGreedyMock.calledOnceWithExactly(
            `${mockProjectRootDir}/prj.wheel.json`
    )).to.be.true;
  });
});
