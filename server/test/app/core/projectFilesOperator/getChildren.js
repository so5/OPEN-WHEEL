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


describe.skip("#getChildren", ()=>{
  let getChildren;
  let getComponentDirMock;
  let readJsonGreedyMock;
  let globMock;

  beforeEach(()=>{
    getChildren = projectFilesOperator._internal.getChildren;

    getComponentDirMock = sinon.stub();
    readJsonGreedyMock = sinon.stub();
    globMock = sinon.stub();
    projectFilesOperator._internal.getComponentDir = getComponentDirMock;
    projectFilesOperator._internal.readJsonGreedy = readJsonGreedyMock;
    projectFilesOperator._internal.promisify = ()=>globMock;
  });

  it("should return an empty array if the directory is not found", async ()=>{
    getComponentDirMock.resolves(null);

    const result = await getChildren("/mock/project", "invalidID", false);

    expect(result).to.deep.equal([]);
  });

  it("should return an empty array if no child components are found", async ()=>{
    getComponentDirMock.resolves("/mock/project/component");
    globMock.resolves([]);

    const result = await getChildren("/mock/project", "validID", false);

    expect(result).to.deep.equal([]);
  });

  it("should return an array of child components excluding subComponents", async ()=>{
    getComponentDirMock.resolves("/mock/project/component");
    globMock.resolves(["/mock/project/component/child1/cmp.wheel.json", "/mock/project/component/child2/cmp.wheel.json"]);

    readJsonGreedyMock.withArgs("/mock/project/component/child1/cmp.wheel.json").resolves({ ID: "child1", subComponent: false });
    readJsonGreedyMock.withArgs("/mock/project/component/child2/cmp.wheel.json").resolves({ ID: "child2", subComponent: true });

    const result = await getChildren("/mock/project", "validID", false);

    expect(result).to.deep.equal([{ ID: "child1", subComponent: false }]);
  });

  it("should handle the case where parentID is a directory path", async ()=>{
    globMock.resolves(["/mock/project/parent/child/cmp.wheel.json"]);
    readJsonGreedyMock.resolves({ ID: "child", subComponent: false });

    const result = await getChildren("/mock/project", "/mock/project/parent", true);

    expect(result).to.deep.equal([{ ID: "child", subComponent: false }]);
  });
});
