/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#removeFileLinkBetweenSiblings", ()=>{
  let getComponentDirStub;
  let readComponentJsonStub;
  let writeComponentJsonStub;
  const projectRootDir = "/mock/project";
  const srcNode = "src123";
  const srcName = "output.txt";
  const dstNode = "dst456";
  const dstName = "input.txt";

  beforeEach(()=>{
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
    readComponentJsonStub = sinon.stub(projectFilesOperator._internal, "readComponentJson");
    writeComponentJsonStub = sinon.stub(projectFilesOperator._internal, "writeComponentJson").resolves();
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should remove the file link between siblings successfully", async ()=>{
    const srcDir = "/mock/project/src123";
    const dstDir = "/mock/project/dst456";
    getComponentDirStub.withArgs(projectRootDir, srcNode, true).resolves(srcDir);
    getComponentDirStub.withArgs(projectRootDir, dstNode, true).resolves(dstDir);

    const srcJson = { outputFiles: [{ name: "output.txt", dst: [{ dstNode, dstName }] }] };
    const dstJson = { inputFiles: [{ name: "input.txt", src: [{ srcNode, srcName }] }] };
    readComponentJsonStub.withArgs(srcDir).resolves(srcJson);
    readComponentJsonStub.withArgs(dstDir).resolves(dstJson);

    await projectFilesOperator._internal.removeFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName);

    expect(srcJson.outputFiles[0].dst).to.be.empty;
    expect(dstJson.inputFiles[0].src).to.be.empty;
    expect(writeComponentJsonStub.calledTwice).to.be.true;
    expect(writeComponentJsonStub.calledWith(projectRootDir, srcDir, srcJson)).to.be.true;
    expect(writeComponentJsonStub.calledWith(projectRootDir, dstDir, dstJson)).to.be.true;
  });

  it("should not fail if the link does not exist", async ()=>{
    const srcDir = "/mock/project/src123";
    const dstDir = "/mock/project/dst456";
    getComponentDirStub.withArgs(projectRootDir, srcNode, true).resolves(srcDir);
    getComponentDirStub.withArgs(projectRootDir, dstNode, true).resolves(dstDir);

    const srcJson = { outputFiles: [{ name: srcName, dst: [] }] };
    const dstJson = { inputFiles: [{ name: dstName, src: [] }] };
    readComponentJsonStub.withArgs(srcDir).resolves(srcJson);
    readComponentJsonStub.withArgs(dstDir).resolves(dstJson);

    await projectFilesOperator._internal.removeFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName);

    expect(writeComponentJsonStub.calledTwice).to.be.true;
  });

  it("should throw an error if component JSON file is not found", async ()=>{
    const readError = new Error("File not found");
    getComponentDirStub.withArgs(projectRootDir, srcNode, true).resolves("/mock/project/src123");
    readComponentJsonStub.withArgs("/mock/project/src123").rejects(readError);

    try {
      await projectFilesOperator._internal.removeFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName);
      throw new Error("should have been rejected");
    } catch (err) {
      expect(err).to.equal(readError);
    }
  });
});
