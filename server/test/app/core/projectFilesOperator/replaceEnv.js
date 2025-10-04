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


describe.skip("#replaceEnv", ()=>{
  let rewireProjectFilesOperator;
  let replaceEnv;
  let readComponentJsonByIDMock;
  let writeComponentJsonByIDMock;
  let diffMock;
  let diffApplyMock;
  let componentJson;

  beforeEach(()=>{
    //rewireでモジュールを読み込み
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    replaceEnv = rewireProjectFilesOperator.__get__("replaceEnv");

    //テストダブル（スタブ/モック）を作成
    readComponentJsonByIDMock = sinon.stub();
    writeComponentJsonByIDMock = sinon.stub();
    diffMock = sinon.stub();
    diffApplyMock = sinon.stub();

    //モックデータ（テスト対象のコンポーネントJSON）
    componentJson = {
      ID: "testComponent",
      env: { OLD_KEY: "old_value", UNUSED_KEY: "unused" }
    };

    //projectFilesOperator 内で呼び出される関数をスタブに差し替え
    rewireProjectFilesOperator.__set__({
      readComponentJsonByID: readComponentJsonByIDMock,
      writeComponentJsonByID: writeComponentJsonByIDMock,
      diff: diffMock,
      diffApply: diffApplyMock
    });
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should replace env with newEnv and write the updated component JSON", async ()=>{
    //readComponentJsonByIDがコンポーネントJSONを返すように設定
    readComponentJsonByIDMock.resolves(componentJson);
    writeComponentJsonByIDMock.resolves();
    diffMock.returns([{ op: "replace", path: "/OLD_KEY", value: "new_value" }]);

    //diffApplyが適用された結果を反映するようにモック。_patchは使わないので _ で省略
    //eslint-disable-next-line no-unused-vars
    diffApplyMock.callsFake((target, _patch)=>{
      target.OLD_KEY = "new_value";
      delete target.UNUSED_KEY;
    });

    //新しい環境変数
    const newEnv = { OLD_KEY: "new_value" };

    //関数実行
    const result = await replaceEnv("/project/root", "testComponent", newEnv);

    //期待する関数の呼び出し確認
    expect(readComponentJsonByIDMock.calledOnceWithExactly("/project/root", "testComponent")).to.be.true;
    expect(diffMock.calledOnceWithExactly(componentJson.env, newEnv)).to.be.true;
    expect(diffApplyMock.calledOnce).to.be.true;
    expect(writeComponentJsonByIDMock.calledOnceWithExactly("/project/root", "testComponent", componentJson)).to.be.true;

    //変更後のenvが期待通りになっているか
    expect(result.env).to.deep.equal({ OLD_KEY: "new_value" });
  });

  it("should throw an error if readComponentJsonByID fails", async ()=>{
    //readComponentJsonByID がエラーを投げる場合のテスト
    const mockError = new Error("Failed to read component JSON");
    readComponentJsonByIDMock.rejects(mockError);

    try {
      await replaceEnv("/project/root", "testComponent", {});
      throw new Error("Expected replaceEnv to throw");
    } catch (err) {
      //期待するエラーが発生したかを確認
      expect(err).to.equal(mockError);
    }

    //readComponentJsonByIDが呼ばれたことを確認
    expect(readComponentJsonByIDMock.calledOnceWithExactly("/project/root", "testComponent")).to.be.true;
    //他の関数は呼ばれていないことを確認
    expect(writeComponentJsonByIDMock.notCalled).to.be.true;
    expect(diffMock.notCalled).to.be.true;
    expect(diffApplyMock.notCalled).to.be.true;
  });

  it("should throw an error if writeComponentJsonByID fails", async ()=>{
    //readComponentJsonByIDは正常に動作
    readComponentJsonByIDMock.resolves(componentJson);
    diffMock.returns([]);
    diffApplyMock.callsFake(()=>{});

    //writeComponentJsonByIDがエラーを投げる場合のテスト
    const mockError = new Error("Failed to write component JSON");
    writeComponentJsonByIDMock.rejects(mockError);

    try {
      await replaceEnv("/project/root", "testComponent", { NEW_KEY: "new_value" });
      throw new Error("Expected replaceEnv to throw");
    } catch (err) {
      //期待するエラーが発生したかを確認
      expect(err).to.equal(mockError);
    }

    //diff関数が呼ばれたことを確認
    expect(diffMock.calledOnce).to.be.true;
    //diffApply関数が呼ばれたことを確認
    expect(diffApplyMock.calledOnce).to.be.true;
    //writeComponentJsonByIDが1回呼ばれていることを確認
    expect(writeComponentJsonByIDMock.calledOnce).to.be.true;
  });
});
