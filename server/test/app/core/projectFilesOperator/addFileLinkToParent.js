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


describe.skip("#addFileLinkToParent", ()=>{
  let addFileLinkToParent;
  let getComponentDirMock, readComponentJsonMock, writeComponentJsonMock;

  beforeEach(()=>{
    addFileLinkToParent = projectFilesOperator._internal.addFileLinkToParent;

    getComponentDirMock = sinon.stub();
    readComponentJsonMock = sinon.stub();
    writeComponentJsonMock = sinon.stub();

    projectFilesOperator._internal.getComponentDir = getComponentDirMock;
    projectFilesOperator._internal.readComponentJson = readComponentJsonMock;
    projectFilesOperator._internal.writeComponentJson = writeComponentJsonMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should add a file link to parent component correctly", async ()=>{
    const projectRootDir = "/mock/project/root";
    const srcNode = "srcNode1";
    const srcName = "outputFile1";
    const dstName = "inputFile1";

    const srcDir = "/mock/project/root/src";
    const parentDir = "/mock/project/root";
    const srcJson = {
      ID: "srcNode1",
      outputFiles: [{ name: "outputFile1", dst: [] }]
    };
    const parentJson = {
      ID: "parentNode1",
      outputFiles: [{ name: "inputFile1" }]
    };

    getComponentDirMock.onFirstCall().resolves(srcDir);
    readComponentJsonMock.withArgs(srcDir).resolves(srcJson);
    readComponentJsonMock.withArgs(parentDir).resolves(parentJson);
    writeComponentJsonMock.resolves();

    await addFileLinkToParent(projectRootDir, srcNode, srcName, dstName);

    expect(srcJson.outputFiles[0].dst).to.deep.include({
      dstNode: "parentNode1",
      dstName: "inputFile1"
    });
    expect(parentJson.outputFiles[0].origin).to.deep.include({
      srcNode: "srcNode1",
      srcName: "outputFile1"
    });

    expect(writeComponentJsonMock.calledTwice).to.be.true;
    expect(writeComponentJsonMock.firstCall.args).to.deep.equal([
      projectRootDir,
      srcDir,
      srcJson
    ]);
    expect(writeComponentJsonMock.secondCall.args).to.deep.equal([
      projectRootDir,
      parentDir,
      parentJson
    ]);
  });

  it("should throw an error if srcNode does not exist", async ()=>{
    const projectRootDir = "/mock/project/root";
    const srcNode = "invalidNode";
    const srcName = "outputFile1";
    const dstName = "inputFile1";

    getComponentDirMock.rejects(new Error("srcNode not found"));

    try {
      await addFileLinkToParent(projectRootDir, srcNode, srcName, dstName);
      throw new Error("Expected addFileLinkToParent to throw");
    } catch (err) {
      expect(err.message).to.equal("srcNode not found");
    }
  });
});
