/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it } = require("mocha");
const sinon = require("sinon");
const path = require("path");
const { promisify } = require("util");
const projectFilesOperator = require("../../../../app/core/projectFilesOperator.js");


describe.skip("#rewriteAllIncludeExcludeProperty", ()=>{
  let rewriteAllIncludeExcludeProperty;
  let rewriteIncludeExcludeMock;
  let globMock;
  let promisifyMock;

  beforeEach(()=>{
    rewriteAllIncludeExcludeProperty = projectFilesOperator._internal.rewriteAllIncludeExcludeProperty;

    rewriteIncludeExcludeMock = sinon.stub();
    projectFilesOperator._internal.rewriteIncludeExclude = rewriteIncludeExcludeMock;

    globMock = sinon.stub();
    promisifyMock = sinon.stub().callsFake((fn)=>fn === glob ? globMock : promisify(fn));
    projectFilesOperator._internal.promisify = promisifyMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should process all component JSON files and update 'changed' array", async ()=>{
    const projectRootDir = "/mock/project/root";
    const changed = [];
    const mockFiles = [
      `${projectRootDir}/comp1/cmp.wheel.json`,
      `${projectRootDir}/comp2/cmp.wheel.json`
    ];

    globMock.resolves(mockFiles);
    rewriteIncludeExcludeMock.resolves();

    await rewriteAllIncludeExcludeProperty(projectRootDir, changed);

    expect(globMock.calledOnceWithExactly(`./**/cmp.wheel.json`, { cwd: projectRootDir })).to.be.true;
    expect(rewriteIncludeExcludeMock.callCount).to.equal(mockFiles.length);
    mockFiles.forEach((file, index)=>{
      expect(rewriteIncludeExcludeMock.getCall(index).args[0]).to.equal(projectRootDir);
      expect(rewriteIncludeExcludeMock.getCall(index).args[1]).to.equal(path.resolve(projectRootDir, file));
      expect(rewriteIncludeExcludeMock.getCall(index).args[2]).to.equal(changed);
    });
  });

  it("should handle an empty project directory gracefully", async ()=>{
    const projectRootDir = "/mock/project/root";
    const changed = [];

    globMock.resolves([]);

    await rewriteAllIncludeExcludeProperty(projectRootDir, changed);

    expect(globMock.calledOnceWithExactly(`./**/cmp.wheel.json`, { cwd: projectRootDir })).to.be.true;
    expect(rewriteIncludeExcludeMock.notCalled).to.be.true;
    expect(changed).to.deep.equal([]);
  });

  it("should propagate errors from rewriteIncludeExclude", async ()=>{
    const projectRootDir = "/mock/project/root";
    const changed = [];
    const mockFiles = [
      `${projectRootDir}/comp1/cmp.wheel.json`
    ];
    const mockError = new Error("Test error");

    globMock.resolves(mockFiles);
    rewriteIncludeExcludeMock.rejects(mockError);

    try {
      await rewriteAllIncludeExcludeProperty(projectRootDir, changed);
      throw new Error("Expected rewriteAllIncludeExcludeProperty to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(globMock.calledOnceWithExactly(`./**/cmp.wheel.json`, { cwd: projectRootDir })).to.be.true;
    expect(rewriteIncludeExcludeMock.calledOnceWithExactly(
      projectRootDir,
      path.resolve(projectRootDir, mockFiles[0]),
      changed
    )).to.be.true;
  });
});
