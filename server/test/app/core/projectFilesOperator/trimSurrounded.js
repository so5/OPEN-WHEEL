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


describe.skip("#trimSurrounded", ()=>{
  let trimSurrounded;

  beforeEach(()=>{
    trimSurrounded = projectFilesOperator._internal.trimSurrounded;
  });

  it("should return the string without curly braces if it is surrounded by them", ()=>{
    const input = "{example}";
    const result = trimSurrounded(input);
    expect(result).to.equal("example");
  });

  it("should return the original string if it is not surrounded by curly braces", ()=>{
    const input = "example";
    const result = trimSurrounded(input);
    expect(result).to.equal("example");
  });

  it("should return the original string if only one side has a curly brace", ()=>{
    const inputLeft = "{example";
    const inputRight = "example}";
    expect(trimSurrounded(inputLeft)).to.equal(inputLeft);
    expect(trimSurrounded(inputRight)).to.equal(inputRight);
  });

  it("should return the inner content if multiple curly braces surround the string", ()=>{
    const input = "{{{example}}}";
    const result = trimSurrounded(input);
    expect(result).to.equal("example}}");
  });

  it("should return the original string if it contains no curly braces", ()=>{
    const input = "noBracesHere";
    const result = trimSurrounded(input);
    expect(result).to.equal("noBracesHere");
  });

  it("should handle an empty string as input", ()=>{
    const input = "";
    const result = trimSurrounded(input);
    expect(result).to.equal("");
  });

  it("should handle strings with spaces correctly", ()=>{
    const input = "{  spaced example  }";
    const result = trimSurrounded(input);
    expect(result).to.equal("  spaced example  ");
  });
});
