/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#makeDir", ()=>{
  let pathExistsStub;
  let mkdirStub;

  beforeEach(()=>{
    pathExistsStub = sinon.stub(projectFilesOperator._internal.fs, "pathExists");
    mkdirStub = sinon.stub(projectFilesOperator._internal.fs, "mkdir").resolves();
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should create a new directory when the name is available", async ()=>{
    pathExistsStub.resolves(false);

    const result = await projectFilesOperator._internal.makeDir("/mock/path", 0);

    expect(pathExistsStub.calledOnceWith("/mock/path0")).to.be.true;
    expect(mkdirStub.calledOnceWith("/mock/path0")).to.be.true;
    expect(result).to.equal("/mock/path0");
  });

  it("should increment suffix until an available name is found", async ()=>{
    pathExistsStub.onCall(0).resolves(true);
    pathExistsStub.onCall(1).resolves(true);
    pathExistsStub.onCall(2).resolves(false);

    const result = await projectFilesOperator._internal.makeDir("/mock/path", 0);

    expect(pathExistsStub.callCount).to.equal(3);
    expect(mkdirStub.calledOnceWith("/mock/path2")).to.be.true;
    expect(result).to.equal("/mock/path2");
  });

  it("should handle an empty basename gracefully", async ()=>{
    pathExistsStub.resolves(false);

    const result = await projectFilesOperator._internal.makeDir("", 0);

    expect(mkdirStub.calledOnceWith("0")).to.be.true;
    expect(result).to.equal("0");
  });

  it("should throw an error if mkdir fails", async ()=>{
    const mkdirError = new Error("Permission denied");
    pathExistsStub.resolves(false);
    mkdirStub.rejects(mkdirError);

    try {
      await projectFilesOperator._internal.makeDir("/mock/path", 0);
      throw new Error("Expected makeDir to throw an error");
    } catch (err) {
      expect(err).to.equal(mkdirError);
    }

    expect(mkdirStub.calledOnceWith("/mock/path0")).to.be.true;
  });
});
