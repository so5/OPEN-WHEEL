/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const path = require("path");
const projectFilesOperator = require("../../../../app/core/projectFilesOperator.js");

describe("#getSourceComponents", ()=>{
  let promisifyStub;
  let globStub;
  let readJsonGreedyStub;
  const mockProjectRootDir = "/mock/project/root";

  beforeEach(()=>{
    globStub = sinon.stub();
    promisifyStub = sinon.stub(projectFilesOperator._internal, "promisify").returns(globStub);
    readJsonGreedyStub = sinon.stub(projectFilesOperator._internal, "readJsonGreedy");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return only source components that are not sub-components or disabled", async ()=>{
    const mockFiles = [
      "comp1/cmp.wheel.json",
      "comp2/cmp.wheel.json",
      "comp3/cmp.wheel.json",
      "comp4/cmp.wheel.json"
    ];
    globStub.resolves(mockFiles);

    const sourceComponent = { type: "source", subComponent: false, disable: false };
    readJsonGreedyStub.onCall(0).resolves(sourceComponent);
    readJsonGreedyStub.onCall(1).resolves({ type: "source", subComponent: true, disable: false });
    readJsonGreedyStub.onCall(2).resolves({ type: "source", subComponent: false, disable: true });
    readJsonGreedyStub.onCall(3).resolves({ type: "task", subComponent: false, disable: false });

    const result = await projectFilesOperator.getSourceComponents(mockProjectRootDir);

    expect(globStub.calledOnceWith(path.join(mockProjectRootDir, "**", "cmp.wheel.json"))).to.be.true;
    expect(result).to.have.lengthOf(1);
    expect(result[0]).to.deep.equal(sourceComponent);
  });

  it("should return an empty array if no componentJson files are found", async ()=>{
    globStub.resolves([]);

    const result = await projectFilesOperator.getSourceComponents(mockProjectRootDir);

    expect(result).to.be.an("array").that.is.empty;
    expect(globStub.calledOnce).to.be.true;
    expect(readJsonGreedyStub.notCalled).to.be.true;
  });

  it("should throw an error if readJsonGreedy rejects for any file", async ()=>{
    const mockFiles = ["comp1/cmp.wheel.json", "comp2/cmp.wheel.json"];
    globStub.resolves(mockFiles);

    const mockError = new Error("Failed to read JSON");
    readJsonGreedyStub.onCall(0).resolves({ type: "source", subComponent: false, disable: false });
    readJsonGreedyStub.onCall(1).rejects(mockError);

    try {
      await projectFilesOperator.getSourceComponents(mockProjectRootDir);
      throw new Error("Expected getSourceComponents to throw an error");
    } catch (err) {
      expect(err).to.equal(mockError);
    }
  });
});