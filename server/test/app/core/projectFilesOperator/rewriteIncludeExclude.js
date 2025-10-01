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

describe("#rewriteIncludeExclude", ()=>{
  let rewriteIncludeExclude;
  let readJsonGreedyMock, writeComponentJsonMock, glob2ArrayMock;
  const mockProjectRootDir = "/mock/project/root";
  const mockFilename = `${mockProjectRootDir}/component.json`;
  let changedFiles;

  beforeEach(()=>{
    rewriteIncludeExclude = projectFilesOperator._internal.rewriteIncludeExclude;

    changedFiles = [];

    readJsonGreedyMock = sinon.stub(projectFilesOperator._internal, "readJsonGreedy");
    writeComponentJsonMock = sinon.stub(projectFilesOperator._internal, "writeComponentJson").resolves();
    glob2ArrayMock = sinon.stub(projectFilesOperator._internal, "glob2Array");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should convert string 'include' property to array of objects", async ()=>{
    const mockComponentJson = { include: "file1,file2", exclude: [] };
    readJsonGreedyMock.resolves(mockComponentJson);
    glob2ArrayMock.returns(["file1", "file2"]);

    await rewriteIncludeExclude(mockProjectRootDir, mockFilename, changedFiles);

    expect(glob2ArrayMock.calledOnceWithExactly("file1,file2")).to.be.true;
    expect(mockComponentJson.include).to.deep.equal([
      { name: "file1" },
      { name: "file2" }
    ]);
    expect(writeComponentJsonMock.calledOnceWithExactly(
      mockProjectRootDir,
      path.dirname(mockFilename),
      mockComponentJson
    )).to.be.true;
    expect(changedFiles).to.include(mockFilename);
  });

  it("should set 'include' to an empty array if it is null", async ()=>{
    const mockComponentJson = { include: null, exclude: [] };
    readJsonGreedyMock.resolves(mockComponentJson);

    await rewriteIncludeExclude(mockProjectRootDir, mockFilename, changedFiles);

    expect(mockComponentJson.include).to.deep.equal([]);
    expect(writeComponentJsonMock.calledOnce).to.be.true;
    expect(changedFiles).to.include(mockFilename);
  });

  it("should not write if no changes are made", async ()=>{
    const mockComponentJson = { include: [], exclude: [] };
    readJsonGreedyMock.resolves(mockComponentJson);

    await rewriteIncludeExclude(mockProjectRootDir, mockFilename, changedFiles);

    expect(writeComponentJsonMock.notCalled).to.be.true;
    expect(changedFiles).to.be.empty;
  });

  it("should convert string 'exclude' property to array of objects", async ()=>{
    const mockComponentJson = { include: [], exclude: "file3,file4" };
    readJsonGreedyMock.resolves(mockComponentJson);
    glob2ArrayMock.returns(["file3", "file4"]);

    await rewriteIncludeExclude(mockProjectRootDir, mockFilename, changedFiles);

    expect(glob2ArrayMock.calledOnceWithExactly("file3,file4")).to.be.true;
    expect(mockComponentJson.exclude).to.deep.equal([
      { name: "file3" },
      { name: "file4" }
    ]);
    expect(writeComponentJsonMock.calledOnce).to.be.true;
    expect(changedFiles).to.include(mockFilename);
  });

  it("should set 'exclude' to an empty array if it is null", async ()=>{
    const mockComponentJson = { include: [], exclude: null };
    readJsonGreedyMock.resolves(mockComponentJson);

    await rewriteIncludeExclude(mockProjectRootDir, mockFilename, changedFiles);

    expect(mockComponentJson.exclude).to.deep.equal([]);
    expect(writeComponentJsonMock.calledOnce).to.be.true;
    expect(changedFiles).to.include(mockFilename);
  });
});
