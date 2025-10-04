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


describe.skip("#addOutputFile", ()=>{
  let rewireProjectFilesOperator;
  let addOutputFile;
  let isValidOutputFilenameMock;
  let getComponentDirMock;
  let readComponentJsonMock;
  let writeComponentJsonMock;

  const mockProjectRootDir = "/mock/project/root";
  const mockID = "componentID";
  const mockName = "outputFileA";
  const mockComponentDir = "/mock/project/root/componentDir";
  const mockComponentJson = {
    name: "testComponent",
    outputFiles: []
  };

  beforeEach(()=>{
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    addOutputFile = rewireProjectFilesOperator.__get__("addOutputFile");

    //sinonでstub作成
    isValidOutputFilenameMock = sinon.stub();
    getComponentDirMock = sinon.stub();
    readComponentJsonMock = sinon.stub();
    writeComponentJsonMock = sinon.stub().resolves();

    //rewireで内部の関数にモックを仕込む
    rewireProjectFilesOperator.__set__("isValidOutputFilename", isValidOutputFilenameMock);
    rewireProjectFilesOperator.__set__("getComponentDir", getComponentDirMock);
    rewireProjectFilesOperator.__set__("readComponentJson", readComponentJsonMock);
    rewireProjectFilesOperator.__set__("writeComponentJson", writeComponentJsonMock);
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if the filename is invalid", async ()=>{
    //filename不正でfalseになる
    isValidOutputFilenameMock.returns(false);

    try {
      await addOutputFile(mockProjectRootDir, mockID, mockName);
      throw new Error("Expected addOutputFile to reject with error");
    } catch (err) {
      expect(err.message).to.equal(`${mockName} is not valid outputFile name`);
    }
    expect(isValidOutputFilenameMock.calledOnceWithExactly(mockName)).to.be.true;
    expect(getComponentDirMock.notCalled).to.be.true;
    expect(readComponentJsonMock.notCalled).to.be.true;
    expect(writeComponentJsonMock.notCalled).to.be.true;
  });

  it("should reject if 'outputFiles' property does not exist in componentJson", async ()=>{
    isValidOutputFilenameMock.returns(true);
    getComponentDirMock.resolves(mockComponentDir);
    //outputFilesが存在しない場合
    const badComponentJson = { name: "badComponent" };
    readComponentJsonMock.resolves(badComponentJson);

    try {
      await addOutputFile(mockProjectRootDir, mockID, mockName);
      throw new Error("Expected addOutputFile to reject");
    } catch (err) {
      expect(err.message).to.equal("badComponent does not have outputFiles");
      expect(err.component).to.deep.equal(badComponentJson);
    }
    expect(getComponentDirMock.calledOnceWithExactly(mockProjectRootDir, mockID, true)).to.be.true;
    expect(readComponentJsonMock.calledOnceWithExactly(mockComponentDir)).to.be.true;
    expect(writeComponentJsonMock.notCalled).to.be.true;
  });

  it("should reject if the same name output file already exists", async ()=>{
    isValidOutputFilenameMock.returns(true);
    getComponentDirMock.resolves(mockComponentDir);
    readComponentJsonMock.resolves({
      name: "testComponent",
      outputFiles: [{ name: mockName, dst: [] }]
    });

    try {
      await addOutputFile(mockProjectRootDir, mockID, mockName);
      throw new Error("Expected addOutputFile to reject");
    } catch (err) {
      expect(err.message).to.equal(`${mockName} is already exists`);
    }
    expect(getComponentDirMock.calledOnce).to.be.true;
    expect(readComponentJsonMock.calledOnce).to.be.true;
    expect(writeComponentJsonMock.notCalled).to.be.true;
  });

  it("should add a new output file and call writeComponentJson when valid and not duplicate", async ()=>{
    isValidOutputFilenameMock.returns(true);
    getComponentDirMock.resolves(mockComponentDir);
    readComponentJsonMock.resolves(mockComponentJson);

    await addOutputFile(mockProjectRootDir, mockID, mockName);

    //outputFilesがpushされているかを確認
    expect(mockComponentJson.outputFiles).to.deep.equal([
      { name: mockName, dst: [] }
    ]);

    //writeComponentJsonが呼ばれているか
    expect(writeComponentJsonMock.calledOnceWithExactly(
      mockProjectRootDir,
      mockComponentDir,
      mockComponentJson
    )).to.be.true;
  });
});
