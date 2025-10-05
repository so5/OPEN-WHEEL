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

describe("#getChildren", ()=>{
  let getComponentDirStub;
  let readJsonGreedyStub;
  let globStub;
  let promisifyStub;

  beforeEach(()=>{
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
    readJsonGreedyStub = sinon.stub(projectFilesOperator._internal, "readJsonGreedy");
    globStub = sinon.stub();
    promisifyStub = sinon.stub(projectFilesOperator._internal, "promisify").returns(globStub);
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return an empty array if the directory is not found", async ()=>{
    getComponentDirStub.resolves(null);

    const result = await projectFilesOperator._internal.getChildren("/mock/project", "invalidID", false);

    expect(result).to.deep.equal([]);
    expect(getComponentDirStub.calledOnce).to.be.true;
    expect(globStub.notCalled).to.be.true;
  });

  it("should return an empty array if no child components are found", async ()=>{
    getComponentDirStub.resolves("/mock/project/component");
    globStub.resolves([]);

    const result = await projectFilesOperator._internal.getChildren("/mock/project", "validID", false);

    expect(result).to.deep.equal([]);
    expect(globStub.calledOnce).to.be.true;
  });

  it("should return an array of child components excluding subComponents", async ()=>{
    const child1Path = "/mock/project/component/child1/cmp.wheel.json";
    const child2Path = "/mock/project/component/child2/cmp.wheel.json";
    getComponentDirStub.resolves("/mock/project/component");
    globStub.resolves([child1Path, child2Path]);

    const child1Json = { ID: "child1", subComponent: false };
    const child2Json = { ID: "child2", subComponent: true };
    readJsonGreedyStub.withArgs(child1Path).resolves(child1Json);
    readJsonGreedyStub.withArgs(child2Path).resolves(child2Json);

    const result = await projectFilesOperator._internal.getChildren("/mock/project", "validID", false);

    expect(result).to.deep.equal([child1Json]);
    expect(readJsonGreedyStub.calledTwice).to.be.true;
  });

  it("should handle the case where parentID is a directory path", async ()=>{
    const childPath = "/mock/project/parent/child/cmp.wheel.json";
    globStub.resolves([childPath]);
    const childJson = { ID: "child", subComponent: false };
    readJsonGreedyStub.resolves(childJson);

    const result = await projectFilesOperator._internal.getChildren("/mock/project", "/mock/project/parent", true);

    expect(result).to.deep.equal([childJson]);
    expect(getComponentDirStub.notCalled).to.be.true;
  });
});