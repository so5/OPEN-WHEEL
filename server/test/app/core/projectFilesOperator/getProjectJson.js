/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import path from "path";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#getProjectJson", ()=>{
  let readJsonGreedyStub;

  beforeEach(()=>{
    readJsonGreedyStub = sinon.stub(projectFilesOperator._internal, "readJsonGreedy");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return the project JSON data when readJsonGreedy resolves", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockProjectJson = { name: "test_project", version: 2 };
    const expectedPath = path.resolve(mockProjectRootDir, "prj.wheel.json");
    readJsonGreedyStub.resolves(mockProjectJson);

    const result = await projectFilesOperator._internal.getProjectJson(mockProjectRootDir);

    expect(readJsonGreedyStub.calledOnceWith(expectedPath)).to.be.true;
    expect(result).to.deep.equal(mockProjectJson);
  });

  it("should throw an error when readJsonGreedy rejects", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockError = new Error("File not found");
    const expectedPath = path.resolve(mockProjectRootDir, "prj.wheel.json");
    readJsonGreedyStub.rejects(mockError);

    try {
      await projectFilesOperator._internal.getProjectJson(mockProjectRootDir);
      throw new Error("Expected getProjectJson to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readJsonGreedyStub.calledOnceWith(expectedPath)).to.be.true;
  });
});
