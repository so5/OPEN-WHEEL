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


describe.skip("#updateComponent", ()=>{
  let rewireProjectFilesOperator;
  let updateComponentMock;
  let readComponentJsonByIDMock;
  let writeComponentJsonByIDMock;
  let renameComponentDirMock;
  let setUploadOndemandOutputFileMock;

  const mockProjectRootDir = "/mock/project/root";
  const mockID = "component123";
  const mockComponentJson = { ID: mockID, name: "OldName", anyProp: "oldValue" };

  beforeEach(()=>{
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");

    //実際の updateComponent 関数を取得
    updateComponentMock = rewireProjectFilesOperator.__get__("updateComponent");

    //各依存関数のモック化
    readComponentJsonByIDMock = sinon.stub().resolves(mockComponentJson);
    writeComponentJsonByIDMock = sinon.stub().resolves();
    renameComponentDirMock = sinon.stub().resolves();
    setUploadOndemandOutputFileMock = sinon.stub().resolves();

    //rewireで差し替え
    rewireProjectFilesOperator.__set__({
      readComponentJsonByID: readComponentJsonByIDMock,
      writeComponentJsonByID: writeComponentJsonByIDMock,
      renameComponentDir: renameComponentDirMock,
      setUploadOndemandOutputFile: setUploadOndemandOutputFileMock
    });
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if prop is path", async ()=>{
    try {
      await updateComponentMock(mockProjectRootDir, mockID, "path", "/new/path");
      throw new Error("Expected to throw an error, but did not.");
    } catch (err) {
      expect(err.message).to.include("path property is deprecated");
    }
  });

  it("should reject if prop is inputFiles or outputFiles", async ()=>{
    try {
      await updateComponentMock(mockProjectRootDir, mockID, "inputFiles", []);
      throw new Error("Expected to throw an error, but did not.");
    } catch (err) {
      expect(err.message).to.include("does not support inputFiles");
    }

    try {
      await updateComponentMock(mockProjectRootDir, mockID, "outputFiles", []);
      throw new Error("Expected to throw an error, but did not.");
    } catch (err) {
      expect(err.message).to.include("does not support outputFiles");
    }
  });

  it("should reject if prop is env", async ()=>{
    try {
      await updateComponentMock(mockProjectRootDir, mockID, "env", { KEY: "VAL" });
      throw new Error("Expected to throw an error, but did not.");
    } catch (err) {
      expect(err.message).to.include("does not support env");
    }
  });

  it("should call setUploadOndemandOutputFile if prop=uploadOnDemand and value=true", async ()=>{
    await updateComponentMock(mockProjectRootDir, mockID, "uploadOnDemand", true);
    expect(setUploadOndemandOutputFileMock.calledOnceWith(mockProjectRootDir, mockID)).to.be.true;
  });

  it("should call renameComponentDir if prop=name", async ()=>{
    await updateComponentMock(mockProjectRootDir, mockID, "name", "NewName");
    expect(renameComponentDirMock.calledOnceWith(mockProjectRootDir, mockID, "NewName")).to.be.true;
  });

  it("should update other properties and write to component JSON", async ()=>{
    await updateComponentMock(mockProjectRootDir, mockID, "anyProp", "newValue");

    //readComponentJsonByIDが呼ばれたか
    expect(readComponentJsonByIDMock.calledOnceWith(mockProjectRootDir, mockID)).to.be.true;

    //取得したcomponentJsonが更新されてwriteComponentJsonByIDされるか
    expect(writeComponentJsonByIDMock.calledOnce).to.be.true;
    const writeCallArgs = writeComponentJsonByIDMock.firstCall.args;
    expect(writeCallArgs[0]).to.equal(mockProjectRootDir); //projectRootDir
    expect(writeCallArgs[1]).to.equal(mockID); //component ID
    expect(writeCallArgs[2]).to.deep.equal({
      ID: mockID,
      anyProp: "newValue",
      name: "NewName",
      uploadOnDemand: true
    });
  });
});
