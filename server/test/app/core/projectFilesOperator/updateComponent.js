/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#updateComponent", ()=>{
  let readComponentJsonByIDStub;
  let writeComponentJsonByIDStub;
  let renameComponentDirStub;
  let setUploadOndemandOutputFileStub;

  const mockProjectRootDir = "/mock/project/root";
  const mockID = "component123";
  let mockComponentJson;

  beforeEach(()=>{
    mockComponentJson = { ID: mockID, name: "OldName", anyProp: "oldValue" };

    readComponentJsonByIDStub = sinon.stub(projectFilesOperator._internal, "readComponentJsonByID").resolves(mockComponentJson);
    writeComponentJsonByIDStub = sinon.stub(projectFilesOperator._internal, "writeComponentJsonByID").resolves();
    renameComponentDirStub = sinon.stub(projectFilesOperator._internal, "renameComponentDir").resolves();
    setUploadOndemandOutputFileStub = sinon.stub(projectFilesOperator._internal, "setUploadOndemandOutputFile").resolves();
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if prop is path", async ()=>{
    try {
      await projectFilesOperator.updateComponent(mockProjectRootDir, mockID, "path", "/new/path");
      throw new Error("Expected to throw an error, but did not.");
    } catch (err) {
      expect(err.message).to.include("path property is deprecated");
    }
  });

  it("should reject if prop is inputFiles or outputFiles", async ()=>{
    try {
      await projectFilesOperator.updateComponent(mockProjectRootDir, mockID, "inputFiles", []);
      throw new Error("Expected to throw an error, but did not.");
    } catch (err) {
      expect(err.message).to.include("does not support inputFiles");
    }

    try {
      await projectFilesOperator.updateComponent(mockProjectRootDir, mockID, "outputFiles", []);
      throw new Error("Expected to throw an error, but did not.");
    } catch (err) {
      expect(err.message).to.include("does not support outputFiles");
    }
  });

  it("should reject if prop is env", async ()=>{
    try {
      await projectFilesOperator.updateComponent(mockProjectRootDir, mockID, "env", { KEY: "VAL" });
      throw new Error("Expected to throw an error, but did not.");
    } catch (err) {
      expect(err.message).to.include("does not support env");
    }
  });

  it("should call setUploadOndemandOutputFile if prop=uploadOnDemand and value=true", async ()=>{
    await projectFilesOperator.updateComponent(mockProjectRootDir, mockID, "uploadOnDemand", true);
    expect(setUploadOndemandOutputFileStub.calledOnceWith(mockProjectRootDir, mockID)).to.be.true;
    expect(writeComponentJsonByIDStub.calledOnce).to.be.true;
    const writeCallArgs = writeComponentJsonByIDStub.firstCall.args;
    expect(writeCallArgs[2].uploadOnDemand).to.be.true;
  });

  it("should call renameComponentDir if prop=name", async ()=>{
    await projectFilesOperator.updateComponent(mockProjectRootDir, mockID, "name", "NewName");
    expect(renameComponentDirStub.calledOnceWith(mockProjectRootDir, mockID, "NewName")).to.be.true;
    expect(writeComponentJsonByIDStub.calledOnce).to.be.true;
    const writeCallArgs = writeComponentJsonByIDStub.firstCall.args;
    expect(writeCallArgs[2].name).to.equal("NewName");
  });

  it("should update other properties and write to component JSON", async ()=>{
    await projectFilesOperator.updateComponent(mockProjectRootDir, mockID, "anyProp", "newValue");

    expect(readComponentJsonByIDStub.calledOnceWith(mockProjectRootDir, mockID)).to.be.true;

    expect(writeComponentJsonByIDStub.calledOnce).to.be.true;
    const writeCallArgs = writeComponentJsonByIDStub.firstCall.args;
    expect(writeCallArgs[0]).to.equal(mockProjectRootDir);
    expect(writeCallArgs[1]).to.equal(mockID);
    expect(writeCallArgs[2]).to.deep.equal({
      ID: mockID,
      name: "OldName",
      anyProp: "newValue"
    });
  });
});
