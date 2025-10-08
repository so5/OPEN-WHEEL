/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const projectFilesOperator = require("../../../../app/core/projectFilesOperator.js");

describe("#addFileLinkFromParent", ()=>{
  const projectRootDir = "/mock/project/root";
  const srcName = "fileA";
  const dstNode = "childID";
  const dstName = "inputB";
  const dstDir = "/mock/project/root/child";
  const parentDir = "/mock/project/root";

  let getComponentDirStub;
  let readComponentJsonStub;
  let writeComponentJsonStub;
  let pathDirnameStub;
  let originalPath;

  beforeEach(()=>{
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
    readComponentJsonStub = sinon.stub(projectFilesOperator._internal, "readComponentJson");
    writeComponentJsonStub = sinon.stub(projectFilesOperator._internal, "writeComponentJson").resolves();
    originalPath = projectFilesOperator._internal.path;
    pathDirnameStub = sinon.stub(projectFilesOperator._internal.path, "dirname");
  });

  afterEach(()=>{
    sinon.restore();
    projectFilesOperator._internal.path = originalPath;
  });

  it("should add a new file link from parent to child correctly", async ()=>{
    const parentJson = {
      ID: "parentID",
      inputFiles: [{ name: srcName, forwardTo: [] }]
    };
    const childJson = {
      ID: dstNode,
      inputFiles: []
    };

    getComponentDirStub.withArgs(projectRootDir, dstNode, true).resolves(dstDir);
    pathDirnameStub.withArgs(dstDir).returns(parentDir);
    readComponentJsonStub.withArgs(parentDir).resolves(parentJson);
    readComponentJsonStub.withArgs(dstDir).resolves(childJson);

    await projectFilesOperator._internal.addFileLinkFromParent(projectRootDir, srcName, dstNode, dstName);

    expect(parentJson.inputFiles[0].forwardTo).to.deep.include({ dstNode, dstName });
    expect(childJson.inputFiles).to.deep.include({
      name: dstName,
      src: [{ srcNode: "parentID", srcName }]
    });
    expect(writeComponentJsonStub.calledTwice).to.be.true;
  });

  it("should not add duplicate file links", async ()=>{
    const parentJson = {
      ID: "parentID",
      inputFiles: [{ name: srcName, forwardTo: [{ dstNode, dstName }] }]
    };
    const childJson = {
      ID: dstNode,
      inputFiles: [{ name: dstName, src: [{ srcNode: "parentID", srcName }] }]
    };

    getComponentDirStub.withArgs(projectRootDir, dstNode, true).resolves(dstDir);
    pathDirnameStub.withArgs(dstDir).returns(parentDir);
    readComponentJsonStub.withArgs(parentDir).resolves(parentJson);
    readComponentJsonStub.withArgs(dstDir).resolves(childJson);

    await projectFilesOperator._internal.addFileLinkFromParent(projectRootDir, srcName, dstNode, dstName);

    expect(parentJson.inputFiles[0].forwardTo).to.have.lengthOf(1);
    expect(childJson.inputFiles[0].src).to.have.lengthOf(1);
    expect(writeComponentJsonStub.calledTwice).to.be.true;
  });

  it("should handle cases where parent inputFiles does not exist", async ()=>{
    const parentJson = {
      ID: "parentID"
    };
    const childJson = {
      ID: dstNode,
      inputFiles: []
    };

    getComponentDirStub.withArgs(projectRootDir, dstNode, true).resolves(dstDir);
    pathDirnameStub.withArgs(dstDir).returns(parentDir);
    readComponentJsonStub.withArgs(parentDir).resolves(parentJson);
    readComponentJsonStub.withArgs(dstDir).resolves(childJson);

    await projectFilesOperator._internal.addFileLinkFromParent(projectRootDir, srcName, dstNode, dstName);

    expect(parentJson.inputFiles[0].forwardTo).to.deep.include({ dstNode, dstName });
    expect(childJson.inputFiles).to.deep.include({
      name: dstName,
      src: [{ srcNode: "parentID", srcName }]
    });
    expect(writeComponentJsonStub.calledTwice).to.be.true;
  });
});
