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


describe.skip("#getUnusedProjectDir", ()=>{
  let getUnusedProjectDir;
  let fsMock;
  beforeEach(()=>{
    getUnusedProjectDir = projectFilesOperator._internal.getUnusedProjectDir;

    fsMock = {
      pathExists: sinon.stub()
    };
    projectFilesOperator._internal.fs = fsMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return the provided projectRootDir if it does not exist", async ()=>{
    const projectRootDir = "/mock/project/root";
    const projectName = "project";

    fsMock.pathExists.resolves(false);

    const result = await getUnusedProjectDir(projectRootDir, projectName);

    expect(result).to.equal(projectRootDir);
    expect(fsMock.pathExists.calledOnceWithExactly(projectRootDir)).to.be.true;
  });

  it("should return a new directory name with suffix if projectRootDir exists", async ()=>{
    const projectRootDir = "/mock/project/root";
    const projectName = "project";
    const suffix = ".wheel";

    fsMock.pathExists.onFirstCall().resolves(true);
    fsMock.pathExists.onSecondCall().resolves(false);

    rewireProjectFilesOperator.__set__("suffix", suffix);

    const result = await getUnusedProjectDir(projectRootDir, projectName);

    expect(result).to.equal("/mock/project/project.wheel");
    expect(fsMock.pathExists.calledTwice).to.be.true;
  });

  it("should increment the suffix number until an unused directory name is found", async ()=>{
    const projectRootDir = "/mock/project/root";
    const projectName = "project";
    const suffix = ".wheel";

    fsMock.pathExists.onCall(0).resolves(true);
    fsMock.pathExists.onCall(1).resolves(true);
    fsMock.pathExists.onCall(2).resolves(true);
    fsMock.pathExists.onCall(3).resolves(false);

    projectFilesOperator._internal.suffix = suffix;

    const result = await getUnusedProjectDir(projectRootDir, projectName);
    console.log(result);

    expect(result).to.equal("/mock/project/project1.wheel");
    expect(fsMock.pathExists.callCount).to.equal(4);
  });

  it("should use the suffix number from the projectName if present", async ()=>{
    const projectRootDir = "/mock/project/root";
    const projectName = "project2";
    const suffix = ".wheel";

    fsMock.pathExists.onCall(0).resolves(true);
    fsMock.pathExists.onCall(1).resolves(false);

    projectFilesOperator._internal.suffix = suffix;

    const result = await getUnusedProjectDir(projectRootDir, projectName);

    expect(result).to.equal("/mock/project/project2.wheel");
    expect(fsMock.pathExists.callCount).to.equal(2);
  });
});
