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


describe.skip("#isLocal", ()=>{
  let isLocal;

  beforeEach(()=>{
    isLocal = projectFilesOperator._internal.isLocal;
  });

  it("should return true if host is undefined", ()=>{
    const component = {};
    expect(isLocal(component)).to.be.true;
  });

  it("should return true if host is 'localhost'", ()=>{
    const component = { host: "localhost" };
    expect(isLocal(component)).to.be.true;
  });

  it("should return false if host is null", ()=>{
    const component = { host: null };
    expect(isLocal(component)).to.be.false;
  });

  it("should return false if host is a remote host", ()=>{
    const component = { host: "remotehost" };
    expect(isLocal(component)).to.be.false;
  });

  it("should return true for an empty object", ()=>{
    const component = {};
    expect(isLocal(component)).to.be.true;
  });
});
