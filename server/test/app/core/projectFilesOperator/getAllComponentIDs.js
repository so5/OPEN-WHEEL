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


describe.skip("#getAllComponentIDs", ()=>{
  let getAllComponentIDs;
  let readJsonGreedyMock;

  const mockProjectRootDir = "/mock/project/root";
  const mockProjectJson = {
    componentPath: {
      component1: "./path/to/component1",
      component2: "./path/to/component2",
      component3: "./path/to/component3"
    }
  };
  const mockFileName = path.resolve(mockProjectRootDir, "prj.wheel.json");

  beforeEach(()=>{
    readJsonGreedyMock = sinon.stub();

    projectFilesOperator._internal.readJsonGreedy = readJsonGreedyMock;

    getAllComponentIDs = projectFilesOperator._internal.getAllComponentIDs;
  });

  it("should return all component IDs from the project JSON", async ()=>{
    readJsonGreedyMock.resolves(mockProjectJson);

    const result = await getAllComponentIDs(mockProjectRootDir);

    expect(readJsonGreedyMock.calledOnceWithExactly(mockFileName)).to.be.true;
    expect(result).to.deep.equal(Object.keys(mockProjectJson.componentPath));
  });

  it("should throw an error if readJsonGreedy fails", async ()=>{
    const mockError = new Error("Failed to read JSON");
    readJsonGreedyMock.rejects(mockError);

    try {
      await getAllComponentIDs(mockProjectRootDir);
      throw new Error("Expected getAllComponentIDs to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readJsonGreedyMock.calledOnceWithExactly(mockFileName)).to.be.true;
  });

  it("should return an empty array if componentPath is not present in the JSON", async ()=>{
    readJsonGreedyMock.resolves({
      componentPath: {}
    });

    const result = await getAllComponentIDs(mockProjectRootDir);

    expect(readJsonGreedyMock.calledOnceWithExactly(mockFileName)).to.be.true;
    expect(result).to.deep.equal([]);
  });
});
