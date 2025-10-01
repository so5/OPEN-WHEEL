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
const projectFilesOperator = require("../../../app/core/projectFilesOperator.js");
const { _internal } = projectFilesOperator;

describe("#isSurrounded", ()=>{
  it("should return true if the string is surrounded by curly braces", ()=>{
    expect(_internal.isSurrounded("{example}")).to.be.true;
  });
  it("should return false if the string is not surrounded by curly braces", ()=>{
    expect(_internal.isSurrounded("example")).to.be.false;
  });
  it("should return false if the string starts with a brace but does not end with one", ()=>{
    expect(_internal.isSurrounded("{example")).to.be.false;
  });
  it("should return false if the string ends with a brace but does not start with one", ()=>{
    expect(_internal.isSurrounded("example}")).to.be.false;
  });
  it("should return true for an empty string surrounded by braces", ()=>{
    expect(_internal.isSurrounded("{}")).to.be.true;
  });
  it("should handle strings with multiple layers of braces correctly", ()=>{
    expect(_internal.isSurrounded("{{example}}")).to.be.true;
    expect(_internal.isSurrounded("{example}}")).to.be.true;
    expect(_internal.isSurrounded("{{example}")).to.be.true;
  });
});
describe("#trimSurrounded", ()=>{
  it("should return the string without curly braces if it is surrounded by them", ()=>{
    const input = "{example}";
    const result = _internal.trimSurrounded(input);
    expect(result).to.equal("example");
  });
  it("should return the original string if it is not surrounded by curly braces", ()=>{
    const input = "example";
    const result = _internal.trimSurrounded(input);
    expect(result).to.equal("example");
  });
  it("should return the original string if only one side has a curly brace", ()=>{
    const inputLeft = "{example";
    const inputRight = "example}";
    expect(_internal.trimSurrounded(inputLeft)).to.equal(inputLeft);
    expect(_internal.trimSurrounded(inputRight)).to.equal(inputRight);
  });
  it("should return the inner content if multiple curly braces surround the string", ()=>{
    const input = "{{{example}}}";
    const result = _internal.trimSurrounded(input);
    expect(result).to.equal("example}}");
  });
  it("should return the original string if it contains no curly braces", ()=>{
    const input = "noBracesHere";
    const result = _internal.trimSurrounded(input);
    expect(result).to.equal("noBracesHere");
  });
  it("should handle an empty string as input", ()=>{
    const input = "";
    const result = _internal.trimSurrounded(input);
    expect(result).to.equal("");
  });
  it("should handle strings with spaces correctly", ()=>{
    const input = "{  spaced example  }";
    const result = _internal.trimSurrounded(input);
    expect(result).to.equal("  spaced example  ");
  });
});
describe("#glob2Array", ()=>{
  it("should convert a comma-separated string into an array", ()=>{
    const input = "file1,file2,file3";
    const expectedOutput = ["file1", "file2", "file3"];
    expect(_internal.glob2Array(input)).to.deep.equal(expectedOutput);
  });
  it("should handle strings surrounded by curly braces", ()=>{
    const input = "{file1,file2,file3}";
    const expectedOutput = ["file1", "file2", "file3"];
    expect(_internal.glob2Array(input)).to.deep.equal(expectedOutput);
  });
  it("should return an empty array for an empty string", ()=>{
    const input = "";
    const expectedOutput = [""];
    expect(_internal.glob2Array(input)).to.deep.equal(expectedOutput);
  });
  it("should handle spaces in the comma-separated list", ()=>{
    const input = " file1 , file2 , file3 ";
    const expectedOutput = [" file1 ", " file2 ", " file3 "];
    expect(_internal.glob2Array(input)).to.deep.equal(expectedOutput);
  });
  it("should return the original token if it is not comma-separated", ()=>{
    const input = "file1";
    const expectedOutput = ["file1"];
    expect(_internal.glob2Array(input)).to.deep.equal(expectedOutput);
  });
  it("should handle nested curly braces gracefully", ()=>{
    const input = "{{file1,file2},file3}";
    const expectedOutput = ["file1", "file2}", "file3"];
    expect(_internal.glob2Array(input)).to.deep.equal(expectedOutput);
  });
});
describe("#removeTrailingPathSep", ()=>{
  it("should remove trailing path separator for POSIX paths", ()=>{
    const originalSep = path.sep;
    path.sep = "/";
    const input = "/path/to/directory/";
    const expected = "/path/to/directory";
    expect(_internal.removeTrailingPathSep(input)).to.equal(expected);
    path.sep = originalSep;
  });
  it("should remove trailing path separator for Windows paths", ()=>{
    const originalSep = path.sep;
    path.sep = "\\";
    const input = "C:\\path\\to\\directory\\";
    const expected = "C:\\path\\to\\directory";
    expect(_internal.removeTrailingPathSep(input)).to.equal(expected);
    path.sep = originalSep;
  });
  it("should not alter a path without trailing path separator", ()=>{
    const input = "/path/to/directory";
    const expected = "/path/to/directory";
    expect(_internal.removeTrailingPathSep(input)).to.equal(expected);
  });
  it("should handle an empty string gracefully", ()=>{
    const input = "";
    const expected = "";
    expect(_internal.removeTrailingPathSep(input)).to.equal(expected);
  });
  it("should handle paths consisting of only a single path separator", ()=>{
    const input = path.sep;
    const expected = "";
    expect(_internal.removeTrailingPathSep(input)).to.equal(expected);
  });
  it("should recursively remove multiple trailing path separators", ()=>{
    const input = `/path/to/directory///`.replace(/\//g, path.sep);
    const expected = `/path/to/directory`.replace(/\//g, path.sep);
    expect(_internal.removeTrailingPathSep(input)).to.equal(expected);
  });
});
describe("#getProjectJson", ()=>{
  beforeEach(()=>{
    sinon.stub(_internal, "readJsonGreedy");
  });
  afterEach(()=>{
    sinon.restore();
  });
  it("should return the project JSON data when readJsonGreedy resolves", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockProjectJson = { name: "test_project", version: 2 };
    _internal.readJsonGreedy.resolves(mockProjectJson);
    const result = await projectFilesOperator.getProjectJson(mockProjectRootDir);
    expect(_internal.readJsonGreedy.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(result).to.deep.equal(mockProjectJson);
  });
  it("should throw an error when readJsonGreedy rejects", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockError = new Error("File not found");
    _internal.readJsonGreedy.rejects(mockError);
    await expect(projectFilesOperator.getProjectJson(mockProjectRootDir)).to.be.rejectedWith(mockError);
    expect(_internal.readJsonGreedy.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
  });
});
describe("#writeProjectJson", ()=>{
  const mockProjectRootDir = "/mock/project/root";
  const mockProjectJson = { name: "test_project", version: 2 };
  const mockFileName = path.resolve(mockProjectRootDir, "prj.wheel.json");
  beforeEach(()=>{
    sinon.stub(_internal, "writeJsonWrapper");
    sinon.stub(_internal, "gitAdd");
  });
  afterEach(()=>{
    sinon.restore();
  });
  it("should write the JSON file and add it to git", async ()=>{
    _internal.writeJsonWrapper.resolves();
    _internal.gitAdd.resolves();
    await projectFilesOperator.writeProjectJson(mockProjectRootDir, mockProjectJson);
    expect(_internal.writeJsonWrapper.calledOnceWithExactly(mockFileName, mockProjectJson)).to.be.true;
    expect(_internal.gitAdd.calledOnceWithExactly(mockProjectRootDir, mockFileName)).to.be.true;
  });
  it("should throw an error if writeJsonWrapper fails", async ()=>{
    const mockError = new Error("Failed to write JSON");
    _internal.writeJsonWrapper.rejects(mockError);
    await expect(projectFilesOperator.writeProjectJson(mockProjectRootDir, mockProjectJson)).to.be.rejectedWith(mockError);
    expect(_internal.writeJsonWrapper.calledOnceWithExactly(mockFileName, mockProjectJson)).to.be.true;
    expect(_internal.gitAdd.notCalled).to.be.true;
  });
  it("should throw an error if gitAdd fails", async ()=>{
    const mockError = new Error("Failed to add file to git");
    _internal.writeJsonWrapper.resolves();
    _internal.gitAdd.rejects(mockError);
    await expect(projectFilesOperator.writeProjectJson(mockProjectRootDir, mockProjectJson)).to.be.rejectedWith(mockError);
    expect(_internal.writeJsonWrapper.calledOnceWithExactly(mockFileName, mockProjectJson)).to.be.true;
    expect(_internal.gitAdd.calledOnceWithExactly(mockProjectRootDir, mockFileName)).to.be.true;
  });
});
describe("#getDescendantsIDs", ()=>{
  beforeEach(()=>{
    sinon.stub(_internal, "readJsonGreedy");
    sinon.stub(_internal, "getComponentDir");
  });
  afterEach(()=>{
    sinon.restore();
  });
  it("should return an array of descendant IDs including the given ID", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockID = "rootID";
    const mockProjectJson = {
      componentPath: {
        rootID: "./root",
        child1: "./root/child1",
        child2: "./root/child2",
        unrelated: "./other"
      }
    };
    const mockPoi = path.resolve(mockProjectRootDir, "root");
    _internal.readJsonGreedy.resolves(mockProjectJson);
    _internal.getComponentDir.resolves(mockPoi);
    const result = await _internal.getDescendantsIDs(mockProjectRootDir, mockID);
    expect(_internal.readJsonGreedy.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(_internal.getComponentDir.calledOnceWithExactly(mockProjectRootDir, mockID, true)).to.be.true;
    expect(result).to.deep.equal(["rootID", "child1", "child2"]);
  });
  it("should return an array with only the given ID if no descendants are found", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockID = "rootID";
    const mockProjectJson = {
      componentPath: {
        rootID: "./root",
        unrelated: "./other"
      }
    };
    const mockPoi = path.resolve(mockProjectRootDir, "root");
    _internal.readJsonGreedy.resolves(mockProjectJson);
    _internal.getComponentDir.resolves(mockPoi);
    const result = await _internal.getDescendantsIDs(mockProjectRootDir, mockID);
    expect(_internal.readJsonGreedy.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(_internal.getComponentDir.calledOnceWithExactly(mockProjectRootDir, mockID, true)).to.be.true;
    expect(result).to.deep.equal(["rootID"]);
  });
  it("should throw an error if readJsonGreedy rejects", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockID = "rootID";
    const mockError = new Error("Failed to read JSON");
    _internal.readJsonGreedy.rejects(mockError);
    await expect(_internal.getDescendantsIDs(mockProjectRootDir, mockID)).to.be.rejectedWith(mockError);
    expect(_internal.readJsonGreedy.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(_internal.getComponentDir.notCalled).to.be.true;
  });
  it("should throw an error if getComponentDir rejects", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockID = "rootID";
    const mockProjectJson = {
      componentPath: {
        rootID: "./root",
        unrelated: "./other"
      }
    };
    const mockError = new Error("Failed to get component directory");
    _internal.readJsonGreedy.resolves(mockProjectJson);
    _internal.getComponentDir.rejects(mockError);
    await expect(_internal.getDescendantsIDs(mockProjectRootDir, mockID)).to.be.rejectedWith(mockError);
    expect(_internal.readJsonGreedy.calledOnceWithExactly(path.resolve(mockProjectRootDir, "prj.wheel.json"))).to.be.true;
    expect(_internal.getComponentDir.calledOnceWithExactly(mockProjectRootDir, mockID, true)).to.be.true;
  });
});
describe("#getAllComponentIDs", ()=>{
  const mockProjectRootDir = "/mock/project/root";
  const mockProjectJson = {
    componentPath: {
      component1: "./path/to/component1",
      component2: "./path/to/component2",
      component3: "./path/to/component3"
    }
  };
  const mockFileName = path.resolve(mockProjectRootDir, "prj.wheel.json");
  beforeEach(()=>{
    sinon.stub(_internal, "readJsonGreedy");
  });
  afterEach(()=>{
    sinon.restore();
  });
  it("should return all component IDs from the project JSON", async ()=>{
    _internal.readJsonGreedy.resolves(mockProjectJson);
    const result = await _internal.getAllComponentIDs(mockProjectRootDir);
    expect(_internal.readJsonGreedy.calledOnceWithExactly(mockFileName)).to.be.true;
    expect(result).to.deep.equal(Object.keys(mockProjectJson.componentPath));
  });
  it("should throw an error if readJsonGreedy fails", async ()=>{
    const mockError = new Error("Failed to read JSON");
    _internal.readJsonGreedy.rejects(mockError);
    await expect(_internal.getAllComponentIDs(mockProjectRootDir)).to.be.rejectedWith(mockError);
    expect(_internal.readJsonGreedy.calledOnceWithExactly(mockFileName)).to.be.true;
  });
  it("should return an empty array if componentPath is not present in the JSON", async ()=>{
    _internal.readJsonGreedy.resolves({ componentPath: {} });
    const result = await _internal.getAllComponentIDs(mockProjectRootDir);
    expect(_internal.readJsonGreedy.calledOnceWithExactly(mockFileName)).to.be.true;
    expect(result).to.deep.equal([]);
  });
});
//more tests are needed
if (process.env.NODE_ENV === "test") {
  module.exports._internal = _internal;
}