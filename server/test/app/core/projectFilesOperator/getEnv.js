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


describe.skip("#getEnv", ()=>{
  let rewireProjectFilesOperator;
  let getEnv;
  let readComponentJsonByIDMock;

  beforeEach(()=>{
    //projectFilesOperator.jsをrewireで読み込む
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");

    //テスト対象の関数を取得
    getEnv = rewireProjectFilesOperator.__get__("getEnv");

    //依存するreadComponentJsonByIDをモック化
    readComponentJsonByIDMock = sinon.stub();
    rewireProjectFilesOperator.__set__({
      readComponentJsonByID: readComponentJsonByIDMock
    });
  });

  it("should return the env object if the component has env property", async ()=>{
    //モックが返すコンポーネントJSONを定義
    const mockComponentJson = {
      env: {
        VAR_A: "VALUE_A",
        VAR_B: "VALUE_B"
      }
    };

    //stubがresolveする値を設定
    readComponentJsonByIDMock.resolves(mockComponentJson);

    //テスト対象関数を呼び出し
    const projectRootDir = "/mock/project/root";
    const componentID = "mockComponentID";
    const result = await getEnv(projectRootDir, componentID);

    //アサーション
    expect(readComponentJsonByIDMock.calledOnceWithExactly(projectRootDir, componentID)).to.be.true;
    expect(result).to.deep.equal(mockComponentJson.env);
  });

  it("should return an empty object if env property is not defined", async ()=>{
    //envプロパティなし
    const mockComponentJson = { name: "testComponent" };
    readComponentJsonByIDMock.resolves(mockComponentJson);

    const result = await getEnv("/mock/project/root", "mockComponentID");
    expect(result).to.deep.equal({});
  });

  it("should throw an error if readComponentJsonByID rejects", async ()=>{
    const mockError = new Error("Failed to read component JSON");
    readComponentJsonByIDMock.rejects(mockError);

    try {
      await getEnv("/mock/project/root", "errorComponentID");
      expect.fail("getEnv should throw an error, but did not");
    } catch (err) {
      expect(err).to.equal(mockError);
    }
  });
});
