/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#addInputFile", ()=>{
  let isValidInputFilenameStub;
  let getComponentDirStub;
  let readComponentJsonStub;
  let writeComponentJsonStub;

  beforeEach(()=>{
    isValidInputFilenameStub = sinon.stub(projectFilesOperator._internal, "isValidInputFilename");
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
    readComponentJsonStub = sinon.stub(projectFilesOperator._internal, "readComponentJson");
    writeComponentJsonStub = sinon.stub(projectFilesOperator._internal, "writeComponentJson");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if the input filename is invalid", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "component123";
    const invalidName = "invalid*filename";

    isValidInputFilenameStub.returns(false);

    try {
      await projectFilesOperator.addInputFile(projectRootDir, componentID, invalidName);
      throw new Error("Expected addInputFile to throw an error");
    } catch (err) {
      expect(err).to.be.an("Error");
      expect(err.message).to.equal(`${invalidName} is not valid inputFile name`);
    }
    expect(isValidInputFilenameStub.calledOnceWithExactly(invalidName)).to.be.true;
    expect(getComponentDirStub.notCalled).to.be.true;
    expect(readComponentJsonStub.notCalled).to.be.true;
    expect(writeComponentJsonStub.notCalled).to.be.true;
  });

  it("should reject if the component does not have inputFiles property", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "componentWithoutInputFiles";
    const name = "validInput.txt";
    isValidInputFilenameStub.returns(true);

    const mockDir = "/mock/project/components/componentWithoutInputFiles";
    getComponentDirStub.resolves(mockDir);

    const mockComponentJson = {
      ID: componentID,
      name: "NoInputFilesComponent"
    };
    readComponentJsonStub.resolves(mockComponentJson);

    try {
      await projectFilesOperator.addInputFile(projectRootDir, componentID, name);
      throw new Error("Expected addInputFile to throw an error");
    } catch (err) {
      expect(err).to.be.an("Error");
      expect(err.message).to.equal(`${mockComponentJson.name} does not have inputFiles`);
      expect(err.component).to.deep.equal(mockComponentJson);
    }

    expect(isValidInputFilenameStub.calledOnceWithExactly(name)).to.be.true;
    expect(getComponentDirStub.calledOnceWithExactly(projectRootDir, componentID, true)).to.be.true;
    expect(readComponentJsonStub.calledOnceWithExactly(mockDir)).to.be.true;
    expect(writeComponentJsonStub.notCalled).to.be.true;
  });

  it("should add a new inputFile to the component and call writeComponentJson on success", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "componentWithInputFiles";
    const name = "inputFileName.txt";
    isValidInputFilenameStub.returns(true);

    const mockDir = "/mock/project/components/componentWithInputFiles";
    getComponentDirStub.resolves(mockDir);

    const mockComponentJson = {
      ID: componentID,
      name: "HasInputFilesComponent",
      inputFiles: []
    };
    readComponentJsonStub.resolves(mockComponentJson);

    writeComponentJsonStub.resolves();

    await projectFilesOperator.addInputFile(projectRootDir, componentID, name);

    expect(isValidInputFilenameStub.calledOnceWithExactly(name)).to.be.true;
    expect(getComponentDirStub.calledOnceWithExactly(projectRootDir, componentID, true)).to.be.true;
    expect(readComponentJsonStub.calledOnceWithExactly(mockDir)).to.be.true;

    expect(mockComponentJson.inputFiles).to.have.lengthOf(1);
    const newInputFile = mockComponentJson.inputFiles[0];
    expect(newInputFile).to.deep.equal({ name, src: [] });

    expect(writeComponentJsonStub.calledOnceWithExactly(projectRootDir, mockDir, mockComponentJson)).to.be.true;
  });

  it("should reject if getComponentDir fails", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "someComponent";
    const name = "testInput.dat";
    isValidInputFilenameStub.returns(true);

    const mockError = new Error("Failed to get component dir");
    getComponentDirStub.rejects(mockError);

    try {
      await projectFilesOperator.addInputFile(projectRootDir, componentID, name);
      throw new Error("Expected addInputFile to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(isValidInputFilenameStub.calledOnceWithExactly(name)).to.be.true;
    expect(readComponentJsonStub.notCalled).to.be.true;
    expect(writeComponentJsonStub.notCalled).to.be.true;
  });

  it("should reject if readComponentJson fails", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "componentWithInputFiles";
    const name = "testInput.dat";
    isValidInputFilenameStub.returns(true);

    const mockDir = "/mock/project/components/componentWithInputFiles";
    getComponentDirStub.resolves(mockDir);

    const mockError = new Error("readComponentJson error");
    readComponentJsonStub.rejects(mockError);

    try {
      await projectFilesOperator.addInputFile(projectRootDir, componentID, name);
      throw new Error("Expected addInputFile to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(isValidInputFilenameStub.calledOnceWithExactly(name)).to.be.true;
    expect(getComponentDirStub.calledOnce).to.be.true;
    expect(readComponentJsonStub.calledOnceWithExactly(mockDir)).to.be.true;
    expect(writeComponentJsonStub.notCalled).to.be.true;
  });

  it("should reject if writeComponentJson fails", async ()=>{
    const projectRootDir = "/mock/project";
    const componentID = "componentWithInputFiles";
    const name = "testInput.dat";
    isValidInputFilenameStub.returns(true);

    const mockDir = "/mock/project/components/componentWithInputFiles";
    getComponentDirStub.resolves(mockDir);

    const mockComponentJson = {
      ID: componentID,
      name: "HasInputFilesComponent",
      inputFiles: []
    };
    readComponentJsonStub.resolves(mockComponentJson);

    const mockError = new Error("writeComponentJson error");
    writeComponentJsonStub.rejects(mockError);

    try {
      await projectFilesOperator.addInputFile(projectRootDir, componentID, name);
      throw new Error("Expected addInputFile to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(mockComponentJson.inputFiles).to.have.lengthOf(1);
    expect(writeComponentJsonStub.calledOnce).to.be.true;
  });
});
