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
const projectFilesOperator = require("../../../app/core/projectFilesOperator.js");


describe.skip("#isComponentDir", ()=>{
  let rewireProjectFilesOperator;
  let isComponentDir;
  let fsMock;

  beforeEach(()=>{
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    isComponentDir = rewireProjectFilesOperator.__get__("isComponentDir");

    //fs.lstatとfs.pathExistsをstub化。ただし変数名はMockで終わらせる規約
    fsMock = {
      lstatMock: sinon.stub(),
      pathExistsMock: sinon.stub()
    };

    //rewireで内部のfs参照を上書き
    rewireProjectFilesOperator.__set__({
      fs: {
        lstat: fsMock.lstatMock,
        pathExists: fsMock.pathExistsMock
      }
    });
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if lstat throws an error (e.g. path does not exist)", async ()=>{
    fsMock.lstatMock.rejects(new Error("ENOENT"));

    await expect(isComponentDir("/non/existing/path")).to.be.rejectedWith("ENOENT");
    expect(fsMock.lstatMock.calledOnce).to.be.true;
    expect(fsMock.pathExistsMock.notCalled).to.be.true;
  });

  it("should return false if target is not a directory", async ()=>{
    const fakeStats = { isDirectory: ()=>false };
    fsMock.lstatMock.resolves(fakeStats);

    const result = await isComponentDir("/some/file");
    expect(result).to.be.false;
    expect(fsMock.lstatMock.calledOnce).to.be.true;
    expect(fsMock.pathExistsMock.notCalled).to.be.true;
  });

  it("should return false if target is a directory but cmp.wheel.json does not exist", async ()=>{
    const fakeStats = { isDirectory: ()=>true };
    fsMock.lstatMock.resolves(fakeStats);
    fsMock.pathExistsMock.resolves(false);

    const result = await isComponentDir("/some/dir");
    expect(result).to.be.false;
    expect(fsMock.lstatMock.calledOnce).to.be.true;
    expect(fsMock.pathExistsMock.calledOnce).to.be.true;
  });

  it("should return true if target is a directory and cmp.wheel.json exists", async ()=>{
    const fakeStats = { isDirectory: ()=>true };
    fsMock.lstatMock.resolves(fakeStats);
    fsMock.pathExistsMock.resolves(true);

    const result = await isComponentDir("/some/dir");
    expect(result).to.be.true;
    expect(fsMock.lstatMock.calledOnce).to.be.true;
    expect(fsMock.pathExistsMock.calledOnce).to.be.true;
  });
});
