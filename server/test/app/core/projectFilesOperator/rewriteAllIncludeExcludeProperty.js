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

const { _internal } = projectFilesOperator;

describe("#rewriteAllIncludeExcludeProperty", ()=>{
  let stub;
  beforeEach(()=>{
    stub = sinon.stub(_internal, "glob");
  });
  afterEach(()=>{
    sinon.restore();
  });
  it("should process all component JSON files and update 'changed' array", async ()=>{
    const projectRootDir = "/mock/project/root";
    const changed = [];
    const mockFiles = [
      "comp1/cmp.wheel.json",
      "comp2/cmp.wheel.json"
    ];

    stub.resolves(mockFiles);
    const rewriteIncludeExcludeStub = sinon.stub(_internal, "rewriteIncludeExclude").resolves();

    await _internal.rewriteAllIncludeExcludeProperty(projectRootDir, changed);

    expect(stub.calledOnceWith(`./**/cmp.wheel.json`, { cwd: projectRootDir })).to.be.true;
    expect(rewriteIncludeExcludeStub.callCount).to.equal(mockFiles.length);
    mockFiles.forEach((file, index)=>{
      expect(rewriteIncludeExcludeStub.getCall(index).args[0]).to.equal(projectRootDir);
      expect(rewriteIncludeExcludeStub.getCall(index).args[1]).to.equal(path.resolve(projectRootDir, file));
      expect(rewriteIncludeExcludeStub.getCall(index).args[2]).to.equal(changed);
    });
  });

  it("should handle an empty project directory gracefully", async ()=>{
    const projectRootDir = "/mock/project/root";
    const changed = [];

    stub.resolves([]);
    const rewriteIncludeExcludeStub = sinon.stub(_internal, "rewriteIncludeExclude").resolves();

    await _internal.rewriteAllIncludeExcludeProperty(projectRootDir, changed);

    expect(stub.calledOnceWith(`./**/cmp.wheel.json`, { cwd: projectRootDir })).to.be.true;
    expect(rewriteIncludeExcludeStub.notCalled).to.be.true;
    expect(changed).to.deep.equal([]);
  });

  it("should propagate errors from rewriteIncludeExclude", async ()=>{
    const projectRootDir = "/mock/project/root";
    const changed = [];
    const mockFiles = [
      "comp1/cmp.wheel.json"
    ];
    const mockError = new Error("Test error");

    stub.resolves(mockFiles);
    const rewriteIncludeExcludeStub = sinon.stub(_internal, "rewriteIncludeExclude").rejects(mockError);

    try {
      await _internal.rewriteAllIncludeExcludeProperty(projectRootDir, changed);
      throw new Error("Expected rewriteAllIncludeExcludeProperty to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(stub.calledOnceWith(`./**/cmp.wheel.json`, { cwd: projectRootDir })).to.be.true;
    expect(rewriteIncludeExcludeStub.calledOnceWith(
      projectRootDir,
      path.resolve(projectRootDir, mockFiles[0]),
      changed
    )).to.be.true;
  });
});
