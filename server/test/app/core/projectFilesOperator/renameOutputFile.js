/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#renameOutputFile", ()=>{
  let isValidOutputFilenameStub;
  let getComponentDirStub;
  let readComponentJsonStub;
  let writeComponentJsonStub;

  const mockProjectRootDir = "/mock/project/root";
  const mockID = "component-123";
  const mockIndex = 0;
  const validNewName = "newOutput.dat";
  const invalidNewName = "invalid/name";
  let mockComponentDir;
  let mockComponentJson;

  beforeEach(()=>{
    isValidOutputFilenameStub = sinon.stub(projectFilesOperator._internal, "isValidOutputFilename");
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
    readComponentJsonStub = sinon.stub(projectFilesOperator._internal, "readComponentJson");
    writeComponentJsonStub = sinon.stub(projectFilesOperator._internal, "writeComponentJson").resolves();

    mockComponentDir = "/mock/project/root/component-123";
    mockComponentJson = {
      outputFiles: [
        {
          name: "oldOutput.dat",
          dst: []
        }
      ]
    };
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if the newName is invalid", async ()=>{
    isValidOutputFilenameStub.returns(false);

    try {
      await projectFilesOperator.renameOutputFile(mockProjectRootDir, mockID, mockIndex, invalidNewName);
      throw new Error("Expected renameOutputFile to throw an error for invalid name");
    } catch (err) {
      expect(err.message).to.equal(`${invalidNewName} is not valid outputFile name`);
      expect(isValidOutputFilenameStub.calledOnceWithExactly(invalidNewName)).to.be.true;
    }
  });

  it("should reject if the index is out of range (negative)", async ()=>{
    isValidOutputFilenameStub.returns(true);
    getComponentDirStub.resolves(mockComponentDir);
    readComponentJsonStub.resolves(mockComponentJson);

    try {
      await projectFilesOperator.renameOutputFile(mockProjectRootDir, mockID, -1, validNewName);
      throw new Error("Expected renameOutputFile to throw an error for out-of-range index");
    } catch (err) {
      expect(err.message).to.equal("invalid index -1");
    }
  });

  it("should reject if the index is out of range (too large)", async ()=>{
    isValidOutputFilenameStub.returns(true);
    getComponentDirStub.resolves(mockComponentDir);

    mockComponentJson.outputFiles = [{ name: "oneFile.dat" }];
    readComponentJsonStub.resolves(mockComponentJson);

    try {
      await projectFilesOperator.renameOutputFile(mockProjectRootDir, mockID, 1, validNewName);
      throw new Error("Expected renameOutputFile to throw an error for out-of-range index");
    } catch (err) {
      expect(err.message).to.equal("invalid index 1");
    }
  });

  it("should rename outputFile without counterparts if dst is empty", async ()=>{
    isValidOutputFilenameStub.returns(true);
    getComponentDirStub.resolves(mockComponentDir);

    mockComponentJson.outputFiles = [
      { name: "oldOutput.dat", dst: [] }
    ];
    readComponentJsonStub.resolves(mockComponentJson);

    await projectFilesOperator.renameOutputFile(mockProjectRootDir, mockID, 0, validNewName);

    expect(mockComponentJson.outputFiles[0].name).to.equal(validNewName);
    expect(writeComponentJsonStub.callCount).to.equal(1);
  });

  it("should rename outputFile and update references in the counterpart's inputFiles", async ()=>{
    isValidOutputFilenameStub.returns(true);
    getComponentDirStub.onCall(0).resolves(mockComponentDir);
    getComponentDirStub.onCall(1).resolves("/mock/project/root/counterpart-999");

    mockComponentJson.outputFiles = [
      {
        name: "oldOutput.dat",
        dst: [{ dstNode: "counterpart-999" }]
      }
    ];
    readComponentJsonStub.onCall(0).resolves(mockComponentJson);

    const counterpartJson = {
      inputFiles: [
        {
          name: "someInput",
          src: [
            { srcNode: mockID, srcName: "oldOutput.dat" }
          ]
        }
      ],
      outputFiles: []
    };
    readComponentJsonStub.onCall(1).resolves(counterpartJson);

    await projectFilesOperator.renameOutputFile(mockProjectRootDir, mockID, 0, validNewName);

    expect(mockComponentJson.outputFiles[0].name).to.equal(validNewName);
    expect(counterpartJson.inputFiles[0].src[0].srcName).to.equal(validNewName);

    expect(writeComponentJsonStub.callCount).to.equal(2);
    expect(writeComponentJsonStub.firstCall.args[1]).to.equal(mockComponentDir);
    expect(writeComponentJsonStub.secondCall.args[1]).to.equal("/mock/project/root/counterpart-999");
  });

  it("should keep old name if the counterpart's outputFiles has 'origin' property", async ()=>{
    isValidOutputFilenameStub.returns(true);
    getComponentDirStub.onCall(0).resolves(mockComponentDir);
    getComponentDirStub.onCall(1).resolves("/mock/project/root/counterpart-999");

    mockComponentJson.outputFiles = [
      {
        name: "oldOutput.dat",
        dst: [{ dstNode: "counterpart-999" }]
      }
    ];
    readComponentJsonStub.onCall(0).resolves(mockComponentJson);

    const counterpartJson = {
      inputFiles: [],
      outputFiles: [
        {
          origin: [{ srcNode: mockID, srcName: "oldOutput.dat" }]
        }
      ]
    };
    readComponentJsonStub.onCall(1).resolves(counterpartJson);

    await projectFilesOperator.renameOutputFile(mockProjectRootDir, mockID, 0, validNewName);

    expect(mockComponentJson.outputFiles[0].name).to.equal(validNewName);
    expect(counterpartJson.outputFiles[0].origin[0].srcName).to.equal(validNewName);

    expect(writeComponentJsonStub.callCount).to.equal(2);
  });
});
