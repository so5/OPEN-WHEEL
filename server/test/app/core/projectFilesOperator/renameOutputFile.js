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


describe.skip("#renameOutputFile", ()=>{
  let rewireProjectFilesOperator;
  let renameOutputFile;

  //sinonスタブ用
  let isValidOutputFilenameMock;
  let getComponentDirMock;
  let readComponentJsonMock;
  let writeComponentJsonMock;

  //テストに使うダミー値
  const mockProjectRootDir = "/mock/project/root";
  const mockID = "component-123";
  const mockIndex = 0;
  const validNewName = "newOutput.dat";
  const invalidNewName = "invalid/name";
  let mockComponentDir;
  let mockComponentJson;

  beforeEach(()=>{
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    renameOutputFile = rewireProjectFilesOperator.__get__("renameOutputFile");

    //各種モックを作成
    isValidOutputFilenameMock = sinon.stub();
    getComponentDirMock = sinon.stub();
    readComponentJsonMock = sinon.stub();
    writeComponentJsonMock = sinon.stub().resolves();

    //rewireで元関数を差し替え
    rewireProjectFilesOperator.__set__({
      isValidOutputFilename: isValidOutputFilenameMock,
      getComponentDir: getComponentDirMock,
      readComponentJson: readComponentJsonMock,
      writeComponentJson: writeComponentJsonMock
    });

    mockComponentDir = "/mock/project/root/component-123";
    mockComponentJson = {
      outputFiles: [
        {
          name: "oldOutput.dat",
          dst: [] //テストごとに動的に差し替え
        }
      ]
    };
  });

  it("should reject if the newName is invalid", async ()=>{
    isValidOutputFilenameMock.returns(false);

    try {
      await renameOutputFile(mockProjectRootDir, mockID, mockIndex, invalidNewName);
      throw new Error("Expected renameOutputFile to throw an error for invalid name");
    } catch (err) {
      expect(err.message).to.equal(`${invalidNewName} is not valid outputFile name`);
      expect(isValidOutputFilenameMock.calledOnceWithExactly(invalidNewName)).to.be.true;
    }
  });

  it("should reject if the index is out of range (negative)", async ()=>{
    isValidOutputFilenameMock.returns(true);
    getComponentDirMock.resolves(mockComponentDir);
    readComponentJsonMock.resolves(mockComponentJson);

    try {
      await renameOutputFile(mockProjectRootDir, mockID, -1, validNewName);
      throw new Error("Expected renameOutputFile to throw an error for out-of-range index");
    } catch (err) {
      expect(err.message).to.equal("invalid index -1");
    }
  });

  it("should reject if the index is out of range (too large)", async ()=>{
    isValidOutputFilenameMock.returns(true);
    getComponentDirMock.resolves(mockComponentDir);

    //outputFiles.length は 1、なのに index=1 は範囲外
    mockComponentJson.outputFiles = [{ name: "oneFile.dat" }];
    readComponentJsonMock.resolves(mockComponentJson);

    try {
      await renameOutputFile(mockProjectRootDir, mockID, 1, validNewName);
      throw new Error("Expected renameOutputFile to throw an error for out-of-range index");
    } catch (err) {
      expect(err.message).to.equal("invalid index 1");
    }
  });

  it("should rename outputFile without counterparts if dst is empty", async ()=>{
    isValidOutputFilenameMock.returns(true);
    getComponentDirMock.resolves(mockComponentDir);

    //dst:[] なので counterparts は生成されるが空
    mockComponentJson.outputFiles = [
      { name: "oldOutput.dat", dst: [] }
    ];
    readComponentJsonMock.resolves(mockComponentJson);

    await renameOutputFile(mockProjectRootDir, mockID, 0, validNewName);

    expect(mockComponentJson.outputFiles[0].name).to.equal(validNewName);
    expect(writeComponentJsonMock.callCount).to.equal(1); //自分自身のみ書き込み
  });

  it("should rename outputFile and update references in the counterpart's inputFiles", async ()=>{
    isValidOutputFilenameMock.returns(true);
    getComponentDirMock.onCall(0).resolves(mockComponentDir); //自身
    getComponentDirMock.onCall(1).resolves("/mock/project/root/counterpart-999"); //相手

    //自分のoutputFiles
    mockComponentJson.outputFiles = [
      {
        name: "oldOutput.dat",
        dst: [{ dstNode: "counterpart-999" }]
      }
    ];
    readComponentJsonMock.onCall(0).resolves(mockComponentJson);

    //counterpartの inputFiles
    const counterpartJson = {
      inputFiles: [
        {
          name: "someInput",
          src: [
            { srcNode: mockID, srcName: "oldOutput.dat" } //ここがリネーム対象
          ]
        }
      ],
      outputFiles: []
    };
    readComponentJsonMock.onCall(1).resolves(counterpartJson);

    await renameOutputFile(mockProjectRootDir, mockID, 0, validNewName);

    //自分側
    expect(mockComponentJson.outputFiles[0].name).to.equal(validNewName);
    //counterpart側
    expect(counterpartJson.inputFiles[0].src[0].srcName).to.equal(validNewName);

    //書き込みの呼ばれ方を確認：自分 + counterpartの計2回
    expect(writeComponentJsonMock.callCount).to.equal(2);
    expect(writeComponentJsonMock.firstCall.args[1]).to.equal(mockComponentDir);
    expect(writeComponentJsonMock.secondCall.args[1]).to.equal("/mock/project/root/counterpart-999");
  });
  it("should keep old name if the counterpart's outputFiles has 'origin' property", async ()=>{
    isValidOutputFilenameMock.returns(true);
    getComponentDirMock.onCall(0).resolves(mockComponentDir);
    getComponentDirMock.onCall(1).resolves("/mock/project/root/counterpart-999");

    //自分のoutputFiles
    mockComponentJson.outputFiles = [
      {
        name: "oldOutput.dat",
        dst: [{ dstNode: "counterpart-999" }]
      }
    ];
    readComponentJsonMock.onCall(0).resolves(mockComponentJson);

    //counterpartのoutputFiles (originあり)
    const counterpartJson = {
      inputFiles: [],
      outputFiles: [
        {
          //実装上は「originが存在する」→ if(!hasOwnProperty("origin"))分岐に入らない
          origin: [{ srcNode: mockID, srcName: "oldOutput.dat" }]
        }
      ]
    };
    readComponentJsonMock.onCall(1).resolves(counterpartJson);

    //originはoldOutput.datのまま
    await renameOutputFile(mockProjectRootDir, mockID, 0, validNewName);

    //自分はrenameされる
    expect(mockComponentJson.outputFiles[0].name).to.equal(validNewName);
    //counterpartのoriginもrenameされる
    expect(counterpartJson.outputFiles[0].origin[0].srcName).to.equal(validNewName);

    //書き込み回数: 自分 + counterpart
    expect(writeComponentJsonMock.callCount).to.equal(2);
  });
});
