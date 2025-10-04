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


describe.skip("#makeDir", ()=>{
  let makeDir;
  let fsMock;

  beforeEach(()=>{
    makeDir = projectFilesOperator._internal.makeDir;

    fsMock = {
      pathExists: sinon.stub(),
      mkdir: sinon.stub().resolves()
    };

    projectFilesOperator._internal.fs = fsMock;
  });

  it("should create a new directory when the name is available", async ()=>{
    fsMock.pathExists.resolves(false);

    const result = await makeDir("/mock/path", 0);

    expect(fsMock.pathExists.calledOnceWithExactly("/mock/path0")).to.be.true;
    expect(fsMock.mkdir.calledOnceWithExactly("/mock/path0")).to.be.true;
    expect(result).to.equal("/mock/path0");
  });

  it("should increment suffix until an available name is found", async ()=>{
    fsMock.pathExists.onFirstCall().resolves(true);
    fsMock.pathExists.onSecondCall().resolves(true);
    fsMock.pathExists.onThirdCall().resolves(false);

    const result = await makeDir("/mock/path", 0);

    expect(fsMock.pathExists.callCount).to.equal(3);
    expect(fsMock.mkdir.calledOnceWithExactly("/mock/path2")).to.be.true;
    expect(result).to.equal("/mock/path2");
  });

  it("should handle an empty basename gracefully", async ()=>{
    fsMock.pathExists.resolves(false);

    const result = await makeDir("", 0);

    expect(fsMock.mkdir.calledOnceWithExactly("0")).to.be.true;
    expect(result).to.equal("0");
  });

  it("should throw an error if mkdir fails", async ()=>{
    fsMock.pathExists.resolves(false);
    fsMock.mkdir.rejects(new Error("Permission denied"));

    try {
      await makeDir("/mock/path", 0);
      throw new Error("Expected makeDir to throw an error");
    } catch (err) {
      expect(err.message).to.equal("Permission denied");
    }

    expect(fsMock.mkdir.calledOnceWithExactly("/mock/path0")).to.be.true;
  });
});
