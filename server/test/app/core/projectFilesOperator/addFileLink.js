/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#addFileLink", ()=>{
  const projectRootDir = "/mock/project";
  const srcNode = "srcNode";
  const srcName = "out.dat";
  const dstNode = "dstNode";
  const dstName = "in.dat";
  let isParentStub;
  let addFileLinkToParentStub;
  let addFileLinkFromParentStub;
  let addFileLinkBetweenSiblingsStub;

  beforeEach(()=>{
    isParentStub = sinon.stub(projectFilesOperator._internal, "isParent");
    addFileLinkToParentStub = sinon.stub(projectFilesOperator._internal, "addFileLinkToParent").resolves();
    addFileLinkFromParentStub = sinon.stub(projectFilesOperator._internal, "addFileLinkFromParent").resolves();
    addFileLinkBetweenSiblingsStub = sinon.stub(projectFilesOperator._internal, "addFileLinkBetweenSiblings").resolves();
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if srcNode and dstNode are the same", async ()=>{
    try {
      await projectFilesOperator.addFileLink(projectRootDir, "same", srcName, "same", dstName);
      throw new Error("Expected addFileLink to reject with an error");
    } catch (err) {
      expect(err).to.be.an("Error");
      expect(err.message).to.equal("cyclic link is not allowed");
    }

    expect(isParentStub.notCalled).to.be.true;
    expect(addFileLinkToParentStub.notCalled).to.be.true;
    expect(addFileLinkFromParentStub.notCalled).to.be.true;
    expect(addFileLinkBetweenSiblingsStub.notCalled).to.be.true;
  });

  it("should call addFileLinkToParent if dstNode is parent of srcNode", async ()=>{
    isParentStub.withArgs(projectRootDir, dstNode, srcNode).resolves(true);

    await projectFilesOperator.addFileLink(projectRootDir, srcNode, srcName, dstNode, dstName);

    expect(addFileLinkToParentStub.calledOnceWithExactly(
      projectRootDir, srcNode, srcName, dstName
    )).to.be.true;

    expect(isParentStub.callCount).to.equal(1);
    expect(addFileLinkFromParentStub.notCalled).to.be.true;
    expect(addFileLinkBetweenSiblingsStub.notCalled).to.be.true;
  });

  it("should call addFileLinkFromParent if srcNode is parent of dstNode", async ()=>{
    isParentStub.withArgs(projectRootDir, dstNode, srcNode).resolves(false);
    isParentStub.withArgs(projectRootDir, srcNode, dstNode).resolves(true);

    await projectFilesOperator.addFileLink(projectRootDir, srcNode, srcName, dstNode, dstName);

    expect(addFileLinkFromParentStub.calledOnceWithExactly(
      projectRootDir, srcName, dstNode, dstName
    )).to.be.true;

    expect(isParentStub.callCount).to.equal(2);
    expect(addFileLinkToParentStub.notCalled).to.be.true;
    expect(addFileLinkBetweenSiblingsStub.notCalled).to.be.true;
  });

  it("should call addFileLinkBetweenSiblings otherwise", async ()=>{
    isParentStub.resolves(false);

    await projectFilesOperator.addFileLink(projectRootDir, srcNode, srcName, dstNode, dstName);

    expect(addFileLinkBetweenSiblingsStub.calledOnceWithExactly(
      projectRootDir, srcNode, srcName, dstNode, dstName
    )).to.be.true;

    expect(isParentStub.callCount).to.equal(2);
    expect(addFileLinkToParentStub.notCalled).to.be.true;
    expect(addFileLinkFromParentStub.notCalled).to.be.true;
  });
});
