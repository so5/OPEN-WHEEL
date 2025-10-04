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


describe.skip("#addFileLink", ()=>{
  let rewireProjectFilesOperator;
  let addFileLink;
  let isParentMock;
  let addFileLinkToParentMock;
  let addFileLinkFromParentMock;
  let addFileLinkBetweenSiblingsMock;

  const projectRootDir = "/mock/project";
  const srcNode = "srcNode";
  const srcName = "out.dat";
  const dstNode = "dstNode";
  const dstName = "in.dat";

  beforeEach(()=>{
    //rewireでプロダクトコードを読み込み
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    //テスト対象の関数を取得
    addFileLink = rewireProjectFilesOperator.__get__("addFileLink");

    //依存関数をstub化
    isParentMock = sinon.stub();
    addFileLinkToParentMock = sinon.stub().resolves();
    addFileLinkFromParentMock = sinon.stub().resolves();
    addFileLinkBetweenSiblingsMock = sinon.stub().resolves();

    //rewireを使って依存関数を差し替え
    rewireProjectFilesOperator.__set__("isParent", isParentMock);
    rewireProjectFilesOperator.__set__("addFileLinkToParent", addFileLinkToParentMock);
    rewireProjectFilesOperator.__set__("addFileLinkFromParent", addFileLinkFromParentMock);
    rewireProjectFilesOperator.__set__("addFileLinkBetweenSiblings", addFileLinkBetweenSiblingsMock);
  });

  it("should reject if srcNode and dstNode are the same", async ()=>{
    try {
      await addFileLink(projectRootDir, "same", srcName, "same", dstName);
      throw new Error("Expected addFileLink to reject with an error");
    } catch (err) {
      expect(err).to.be.an("Error");
      expect(err.message).to.equal("cyclic link is not allowed");
    }

    expect(isParentMock.notCalled).to.be.true;
    expect(addFileLinkToParentMock.notCalled).to.be.true;
    expect(addFileLinkFromParentMock.notCalled).to.be.true;
    expect(addFileLinkBetweenSiblingsMock.notCalled).to.be.true;
  });

  it("should call addFileLinkToParent if dstNode is parent of srcNode", async ()=>{
    //(B) dstNode が srcNode の親
    isParentMock.onFirstCall().resolves(true); //isParent(projectRootDir, dstNode, srcNode) => true

    await addFileLink(projectRootDir, srcNode, srcName, dstNode, dstName);

    //addFileLinkToParent が呼ばれていること
    expect(addFileLinkToParentMock.calledOnceWithExactly(
      projectRootDir, srcNode, srcName, dstName
    )).to.be.true;

    //他の関数は呼ばれない
    expect(isParentMock.callCount).to.equal(1);
    expect(addFileLinkFromParentMock.notCalled).to.be.true;
    expect(addFileLinkBetweenSiblingsMock.notCalled).to.be.true;
  });

  it("should call addFileLinkFromParent if srcNode is parent of dstNode", async ()=>{
    //(C) dstNode が親ではない => false, srcNode が親 => true
    isParentMock.onFirstCall().resolves(false); //dstNodeがsrcNodeの親か？ => false
    isParentMock.onSecondCall().resolves(true); //srcNodeがdstNodeの親か？ => true

    await addFileLink(projectRootDir, srcNode, srcName, dstNode, dstName);

    //addFileLinkFromParent が呼ばれていること
    expect(addFileLinkFromParentMock.calledOnceWithExactly(
      projectRootDir, srcName, dstNode, dstName
    )).to.be.true;

    expect(addFileLinkToParentMock.notCalled).to.be.true;
    expect(addFileLinkBetweenSiblingsMock.notCalled).to.be.true;
  });

  it("should call addFileLinkBetweenSiblings otherwise", async ()=>{
    //(D) isParent が両方 false => siblings のケース
    isParentMock.onFirstCall().resolves(false);
    isParentMock.onSecondCall().resolves(false);

    await addFileLink(projectRootDir, srcNode, srcName, dstNode, dstName);

    expect(addFileLinkBetweenSiblingsMock.calledOnceWithExactly(
      projectRootDir, srcNode, srcName, dstNode, dstName
    )).to.be.true;

    expect(addFileLinkToParentMock.notCalled).to.be.true;
    expect(addFileLinkFromParentMock.notCalled).to.be.true;
  });
});
