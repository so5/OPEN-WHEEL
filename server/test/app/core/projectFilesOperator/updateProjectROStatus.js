/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it } from "mocha";
import sinon from "sinon";
import path from "path";
import { promisify } from "util";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#updateProjectROStatus", ()=>{
  let updateProjectROStatus;
  let readJsonGreedyMock;
  let writeJsonWrapperMock;

  beforeEach(()=>{
    updateProjectROStatus = projectFilesOperator._internal.updateProjectROStatus;

    readJsonGreedyMock = sinon.stub(projectFilesOperator._internal, "readJsonGreedy");
    writeJsonWrapperMock = sinon.stub(projectFilesOperator._internal, "writeJsonWrapper");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should update the readOnly property in the project JSON file", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockProjectJson = { name: "test_project", readOnly: false };
    const updatedProjectJson = { name: "test_project", readOnly: true };

    readJsonGreedyMock.resolves(mockProjectJson);
    writeJsonWrapperMock.resolves();

    await updateProjectROStatus(mockProjectRootDir, true);

    expect(readJsonGreedyMock.calledOnceWithExactly(
      `${mockProjectRootDir}/prj.wheel.json`
    )).to.be.true;

    expect(writeJsonWrapperMock.calledOnceWithExactly(
      `${mockProjectRootDir}/prj.wheel.json`,
      updatedProjectJson
    )).to.be.true;
  });

  it("should throw an error if readJsonGreedy fails", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockError = new Error("File not found");

    readJsonGreedyMock.rejects(mockError);

    try {
      await updateProjectROStatus(mockProjectRootDir, true);
      throw new Error("Expected updateProjectROStatus to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readJsonGreedyMock.calledOnceWithExactly(
      `${mockProjectRootDir}/prj.wheel.json`
    )).to.be.true;

    expect(writeJsonWrapperMock.notCalled).to.be.true;
  });

  it("should throw an error if writeJsonWrapper fails", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockProjectJson = { name: "test_project", readOnly: false };
    const mockError = new Error("Write failed");

    readJsonGreedyMock.resolves(mockProjectJson);
    writeJsonWrapperMock.rejects(mockError);

    try {
      await updateProjectROStatus(mockProjectRootDir, true);
      throw new Error("Expected updateProjectROStatus to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readJsonGreedyMock.calledOnceWithExactly(
      `${mockProjectRootDir}/prj.wheel.json`
    )).to.be.true;

    expect(writeJsonWrapperMock.calledOnceWithExactly(
      `${mockProjectRootDir}/prj.wheel.json`,
      { name: "test_project", readOnly: true }
    )).to.be.true;
  });
});
