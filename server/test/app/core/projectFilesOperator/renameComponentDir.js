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


describe.skip("#renameComponentDir", ()=>{
  let rewireProjectFilesOperator;
  let renameComponentDir;
  let isValidNameMock;
  let getComponentDirMock;
  let gitRmMock;
  let fsMoveMock;
  let gitAddMock;
  let updateComponentPathMock;

  const mockProjectRootDir = "/mock/project";
  const mockID = "mock-component-id";

  beforeEach(()=>{
    //rewireでモジュールを読み込み
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    renameComponentDir = rewireProjectFilesOperator.__get__("renameComponentDir");

    //テストダブル（スタブ/モック）を作成
    isValidNameMock = sinon.stub();
    getComponentDirMock = sinon.stub();
    gitRmMock = sinon.stub().resolves();
    fsMoveMock = sinon.stub().resolves();
    gitAddMock = sinon.stub().resolves();
    updateComponentPathMock = sinon.stub().resolves("updated-path-map");

    //projectFilesOperator 内で呼び出される関数を差し替え
    rewireProjectFilesOperator.__set__({
      isValidName: isValidNameMock,
      getComponentDir: getComponentDirMock,
      gitRm: gitRmMock,
      fs: { move: fsMoveMock },
      gitAdd: gitAddMock,
      updateComponentPath: updateComponentPathMock
    });
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should throw an error if newName is invalid", async ()=>{
    isValidNameMock.returns(false); //newNameが不正

    try {
      await renameComponentDir(mockProjectRootDir, mockID, "???");
      throw new Error("Expected error to be thrown");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.match(/not valid component name/);
    }

    expect(isValidNameMock.calledOnce).to.be.true;
    //下記処理は通らないのでstubは呼ばれない
    expect(getComponentDirMock.called).to.be.false;
    expect(gitRmMock.called).to.be.false;
    expect(fsMoveMock.called).to.be.false;
    expect(gitAddMock.called).to.be.false;
    expect(updateComponentPathMock.called).to.be.false;
  });

  it("should throw an error if trying to rename the root workflow directory", async ()=>{
    isValidNameMock.returns(true);
    getComponentDirMock.resolves(mockProjectRootDir); //oldDirがrootDirと同じ

    try {
      await renameComponentDir(mockProjectRootDir, mockID, "NewName");
      throw new Error("Expected error to be thrown");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("updateNode can not rename root workflow");
    }

    expect(isValidNameMock.calledOnce).to.be.true;
    expect(getComponentDirMock.calledOnce).to.be.true;
    expect(gitRmMock.called).to.be.false;
    expect(fsMoveMock.called).to.be.false;
    expect(gitAddMock.called).to.be.false;
    expect(updateComponentPathMock.called).to.be.false;
  });

  it("should return true if path.basename(oldDir) === newName", async ()=>{
    isValidNameMock.returns(true);
    getComponentDirMock.resolves("/mock/project/SomeName"); //oldDir
    //oldDirのbasenameが"SomeName" → newNameも"SomeName" の場合は処理スキップ
    const result = await renameComponentDir(mockProjectRootDir, mockID, "SomeName");

    expect(result).to.be.true;
    expect(isValidNameMock.calledOnce).to.be.true;
    expect(getComponentDirMock.calledOnce).to.be.true;
    //リネームしないので以降は呼ばれない
    expect(gitRmMock.called).to.be.false;
    expect(fsMoveMock.called).to.be.false;
    expect(gitAddMock.called).to.be.false;
    expect(updateComponentPathMock.called).to.be.false;
  });

  it("should move directory, call gitRm, fs.move, gitAdd and updateComponentPath if everything is fine", async ()=>{
    isValidNameMock.returns(true);
    getComponentDirMock.resolves("/mock/project/OldCompName");

    const result = await renameComponentDir(mockProjectRootDir, mockID, "NewCompName");

    //成功時はupdateComponentPathの戻り値をそのまま返している
    expect(result).to.equal("updated-path-map");

    //順序をテストしたい場合は call順のチェック
    expect(isValidNameMock.calledOnce).to.be.true;
    expect(getComponentDirMock.calledOnce).to.be.true;
    expect(gitRmMock.calledOnceWithExactly(mockProjectRootDir, "/mock/project/OldCompName")).to.be.true;
    expect(fsMoveMock.calledOnce).to.be.true;
    //fsMoveで呼ばれる第2引数が /mock/project/NewCompName になっているか
    const fsMoveArgs = fsMoveMock.args[0];
    expect(fsMoveArgs[0]).to.equal("/mock/project/OldCompName");
    expect(fsMoveArgs[1]).to.equal(path.resolve("/mock/project", "NewCompName"));

    expect(gitAddMock.calledOnce).to.be.true;
    //最後に updateComponentPath が正しい引数で呼ばれているか
    expect(updateComponentPathMock.calledOnce).to.be.true;
    const updateArgs = updateComponentPathMock.args[0];
    expect(updateArgs[0]).to.equal(mockProjectRootDir);
    expect(updateArgs[1]).to.equal(mockID);
    expect(updateArgs[2]).to.equal(path.resolve("/mock/project", "NewCompName"));
  });
});
