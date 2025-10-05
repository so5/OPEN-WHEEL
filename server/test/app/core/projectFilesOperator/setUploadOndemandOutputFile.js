/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const projectFilesOperator = require("../../../../app/core/projectFilesOperator.js");


describe("#setUploadOndemandOutputFile", ()=>{
  const projectRootDir = "/mock/project";
  const componentID = "comp-id";
  let getComponentDirStub;
  let readComponentJsonStub;
  let addOutputFileStub;
  let removeFileLinkStub;
  let renameOutputFileStub;

  beforeEach(()=>{
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
    readComponentJsonStub = sinon.stub(projectFilesOperator._internal, "readComponentJson");
    addOutputFileStub = sinon.stub(projectFilesOperator._internal, "addOutputFile").resolves();
    removeFileLinkStub = sinon.stub(projectFilesOperator._internal, "removeFileLink").resolves();
    renameOutputFileStub = sinon.stub(projectFilesOperator._internal, "renameOutputFile").resolves();
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if the component does not have an outputFiles property", async ()=>{
    getComponentDirStub.resolves("/mock/comp-dir");
    //outputFilesプロパティが無い
    readComponentJsonStub.resolves({ name: "testComponent" });

    try {
      await projectFilesOperator._internal.setUploadOndemandOutputFile(projectRootDir, componentID);
      throw new Error("Expected setUploadOndemandOutputFile to reject, but it resolved.");
    } catch (err) {
      expect(err.message).to.equal("testComponent does not have outputFiles");
      expect(err.component).to.deep.equal({ name: "testComponent" });
    }
    expect(addOutputFileStub.notCalled).to.be.true;
    expect(removeFileLinkStub.notCalled).to.be.true;
    expect(renameOutputFileStub.notCalled).to.be.true;
  });

  it("should call addOutputFile if there are no outputFiles", async ()=>{
    getComponentDirStub.resolves("/mock/comp-dir");
    //outputFiles は空配列
    readComponentJsonStub.resolves({
      name: "testComponent",
      outputFiles: []
    });

    await projectFilesOperator._internal.setUploadOndemandOutputFile(projectRootDir, componentID);

    //outputFiles が 0 個なら addOutputFile を呼ぶ
    expect(addOutputFileStub.calledOnceWithExactly(projectRootDir, componentID, "UPLOAD_ONDEMAND"))
      .to.be.true;

    expect(removeFileLinkStub.notCalled).to.be.true;
    expect(renameOutputFileStub.notCalled).to.be.true;
  });

  it("should remove extra outputFiles if there is more than one, and rename the first to UPLOAD_ONDEMAND", async ()=>{
    getComponentDirStub.resolves("/mock/comp-dir");

    //outputFilesが複数あるケース
    //2つ目以降にはdst が複数ある想定
    readComponentJsonStub.resolves({
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

    await projectFilesOperator._internal.setUploadOndemandOutputFile(projectRootDir, componentID);

    //removeFileLink が正しく呼ばれているか
    //→ 2つ目以降の出力ファイルに記載されたdstセットに対して removeFileLink() が呼ばれる
    //第2〜n番目 outputFiles[i].dst: すべてunique set -> removeFileLinkが複数呼ばれる
    //具体的には以下で4回呼ばれる
    expect(removeFileLinkStub.callCount).to.equal(3); //2つ目は2回, 3つ目は1回: ただし Set() により重複除外
    //順番は特に保証されないが、呼び出し引数が正しいかチェック
    //例: removeFileLink(projectRootDir, "comp-id", "someOutput2", "dstComp2", "dstFilename2")
    //removeFileLink(projectRootDir, "comp-id", "someOutput2", "dstComp3", "dstFilename3")
    //removeFileLink(projectRootDir, "comp-id", "someOutput3", "dstComp4", "dstFilename4")
    const calls = removeFileLinkStub.getCalls().map((c)=>c.args);
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
    expect(renameOutputFileStub.calledOnceWithExactly(projectRootDir, "comp-id", 0, "UPLOAD_ONDEMAND"))
      .to.be.true;

    expect(addOutputFileStub.notCalled).to.be.true;
  });

  it("should rename the single existing outputFile to UPLOAD_ONDEMAND if outputFiles length is exactly one", async ()=>{
    getComponentDirStub.resolves("/mock/comp-dir");

    //outputFileがひとつだけのケース
    readComponentJsonStub.resolves({
      name: "testComponent",
      outputFiles: [
        {
          name: "someOutput",
          dst: [{ dstNode: "dstComp", dstName: "dstFilename" }]
        }
      ]
    });

    await projectFilesOperator._internal.setUploadOndemandOutputFile(projectRootDir, componentID);

    //removeFileLinkは呼ばれない
    expect(removeFileLinkStub.notCalled).to.be.true;

    //renameOutputFile が呼ばれる
    expect(renameOutputFileStub.calledOnceWithExactly(
      projectRootDir,
      componentID,
      0,
      "UPLOAD_ONDEMAND"
    )).to.be.true;
    expect(addOutputFileStub.notCalled).to.be.true;
  });
});
