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


describe.skip("#removeAllLink", ()=>{
  let rewireProjectFilesOperator;
  let removeAllLink;
  let getComponentDirMock;
  let readComponentJsonMock;
  let writeComponentJsonMock;
  let projectRootDir;
  let componentID;

  beforeEach(()=>{
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    removeAllLink = rewireProjectFilesOperator.__get__("removeAllLink");

    //sinon.stub()でテストダブルを作成（～Mock）
    getComponentDirMock = sinon.stub();
    readComponentJsonMock = sinon.stub();
    writeComponentJsonMock = sinon.stub();

    //関数を差し替え
    rewireProjectFilesOperator.__set__({
      getComponentDir: getComponentDirMock,
      readComponentJson: readComponentJsonMock,
      writeComponentJson: writeComponentJsonMock
    });

    projectRootDir = "/mock/project/root";
    componentID = "dstCompID";
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should do nothing when dstJson.previous is an empty array", async ()=>{
    //dstDir, dstJsonの設定
    getComponentDirMock.onFirstCall().resolves("/mock/project/root/dstDir");
    readComponentJsonMock.onFirstCall().resolves({ previous: [] });

    //実行
    await removeAllLink(projectRootDir, componentID);

    //期待動作: srcは一切呼び出されず、dstJson.previous = [] の書き戻しだけ行われる
    expect(getComponentDirMock.calledOnce).to.be.true;
    expect(readComponentJsonMock.calledOnce).to.be.true;
    //src用のwriteComponentJsonは呼ばれない
    expect(writeComponentJsonMock.calledOnce).to.be.true;
    const writtenDstArgs = writeComponentJsonMock.firstCall.args;
    expect(writtenDstArgs[1]).to.equal("/mock/project/root/dstDir"); //dstDir
    expect(writtenDstArgs[2]).to.deep.equal({ previous: [] }); //previousが空配列のまま
  });

  it("should remove componentID from srcJson.next and srcJson.else if they are arrays", async ()=>{
    //シナリオ: dstJson.previousに2つのsrcがある
    getComponentDirMock.onCall(0).resolves("/mock/project/root/dstDir");
    readComponentJsonMock.onCall(0).resolves({
      previous: ["srcCompA", "srcCompB"]
    });

    //srcCompA
    getComponentDirMock.onCall(1).resolves("/mock/project/root/srcCompA");
    //next配列にcomponentIDが含まれている
    readComponentJsonMock.onCall(1).resolves({
      next: ["dstCompID", "anotherID"],
      else: ["otherID", "dstCompID"]
    });

    //srcCompB
    getComponentDirMock.onCall(2).resolves("/mock/project/root/srcCompB");
    //elseのみ配列にcomponentIDが含まれない
    readComponentJsonMock.onCall(2).resolves({
      next: ["someID"],
      else: ["x", "y"]
    });

    //dst側書き込み後、srcA, srcB書き込みの順で3回writeComponentJsonが呼ばれる想定

    await removeAllLink(projectRootDir, componentID);

    //dstDir取得 + srcA/srcB取得 で計3回のgetComponentDirが呼ばれる
    expect(getComponentDirMock.callCount).to.equal(3);
    //dstJson + srcA + srcB の順で計3回readされる
    expect(readComponentJsonMock.callCount).to.equal(3);

    //書き込まれる回数3回 (srcA, srcB, dst)
    expect(writeComponentJsonMock.callCount).to.equal(3);

    //まずsrcAを書き込むときの引数検証
    const [rootA, dirA, newSrcAjson] = writeComponentJsonMock.getCall(0).args;
    expect(rootA).to.equal(projectRootDir);
    expect(dirA).to.equal("/mock/project/root/srcCompA");
    expect(newSrcAjson.next).to.deep.equal(["anotherID"]); //dstCompIDがfilterされて消える
    expect(newSrcAjson.else).to.deep.equal(["otherID"]); //dstCompIDがfilterされて消える

    //次にsrcBを書き込むときの引数検証
    const [rootB, dirB, newSrcBjson] = writeComponentJsonMock.getCall(1).args;
    expect(rootB).to.equal(projectRootDir);
    expect(dirB).to.equal("/mock/project/root/srcCompB");
    expect(newSrcBjson.next).to.deep.equal(["someID"]); //もともと"dstCompID"が無いため変化なし
    expect(newSrcBjson.else).to.deep.equal(["x", "y"]); //もともと含まれていない

    //最後にdstを書き込むときの引数検証
    const [rootDst, dstDir, updatedDstJson] = writeComponentJsonMock.getCall(2).args;
    expect(rootDst).to.equal(projectRootDir);
    expect(dstDir).to.equal("/mock/project/root/dstDir");
    expect(updatedDstJson.previous).to.deep.equal([]); //previousは空配列に
  });

  it("should skip removing next if srcJson.next is not an array", async ()=>{
    getComponentDirMock.onCall(0).resolves("/mock/project/root/dstDir");
    readComponentJsonMock.onCall(0).resolves({ previous: ["srcCompC"] });

    //srcCompC
    getComponentDirMock.onCall(1).resolves("/mock/project/root/srcCompC");
    readComponentJsonMock.onCall(1).resolves({
      next: "not-an-array",
      else: ["dstCompID"]
    });

    await removeAllLink(projectRootDir, componentID);

    //書き込みは最終的にsrcCompC, dst の2回
    expect(writeComponentJsonMock.callCount).to.equal(2);

    const [rootC, dirC, newSrcCjson] = writeComponentJsonMock.getCall(0).args;
    expect(rootC).to.equal(projectRootDir);
    expect(dirC).to.equal("/mock/project/root/srcCompC");
    //nextは配列でないので除去処理が行われず、元のまま
    expect(newSrcCjson.next).to.equal("not-an-array");
    //elseは配列なのでdstCompIDがfilterされる
    expect(newSrcCjson.else).to.deep.equal([]);

    //dstJsonはpreviousが空配列に
    //eslint-disable-next-line no-unused-vars
    const [_rootDst, _dstDir, updatedDst] = writeComponentJsonMock.getCall(1).args;
    expect(updatedDst.previous).to.deep.equal([]);
  });

  it("should skip removing else if srcJson.else is not an array", async ()=>{
    getComponentDirMock.onCall(0).resolves("/mock/project/root/dstDir");
    readComponentJsonMock.onCall(0).resolves({ previous: ["srcCompD"] });

    //srcCompD
    getComponentDirMock.onCall(1).resolves("/mock/project/root/srcCompD");
    readComponentJsonMock.onCall(1).resolves({
      next: ["dstCompID"],
      else: "not-array-else"
    });

    await removeAllLink(projectRootDir, componentID);

    //書き込み回数はsrcCompD と dst の2回
    expect(writeComponentJsonMock.callCount).to.equal(2);

    //srcCompD検証
    //eslint-disable-next-line no-unused-vars
    const [_rootS, _dirS, newSrcDjson] = writeComponentJsonMock.getCall(0).args;
    expect(newSrcDjson.next).to.deep.equal([]); //filterされてdstCompID削除
    expect(newSrcDjson.else).to.equal("not-array-else");

    //dstJson検証
    //eslint-disable-next-line no-unused-vars
    const [_rootD, _dirD, newDstJson] = writeComponentJsonMock.getCall(1).args;
    expect(newDstJson.previous).to.deep.equal([]);
  });
});
