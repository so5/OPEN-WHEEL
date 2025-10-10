/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import path from "path";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#getUnusedProjectDir", ()=>{
  let pathExistsStub;
  let getSuffixNumberStub;
  const suffix = ".wheel"; //The actual suffix from db.js

  beforeEach(()=>{
    pathExistsStub = sinon.stub(projectFilesOperator._internal.fs, "pathExists");
    getSuffixNumberStub = sinon.stub(projectFilesOperator._internal, "getSuffixNumberFromProjectName");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return the provided projectRootDir if it does not exist", async ()=>{
    const projectRootDir = "/mock/project/root";
    const projectName = "project";
    pathExistsStub.withArgs(projectRootDir).resolves(false);

    const result = await projectFilesOperator._internal.getUnusedProjectDir(projectRootDir, projectName);

    expect(result).to.equal(projectRootDir);
    expect(pathExistsStub.calledOnceWith(projectRootDir)).to.be.true;
  });

  it("should return suffixed name if projectRootDir exists but suffixed one does not", async ()=>{
    const projectRootDir = "/mock/project/root";
    const projectName = "project";
    const expectedDir = path.resolve(path.dirname(projectRootDir), `${projectName}${suffix}`);

    pathExistsStub.withArgs(projectRootDir).resolves(true);
    pathExistsStub.withArgs(expectedDir).resolves(false);

    const result = await projectFilesOperator._internal.getUnusedProjectDir(projectRootDir, projectName);

    expect(result).to.equal(expectedDir);
    expect(pathExistsStub.callCount).to.equal(2);
  });

  it("should increment suffix number if suffixed directories exist", async ()=>{
    const projectRootDir = "/mock/project/root";
    const projectName = "project";
    const suffixedDir = path.resolve(path.dirname(projectRootDir), `${projectName}${suffix}`);
    const suffixedDirWithNum0 = path.resolve(path.dirname(projectRootDir), `${projectName}0${suffix}`);
    const suffixedDirWithNum1 = path.resolve(path.dirname(projectRootDir), `${projectName}1${suffix}`);

    pathExistsStub.withArgs(projectRootDir).resolves(true);
    pathExistsStub.withArgs(suffixedDir).resolves(true);
    pathExistsStub.withArgs(suffixedDirWithNum0).resolves(true);
    pathExistsStub.withArgs(suffixedDirWithNum1).resolves(false);
    getSuffixNumberStub.withArgs(projectName).returns(0);

    const result = await projectFilesOperator._internal.getUnusedProjectDir(projectRootDir, projectName);

    expect(result).to.equal(suffixedDirWithNum1);
    expect(pathExistsStub.callCount).to.equal(4);
  });

  it("should use and increment the suffix number from the project name", async ()=>{
    const projectRootDir = "/mock/project/root";
    const projectName = "project2";
    const suffixedDir = path.resolve(path.dirname(projectRootDir), `${projectName}${suffix}`);
    const suffixedDirWithNum2 = path.resolve(path.dirname(projectRootDir), `${projectName}2${suffix}`);
    const suffixedDirWithNum3 = path.resolve(path.dirname(projectRootDir), `${projectName}3${suffix}`);

    pathExistsStub.withArgs(projectRootDir).resolves(true);
    pathExistsStub.withArgs(suffixedDir).resolves(true);
    pathExistsStub.withArgs(suffixedDirWithNum2).resolves(true);
    pathExistsStub.withArgs(suffixedDirWithNum3).resolves(false);
    getSuffixNumberStub.withArgs(projectName).returns(2);

    const result = await projectFilesOperator._internal.getUnusedProjectDir(projectRootDir, projectName);

    expect(result).to.equal(suffixedDirWithNum3);
    expect(pathExistsStub.callCount).to.equal(4);
  });
});
