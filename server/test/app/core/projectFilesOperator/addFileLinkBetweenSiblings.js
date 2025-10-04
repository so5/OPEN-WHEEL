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


describe.skip("#addFileLinkBetweenSiblings", ()=>{
  let addFileLinkBetweenSiblings;
  let getComponentDirMock, readComponentJsonMock, writeComponentJsonMock;

  beforeEach(()=>{
    addFileLinkBetweenSiblings = projectFilesOperator._internal.addFileLinkBetweenSiblings;

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

  it("should add a file link between sibling components when not already linked", async ()=>{
    const projectRootDir = "/mock/project";
    const srcNode = "componentA";
    const srcName = "outputA.txt";
    const dstNode = "componentB";
    const dstName = "inputB.txt";

    const srcComponentJson = {
      ID: srcNode,
      outputFiles: [{ name: srcName, dst: [] }]
    };

    const dstComponentJson = {
      ID: dstNode,
      inputFiles: []
    };

    getComponentDirMock.withArgs(projectRootDir, srcNode, true).resolves("/mock/project/componentA");
    getComponentDirMock.withArgs(projectRootDir, dstNode, true).resolves("/mock/project/componentB");
    readComponentJsonMock.withArgs("/mock/project/componentA").resolves(srcComponentJson);
    readComponentJsonMock.withArgs("/mock/project/componentB").resolves(dstComponentJson);

    await addFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName);

    expect(srcComponentJson.outputFiles[0].dst).to.deep.include({ dstNode, dstName });

    expect(dstComponentJson.inputFiles).to.deep.include({ name: dstName, src: [{ srcNode, srcName }] });

    expect(writeComponentJsonMock.calledTwice).to.be.true;
    expect(writeComponentJsonMock.firstCall.args[1]).to.equal("/mock/project/componentA");
    expect(writeComponentJsonMock.secondCall.args[1]).to.equal("/mock/project/componentB");
  });

  it("should allow duplicate file links if already exists", async ()=>{
    const projectRootDir = "/mock/project";
    const srcNode = "componentA";
    const srcName = "outputA.txt";
    const dstNode = "componentB";
    const dstName = "inputB.txt";

    const srcComponentJson = {
      ID: srcNode,
      outputFiles: [{ name: srcName, dst: [{ dstNode, dstName }] }]
    };

    const dstComponentJson = {
      ID: dstNode,
      inputFiles: [{ name: dstName, src: [{ srcNode, srcName }] }]
    };

    getComponentDirMock.withArgs(projectRootDir, srcNode, true).resolves("/mock/project/componentA");
    getComponentDirMock.withArgs(projectRootDir, dstNode, true).resolves("/mock/project/componentB");
    readComponentJsonMock.withArgs("/mock/project/componentA").resolves(srcComponentJson);
    readComponentJsonMock.withArgs("/mock/project/componentB").resolves(dstComponentJson);

    await addFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName);

    expect(srcComponentJson.outputFiles[0].dst).to.have.length(2);
    expect(srcComponentJson.outputFiles[0].dst).to.deep.equal([
      { dstNode, dstName },
      { dstNode, dstName }
    ]);

    expect(dstComponentJson.inputFiles).to.have.length(1);
    expect(dstComponentJson.inputFiles[0].src).to.have.length(2);
    expect(dstComponentJson.inputFiles[0].src).to.deep.equal([
      { srcNode, srcName },
      { srcNode, srcName }
    ]);

    expect(writeComponentJsonMock.calledTwice).to.be.true;
  });

  it("should create a new inputFiles entry if dstName does not exist", async ()=>{
    const projectRootDir = "/mock/project";
    const srcNode = "componentA";
    const srcName = "outputA.txt";
    const dstNode = "componentB";
    const dstName = "inputB.txt";

    const srcComponentJson = {
      ID: srcNode,
      outputFiles: [{ name: srcName, dst: [] }]
    };

    const dstComponentJson = {
      ID: dstNode,
      inputFiles: []
    };

    getComponentDirMock.withArgs(projectRootDir, srcNode, true).resolves("/mock/project/componentA");
    getComponentDirMock.withArgs(projectRootDir, dstNode, true).resolves("/mock/project/componentB");
    readComponentJsonMock.withArgs("/mock/project/componentA").resolves(srcComponentJson);
    readComponentJsonMock.withArgs("/mock/project/componentB").resolves(dstComponentJson);

    await addFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName);

    expect(dstComponentJson.inputFiles).to.have.deep.members([{ name: dstName, src: [{ srcNode, srcName }] }]);
    expect(writeComponentJsonMock.calledTwice).to.be.true;
  });
});
