/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#addFileLinkToParent", ()=>{
  const projectRootDir = "/mock/project/root";
  const srcNode = "srcNode1";
  const srcName = "outputFile1";
  const dstName = "inputFile1";
  const srcDir = "/mock/project/root/src";
  const parentDir = "/mock/project/root";
  const parentID = "parentNode1";

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

  it("should add a file link to parent component correctly", async ()=>{
    const srcJson = {
      ID: srcNode,
      outputFiles: [{ name: srcName, dst: [] }]
    };
    const parentJson = {
      ID: parentID,
      outputFiles: [{ name: dstName }]
    };

    getComponentDirStub.withArgs(projectRootDir, srcNode, true).resolves(srcDir);
    pathDirnameStub.withArgs(srcDir).returns(parentDir);
    readComponentJsonStub.withArgs(srcDir).resolves(srcJson);
    readComponentJsonStub.withArgs(parentDir).resolves(parentJson);

    await projectFilesOperator._internal.addFileLinkToParent(projectRootDir, srcNode, srcName, dstName);

    expect(srcJson.outputFiles[0].dst).to.deep.include({
      dstNode: parentID,
      dstName
    });
    expect(parentJson.outputFiles[0].origin).to.deep.include({
      srcNode,
      srcName
    });
    expect(writeComponentJsonStub.calledTwice).to.be.true;
    expect(writeComponentJsonStub.firstCall.args).to.deep.equal([
      projectRootDir,
      srcDir,
      srcJson
    ]);
    expect(writeComponentJsonStub.secondCall.args).to.deep.equal([
      projectRootDir,
      parentDir,
      parentJson
    ]);
  });

  it("should not add duplicate file links", async ()=>{
    const srcJson = {
      ID: srcNode,
      outputFiles: [{ name: srcName, dst: [{ dstNode: parentID, dstName }] }]
    };
    const parentJson = {
      ID: parentID,
      outputFiles: [{ name: dstName, origin: [{ srcNode, srcName }] }]
    };

    getComponentDirStub.withArgs(projectRootDir, srcNode, true).resolves(srcDir);
    pathDirnameStub.withArgs(srcDir).returns(parentDir);
    readComponentJsonStub.withArgs(srcDir).resolves(srcJson);
    readComponentJsonStub.withArgs(parentDir).resolves(parentJson);

    await projectFilesOperator._internal.addFileLinkToParent(projectRootDir, srcNode, srcName, dstName);

    expect(srcJson.outputFiles[0].dst).to.have.lengthOf(1);
    expect(parentJson.outputFiles[0].origin).to.have.lengthOf(1);
    expect(writeComponentJsonStub.calledTwice).to.be.true;
  });

  it("should throw an error if srcNode does not exist", async ()=>{
    getComponentDirStub.withArgs(projectRootDir, "invalidNode", true).rejects(new Error("srcNode not found"));

    try {
      await projectFilesOperator._internal.addFileLinkToParent(projectRootDir, "invalidNode", "outputFile1", "inputFile1");
      throw new Error("Expected addFileLinkToParent to throw");
    } catch (err) {
      expect(err.message).to.equal("srcNode not found");
    }
  });
});
