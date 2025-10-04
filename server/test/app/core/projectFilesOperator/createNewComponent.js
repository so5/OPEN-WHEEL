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


describe.skip("#createNewComponent", ()=>{
  let rewireProjectFilesOperator;
  let createNewComponent;

  let readJsonGreedyMock;
  let makeDirMock;
  let componentFactoryMock;
  let writeComponentJsonMock;
  let updateComponentPathMock;
  let writeJsonWrapperMock;
  let gitAddMock;

  //テストで使うダミー値
  const dummyProjectRootDir = "/dummy/projectRootDir";
  const dummyParentDir = "/dummy/parentDir";
  const dummyPos = { x: 100, y: 200 };
  const dummyParentJson = { ID: "parent-123" };
  const dummyAbsDirName = "/dummy/parentDir/task0"; //makeDir の戻り値
  const dummyComponent = {
    type: "task",
    pos: dummyPos,
    parent: "parent-123",
    ID: "new-component-id",
    name: "task0"
  };
  const dummyPsComponent = {
    type: "PS",
    pos: dummyPos,
    parent: "parent-123",
    ID: "new-ps-id",
    name: "PS0"
  };

  beforeEach(()=>{
    //rewire でモジュールを読み込む
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    createNewComponent = rewireProjectFilesOperator.__get__("createNewComponent");

    //sinon.stub で依存関数を置き換え
    readJsonGreedyMock = sinon.stub().resolves(dummyParentJson);
    makeDirMock = sinon.stub().resolves(dummyAbsDirName);
    componentFactoryMock = sinon.stub().returns(dummyComponent);
    writeComponentJsonMock = sinon.stub().resolves();
    updateComponentPathMock = sinon.stub().resolves();
    writeJsonWrapperMock = sinon.stub().resolves();
    gitAddMock = sinon.stub().resolves();

    //rewireで内部の依存を差し替え
    rewireProjectFilesOperator.__set__({
      readJsonGreedy: readJsonGreedyMock,
      makeDir: makeDirMock,
      componentFactory: componentFactoryMock,
      writeComponentJson: writeComponentJsonMock,
      updateComponentPath: updateComponentPathMock,
      writeJsonWrapper: writeJsonWrapperMock,
      gitAdd: gitAddMock
    });
  });

  afterEach(()=>{
    //sinon.restore()でもよいが、個別にリストアするならこちら
    sinon.reset();
    sinon.restore();
  });

  it("should successfully create a new component when type is 'task'", async ()=>{
    //実行
    const result = await createNewComponent(dummyProjectRootDir, dummyParentDir, "task", dummyPos);

    //検証
    //1) 親のcomponentJsonを読む
    expect(readJsonGreedyMock.calledOnce).to.be.true;
    expect(readJsonGreedyMock.firstCall.args[0])
      .to.equal(path.resolve(dummyParentDir, "cmp.wheel.json")); //cmp.wheel.jsonのパス

    //2) makeDirが呼ばれ、basenameが正しく連結されているか
    expect(makeDirMock.calledOnce).to.be.true;
    expect(makeDirMock.firstCall.args[0])
      .to.equal(path.resolve(dummyParentDir, "task")); //getComponentDefaultName("task") => "task"
    expect(makeDirMock.firstCall.args[1]).to.equal(0);

    //3) componentFactoryが正しい引数で呼ばれたか
    expect(componentFactoryMock.calledOnce).to.be.true;
    expect(componentFactoryMock.firstCall.args).to.deep.equal(["task", dummyPos, "parent-123"]);

    //4) writeComponentJsonが正しい引数で呼ばれているか
    expect(writeComponentJsonMock.calledOnce).to.be.true;
    expect(writeComponentJsonMock.firstCall.args[0]).to.equal(dummyProjectRootDir);
    expect(writeComponentJsonMock.firstCall.args[1]).to.equal(dummyAbsDirName);
    expect(writeComponentJsonMock.firstCall.args[2]).to.equal(dummyComponent);

    //5) updateComponentPathが正しい引数で呼ばれているか
    expect(updateComponentPathMock.calledOnce).to.be.true;
    expect(updateComponentPathMock.firstCall.args[0]).to.equal(dummyProjectRootDir);
    expect(updateComponentPathMock.firstCall.args[1]).to.equal("new-component-id");
    expect(updateComponentPathMock.firstCall.args[2]).to.equal(dummyAbsDirName);

    //6) type = "task" なので PSConfigFilename の書き込みは無い
    expect(writeJsonWrapperMock.called).to.be.false;
    expect(gitAddMock.called).to.be.false;

    //7) 戻り値のコンポーネントオブジェクトを検証
    expect(result).to.equal(dummyComponent);
    expect(result.type).to.equal("task");
  });

  it("should create additional parameterSetting.json when type is 'PS'", async ()=>{
    //テスト用に componentFactory の戻り値を差し替える
    componentFactoryMock.returns(dummyPsComponent);
    const pathToPS = path.resolve(dummyAbsDirName, "parameterSetting.json");

    //実行
    const result = await createNewComponent(dummyProjectRootDir, dummyParentDir, "PS", dummyPos);

    //検証
    expect(componentFactoryMock.calledOnce).to.be.true;
    expect(result.type).to.equal("PS");

    //PS用のparameterSetting.jsonが書き込まれたか
    expect(writeJsonWrapperMock.calledOnce).to.be.true;
    expect(writeJsonWrapperMock.firstCall.args[0]).to.equal(pathToPS);
    //中身 { version: 2, targetFiles: [], params: [], scatter: [], gather: [] }
    expect(writeJsonWrapperMock.firstCall.args[1]).to.deep.equal({
      version: 2,
      targetFiles: [],
      params: [],
      scatter: [],
      gather: []
    });

    //gitAdd が呼ばれているか
    expect(gitAddMock.calledOnce).to.be.true;
    expect(gitAddMock.firstCall.args[0]).to.equal(dummyProjectRootDir);
    expect(gitAddMock.firstCall.args[1]).to.equal(pathToPS);
  });

  it("should throw an error if parent componentJson read fails", async ()=>{
    //readJsonGreedyをrejectさせる
    const readError = new Error("Failed to read parent cmp.wheel.json");
    readJsonGreedyMock.rejects(readError);

    try {
      await createNewComponent(dummyProjectRootDir, dummyParentDir, "task", dummyPos);
      expect.fail("Expected createNewComponent to throw an error");
    } catch (err) {
      expect(err).to.equal(readError);
    }
  });
});
