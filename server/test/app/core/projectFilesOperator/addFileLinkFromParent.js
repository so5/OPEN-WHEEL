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


describe.skip("#addFileLinkFromParent", ()=>{
  let addFileLinkFromParent;
  let readComponentJsonMock;
  let writeComponentJsonMock;
  let getComponentDirMock;
  let pathDirnameMock;
  let projectRootDir;

  beforeEach(()=>{
    addFileLinkFromParent = projectFilesOperator._internal.addFileLinkFromParent;

    readComponentJsonMock = sinon.stub();
    writeComponentJsonMock = sinon.stub().resolves();
    getComponentDirMock = sinon.stub();
    pathDirnameMock = sinon.stub();

    projectFilesOperator._internal.readComponentJson = readComponentJsonMock;
    projectFilesOperator._internal.writeComponentJson = writeComponentJsonMock;
    projectFilesOperator._internal.getComponentDir = getComponentDirMock;
    projectFilesOperator._internal.path = { dirname: pathDirnameMock };

    projectRootDir = "/mock/project/root";
  });

  it("should add a new file link from parent to child correctly", async ()=>{
    const dstDir = "/mock/project/root/child";
    const parentDir = "/mock/project/root/parent";

    getComponentDirMock.withArgs(projectRootDir, "childID", true).resolves(dstDir);
    pathDirnameMock.withArgs(dstDir).returns(parentDir);

    const parentJson = {
      ID: "parentID",
      inputFiles: [{ name: "fileA", forwardTo: [] }]
    };
    const childJson = {
      ID: "childID",
      inputFiles: []
    };

    readComponentJsonMock.withArgs(parentDir).resolves(parentJson);
    readComponentJsonMock.withArgs(dstDir).resolves(childJson);

    await addFileLinkFromParent(projectRootDir, "fileA", "childID", "inputB");

    expect(parentJson.inputFiles[0].forwardTo).to.deep.include({
      dstNode: "childID",
      dstName: "inputB"
    });
    expect(childJson.inputFiles).to.deep.include({
      name: "inputB",
      src: [{ srcNode: "parentID", srcName: "fileA" }]
    });

    expect(writeComponentJsonMock.firstCall.args).to.deep.equal([
      projectRootDir,
      parentDir,
      parentJson
    ]);
    expect(writeComponentJsonMock.secondCall.args).to.deep.equal([
      projectRootDir,
      dstDir,
      childJson
    ]);
  });

  it("should handle cases where parent inputFiles does not exist", async ()=>{
    const dstDir = "/mock/project/root/child";
    const parentDir = "/mock/project/root/parent";

    getComponentDirMock.withArgs(projectRootDir, "childID", true).resolves(dstDir);
    pathDirnameMock.withArgs(dstDir).returns(parentDir);

    const parentJson = {
      ID: "parentID",
      inputFiles: [{ name: "fileA", forwardTo: [] }]
    };
    const childJson = {
      ID: "childID",
      inputFiles: []
    };

    readComponentJsonMock.withArgs(parentDir).resolves(parentJson);
    readComponentJsonMock.withArgs(dstDir).resolves(childJson);

    await addFileLinkFromParent(projectRootDir, "fileA", "childID", "inputB");

    expect(parentJson.inputFiles[0].forwardTo).to.deep.include({
      dstNode: "childID",
      dstName: "inputB"
    });
    expect(childJson.inputFiles).to.deep.include({
      name: "inputB",
      src: [{ srcNode: "parentID", srcName: "fileA" }]
    });

    expect(writeComponentJsonMock.firstCall.args).to.deep.equal([
      projectRootDir,
      parentDir,
      parentJson
    ]);
    expect(writeComponentJsonMock.secondCall.args).to.deep.equal([
      projectRootDir,
      dstDir,
      childJson
    ]);
  });
});
