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

describe("#writeProjectJson", ()=>{
  let writeJsonWrapperMock;
  let gitAddMock;

  const mockProjectRootDir = "/mock/project/root";
  const mockProjectJson = { name: "test_project", version: 2 };
  const mockFileName = `${mockProjectRootDir}/prj.wheel.json`;

  beforeEach(()=>{
    writeJsonWrapperMock = sinon.stub(projectFilesOperator._internal, "writeJsonWrapper");
    gitAddMock = sinon.stub(projectFilesOperator._internal, "gitAdd");
  });
  afterEach(()=>{
    sinon.restore();
  });

  it("should write the JSON file and add it to git", async ()=>{
    writeJsonWrapperMock.resolves();
    gitAddMock.resolves();

    await projectFilesOperator._internal.writeProjectJson(mockProjectRootDir, mockProjectJson);

    expect(writeJsonWrapperMock.calledOnceWithExactly(mockFileName, mockProjectJson)).to.be.true;
    expect(gitAddMock.calledOnceWithExactly(mockProjectRootDir, mockFileName)).to.be.true;
  });

  it("should throw an error if writeJsonWrapper fails", async ()=>{
    const mockError = new Error("Failed to write JSON");
    writeJsonWrapperMock.rejects(mockError);

    try {
      await projectFilesOperator._internal.writeProjectJson(mockProjectRootDir, mockProjectJson);
      throw new Error("Expected writeProjectJson to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(writeJsonWrapperMock.calledOnceWithExactly(mockFileName, mockProjectJson)).to.be.true;
    expect(gitAddMock.notCalled).to.be.true;
  });

  it("should throw an error if gitAdd fails", async ()=>{
    const mockError = new Error("Failed to add file to git");
    writeJsonWrapperMock.resolves();
    gitAddMock.rejects(mockError);

    try {
      await projectFilesOperator._internal.writeProjectJson(mockProjectRootDir, mockProjectJson);
      throw new Error("Expected writeProjectJson to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(writeJsonWrapperMock.calledOnceWithExactly(mockFileName, mockProjectJson)).to.be.true;
    expect(gitAddMock.calledOnceWithExactly(mockProjectRootDir, mockFileName)).to.be.true;
  });
});
