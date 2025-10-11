/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it } from "mocha";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#isDefaultPort", ()=>{
  const { isDefaultPort } = projectFilesOperator._internal;

  it("should return true for undefined", ()=>{
    expect(isDefaultPort(undefined)).to.be.true;
  });

  it("should return true for numeric 22", ()=>{
    expect(isDefaultPort(22)).to.be.true;
  });

  it("should return true for string '22'", ()=>{
    expect(isDefaultPort("22")).to.be.true;
  });

  it("should return true for an empty string", ()=>{
    expect(isDefaultPort("")).to.be.true;
  });

  it("should return false for other numeric values", ()=>{
    expect(isDefaultPort(23)).to.be.false;
    expect(isDefaultPort(80)).to.be.false;
  });

  it("should return false for other string values", ()=>{
    expect(isDefaultPort("23")).to.be.false;
    expect(isDefaultPort("80")).to.be.false;
  });

  it("should return false for non-numeric strings", ()=>{
    expect(isDefaultPort("random")).to.be.false;
  });

  it("should return false for null input", ()=>{
    expect(isDefaultPort(null)).to.be.false;
  });

  it("should return false for boolean inputs", ()=>{
    expect(isDefaultPort(true)).to.be.false;
    expect(isDefaultPort(false)).to.be.false;
  });
});
