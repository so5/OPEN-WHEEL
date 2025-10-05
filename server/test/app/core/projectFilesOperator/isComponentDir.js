/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const projectFilesOperator = require("../../../../app/core/projectFilesOperator.js");

describe("#isComponentDir", ()=>{
  let lstatStub;
  let pathExistsStub;

  beforeEach(()=>{
    lstatStub = sinon.stub(projectFilesOperator._internal.fs, "lstat");
    pathExistsStub = sinon.stub(projectFilesOperator._internal.fs, "pathExists");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if lstat throws an error", async ()=>{
    const lstatError = new Error("ENOENT");
    lstatStub.rejects(lstatError);

    try {
      await projectFilesOperator.isComponentDir("/non/existing/path");
      throw new Error("should have been rejected");
    } catch (err) {
      expect(err).to.equal(lstatError);
    }
    expect(lstatStub.calledOnce).to.be.true;
    expect(pathExistsStub.notCalled).to.be.true;
  });

  it("should return false if target is not a directory", async ()=>{
    const fakeStats = { isDirectory: ()=>false };
    lstatStub.resolves(fakeStats);

    const result = await projectFilesOperator.isComponentDir("/some/file");
    expect(result).to.be.false;
    expect(lstatStub.calledOnce).to.be.true;
    expect(pathExistsStub.notCalled).to.be.true;
  });

  it("should return false if target is a directory but cmp.wheel.json does not exist", async ()=>{
    const fakeStats = { isDirectory: ()=>true };
    lstatStub.resolves(fakeStats);
    pathExistsStub.resolves(false);

    const result = await projectFilesOperator.isComponentDir("/some/dir");
    expect(result).to.be.false;
    expect(lstatStub.calledOnce).to.be.true;
    expect(pathExistsStub.calledOnce).to.be.true;
  });

  it("should return true if target is a directory and cmp.wheel.json exists", async ()=>{
    const fakeStats = { isDirectory: ()=>true };
    lstatStub.resolves(fakeStats);
    pathExistsStub.resolves(true);

    const result = await projectFilesOperator.isComponentDir("/some/dir");
    expect(result).to.be.true;
    expect(lstatStub.calledOnce).to.be.true;
    expect(pathExistsStub.calledOnce).to.be.true;
  });
});