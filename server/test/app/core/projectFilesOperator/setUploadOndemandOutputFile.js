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


describe.skip("#setUploadOndemandOutputFile", ()=>{
  let rewireProjectFilesOperator;
  let setUploadOndemandOutputFile;
  let getComponentDirMock;
  let readComponentJsonMock;
  let addOutputFileMock;
  let removeFileLinkMock;
  let renameOutputFileMock;

  beforeEach(()=>{
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    setUploadOndemandOutputFile = rewireProjectFilesOperator.__get__("setUploadOndemandOutputFile");

    //各依存関数をスタブ化
    getComponentDirMock = sinon.stub();
    readComponentJsonMock = sinon.stub();
    addOutputFileMock = sinon.stub().resolves();
    removeFileLinkMock = sinon.stub().resolves();
    renameOutputFileMock = sinon.stub().resolves();

    //rewire で内部参照を差し替え
    rewireProjectFilesOperator.__set__({
      getComponentDir: getComponentDirMock,
      readComponentJson: readComponentJsonMock,
      addOutputFile: addOutputFileMock,
      removeFileLink: removeFileLinkMock,
      renameOutputFile: renameOutputFileMock
    });
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if the component does not have an outputFiles property", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "comp-id";
    getComponentDirMock.resolves("/mock/comp-dir");
    //outputFilesプロパティが無い
    readComponentJsonMock.resolves({ name: "testComponent" });

    try {
      await setUploadOndemandOutputFile(projectRootDir, componentID);
      throw new Error("Expected setUploadOndemandOutputFile to reject, but it resolved.");
    } catch (err) {
      expect(err.message).to.equal("testComponent does not have outputFiles");
      expect(err.component).to.deep.equal({ name: "testComponent" });
    }
    expect(addOutputFileMock.notCalled).to.be.true;
    expect(removeFileLinkMock.notCalled).to.be.true;
    expect(renameOutputFileMock.notCalled).to.be.true;
  });

  it("should call addOutputFile if there are no outputFiles", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "comp-id";
    getComponentDirMock.resolves("/mock/comp-dir");
    //outputFiles は空配列
    readComponentJsonMock.resolves({
      name: "testComponent",
      outputFiles: []
    });

    await setUploadOndemandOutputFile(projectRootDir, componentID);

    //outputFiles が 0 個なら addOutputFile を呼ぶ
    expect(addOutputFileMock.calledOnceWithExactly(projectRootDir, componentID, "UPLOAD_ONDEMAND"))
      .to.be.true;

    expect(removeFileLinkMock.notCalled).to.be.true;
    expect(renameOutputFileMock.notCalled).to.be.true;
  });

  it("should remove extra outputFiles if there is more than one, and rename the first to UPLOAD_ONDEMAND", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "comp-id";
    getComponentDirMock.resolves("/mock/comp-dir");

    //outputFilesが複数あるケース
    //2つ目以降にはdst が複数ある想定
    readComponentJsonMock.resolves({
      name: "testComponent",
      outputFiles: [
        {
          name: "someOutput1",
          dst: [{ dstNode: "dstComp1", dstName: "dstFilename1" }]
        },
        {
          name: "someOutput2",
          dst: [
            { dstNode: "dstComp2", dstName: "dstFilename2" },
            { dstNode: "dstComp3", dstName: "dstFilename3" }
          ]
        },
        {
          name: "someOutput3",
          dst: [{ dstNode: "dstComp4", dstName: "dstFilename4" }]
        }
      ]
    });

    await setUploadOndemandOutputFile(projectRootDir, componentID);

    //removeFileLink が正しく呼ばれているか
    //→ 2つ目以降の出力ファイルに記載されたdstセットに対して removeFileLink() が呼ばれる
    //第2〜n番目 outputFiles[i].dst: すべてunique set -> removeFileLinkが複数呼ばれる
    //具体的には以下で4回呼ばれる
    expect(removeFileLinkMock.callCount).to.equal(3); //2つ目は2回, 3つ目は1回: ただし Set() により重複除外
    //順番は特に保証されないが、呼び出し引数が正しいかチェック
    //例: removeFileLink(projectRootDir, "comp-id", "someOutput2", "dstComp2", "dstFilename2")
    //removeFileLink(projectRootDir, "comp-id", "someOutput2", "dstComp3", "dstFilename3")
    //removeFileLink(projectRootDir, "comp-id", "someOutput3", "dstComp4", "dstFilename4")
    const calls = removeFileLinkMock.getCalls().map((c)=>c.args);
    expect(calls).to.deep.include(
      [projectRootDir, "comp-id", "someOutput2", "dstComp2", "dstFilename2"]
    );
    expect(calls).to.deep.include(
      [projectRootDir, "comp-id", "someOutput2", "dstComp3", "dstFilename3"]
    );
    expect(calls).to.deep.include(
      [projectRootDir, "comp-id", "someOutput3", "dstComp4", "dstFilename4"]
    );

    //最後に renameOutputFile(… 0, "UPLOAD_ONDEMAND") が呼ばれる
    expect(renameOutputFileMock.calledOnceWithExactly(projectRootDir, "comp-id", 0, "UPLOAD_ONDEMAND"))
      .to.be.true;

    expect(addOutputFileMock.notCalled).to.be.true;
  });

  it("should rename the single existing outputFile to UPLOAD_ONDEMAND if outputFiles length is exactly one", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "comp-id";
    getComponentDirMock.resolves("/mock/comp-dir");

    //outputFileがひとつだけのケース
    readComponentJsonMock.resolves({
      name: "testComponent",
      outputFiles: [
        {
          name: "someOutput",
          dst: [{ dstNode: "dstComp", dstName: "dstFilename" }]
        }
      ]
    });

    await setUploadOndemandOutputFile(projectRootDir, componentID);

    //removeFileLinkは呼ばれない
    expect(removeFileLinkMock.notCalled).to.be.true;

    //renameOutputFile が呼ばれる
    expect(renameOutputFileMock.calledOnceWithExactly(
      projectRootDir,
      componentID,
      0,
      "UPLOAD_ONDEMAND"
    )).to.be.true;
    expect(addOutputFileMock.notCalled).to.be.true;
  });
});
