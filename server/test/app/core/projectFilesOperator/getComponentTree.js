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


describe.skip("#getComponentTree", ()=>{
  let getComponentTree;
  let readJsonGreedyMock;
  let pathIsAbsoluteMock;
  let pathRelativeMock;
  let pathDirnameMock;
  let pathJoinMock;

  beforeEach(()=>{
    //rewireで対象モジュールを読み込み
    getComponentTree = projectFilesOperator._internal.getComponentTree;

    readJsonGreedyMock = sinon.stub();
    pathIsAbsoluteMock = sinon.stub();
    pathRelativeMock = sinon.stub();
    pathDirnameMock = sinon.stub();
    pathJoinMock = sinon.stub();

    //getComponentTree内で使われるメソッドをtest側でstub化
    //必要に応じてnormalizeやresolveもstub化可能
    projectFilesOperator._internal.readJsonGreedy = readJsonGreedyMock;
    projectFilesOperator._internal.path = {
      ...path,
      isAbsolute: pathIsAbsoluteMock,
      relative: pathRelativeMock,
      dirname: pathDirnameMock,
      join: pathJoinMock,
      normalize: path.normalize,
      resolve: path.resolve
    };
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return the root component with children properly attached (absolute path case)", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockRootDir = "/mock/project/root"; //絶対パス指定(テスト上の想定)

    //projectJson (prj.wheel.json) の想定データ
    const mockProjectJson = {
      componentPath: {
        rootID: "./",
        childID1: "./child1",
        childID2: "./child2"
      }
    };

    //1) rootDirが絶対パス => true
    pathIsAbsoluteMock.returns(true);

    //2) path.relativeで "./" を返す => 関数内で「|| './'」してstartが"./"に
    pathRelativeMock.returns("./");

    //3) path.join("...", "cmp.wheel.json")の戻り値
    //今回はあえて ".//cmp.wheel.json" 等を返す
    pathJoinMock.callsFake((dir, file)=>`${dir}/${file}`);

    //4) path.dirname(...) が呼ばれたら、すべて "." を返すようにする
    //=> これにより "startStriped" = "." と一致し rootIndexが -1 にならない
    pathDirnameMock.returns(".");

    //readJsonGreedyMock: 順番に呼ばれるので onCall() で返却
    //0回目 : prj.wheel.json
    //1回目 : .//cmp.wheel.json
    //2回目 : ./child1/cmp.wheel.json
    //3回目 : ./child2/cmp.wheel.json
    readJsonGreedyMock.onCall(0).resolves(mockProjectJson);
    readJsonGreedyMock.onCall(1).resolves({ ID: "rootID" });
    readJsonGreedyMock.onCall(2).resolves({ ID: "childID1", parent: "rootID" });
    readJsonGreedyMock.onCall(3).resolves({ ID: "childID2", parent: "childID1" });

    const result = await getComponentTree(mockProjectRootDir, mockRootDir);

    expect(result.ID).to.equal("rootID");
    expect(result.children).to.have.lengthOf(1);
    expect(result.children[0].ID).to.equal("childID1");
    expect(result.children[0].children).to.have.lengthOf(1);
    expect(result.children[0].children[0].ID).to.equal("childID2");
  });

  it("should return the root component with children (relative path case)", async ()=>{
    //rootDirを相対パス扱いにする => isAbsolute = false
    const mockProjectRootDir = "/mock/project/root";
    const mockRootDir = "./"; //相対パス

    const mockProjectJson = {
      componentPath: {
        rootID: "./",
        childID1: "./child1"
      }
    };

    //isAbsolute => false
    pathIsAbsoluteMock.returns(false);

    //path.relativeは呼ばれない(or 呼ばれても使われない)ためstubしておく
    pathRelativeMock.returns("./");

    //path.join => 同様に "dirname/cmp.wheel.json" みたいに返す
    pathJoinMock.callsFake((dir, file)=>`${dir}/${file}`);

    //path.dirnameは常に "." を返せば "startStriped" = "." に合致
    pathDirnameMock.returns(".");

    readJsonGreedyMock.onCall(0).resolves(mockProjectJson); //prj.wheel.json
    readJsonGreedyMock.onCall(1).resolves({ ID: "rootID" });
    readJsonGreedyMock.onCall(2).resolves({ ID: "childID1", parent: "rootID" });

    const result = await getComponentTree(mockProjectRootDir, mockRootDir);

    expect(result.ID).to.equal("rootID");
    expect(result.children).to.have.lengthOf(1);
    expect(result.children[0].ID).to.equal("childID1");
  });

  it("should attach child to root if child refers a non-existent parent", async ()=>{
    //ルートが "./", 子が "./child"
    const mockProjectRootDir = "/mock/project/root";
    const mockRootDir = "/mock/project/root";

    const mockProjectJson = {
      componentPath: {
        rootID: "./",
        lonelyChild: "./child"
      }
    };

    pathIsAbsoluteMock.returns(true);
    pathRelativeMock.returns("./");
    pathJoinMock.callsFake((dir, file)=>`${dir}/${file}`);

    //dirnameはいつものように "." を返して rootIndex=0 にする
    pathDirnameMock.returns(".");

    //cmp.wheel.jsonそれぞれ
    readJsonGreedyMock.onCall(0).resolves(mockProjectJson);
    //ルートコンポーネント
    readJsonGreedyMock.onCall(1).resolves({ ID: "rootID" });
    //parentプロパティが "unknownParent" など存在しないID
    readJsonGreedyMock.onCall(2).resolves({ ID: "lonelyChild", parent: "unknownParent" });

    const result = await getComponentTree(mockProjectRootDir, mockRootDir);

    //親が見つからない => rootにぶら下がる
    expect(result.ID).to.equal("rootID");
    expect(result.children).to.have.lengthOf(1);
    expect(result.children[0].ID).to.equal("lonelyChild");
  });

  it("should create a new children array if the parent component has no existing children array", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockRootDir = "/mock/project/root";
    const mockProjectJson = {
      componentPath: {
        rootID: "./",
        childID: "./child"
      }
    };

    pathIsAbsoluteMock.returns(true);
    pathRelativeMock.returns("./");
    pathJoinMock.callsFake((dir, file)=>`${dir}/${file}`);
    pathDirnameMock.returns(".");

    readJsonGreedyMock.onCall(0).resolves(mockProjectJson);
    //rootCmpに children プロパティはなし
    readJsonGreedyMock.onCall(1).resolves({ ID: "rootID" });
    readJsonGreedyMock.onCall(2).resolves({ ID: "childID", parent: "rootID" });

    const result = await getComponentTree(mockProjectRootDir, mockRootDir);

    //rootCmpは当初 children=[] がないが、子供がattachされて children=[{childID}] になる
    expect(result.ID).to.equal("rootID");
    expect(result.children).to.have.lengthOf(1);
    expect(result.children[0].ID).to.equal("childID");
  });
});
