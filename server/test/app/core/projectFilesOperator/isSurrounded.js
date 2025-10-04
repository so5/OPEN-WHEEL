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


describe.skip("#isSurrounded", ()=>{
  let isSurrounded;

  beforeEach(()=>{
    isSurrounded = projectFilesOperator._internal.isSurrounded;
  });

  it("should return true if the string is surrounded by curly braces", ()=>{
    expect(isSurrounded("{example}")).to.be.true;
  });

  it("should return false if the string is not surrounded by curly braces", ()=>{
    expect(isSurrounded("example")).to.be.false;
  });

  it("should return false if the string starts with a brace but does not end with one", ()=>{
    expect(isSurrounded("{example")).to.be.false;
  });

  it("should return false if the string ends with a brace but does not start with one", ()=>{
    expect(isSurrounded("example}")).to.be.false;
  });

  it("should return true for an empty string surrounded by braces", ()=>{
    expect(isSurrounded("{}")).to.be.true;
  });

  it("should handle strings with multiple layers of braces correctly", ()=>{
    expect(isSurrounded("{{example}}")).to.be.true;
    expect(isSurrounded("{example}}")).to.be.true;
    expect(isSurrounded("{{example}")).to.be.true;
  });
});
