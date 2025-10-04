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


describe.skip("#addInputFile", ()=>{
  let rewireProjectFilesOperator;
  let addInputFile;
  let isValidInputFilenameMock;
  let getComponentDirMock;
  let readComponentJsonMock;
  let writeComponentJsonMock;

  beforeEach(()=>{
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    addInputFile = rewireProjectFilesOperator.__get__("addInputFile");

    //sinon.stub(...) で依存関数をモック化
    isValidInputFilenameMock = sinon.stub();
    getComponentDirMock = sinon.stub();
    readComponentJsonMock = sinon.stub();
    writeComponentJsonMock = sinon.stub();

    //rewireで内部の関数・変数を差し替え
    rewireProjectFilesOperator.__set__({
      isValidInputFilename: isValidInputFilenameMock,
      getComponentDir: getComponentDirMock,
      readComponentJson: readComponentJsonMock,
      writeComponentJson: writeComponentJsonMock
    });
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if the input filename is invalid", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "component123";
    const invalidName = "invalid*filename";

    isValidInputFilenameMock.returns(false); //invalid と判定させる

    try {
      await addInputFile(projectRootDir, componentID, invalidName);
      throw new Error("Expected addInputFile to throw an error");
    } catch (err) {
      expect(err).to.be.an("Error");
      expect(err.message).to.equal(`${invalidName} is not valid inputFile name`);
    }
    expect(isValidInputFilenameMock.calledOnceWithExactly(invalidName)).to.be.true;
    //下記の関数は呼ばれない
    expect(getComponentDirMock.notCalled).to.be.true;
    expect(readComponentJsonMock.notCalled).to.be.true;
    expect(writeComponentJsonMock.notCalled).to.be.true;
  });

  it("should reject if the component does not have inputFiles property", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "componentWithoutInputFiles";
    const name = "validInput.txt";
    isValidInputFilenameMock.returns(true);

    //仮にgetComponentDirの戻り値
    const mockDir = "/mock/project/components/componentWithoutInputFiles";
    getComponentDirMock.resolves(mockDir);

    //componentJson に inputFilesが無い想定
    const mockComponentJson = {
      ID: componentID,
      name: "NoInputFilesComponent"
      //ここで inputFiles プロパティ無し
    };
    readComponentJsonMock.resolves(mockComponentJson);

    try {
      await addInputFile(projectRootDir, componentID, name);
      throw new Error("Expected addInputFile to throw an error");
    } catch (err) {
      expect(err).to.be.an("Error");
      expect(err.message).to.equal(`${mockComponentJson.name} does not have inputFiles`);
      expect(err.component).to.deep.equal(mockComponentJson);
    }

    //各モック呼び出しの検証
    expect(isValidInputFilenameMock.calledOnceWithExactly(name)).to.be.true;
    expect(getComponentDirMock.calledOnceWithExactly(projectRootDir, componentID, true)).to.be.true;
    expect(readComponentJsonMock.calledOnceWithExactly(mockDir)).to.be.true;
    expect(writeComponentJsonMock.notCalled).to.be.true;
  });

  it("should add a new inputFile to the component and call writeComponentJson on success", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "componentWithInputFiles";
    const name = "inputFileName.txt";
    isValidInputFilenameMock.returns(true);

    //getComponentDirのモック戻り値
    const mockDir = "/mock/project/components/componentWithInputFiles";
    getComponentDirMock.resolves(mockDir);

    //componentJsonに inputFiles: [] が存在する想定
    const mockComponentJson = {
      ID: componentID,
      name: "HasInputFilesComponent",
      inputFiles: []
    };
    readComponentJsonMock.resolves(mockComponentJson);

    writeComponentJsonMock.resolves(); //成功時には特に値は返さない

    await addInputFile(projectRootDir, componentID, name);

    expect(isValidInputFilenameMock.calledOnceWithExactly(name)).to.be.true;
    expect(getComponentDirMock.calledOnceWithExactly(projectRootDir, componentID, true)).to.be.true;
    expect(readComponentJsonMock.calledOnceWithExactly(mockDir)).to.be.true;

    //inputFilesに要素追加されたか
    expect(mockComponentJson.inputFiles).to.have.lengthOf(1);
    const newInputFile = mockComponentJson.inputFiles[0];
    expect(newInputFile).to.deep.equal({ name, src: [] });

    //writeComponentJsonが正しく呼ばれたか
    expect(writeComponentJsonMock.calledOnceWithExactly(projectRootDir, mockDir, mockComponentJson)).to.be.true;
  });

  it("should reject if getComponentDir fails", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "someComponent";
    const name = "testInput.dat";
    isValidInputFilenameMock.returns(true);

    //getComponentDirを強制的にrejectさせる
    const mockError = new Error("Failed to get component dir");
    getComponentDirMock.rejects(mockError);

    try {
      await addInputFile(projectRootDir, componentID, name);
      throw new Error("Expected addInputFile to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(isValidInputFilenameMock.calledOnceWithExactly(name)).to.be.true;
    expect(readComponentJsonMock.notCalled).to.be.true;
    expect(writeComponentJsonMock.notCalled).to.be.true;
  });

  it("should reject if readComponentJson fails", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "componentWithInputFiles";
    const name = "testInput.dat";
    isValidInputFilenameMock.returns(true);

    const mockDir = "/mock/project/components/componentWithInputFiles";
    getComponentDirMock.resolves(mockDir);

    const mockError = new Error("readComponentJson error");
    readComponentJsonMock.rejects(mockError);

    try {
      await addInputFile(projectRootDir, componentID, name);
      throw new Error("Expected addInputFile to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(isValidInputFilenameMock.calledOnceWithExactly(name)).to.be.true;
    expect(getComponentDirMock.calledOnce).to.be.true;
    expect(readComponentJsonMock.calledOnceWithExactly(mockDir)).to.be.true;
    expect(writeComponentJsonMock.notCalled).to.be.true;
  });

  it("should reject if writeComponentJson fails", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "componentWithInputFiles";
    const name = "testInput.dat";
    isValidInputFilenameMock.returns(true);

    const mockDir = "/mock/project/components/componentWithInputFiles";
    getComponentDirMock.resolves(mockDir);

    const mockComponentJson = {
      ID: componentID,
      name: "HasInputFilesComponent",
      inputFiles: []
    };
    readComponentJsonMock.resolves(mockComponentJson);

    const mockError = new Error("writeComponentJson error");
    writeComponentJsonMock.rejects(mockError);

    try {
      await addInputFile(projectRootDir, componentID, name);
      throw new Error("Expected addInputFile to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(mockComponentJson.inputFiles).to.have.lengthOf(1); //追加はされている
    expect(writeComponentJsonMock.calledOnce).to.be.true;
  });
});
