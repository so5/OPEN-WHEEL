/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { describe, it } = require("mocha");
const { expect } = require("chai");
const { getSNDs } = require("../../../../app/core/fileBrowser");
const testDirRoot = "WHEEL_TEST_TMP";
describe("#getSNDs", ()=>{
  const input = [
    "foo",
    "bar",
    "baz",
    "foo_0",
    "foo_1",
    "foo_2",
    "foo_1_10",
    "foo_1_15",
    "foo_1_100",
    "bar_1_10",
    "foo_2_10",
    "foo_2_15",
    "foo_2_100",
    "0_baz",
    "1_baz",
    "2_baz"
  ].map((e)=>{
    return {
      path: testDirRoot,
      name: e,
      type: "file",
      islink: false,
      isComponentDir: false
    };
  });
  it("should return glob patterns", ()=>{
    const expected = [
      {
        path: testDirRoot,
        name: "foo_1_*",
        type: "snd",
        islink: false,
        pattern: "foo_1_\\d+"
      },
      {
        path: testDirRoot,
        name: "foo_*",
        type: "snd",
        islink: false,
        pattern: "foo_\\d+"
      },
      {
        path: testDirRoot,
        name: "foo_*_10",
        type: "snd",
        islink: false,
        pattern: "foo_\\d+_10"
      },
      {
        path: testDirRoot,
        name: "foo_*_15",
        type: "snd",
        islink: false,
        pattern: "foo_\\d+_15"
      },
      {
        path: testDirRoot,
        name: "foo_2_*",
        type: "snd",
        islink: false,
        pattern: "foo_2_\\d+"
      },
      {
        path: testDirRoot,
        name: "foo_*_100",
        type: "snd",
        islink: false,
        pattern: "foo_\\d+_100"
      },
      {
        path: testDirRoot,
        name: "*_baz",
        type: "snd",
        islink: false,
        pattern: "\\d+_baz"
      }
    ];
    expect(getSNDs(input)).to.have.deep.not.ordered.members(expected);
  });
});