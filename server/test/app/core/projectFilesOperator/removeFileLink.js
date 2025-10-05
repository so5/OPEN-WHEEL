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

describe("#removeFileLink", ()=>{
  let isParentStub;
  let removeFileLinkToParentStub;
  let removeFileLinkFromParentStub;
  let removeFileLinkBetweenSiblingsStub;
  const projectRootDir = "/mock/project";
  const srcComp = "srcComp";
  const srcFile = "srcFile";
  const dstComp = "dstComp";
  const dstFile = "dstFile";

  beforeEach(()=>{
    isParentStub = sinon.stub(projectFilesOperator._internal, "isParent");
    removeFileLinkToParentStub = sinon.stub(projectFilesOperator._internal, "removeFileLinkToParent").resolves();
    removeFileLinkFromParentStub = sinon.stub(projectFilesOperator._internal, "removeFileLinkFromParent").resolves();
    removeFileLinkBetweenSiblingsStub = sinon.stub(projectFilesOperator._internal, "removeFileLinkBetweenSiblings").resolves();
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should call removeFileLinkToParent if dstNode is parent of srcNode", async ()=>{
    isParentStub.withArgs(projectRootDir, dstComp, srcComp).resolves(true);

    await projectFilesOperator.removeFileLink(projectRootDir, srcComp, srcFile, dstComp, dstFile);

    expect(isParentStub.calledOnce).to.be.true;
    expect(removeFileLinkToParentStub.calledOnceWith(projectRootDir, srcComp, srcFile, dstFile)).to.be.true;
    expect(removeFileLinkFromParentStub.notCalled).to.be.true;
    expect(removeFileLinkBetweenSiblingsStub.notCalled).to.be.true;
  });

  it("should call removeFileLinkFromParent if srcNode is parent of dstNode", async ()=>{
    isParentStub.withArgs(projectRootDir, dstComp, srcComp).resolves(false);
    isParentStub.withArgs(projectRootDir, srcComp, dstComp).resolves(true);

    await projectFilesOperator.removeFileLink(projectRootDir, srcComp, srcFile, dstComp, dstFile);

    expect(isParentStub.callCount).to.equal(2);
    expect(removeFileLinkToParentStub.notCalled).to.be.true;
    expect(removeFileLinkFromParentStub.calledOnceWith(projectRootDir, srcFile, dstComp, dstFile)).to.be.true;
    expect(removeFileLinkBetweenSiblingsStub.notCalled).to.be.true;
  });

  it("should call removeFileLinkBetweenSiblings if neither is parent", async ()=>{
    isParentStub.resolves(false);

    await projectFilesOperator.removeFileLink(projectRootDir, srcComp, srcFile, dstComp, dstFile);

    expect(isParentStub.callCount).to.equal(2);
    expect(removeFileLinkToParentStub.notCalled).to.be.true;
    expect(removeFileLinkFromParentStub.notCalled).to.be.true;
    expect(removeFileLinkBetweenSiblingsStub.calledOnceWith(projectRootDir, srcComp, srcFile, dstComp, dstFile)).to.be.true;
  });

  it("should throw an error if the first isParent call fails", async ()=>{
    const testError = new Error("isParent error");
    isParentStub.withArgs(projectRootDir, dstComp, srcComp).rejects(testError);

    try {
      await projectFilesOperator.removeFileLink(projectRootDir, srcComp, srcFile, dstComp, dstFile);
      throw new Error("should have been rejected");
    } catch (err) {
      expect(err).to.equal(testError);
    }
  });

  it("should throw an error if the second isParent call fails", async ()=>{
    const testError = new Error("second isParent error");
    isParentStub.withArgs(projectRootDir, dstComp, srcComp).resolves(false);
    isParentStub.withArgs(projectRootDir, srcComp, dstComp).rejects(testError);

    try {
      await projectFilesOperator.removeFileLink(projectRootDir, srcComp, srcFile, dstComp, dstFile);
      throw new Error("should have been rejected");
    } catch (err) {
      expect(err).to.equal(testError);
    }
  });
});