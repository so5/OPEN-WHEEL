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


describe.skip("#addLink", ()=>{
  let rewireProjectFilesOperator;
  let addLink;
  let getComponentDirMock;
  let readComponentJsonMock;
  let writeComponentJsonMock;
  let updateStepNumberMock;

  const projectRootDir = "/mock/project/root";

  beforeEach(()=>{
    //rewireでモジュール読み込み
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");

    //テスト対象関数を取得
    addLink = rewireProjectFilesOperator.__get__("addLink");

    //依存関数をスタブ化
    getComponentDirMock = sinon.stub();
    readComponentJsonMock = sinon.stub();
    writeComponentJsonMock = sinon.stub().resolves();
    updateStepNumberMock = sinon.stub().resolves();

    //rewireで内部参照を書き換え
    rewireProjectFilesOperator.__set__({
      getComponentDir: getComponentDirMock,
      readComponentJson: readComponentJsonMock,
      writeComponentJson: writeComponentJsonMock,
      updateStepNumber: updateStepNumberMock
    });
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if src === dst (cyclic link not allowed)", async ()=>{
    try {
      await addLink(projectRootDir, "sameID", "sameID");
      throw new Error("Expected addLink to reject");
    } catch (err) {
      expect(err.message).to.equal("cyclic link is not allowed");
    }
  });

  it("should reject if either component is 'viewer'", async ()=>{
    //srcがviewerの場合
    getComponentDirMock.onFirstCall().resolves("/mock/srcDir");
    readComponentJsonMock.onFirstCall().resolves({
      type: "viewer", name: "ViewerComponent", else: [], next: [], previous: []
    });
    //dst
    getComponentDirMock.onSecondCall().resolves("/mock/dstDir");
    readComponentJsonMock.onSecondCall().resolves({
      type: "task", name: "SomeTask", else: [], next: [], previous: []
    });

    try {
      await addLink(projectRootDir, "viewerID", "taskID", false);
      throw new Error("Expected addLink to reject");
    } catch (err) {
      expect(err.message).to.equal("viewer can not have link");
      expect(err.code).to.equal("ELINK");
      expect(err.src).to.equal("viewerID");
      expect(err.dst).to.equal("taskID");
      expect(err.isElse).to.be.false;
    }
  });

  it("should reject if either component is 'source'", async ()=>{
    //srcがtask、dstがsourceの場合の例
    getComponentDirMock.onFirstCall().resolves("/mock/srcDir");
    readComponentJsonMock.onFirstCall().resolves({
      type: "task", name: "TaskComp", else: [], next: [], previous: []
    });
    getComponentDirMock.onSecondCall().resolves("/mock/dstDir");
    readComponentJsonMock.onSecondCall().resolves({
      type: "source", name: "SourceComp", else: [], next: [], previous: []
    });

    try {
      await addLink(projectRootDir, "taskID", "sourceID", true);
      throw new Error("Expected addLink to reject");
    } catch (err) {
      expect(err.message).to.equal("source can not have link");
      expect(err.code).to.equal("ELINK");
      expect(err.src).to.equal("taskID");
      expect(err.dst).to.equal("sourceID");
      expect(err.isElse).to.be.true;
    }
  });

  it("should add dst to src.else if isElse is true, and not already in the array", async ()=>{
    //srcJson.typeがtask, dstJson.typeがtaskなど
    getComponentDirMock.onFirstCall().resolves("/mock/srcDir");
    readComponentJsonMock.onFirstCall().resolves({
      type: "task",
      name: "TaskA",
      else: ["existingElseID"],
      next: [],
      previous: []
    });

    getComponentDirMock.onSecondCall().resolves("/mock/dstDir");
    readComponentJsonMock.onSecondCall().resolves({
      type: "task",
      name: "TaskB",
      else: [],
      next: [],
      previous: []
    });

    await addLink(projectRootDir, "srcID", "dstID", true);

    //src側: elseに追加される
    const srcWriteCallArg = writeComponentJsonMock.firstCall.args[2]; //srcJson
    expect(srcWriteCallArg.else).to.deep.equal(["existingElseID", "dstID"]);

    //dst側: previousにsrcID追加
    const dstWriteCallArg = writeComponentJsonMock.secondCall.args[2]; //dstJson
    expect(dstWriteCallArg.previous).to.deep.equal(["srcID"]);
  });

  it("should add dst to src.next if isElse is false, and not already in the array", async ()=>{
    getComponentDirMock.onFirstCall().resolves("/mock/srcDir");
    readComponentJsonMock.onFirstCall().resolves({
      type: "task",
      name: "TaskA",
      else: [],
      next: ["alreadyThere"],
      previous: []
    });

    getComponentDirMock.onSecondCall().resolves("/mock/dstDir");
    readComponentJsonMock.onSecondCall().resolves({
      type: "task",
      name: "TaskB",
      else: [],
      next: [],
      previous: []
    });

    await addLink(projectRootDir, "srcID", "dstID", false);

    //src側
    const srcWriteCallArg = writeComponentJsonMock.firstCall.args[2];
    expect(srcWriteCallArg.next).to.deep.equal(["alreadyThere", "dstID"]);

    //dst側
    const dstWriteCallArg = writeComponentJsonMock.secondCall.args[2];
    expect(dstWriteCallArg.previous).to.deep.equal(["srcID"]);
  });

  it("should not duplicate dst in srcJson.else or srcJson.next if it already exists", async ()=>{
    getComponentDirMock.onFirstCall().resolves("/mock/srcDir");
    readComponentJsonMock.onFirstCall().resolves({
      type: "task",
      name: "TaskA",
      else: ["dstID"], //すでにdstIDがある
      next: [],
      previous: []
    });

    getComponentDirMock.onSecondCall().resolves("/mock/dstDir");
    readComponentJsonMock.onSecondCall().resolves({
      type: "task",
      name: "TaskB",
      else: [],
      next: [],
      previous: ["srcID"] //すでにsrcIDがある
    });

    await addLink(projectRootDir, "srcID", "dstID", true);

    //src側
    const srcWriteCallArg = writeComponentJsonMock.firstCall.args[2];
    expect(srcWriteCallArg.else).to.deep.equal(["dstID"]); //重複追加されない

    //dst側
    const dstWriteCallArg = writeComponentJsonMock.secondCall.args[2];
    expect(dstWriteCallArg.previous).to.deep.equal(["srcID"]); //重複追加されない
  });

  it("should call updateStepNumber if both src and dst are stepjobTask", async ()=>{
    getComponentDirMock.onFirstCall().resolves("/mock/srcDir");
    readComponentJsonMock.onFirstCall().resolves({
      type: "stepjobTask", else: [], next: [], previous: []
    });

    getComponentDirMock.onSecondCall().resolves("/mock/dstDir");
    readComponentJsonMock.onSecondCall().resolves({
      type: "stepjobTask", else: [], next: [], previous: []
    });

    await addLink(projectRootDir, "srcID", "dstID", false);
    expect(updateStepNumberMock.calledOnce).to.be.true;
  });

  it("should not call updateStepNumber if src is stepjobTask but dst is task", async ()=>{
    getComponentDirMock.onFirstCall().resolves("/mock/srcDir");
    readComponentJsonMock.onFirstCall().resolves({
      type: "stepjobTask", else: [], next: [], previous: []
    });

    getComponentDirMock.onSecondCall().resolves("/mock/dstDir");
    readComponentJsonMock.onSecondCall().resolves({
      type: "task", else: [], next: [], previous: []
    });

    await addLink(projectRootDir, "srcID", "dstID");
    expect(updateStepNumberMock.notCalled).to.be.true;
  });

  it("should handle writeComponentJson rejections", async ()=>{
    //書き込み時にエラーが出るケース
    getComponentDirMock.resolves("/mock/dir");
    readComponentJsonMock.resolves({ type: "task", else: [], next: [], previous: [] });
    writeComponentJsonMock.rejects(new Error("write failed"));

    try {
      await addLink(projectRootDir, "x", "y", false);
      throw new Error("Expected addLink to throw");
    } catch (err) {
      expect(err.message).to.equal("write failed");
    }
  });
});
