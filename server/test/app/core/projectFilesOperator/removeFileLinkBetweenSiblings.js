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


describe.skip("#removeFileLinkBetweenSiblings", ()=>{
  let removeFileLinkBetweenSiblings;
  let getComponentDirMock, readComponentJsonMock, writeComponentJsonMock;

  beforeEach(()=>{
    removeFileLinkBetweenSiblings = projectFilesOperator._internal.removeFileLinkBetweenSiblings;

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

  it("should remove the file link between siblings successfully", async ()=>{
    const projectRootDir = "/mock/project";
    const srcNode = "src123";
    const srcName = "output.txt";
    const dstNode = "dst456";
    const dstName = "input.txt";

    getComponentDirMock.withArgs(projectRootDir, srcNode, true).resolves("/mock/project/src123");
    getComponentDirMock.withArgs(projectRootDir, dstNode, true).resolves("/mock/project/dst456");

    const srcJson = {
      outputFiles: [{ name: "output.txt", dst: [{ dstNode: "dst456", dstName: "input.txt" }] }]
    };
    const dstJson = {
      inputFiles: [{ name: "input.txt", src: [{ srcNode: "src123", srcName: "output.txt" }] }]
    };

    readComponentJsonMock.withArgs("/mock/project/src123").resolves(srcJson);
    readComponentJsonMock.withArgs("/mock/project/dst456").resolves(dstJson);

    await removeFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName);

    expect(srcJson.outputFiles[0].dst).to.deep.equal([]);
    expect(dstJson.inputFiles[0].src).to.deep.equal([]);

    expect(writeComponentJsonMock.calledTwice).to.be.true;
    expect(writeComponentJsonMock.calledWithExactly(projectRootDir, "/mock/project/src123", srcJson)).to.be.true;
    expect(writeComponentJsonMock.calledWithExactly(projectRootDir, "/mock/project/dst456", dstJson)).to.be.true;
  });

  it("should not fail if the link does not exist", async ()=>{
    const projectRootDir = "/mock/project";
    const srcNode = "src123";
    const srcName = "output.txt";
    const dstNode = "dst456";
    const dstName = "input.txt";

    getComponentDirMock.withArgs(projectRootDir, srcNode, true).resolves("/mock/project/src123");
    getComponentDirMock.withArgs(projectRootDir, dstNode, true).resolves("/mock/project/dst456");

    const srcJson = {
      outputFiles: [{ name: "output.txt", dst: [] }]
    };
    const dstJson = {
      inputFiles: [{ name: "input.txt", src: [] }]
    };

    readComponentJsonMock.withArgs("/mock/project/src123").resolves(srcJson);
    readComponentJsonMock.withArgs("/mock/project/dst456").resolves(dstJson);

    await removeFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName);

    expect(writeComponentJsonMock.calledTwice).to.be.true;
  });

  it("should throw an error if component JSON file is not found", async ()=>{
    const projectRootDir = "/mock/project";
    const srcNode = "src123";
    const srcName = "output.txt";
    const dstNode = "dst456";
    const dstName = "input.txt";

    getComponentDirMock.withArgs(projectRootDir, srcNode, true).resolves("/mock/project/src123");
    getComponentDirMock.withArgs(projectRootDir, dstNode, true).resolves("/mock/project/dst456");

    readComponentJsonMock.withArgs("/mock/project/src123").rejects(new Error("File not found"));

    try {
      await removeFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName);
      throw new Error("Expected function to throw an error");
    } catch (error) {
      expect(error.message).to.equal("File not found");
    }
  });
});
