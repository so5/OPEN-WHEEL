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


describe.skip("#removeLink", ()=>{
  let rewireProjectFilesOperator;
  let removeLink;
  let getComponentDirMock;
  let readComponentJsonMock;
  let writeComponentJsonMock;

  beforeEach(()=>{
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    removeLink = rewireProjectFilesOperator.__get__("removeLink");

    //Sinonで使うテストダブル（Mock）の命名ルール: 変数名末尾はMock
    getComponentDirMock = sinon.stub();
    readComponentJsonMock = sinon.stub();
    writeComponentJsonMock = sinon.stub().resolves();

    rewireProjectFilesOperator.__set__({
      getComponentDir: getComponentDirMock,
      readComponentJson: readComponentJsonMock,
      writeComponentJson: writeComponentJsonMock
    });
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should remove dst from srcJson.next when isElse is false, and remove src from dstJson.previous", async ()=>{
    const projectRootDir = "/mock/project/root";
    const src = "componentSrc";
    const dst = "componentDst";
    const isElse = false;

    const mockSrcDir = "/mock/project/root/srcDir";
    const mockDstDir = "/mock/project/root/dstDir";

    //srcJsonにはnext配列を用意
    const mockSrcJson = {
      next: ["componentX", "componentDst", "componentY"],
      else: ["componentA"]
      //... 省略
    };

    //dstJsonにはprevious配列を用意
    const mockDstJson = {
      previous: ["componentQ", "componentSrc", "componentW"]
      //... 省略
    };

    getComponentDirMock.withArgs(projectRootDir, src, true).resolves(mockSrcDir);
    getComponentDirMock.withArgs(projectRootDir, dst, true).resolves(mockDstDir);

    readComponentJsonMock.withArgs(mockSrcDir).resolves(mockSrcJson);
    readComponentJsonMock.withArgs(mockDstDir).resolves(mockDstJson);

    //実行
    await removeLink(projectRootDir, src, dst, isElse);

    //検証: next配列から"componentDst"が取り除かれている
    expect(mockSrcJson.next).to.deep.equal(["componentX", "componentY"]);
    //else配列は変更なし
    expect(mockSrcJson.else).to.deep.equal(["componentA"]);

    //dstJsonのprevious配列から"componentSrc"が取り除かれている
    expect(mockDstJson.previous).to.deep.equal(["componentQ", "componentW"]);

    //writeComponentJsonが呼ばれたことを検証
    expect(writeComponentJsonMock.callCount).to.equal(2);
    expect(writeComponentJsonMock.firstCall.args[1]).to.equal(mockSrcDir);
    expect(writeComponentJsonMock.firstCall.args[2]).to.equal(mockSrcJson);
    expect(writeComponentJsonMock.secondCall.args[1]).to.equal(mockDstDir);
    expect(writeComponentJsonMock.secondCall.args[2]).to.equal(mockDstJson);
  });

  it("should remove dst from srcJson.else when isElse is true, and remove src from dstJson.previous", async ()=>{
    const projectRootDir = "/mock/project/root";
    const src = "componentSrc";
    const dst = "componentDst";
    const isElse = true;

    const mockSrcDir = "/mock/project/root/srcDir";
    const mockDstDir = "/mock/project/root/dstDir";

    //srcJsonにはelse配列を用意
    const mockSrcJson = {
      next: ["componentB"],
      else: ["componentDst", "componentC"]
    };

    //dstJsonにはprevious配列を用意
    const mockDstJson = {
      previous: ["componentSrc", "componentZ"]
    };

    getComponentDirMock.withArgs(projectRootDir, src, true).resolves(mockSrcDir);
    getComponentDirMock.withArgs(projectRootDir, dst, true).resolves(mockDstDir);

    readComponentJsonMock.withArgs(mockSrcDir).resolves(mockSrcJson);
    readComponentJsonMock.withArgs(mockDstDir).resolves(mockDstJson);

    await removeLink(projectRootDir, src, dst, isElse);

    //else配列から"componentDst"が削除されている
    expect(mockSrcJson.else).to.deep.equal(["componentC"]);
    //next配列は変更なし
    expect(mockSrcJson.next).to.deep.equal(["componentB"]);

    //dst側のpreviousから"componentSrc"が削除
    expect(mockDstJson.previous).to.deep.equal(["componentZ"]);

    expect(writeComponentJsonMock.callCount).to.equal(2);
  });

  it("should do nothing if dst does not exist in srcJson.next/else, and still remove src from dstJson.previous", async ()=>{
    const projectRootDir = "/mock/project/root";
    const src = "componentSrc";
    const dst = "notInArray";
    const isElse = false; //どちらでも動作確認する

    const mockSrcDir = "/mock/project/root/srcDir";
    const mockDstDir = "/mock/project/root/dstDir";

    //srcJsonにdstが含まれていないケース
    const mockSrcJson = {
      next: ["componentX", "componentY"],
      else: []
    };
    const mockDstJson = {
      previous: ["componentSrc", "componentQ"]
    };

    getComponentDirMock.withArgs(projectRootDir, src, true).resolves(mockSrcDir);
    getComponentDirMock.withArgs(projectRootDir, dst, true).resolves(mockDstDir);

    readComponentJsonMock.withArgs(mockSrcDir).resolves(mockSrcJson);
    readComponentJsonMock.withArgs(mockDstDir).resolves(mockDstJson);

    await removeLink(projectRootDir, src, dst, isElse);

    //next配列は変わらない
    expect(mockSrcJson.next).to.deep.equal(["componentX", "componentY"]);
    //dst側previousはsrcを削除
    expect(mockDstJson.previous).to.deep.equal(["componentQ"]);

    expect(writeComponentJsonMock.callCount).to.equal(2);
  });

  it("should do nothing if src does not exist in dstJson.previous, but still remove dst from srcJson", async ()=>{
    const projectRootDir = "/mock/project/root";
    const src = "componentSrc";
    const dst = "componentDst";
    const isElse = false;

    const mockSrcDir = "/mock/project/root/srcDir";
    const mockDstDir = "/mock/project/root/dstDir";

    const mockSrcJson = {
      next: ["componentDst", "componentK"],
      else: []
    };
    //dstJsonのpreviousにsrcが無いケース
    const mockDstJson = {
      previous: ["componentM", "componentN"]
    };

    getComponentDirMock.withArgs(projectRootDir, src, true).resolves(mockSrcDir);
    getComponentDirMock.withArgs(projectRootDir, dst, true).resolves(mockDstDir);

    readComponentJsonMock.withArgs(mockSrcDir).resolves(mockSrcJson);
    readComponentJsonMock.withArgs(mockDstDir).resolves(mockDstJson);

    await removeLink(projectRootDir, src, dst, isElse);

    //srcJson.next からcomponentDstを削除
    expect(mockSrcJson.next).to.deep.equal(["componentK"]);
    //dstJson.previous は変わらず
    expect(mockDstJson.previous).to.deep.equal(["componentM", "componentN"]);

    expect(writeComponentJsonMock.callCount).to.equal(2);
  });
});
