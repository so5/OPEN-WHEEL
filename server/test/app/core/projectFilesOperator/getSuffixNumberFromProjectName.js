/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it } from "mocha";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#getSuffixNumberFromProjectName", ()=>{
  const { getSuffixNumberFromProjectName } = projectFilesOperator._internal;

  it("should return the suffix number if the project name ends with numbers", ()=>{
    const projectName = "Project123";
    const result = getSuffixNumberFromProjectName(projectName);
    expect(result).to.equal("123");
  });

  it("should return 0 if the project name does not end with numbers", ()=>{
    const projectName = "Project";
    const result = getSuffixNumberFromProjectName(projectName);
    expect(result).to.equal(0);
  });

  it("should return 0 when the project name contains numbers but does not end with them", ()=>{
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

  it("should return 0 if the project name ends with spaces", ()=>{
    const projectName = "Project123   ";
    const result = getSuffixNumberFromProjectName(projectName);
    expect(result).to.equal(0);
  });

  it("should handle names with leading spaces correctly", ()=>{
    const projectName = "   Project123";
    const result = getSuffixNumberFromProjectName(projectName);
    expect(result).to.equal("123");
  });
});
