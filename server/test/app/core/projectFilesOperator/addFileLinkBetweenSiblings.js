/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#addFileLinkBetweenSiblings", ()=>{
  let getComponentDirStub;
  let readComponentJsonStub;
  let writeComponentJsonStub;

  beforeEach(()=>{
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
    readComponentJsonStub = sinon.stub(projectFilesOperator._internal, "readComponentJson");
    writeComponentJsonStub = sinon.stub(projectFilesOperator._internal, "writeComponentJson").resolves();
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

    getComponentDirStub.withArgs(projectRootDir, srcNode, true).resolves("/mock/project/componentA");
    getComponentDirStub.withArgs(projectRootDir, dstNode, true).resolves("/mock/project/componentB");
    readComponentJsonStub.withArgs("/mock/project/componentA").resolves(srcComponentJson);
    readComponentJsonStub.withArgs("/mock/project/componentB").resolves(dstComponentJson);

    await projectFilesOperator._internal.addFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName);

    expect(srcComponentJson.outputFiles[0].dst).to.deep.include({ dstNode, dstName });

    expect(dstComponentJson.inputFiles).to.deep.include({ name: dstName, src: [{ srcNode, srcName }] });

    expect(writeComponentJsonStub.calledTwice).to.be.true;
    expect(writeComponentJsonStub.firstCall.args[1]).to.equal("/mock/project/componentA");
    expect(writeComponentJsonStub.secondCall.args[1]).to.equal("/mock/project/componentB");
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

    getComponentDirStub.withArgs(projectRootDir, srcNode, true).resolves("/mock/project/componentA");
    getComponentDirStub.withArgs(projectRootDir, dstNode, true).resolves("/mock/project/componentB");
    readComponentJsonStub.withArgs("/mock/project/componentA").resolves(srcComponentJson);
    readComponentJsonStub.withArgs("/mock/project/componentB").resolves(dstComponentJson);

    await projectFilesOperator._internal.addFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName);

    expect(srcComponentJson.outputFiles[0].dst).to.have.length(2);
    expect(dstComponentJson.inputFiles[0].src).to.have.length(2);
    expect(writeComponentJsonStub.calledTwice).to.be.true;
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

    getComponentDirStub.withArgs(projectRootDir, srcNode, true).resolves("/mock/project/componentA");
    getComponentDirStub.withArgs(projectRootDir, dstNode, true).resolves("/mock/project/componentB");
    readComponentJsonStub.withArgs("/mock/project/componentA").resolves(srcComponentJson);
    readComponentJsonStub.withArgs("/mock/project/componentB").resolves(dstComponentJson);

    await projectFilesOperator._internal.addFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName);

    expect(dstComponentJson.inputFiles).to.have.deep.members([{ name: dstName, src: [{ srcNode, srcName }] }]);
    expect(writeComponentJsonStub.calledTwice).to.be.true;
  });
});
