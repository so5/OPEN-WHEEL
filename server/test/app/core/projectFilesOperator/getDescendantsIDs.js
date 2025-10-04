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


describe.skip("#getDescendantsIDs", ()=>{
  let getDescendantsIDs;
  let readJsonGreedyMock;
  let getComponentDirMock;

  beforeEach(()=>{
    getDescendantsIDs = projectFilesOperator._internal.getDescendantsIDs;

    readJsonGreedyMock = sinon.stub();
    getComponentDirMock = sinon.stub();

    projectFilesOperator._internal.readJsonGreedy = readJsonGreedyMock;
    projectFilesOperator._internal.getComponentDir = getComponentDirMock;
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

    readJsonGreedyMock.resolves(mockProjectJson);
    getComponentDirMock.resolves(mockPoi);

    const result = await getDescendantsIDs(mockProjectRootDir, mockID);

    expect(readJsonGreedyMock.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(getComponentDirMock.calledOnceWithExactly(mockProjectRootDir, mockID, true)).to.be.true;
    expect(result).to.deep.equal(["rootID", "child1", "child2"]);
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

    readJsonGreedyMock.resolves(mockProjectJson);
    getComponentDirMock.resolves(mockPoi);

    const result = await getDescendantsIDs(mockProjectRootDir, mockID);

    expect(readJsonGreedyMock.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(getComponentDirMock.calledOnceWithExactly(mockProjectRootDir, mockID, true)).to.be.true;
    expect(result).to.deep.equal(["rootID"]);
  });

  it("should throw an error if readJsonGreedy rejects", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockID = "rootID";
    const mockError = new Error("Failed to read JSON");

    readJsonGreedyMock.rejects(mockError);

    try {
      await getDescendantsIDs(mockProjectRootDir, mockID);
      throw new Error("Expected getDescendantsIDs to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readJsonGreedyMock.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(getComponentDirMock.notCalled).to.be.true;
  });

  it("should throw an error if getComponentDir rejects", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockID = "rootID";
    const mockProjectJson = {
      componentPath: {
        rootID: "./root",
        unrelated: "./other"
      }
    };
    const mockError = new Error("Failed to get component directory");

    readJsonGreedyMock.resolves(mockProjectJson);
    getComponentDirMock.rejects(mockError);

    try {
      await getDescendantsIDs(mockProjectRootDir, mockID);
      throw new Error("Expected getDescendantsIDs to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readJsonGreedyMock.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(getComponentDirMock.calledOnceWithExactly(mockProjectRootDir, mockID, true)).to.be.true;
  });
});
