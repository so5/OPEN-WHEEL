/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import path from "path";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#removeFileLinkFromParent", ()=>{
  let getComponentDirStub;
  let readComponentJsonStub;
  let writeComponentJsonStub;
  let pathDirnameStub;
  let originalPath;
  const projectRootDir = "/mock/project";
  const srcName = "output.txt";
  const dstNode = "childComponentID";
  const dstName = "input.txt";
  const parentID = "parentComponentID";
  const dstDir = "/mock/project/childComponent";
  const parentDir = "/mock/project";

  beforeEach(()=>{
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
    readComponentJsonStub = sinon.stub(projectFilesOperator._internal, "readComponentJson");
    writeComponentJsonStub = sinon.stub(projectFilesOperator._internal, "writeComponentJson").resolves();
    originalPath = projectFilesOperator._internal.path;
    pathDirnameStub = sinon.stub(path, "dirname").returns(parentDir);
    projectFilesOperator._internal.path = path;
  });

  afterEach(()=>{
    sinon.restore();
    projectFilesOperator._internal.path = originalPath;
  });

  it("should remove the file link from parent component correctly", async ()=>{
    getComponentDirStub.withArgs(projectRootDir, dstNode, true).resolves(dstDir);

    const parentJson = { ID: parentID, inputFiles: [{ name: srcName, forwardTo: [{ dstNode, dstName }] }] };
    const dstJson = { ID: dstNode, inputFiles: [{ name: dstName, src: [{ srcNode: parentID, srcName }] }] };
    readComponentJsonStub.withArgs(dstDir).resolves(dstJson);
    readComponentJsonStub.withArgs(parentDir).resolves(parentJson);

    await projectFilesOperator._internal.removeFileLinkFromParent(projectRootDir, srcName, dstNode, dstName);

    expect(parentJson.inputFiles[0].forwardTo).to.be.empty;
    expect(dstJson.inputFiles[0].src).to.be.empty;
    expect(writeComponentJsonStub.calledWith(projectRootDir, parentDir, parentJson)).to.be.true;
    expect(writeComponentJsonStub.calledWith(projectRootDir, dstDir, dstJson)).to.be.true;
  });

  it("should handle missing forwardTo in parent component", async ()=>{
    getComponentDirStub.withArgs(projectRootDir, dstNode, true).resolves(dstDir);

    const parentJson = { ID: parentID, inputFiles: [{ name: srcName }] };
    const dstJson = { ID: dstNode, inputFiles: [{ name: dstName, src: [{ srcNode: parentID, srcName }] }] };
    readComponentJsonStub.withArgs(dstDir).resolves(dstJson);
    readComponentJsonStub.withArgs(parentDir).resolves(parentJson);

    await projectFilesOperator._internal.removeFileLinkFromParent(projectRootDir, srcName, dstNode, dstName);

    expect(dstJson.inputFiles[0].src).to.be.empty;
    expect(writeComponentJsonStub.calledWith(projectRootDir, parentDir, parentJson)).to.be.true;
    expect(writeComponentJsonStub.calledWith(projectRootDir, dstDir, dstJson)).to.be.true;
  });
});
