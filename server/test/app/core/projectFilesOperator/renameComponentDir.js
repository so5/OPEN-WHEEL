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

describe("#renameComponentDir", ()=>{
  let isValidNameStub;
  let getComponentDirStub;
  let gitRmStub;
  let fsMoveStub;
  let gitAddStub;
  let updateComponentPathStub;
  let fsStub;

  const mockProjectRootDir = "/mock/project";
  const mockID = "mock-component-id";

  beforeEach(()=>{
    isValidNameStub = sinon.stub(projectFilesOperator._internal, "isValidName");
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
    gitRmStub = sinon.stub(projectFilesOperator._internal, "gitRm").resolves();
    fsStub = sinon.stub(projectFilesOperator._internal.fs, "move").resolves();
    gitAddStub = sinon.stub(projectFilesOperator._internal, "gitAdd").resolves();
    updateComponentPathStub = sinon.stub(projectFilesOperator._internal, "updateComponentPath").resolves("updated-path-map");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should throw an error if newName is invalid", async ()=>{
    isValidNameStub.returns(false);

    try {
      await projectFilesOperator._internal.renameComponentDir(mockProjectRootDir, mockID, "???");
      throw new Error("Expected error to be thrown");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.match(/not valid component name/);
    }

    expect(isValidNameStub.calledOnce).to.be.true;
    expect(getComponentDirStub.called).to.be.false;
    expect(gitRmStub.called).to.be.false;
    expect(fsMoveStub.called).to.be.false;
    expect(gitAddStub.called).to.be.false;
    expect(updateComponentPathStub.called).to.be.false;
  });

  it("should throw an error if trying to rename the root workflow directory", async ()=>{
    isValidNameStub.returns(true);
    getComponentDirStub.resolves(mockProjectRootDir);

    try {
      await projectFilesOperator._internal.renameComponentDir(mockProjectRootDir, mockID, "NewName");
      throw new Error("Expected error to be thrown");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("updateNode can not rename root workflow");
    }

    expect(isValidNameStub.calledOnce).to.be.true;
    expect(getComponentDirStub.calledOnce).to.be.true;
    expect(gitRmStub.called).to.be.false;
    expect(fsMoveStub.called).to.be.false;
    expect(gitAddStub.called).to.be.false;
    expect(updateComponentPathStub.called).to.be.false;
  });

  it("should return true if path.basename(oldDir) === newName", async ()=>{
    isValidNameStub.returns(true);
    getComponentDirStub.resolves("/mock/project/SomeName");
    const result = await projectFilesOperator._internal.renameComponentDir(mockProjectRootDir, mockID, "SomeName");

    expect(result).to.be.true;
    expect(isValidNameStub.calledOnce).to.be.true;
    expect(getComponentDirStub.calledOnce).to.be.true;
    expect(gitRmStub.called).to.be.false;
    expect(fsMoveStub.called).to.be.false;
    expect(gitAddStub.called).to.be.false;
    expect(updateComponentPathStub.called).to.be.false;
  });

  it("should move directory, call gitRm, fs.move, gitAdd and updateComponentPath if everything is fine", async ()=>{
    isValidNameStub.returns(true);
    getComponentDirStub.resolves("/mock/project/OldCompName");

    const result = await projectFilesOperator._internal.renameComponentDir(mockProjectRootDir, mockID, "NewCompName");

    expect(result).to.equal("updated-path-map");

    expect(isValidNameStub.calledOnce).to.be.true;
    expect(getComponentDirStub.calledOnce).to.be.true;
    expect(gitRmStub.calledOnceWithExactly(mockProjectRootDir, "/mock/project/OldCompName")).to.be.true;
    expect(fsMoveStub.calledOnce).to.be.true;
    const fsMoveArgs = fsMoveStub.args[0];
    expect(fsMoveArgs[0]).to.equal("/mock/project/OldCompName");
    expect(fsMoveArgs[1]).to.equal(path.resolve("/mock/project", "NewCompName"));

    expect(gitAddStub.calledOnce).to.be.true;
    expect(updateComponentPathStub.calledOnce).to.be.true;
    const updateArgs = updateComponentPathStub.args[0];
    expect(updateArgs[0]).to.equal(mockProjectRootDir);
    expect(updateArgs[1]).to.equal(mockID);
    expect(updateArgs[2]).to.equal(path.resolve("/mock/project", "NewCompName"));
  });
});
