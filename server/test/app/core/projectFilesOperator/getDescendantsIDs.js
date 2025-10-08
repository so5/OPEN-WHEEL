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

describe("#getDescendantsIDs", ()=>{
  let readJsonGreedyStub;
  let getComponentDirStub;

  beforeEach(()=>{
    readJsonGreedyStub = sinon.stub(projectFilesOperator._internal, "readJsonGreedy");
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return an array of descendant IDs including the given ID", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockID = "rootID";
    const mockProjectJson = {
      componentPath: {
        rootID: "./root",
        child1: "./root/child1",
        child2: "./root/child2",
        unrelated: "./other"
      }
    };
    const mockPoi = path.resolve(mockProjectRootDir, "root");
    readJsonGreedyStub.resolves(mockProjectJson);
    getComponentDirStub.resolves(mockPoi);

    const result = await projectFilesOperator._internal.getDescendantsIDs(mockProjectRootDir, mockID);

    expect(readJsonGreedyStub.calledOnceWith(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(getComponentDirStub.calledOnceWith(mockProjectRootDir, mockID, true)).to.be.true;
    expect(result).to.have.deep.members(["rootID", "child1", "child2"]);
  });

  it("should return an array with only the given ID if no descendants are found", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockID = "rootID";
    const mockProjectJson = {
      componentPath: {
        rootID: "./root",
        unrelated: "./other"
      }
    };
    const mockPoi = path.resolve(mockProjectRootDir, "root");
    readJsonGreedyStub.resolves(mockProjectJson);
    getComponentDirStub.resolves(mockPoi);

    const result = await projectFilesOperator._internal.getDescendantsIDs(mockProjectRootDir, mockID);

    expect(result).to.have.deep.members(["rootID"]);
  });

  it("should throw an error if readJsonGreedy rejects", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockID = "rootID";
    const mockError = new Error("Failed to read JSON");
    readJsonGreedyStub.rejects(mockError);

    try {
      await projectFilesOperator._internal.getDescendantsIDs(mockProjectRootDir, mockID);
      throw new Error("Expected getDescendantsIDs to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }
    expect(getComponentDirStub.notCalled).to.be.true;
  });

  it("should throw an error if getComponentDir rejects", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockID = "rootID";
    const mockProjectJson = {
      componentPath: {
        rootID: "./root"
      }
    };
    const mockError = new Error("Failed to get component directory");
    readJsonGreedyStub.resolves(mockProjectJson);
    getComponentDirStub.rejects(mockError);

    try {
      await projectFilesOperator._internal.getDescendantsIDs(mockProjectRootDir, mockID);
      throw new Error("Expected getDescendantsIDs to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }
  });
});
