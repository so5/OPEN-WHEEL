/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it } = require("mocha");
const { isJobFailed } = require("../../../../app/core/jobManager.js");

describe("#isJobFailed", ()=>{
  it("should return true if acceptableJobStatus is undefined and code is '0'", ()=>{
    //JS.acceptableJobStatus が未定義の場合
    const JS = {}; //acceptableJobStatus未定義
    const code = "0";
    const result = isJobFailed(JS, code);
    //statusList は ["0",0] となり、 code="0" は含まれる => true
    expect(result).to.be.true;
  });

  it("should return false if acceptableJobStatus is undefined and code is not '0'", ()=>{
    const JS = {};
    const code = "1";
    const result = isJobFailed(JS, code);
    //statusList は ["0",0] となり、 code="1" は含まれない => false
    expect(result).to.be.false;
  });

  it("should return true if acceptableJobStatus is an array and code is included in the array", ()=>{
    const JS = {
      acceptableJobStatus: ["1", "99", "abc"]
    };
    const code = "99";
    const result = isJobFailed(JS, code);
    expect(result).to.be.true; //code "99" が含まれる
  });

  it("should return false if acceptableJobStatus is an array and code is not included in the array", ()=>{
    const JS = {
      acceptableJobStatus: ["1", "99", "abc"]
    };
    const code = "xyz";
    const result = isJobFailed(JS, code);
    expect(result).to.be.false;
  });

  it("should return true if acceptableJobStatus is an object that has toString() and code matches that string", ()=>{
    //数値や文字列リテラルなど、prototype の toString() でも分岐を拾う可能性がありますが、
    //ここではカスタムなオブジェクトを使う例を示します。
    const JS = {
      acceptableJobStatus: {
        toString: ()=>"ABC"
      }
    };
    const code = "ABC";
    const result = isJobFailed(JS, code);
    expect(result).to.be.true;
  });

  it("should return false if acceptableJobStatus is an object that has toString() but code does not match", ()=>{
    const JS = {
      acceptableJobStatus: {
        toString: ()=>"ABC"
      }
    };
    const code = "DEF";
    const result = isJobFailed(JS, code);
    expect(result).to.be.false;
  });

  it("should return false if acceptableJobStatus has no valid toString() function", ()=>{
    //Object.create(null) で通常の Object.prototype を継承しないオブジェクトを作る
    //=> これで typeof obj.toString === "undefined" になる
    const objNoToString = Object.create(null);
    //念のため toString が無いことを確認
    expect(typeof objNoToString.toString).to.equal("undefined");

    const JS = {
      acceptableJobStatus: objNoToString
    };
    const code = "anything";
    const result = isJobFailed(JS, code);
    expect(result).to.be.false;
  });
});