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


describe("#addOutputFile", ()=>{
  let isValidOutputFilenameStub;
  let getComponentDirStub;
  let readComponentJsonStub;
  let writeComponentJsonStub;

  const mockProjectRootDir = "/mock/project/root";
  const mockID = "componentID";
  const mockName = "outputFileA";
  const mockComponentDir = "/mock/project/root/componentDir";
  const mockComponentJson = {
    name: "testComponent",
    outputFiles: []
  };

  beforeEach(()=>{
    isValidOutputFilenameStub = sinon.stub(projectFilesOperator._internal, "isValidOutputFilename");
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
    readComponentJsonStub = sinon.stub(projectFilesOperator._internal, "readComponentJson");
    writeComponentJsonStub = sinon.stub(projectFilesOperator._internal, "writeComponentJson").resolves();
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if the filename is invalid", async ()=>{
    isValidOutputFilenameStub.returns(false);

    try {
      await projectFilesOperator.addOutputFile(mockProjectRootDir, mockID, mockName);
      throw new Error("Expected addOutputFile to reject with error");
    } catch (err) {
      expect(err.message).to.equal(`${mockName} is not valid outputFile name`);
    }
    expect(isValidOutputFilenameStub.calledOnceWithExactly(mockName)).to.be.true;
    expect(getComponentDirStub.notCalled).to.be.true;
    expect(readComponentJsonStub.notCalled).to.be.true;
    expect(writeComponentJsonStub.notCalled).to.be.true;
  });

  it("should reject if 'outputFiles' property does not exist in componentJson", async ()=>{
    isValidOutputFilenameStub.returns(true);
    getComponentDirStub.resolves(mockComponentDir);
    const badComponentJson = { name: "badComponent" };
    readComponentJsonStub.resolves(badComponentJson);

    try {
      await projectFilesOperator.addOutputFile(mockProjectRootDir, mockID, mockName);
      throw new Error("Expected addOutputFile to reject");
    } catch (err) {
      expect(err.message).to.equal("badComponent does not have outputFiles");
      expect(err.component).to.deep.equal(badComponentJson);
    }
    expect(getComponentDirStub.calledOnceWithExactly(mockProjectRootDir, mockID, true)).to.be.true;
    expect(readComponentJsonStub.calledOnceWithExactly(mockComponentDir)).to.be.true;
    expect(writeComponentJsonStub.notCalled).to.be.true;
  });

  it("should reject if the same name output file already exists", async ()=>{
    isValidOutputFilenameStub.returns(true);
    getComponentDirStub.resolves(mockComponentDir);
    readComponentJsonStub.resolves({
      name: "testComponent",
      outputFiles: [{ name: mockName, dst: [] }]
    });

    try {
      await projectFilesOperator.addOutputFile(mockProjectRootDir, mockID, mockName);
      throw new Error("Expected addOutputFile to reject");
    } catch (err) {
      expect(err.message).to.equal(`${mockName} is already exists`);
    }
    expect(getComponentDirStub.calledOnce).to.be.true;
    expect(readComponentJsonStub.calledOnce).to.be.true;
    expect(writeComponentJsonStub.notCalled).to.be.true;
  });

  it("should add a new output file and call writeComponentJson when valid and not duplicate", async ()=>{
    isValidOutputFilenameStub.returns(true);
    getComponentDirStub.resolves(mockComponentDir);
    readComponentJsonStub.resolves(mockComponentJson);

    await projectFilesOperator.addOutputFile(mockProjectRootDir, mockID, mockName);

    expect(mockComponentJson.outputFiles).to.deep.equal([
      { name: mockName, dst: [] }
    ]);

    expect(writeComponentJsonStub.calledOnceWithExactly(
      mockProjectRootDir,
      mockComponentDir,
      mockComponentJson
    )).to.be.true;
  });
});