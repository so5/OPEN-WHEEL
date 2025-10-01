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

describe("#getAllComponentIDs", ()=>{
  let readJsonGreedyStub;
  const mockProjectRootDir = "/mock/project/root";
  const mockFileName = path.resolve(mockProjectRootDir, "prj.wheel.json");

  beforeEach(()=>{
    readJsonGreedyStub = sinon.stub(projectFilesOperator._internal, "readJsonGreedy");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return all component IDs from the project JSON", async ()=>{
    const mockProjectJson = {
      componentPath: {
        component1: "./path/to/component1",
        component2: "./path/to/component2",
        component3: "./path/to/component3"
      }
    };
    readJsonGreedyStub.resolves(mockProjectJson);

    const result = await projectFilesOperator._internal.getAllComponentIDs(mockProjectRootDir);

    expect(readJsonGreedyStub.calledOnceWith(mockFileName)).to.be.true;
    expect(result).to.deep.equal(Object.keys(mockProjectJson.componentPath));
  });

  it("should throw an error if readJsonGreedy fails", async ()=>{
    const mockError = new Error("Failed to read JSON");
    readJsonGreedyStub.rejects(mockError);

    try {
      await projectFilesOperator._internal.getAllComponentIDs(mockProjectRootDir);
      throw new Error("Expected getAllComponentIDs to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readJsonGreedyStub.calledOnceWith(mockFileName)).to.be.true;
  });

  it("should return an empty array if componentPath is not present in the JSON", async ()=>{
    readJsonGreedyStub.resolves({
      componentPath: {}
    });

    const result = await projectFilesOperator._internal.getAllComponentIDs(mockProjectRootDir);

    expect(readJsonGreedyStub.calledOnceWith(mockFileName)).to.be.true;
    expect(result).to.deep.equal([]);
  });
});
