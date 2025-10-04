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


describe.skip("#removeFileLinkFromParent", ()=>{
  let removeFileLinkFromParent;
  let getComponentDirMock, readComponentJsonMock, writeComponentJsonMock;

  beforeEach(()=>{
    removeFileLinkFromParent = projectFilesOperator._internal.removeFileLinkFromParent;

    getComponentDirMock = sinon.stub();
    readComponentJsonMock = sinon.stub();
    writeComponentJsonMock = sinon.stub().resolves();

    projectFilesOperator._internal.getComponentDir = getComponentDirMock;
    projectFilesOperator._internal.readComponentJson = readComponentJsonMock;
    projectFilesOperator._internal.writeComponentJson = writeComponentJsonMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should remove the file link from parent component correctly", async ()=>{
    const projectRootDir = "/mock/project";
    const srcName = "output.txt";
    const dstNode = "childComponentID";
    const dstName = "input.txt";
    const parentID = "parentComponentID";

    const dstDir = "/mock/project/childComponent";
    const parentDir = path.dirname(dstDir);
    const resolvedParentDir = path.resolve(parentDir);

    getComponentDirMock.withArgs(projectRootDir, dstNode, true).resolves(dstDir);

    const mockParentJson = {
      ID: parentID,
      inputFiles: [
        { name: srcName, forwardTo: [{ dstNode, dstName }] }
      ]
    };

    const mockDstJson = {
      ID: dstNode,
      inputFiles: [
        { name: dstName, src: [{ srcNode: parentID, srcName }] }
      ]
    };

    readComponentJsonMock.withArgs(dstDir).resolves(mockDstJson);
    readComponentJsonMock.withArgs(resolvedParentDir).resolves(mockParentJson);

    await removeFileLinkFromParent(projectRootDir, srcName, dstNode, dstName);

    expect(mockParentJson.inputFiles[0].forwardTo).to.deep.equal([]);
    expect(mockDstJson.inputFiles[0].src).to.deep.equal([]);

    expect(writeComponentJsonMock.calledWith(projectRootDir, resolvedParentDir, mockParentJson)).to.be.true;
    expect(writeComponentJsonMock.calledWith(projectRootDir, dstDir, mockDstJson)).to.be.true;
  });

  it("should handle missing forwardTo in parent component", async ()=>{
    const projectRootDir = "/mock/project";
    const srcName = "output.txt";
    const dstNode = "childComponentID";
    const dstName = "input.txt";
    const parentID = "parentComponentID";

    const dstDir = "/mock/project/childComponent";
    const parentDir = path.dirname(dstDir);
    const resolvedParentDir = path.resolve(parentDir);

    getComponentDirMock.withArgs(projectRootDir, dstNode, true).resolves(dstDir);

    const mockParentJson = {
      ID: parentID,
      inputFiles: [{ name: srcName }]
    };

    const mockDstJson = {
      ID: dstNode,
      inputFiles: [
        { name: dstName, src: [{ srcNode: parentID, srcName }] }
      ]
    };

    readComponentJsonMock.withArgs(dstDir).resolves(mockDstJson);
    readComponentJsonMock.withArgs(resolvedParentDir).resolves(mockParentJson);

    await removeFileLinkFromParent(projectRootDir, srcName, dstNode, dstName);

    expect(mockDstJson.inputFiles[0].src).to.deep.equal([]);

    expect(writeComponentJsonMock.calledWith(projectRootDir, resolvedParentDir, mockParentJson)).to.be.true;
    expect(writeComponentJsonMock.calledWith(projectRootDir, dstDir, mockDstJson)).to.be.true;
  });
});
