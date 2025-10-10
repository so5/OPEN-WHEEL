/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it } from "mocha";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#glob2Array", ()=>{
  const { glob2Array } = projectFilesOperator._internal;

  it("should convert a comma-separated string into an array", ()=>{
    const input = "file1,file2,file3";
    const expectedOutput = ["file1", "file2", "file3"];
    expect(glob2Array(input)).to.deep.equal(expectedOutput);
  });

  it("should handle strings surrounded by curly braces", ()=>{
    const input = "{file1,file2,file3}";
    const expectedOutput = ["file1", "file2", "file3"];
    expect(glob2Array(input)).to.deep.equal(expectedOutput);
  });

  it("should return an array with an empty string for an empty input string", ()=>{
    const input = "";
    const expectedOutput = [""];
    expect(glob2Array(input)).to.deep.equal(expectedOutput);
  });

  it("should handle spaces in the comma-separated list", ()=>{
    const input = " file1 , file2 , file3 ";
    const expectedOutput = [" file1 ", " file2 ", " file3 "];
    expect(glob2Array(input)).to.deep.equal(expectedOutput);
  });

  it("should return an array with the original token if it is not comma-separated", ()=>{
    const input = "file1";
    const expectedOutput = ["file1"];
    expect(glob2Array(input)).to.deep.equal(expectedOutput);
  });

  it("should handle nested curly braces gracefully", ()=>{
    const input = "{{file1,file2},file3}";
    const expectedOutput = ["file1", "file2}", "file3"];
    expect(glob2Array(input)).to.deep.equal(expectedOutput);
  });
});
