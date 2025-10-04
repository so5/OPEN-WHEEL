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


describe.skip("#isParent", ()=>{
  let isParent;
  let readComponentJsonByIDMock;

  beforeEach(()=>{
    isParent = projectFilesOperator._internal.isParent;

    readComponentJsonByIDMock = sinon.stub();
    projectFilesOperator._internal.readComponentJsonByID = readComponentJsonByIDMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return true if parentID is 'parent'", async ()=>{
    const result = await isParent("/mock/project", "parent", "childID");
    expect(result).to.be.true;
  });

  it("should return false if childID is 'parent'", async ()=>{
    const result = await isParent("/mock/project", "parentID", "parent");
    expect(result).to.be.false;
  });

  it("should return false if childJson is null", async ()=>{
    readComponentJsonByIDMock.resolves(null);

    const result = await isParent("/mock/project", "parentID", "childID");
    expect(result).to.be.false;
    expect(readComponentJsonByIDMock.calledOnceWithExactly("/mock/project", "childID")).to.be.true;
  });

  it("should return false if childID is not a string", async ()=>{
    readComponentJsonByIDMock.resolves({ parent: "parentID" });

    const result = await isParent("/mock/project", "parentID", 123);
    expect(result).to.be.false;
  });

  it("should return true if childJson.parent matches parentID", async ()=>{
    readComponentJsonByIDMock.resolves({ parent: "parentID" });

    const result = await isParent("/mock/project", "parentID", "childID");
    expect(result).to.be.true;
    expect(readComponentJsonByIDMock.calledOnceWithExactly("/mock/project", "childID")).to.be.true;
  });

  it("should return false if childJson.parent does not match parentID", async ()=>{
    readComponentJsonByIDMock.resolves({ parent: "otherParentID" });

    const result = await isParent("/mock/project", "parentID", "childID");
    expect(result).to.be.false;
    expect(readComponentJsonByIDMock.calledOnceWithExactly("/mock/project", "childID")).to.be.true;
  });
});
