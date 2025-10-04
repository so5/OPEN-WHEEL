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


describe.skip("#removeFileLink", ()=>{
  let rewireProjectFilesOperator;
  let removeFileLink;
  let isParentMock;
  let removeFileLinkToParentMock;
  let removeFileLinkFromParentMock;
  let removeFileLinkBetweenSiblingsMock;

  beforeEach(()=>{
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    removeFileLink = rewireProjectFilesOperator.__get__("removeFileLink");

    //sinon.stub()で作成したテストダブルは変数末尾にMockを付ける
    isParentMock = sinon.stub();
    removeFileLinkToParentMock = sinon.stub().resolves();
    removeFileLinkFromParentMock = sinon.stub().resolves();
    removeFileLinkBetweenSiblingsMock = sinon.stub().resolves();

    //テスト対象が内部で呼んでいる関数をスタブ化
    rewireProjectFilesOperator.__set__("isParent", isParentMock);
    rewireProjectFilesOperator.__set__("removeFileLinkToParent", removeFileLinkToParentMock);
    rewireProjectFilesOperator.__set__("removeFileLinkFromParent", removeFileLinkFromParentMock);
    rewireProjectFilesOperator.__set__("removeFileLinkBetweenSiblings", removeFileLinkBetweenSiblingsMock);
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should call removeFileLinkToParent if dstNode is parent of srcNode", async ()=>{
    //dstNodeがsrcNodeの親であると判定
    isParentMock.onCall(0).resolves(true); //isParent(projectRootDir, dstNode, srcNode) => true

    await removeFileLink("/mock/project", "srcComp", "srcFile", "dstComp", "dstFile");

    expect(isParentMock.callCount).to.equal(1);
    expect(removeFileLinkToParentMock.calledOnce).to.be.true;
    expect(removeFileLinkToParentMock.calledWithExactly(
      "/mock/project", "srcComp", "srcFile", "dstFile"
    )).to.be.true;
    expect(removeFileLinkFromParentMock.called).to.be.false;
    expect(removeFileLinkBetweenSiblingsMock.called).to.be.false;
  });

  it("should call removeFileLinkFromParent if srcNode is parent of dstNode", async ()=>{
    //dstNodeがsrcNodeの親ではない => false
    //srcNodeがdstNodeの親である => true
    isParentMock.onCall(0).resolves(false);
    isParentMock.onCall(1).resolves(true);

    await removeFileLink("/mock/project", "srcComp", "srcFile", "dstComp", "dstFile");

    //dstNodeがsrcNodeの親かを先に確認
    expect(isParentMock.firstCall.args).to.deep.equal([
      "/mock/project", "dstComp", "srcComp"
    ]);
    //srcNodeがdstNodeの親かを2番目に確認
    expect(isParentMock.secondCall.args).to.deep.equal([
      "/mock/project", "srcComp", "dstComp"
    ]);

    expect(removeFileLinkToParentMock.called).to.be.false;
    expect(removeFileLinkFromParentMock.calledOnce).to.be.true;
    expect(removeFileLinkFromParentMock.calledWithExactly(
      "/mock/project", "srcFile", "dstComp", "dstFile"
    )).to.be.true;
    expect(removeFileLinkBetweenSiblingsMock.called).to.be.false;
  });

  it("should call removeFileLinkBetweenSiblings if neither is parent", async ()=>{
    //dstNodeがsrcNodeの親 => false, srcNodeがdstNodeの親 => false
    isParentMock.onCall(0).resolves(false);
    isParentMock.onCall(1).resolves(false);

    await removeFileLink("/mock/project", "srcComp", "srcFile", "dstComp", "dstFile");

    expect(isParentMock.callCount).to.equal(2);
    expect(removeFileLinkToParentMock.called).to.be.false;
    expect(removeFileLinkFromParentMock.called).to.be.false;
    expect(removeFileLinkBetweenSiblingsMock.calledOnce).to.be.true;
    expect(removeFileLinkBetweenSiblingsMock.calledWithExactly(
      "/mock/project", "srcComp", "srcFile", "dstComp", "dstFile"
    )).to.be.true;
  });

  it("should throw an error if isParent throws an error (first check)", async ()=>{
    //最初の isParent 呼び出しでエラーがthrowされるケース
    const testError = new Error("isParent error");
    isParentMock.onCall(0).rejects(testError);

    await expect(
      removeFileLink("/mock/project", "srcComp", "srcFile", "dstComp", "dstFile")
    ).to.be.rejectedWith("isParent error");

    expect(isParentMock.calledOnce).to.be.true;
    expect(removeFileLinkToParentMock.called).to.be.false;
    expect(removeFileLinkFromParentMock.called).to.be.false;
    expect(removeFileLinkBetweenSiblingsMock.called).to.be.false;
  });

  it("should throw an error if the second isParent call throws an error", async ()=>{
    //最初の isParent は falseを返す => 次の isParent でエラー
    isParentMock.onCall(0).resolves(false);
    isParentMock.onCall(1).rejects(new Error("second isParent error"));

    await expect(
      removeFileLink("/mock/project", "srcComp", "srcFile", "dstComp", "dstFile")
    ).to.be.rejectedWith("second isParent error");

    expect(isParentMock.callCount).to.equal(2);
    expect(removeFileLinkToParentMock.called).to.be.false;
    expect(removeFileLinkFromParentMock.called).to.be.false;
    expect(removeFileLinkBetweenSiblingsMock.called).to.be.false;
  });
});
