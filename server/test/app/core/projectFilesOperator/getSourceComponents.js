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


describe.skip("#getSourceComponents", ()=>{
  let rewireProjectFilesOperator;
  let getSourceComponents;
  let promisifyStub;
  let globStub;
  let readJsonGreedyStub;
  const mockProjectRootDir = "/mock/project/root";

  beforeEach(()=>{
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    getSourceComponents = rewireProjectFilesOperator.__get__("getSourceComponents");

    globStub = sinon.stub();
    readJsonGreedyStub = sinon.stub();

    //promisify の戻り値として globStub を返すようにする
    promisifyStub = sinon.stub().callsFake(()=>{
      return globStub;
    });

    //rewireで依存する関数を差し替える
    rewireProjectFilesOperator.__set__({
      promisify: promisifyStub,
      readJsonGreedy: readJsonGreedyStub
    });
  });

  it("should return only source components (subComponent=false, disable=false)", async ()=>{
    //Arrange
    const mockFiles = [
      "/mock/project/root/comp1/cmp.wheel.json",
      "/mock/project/root/comp2/cmp.wheel.json",
      "/mock/project/root/comp3/cmp.wheel.json",
      "/mock/project/root/comp4/cmp.wheel.json"
    ];
    globStub.resolves(mockFiles);

    //comp1: source かつ subComponent=false, disable=false ⇒ フィルタを通る
    //comp2: source かつ subComponent=true ⇒ フィルタ対象外
    //comp3: source かつ disable=true ⇒ フィルタ対象外
    //comp4: task なので type != source ⇒ フィルタ対象外
    readJsonGreedyStub.onCall(0).resolves({ type: "source", subComponent: false, disable: false });
    readJsonGreedyStub.onCall(1).resolves({ type: "source", subComponent: true, disable: false });
    readJsonGreedyStub.onCall(2).resolves({ type: "source", subComponent: false, disable: true });
    readJsonGreedyStub.onCall(3).resolves({ type: "task", subComponent: false, disable: false });

    //Act
    const result = await getSourceComponents(mockProjectRootDir);

    //Assert
    expect(promisifyStub.calledOnce).to.be.true;
    expect(globStub.calledOnceWithExactly(
      path.join(mockProjectRootDir, "**", "cmp.wheel.json")
    )).to.be.true;

    //結果は comp1 のみが該当する
    expect(result).to.have.lengthOf(1);
    expect(result[0]).to.deep.equal({ type: "source", subComponent: false, disable: false });
  });

  it("should return an empty array if no componentJson files are found", async ()=>{
    //Arrange
    globStub.resolves([]);
    //readJsonGreedy は呼ばれないのでスタブは設定しなくてもOK

    //Act
    const result = await getSourceComponents(mockProjectRootDir);

    //Assert
    expect(result).to.be.an("array").that.is.empty;
    expect(globStub.calledOnce).to.be.true;
    expect(readJsonGreedyStub.notCalled).to.be.true;
  });

  it("should throw an error if readJsonGreedy rejects for any file", async ()=>{
    //Arrange
    const mockFiles = [
      "/mock/project/root/comp1/cmp.wheel.json",
      "/mock/project/root/comp2/cmp.wheel.json"
    ];
    globStub.resolves(mockFiles);

    readJsonGreedyStub.onCall(0).resolves({ type: "source", subComponent: false, disable: false });
    //comp2 側でエラーを投げる
    const mockError = new Error("Failed to read JSON");
    readJsonGreedyStub.onCall(1).rejects(mockError);

    //Act & Assert
    try {
      await getSourceComponents(mockProjectRootDir);
      throw new Error("Expected getSourceComponents to throw an error");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(globStub.calledOnce).to.be.true;
    //comp1までは読み込むが comp2 でエラー
    expect(readJsonGreedyStub.callCount).to.equal(2);
  });
});
