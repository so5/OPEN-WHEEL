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
const projectFilesOperator = require("../../../../app/core/projectFilesOperator.js");


describe.skip("#removeTrailingPathSep", ()=>{
  let removeTrailingPathSep;

  beforeEach(()=>{
    removeTrailingPathSep = projectFilesOperator._internal.removeTrailingPathSep;
  });

  it("should remove trailing path separator for POSIX paths", ()=>{
    const input = "/path/to/directory/";
    const expected = path.sep === "/" ? "/path/to/directory" : input; //実行環境がPOSIXなら削除、Windowsならそのまま
    expect(removeTrailingPathSep(input)).to.equal(expected);
  });

  it("should remove trailing path separator for Windows paths", ()=>{
    const input = "C:\\path\\to\\directory\\";
    const expected = path.sep === "\\" ? "C:\\path\\to\\directory" : input; //Windowsなら削除、POSIXならそのまま
    expect(removeTrailingPathSep(input)).to.equal(expected);
  });

  it("should not alter a path without trailing path separator", ()=>{
    const input = "/path/to/directory";
    const expected = "/path/to/directory";
    expect(removeTrailingPathSep(input)).to.equal(expected);
  });

  it("should handle an empty string gracefully", ()=>{
    const input = "";
    const expected = "";
    expect(removeTrailingPathSep(input)).to.equal(expected);
  });

  it("should handle paths consisting of only a single path separator", ()=>{
    const input = path.sep;
    const expected = "";
    expect(removeTrailingPathSep(input)).to.equal(expected);
  });

  it("should recursively remove multiple trailing path separators", ()=>{
    const input = `/path/to/directory///`.replace(/\//g, path.sep); //セパレータを現在の実行環境に合わせる
    const expected = `/path/to/directory`.replace(/\//g, path.sep); //入力と同様に変換後の期待値
    expect(removeTrailingPathSep(input)).to.equal(expected);
  });
});
