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


describe.skip("#getSuffixNumberFromProjectName", ()=>{
  let getSuffixNumberFromProjectName;

  beforeEach(()=>{
    getSuffixNumberFromProjectName = projectFilesOperator._internal.getSuffixNumberFromProjectName;
  });

  it("should return the suffix number if the project name ends with numbers", ()=>{
    const projectName = "Project123";
    const result = getSuffixNumberFromProjectName(projectName);
    expect(result).to.equal("3");
  });

  it("should return 0 if the project name does not end with numbers", ()=>{
    const projectName = "Project";
    const result = getSuffixNumberFromProjectName(projectName);
    expect(result).to.equal(0);
  });

  it("should return the correct suffix when the project name contains numbers but does not end with them", ()=>{
    const projectName = "Project123abc";
    const result = getSuffixNumberFromProjectName(projectName);
    expect(result).to.equal(0);
  });

  it("should return 0 for an empty project name", ()=>{
    const projectName = "";
    const result = getSuffixNumberFromProjectName(projectName);
    expect(result).to.equal(0);
  });

  it("should return 0 if the project name consists only of non-numeric characters", ()=>{
    const projectName = "abcdef";
    const result = getSuffixNumberFromProjectName(projectName);
    expect(result).to.equal(0);
  });

  it("should return 0 if the project name consists only of spaces", ()=>{
    const projectName = "Project123   ";
    const result = getSuffixNumberFromProjectName(projectName);
    expect(result).to.equal(0);
  });

  it("should handle names with leading spaces correctly", ()=>{
    const projectName = "   Project123";
    const result = getSuffixNumberFromProjectName(projectName);
    expect(result).to.equal("3");
  });
});
