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
const projectFilesOperator = require("../../../../app/core/projectFilesOperator.js");

describe("#removeFileLinkToParent", ()=>{
  let removeFileLinkToParent;
  let getComponentDirMock, readComponentJsonMock, writeComponentJsonMock;

  beforeEach(()=>{
    removeFileLinkToParent = projectFilesOperator._internal.removeFileLinkToParent;

    getComponentDirMock = sinon.stub(projectFilesOperator._internal, "getComponentDir");
    readComponentJsonMock = sinon.stub(projectFilesOperator._internal, "readComponentJson");
    writeComponentJsonMock = sinon.stub(projectFilesOperator._internal, "writeComponentJson").resolves();
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should remove the file link from the parent's outputFiles and source's outputFiles", async ()=>{
    const projectRootDir = "/mock/project";
    const srcNode = "source123";
    const srcName = "output.txt";
    const dstName = "input.txt";
    const parentID = "parent123";
    const srcDir = "/mock/project/components/source123";
    const parentDir = path.dirname(srcDir);

    const srcJson = {
      ID: srcNode,
      outputFiles: [
        { name: "output.txt", dst: [{ dstNode: parentID, dstName: "input.txt" }] }
      ]
    };

    const parentJson = {
      ID: parentID,
      outputFiles: [
        { name: "input.txt", origin: [{ srcNode: srcNode, srcName: "output.txt" }] }
      ]
    };

    getComponentDirMock.withArgs(projectRootDir, srcNode, true).resolves(srcDir);
    readComponentJsonMock.withArgs(srcDir).resolves(srcJson);
    readComponentJsonMock.withArgs(parentDir).resolves(parentJson);

    await removeFileLinkToParent(projectRootDir, srcNode, srcName, dstName);

    expect(srcJson.outputFiles[0].dst).to.deep.equal([]);
    expect(parentJson.outputFiles[0].origin).to.deep.equal([]);

    expect(writeComponentJsonMock.calledWith(projectRootDir, srcDir, srcJson)).to.be.true;
    expect(writeComponentJsonMock.calledWith(projectRootDir, parentDir, parentJson)).to.be.true;
  });

  it("should throw an error when no matching output file exists in the source component", async ()=>{
    const projectRootDir = "/mock/project";
    const srcNode = "source123";
    const srcName = "nonexistent.txt"; //存在しない出力ファイル
    const dstName = "input.txt";
    const parentID = "parent123";
    const srcDir = "/mock/project/components/source123";
    const parentDir = path.dirname(srcDir);

    const srcJson = {
      ID: srcNode,
      outputFiles: [ //ここには "nonexistent.txt" が存在しない
        { name: "output.txt", dst: [{ dstNode: parentID, dstName: "input.txt" }] }
      ]
    };

    const parentJson = {
      ID: parentID,
      outputFiles: [
        { name: "input.txt", origin: [{ srcNode: srcNode, srcName: "output.txt" }] }
      ]
    };

    getComponentDirMock.withArgs(projectRootDir, srcNode, true).resolves(srcDir);
    readComponentJsonMock.withArgs(srcDir).resolves(srcJson);
    readComponentJsonMock.withArgs(parentDir).resolves(parentJson);

    await expect(removeFileLinkToParent(projectRootDir, srcNode, srcName, dstName))
      .to.be.rejectedWith(TypeError, "Cannot read properties of undefined (reading 'dst')");
  });

  it("should handle the case when parent component does not have matching origin entry", async ()=>{
    const projectRootDir = "/mock/project";
    const srcNode = "source123";
    const srcName = "output.txt";
    const dstName = "input.txt";
    const parentID = "parent123";
    const srcDir = "/mock/project/components/source123";
    const parentDir = path.dirname(srcDir);

    const srcJson = {
      ID: srcNode,
      outputFiles: [
        { name: "output.txt", dst: [{ dstNode: parentID, dstName: "input.txt" }] }
      ]
    };

    const parentJson = {
      ID: parentID,
      outputFiles: [
        { name: "input.txt" }
      ]
    };

    getComponentDirMock.withArgs(projectRootDir, srcNode, true).resolves(srcDir);
    readComponentJsonMock.withArgs(srcDir).resolves(srcJson);
    readComponentJsonMock.withArgs(parentDir).resolves(parentJson);

    await removeFileLinkToParent(projectRootDir, srcNode, srcName, dstName);

    expect(srcJson.outputFiles[0].dst).to.deep.equal([]);
    expect(parentJson.outputFiles[0]).to.not.have.property("origin");

    expect(writeComponentJsonMock.calledWith(projectRootDir, srcDir, srcJson)).to.be.true;
    expect(writeComponentJsonMock.calledWith(projectRootDir, parentDir, parentJson)).to.be.true;
  });
});
