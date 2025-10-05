/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const projectFilesOperator = require("../../../../app/core/projectFilesOperator.js");

describe("#addProject", ()=>{
  let pathExistsStub;
  let createNewProjectStub;
  let isValidNameStub;
  let projectListUnshiftStub;
  let removeTrailingPathSepStub;
  let convertPathSepStub;

  beforeEach(()=>{
    pathExistsStub = sinon.stub(projectFilesOperator._internal.fs, "pathExists");
    createNewProjectStub = sinon.stub(projectFilesOperator._internal, "createNewProject");
    isValidNameStub = sinon.stub(projectFilesOperator._internal, "isValidName");
    projectListUnshiftStub = sinon.stub(projectFilesOperator._internal.projectList, "unshift");
    removeTrailingPathSepStub = sinon.stub(projectFilesOperator._internal, "removeTrailingPathSep").callsFake((p)=>p);
    convertPathSepStub = sinon.stub(projectFilesOperator._internal, "convertPathSep").callsFake((p)=>p);
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should throw an error if the project directory already exists", async ()=>{
    const mockProjectDir = "/existing/project/dir";
    const projectRootDir = `${mockProjectDir}.wheel`;
    pathExistsStub.withArgs(projectRootDir).resolves(true);

    try {
      await projectFilesOperator.addProject(mockProjectDir, "Test description");
      throw new Error("Expected addProject to throw an error");
    } catch (err) {
      expect(err.message).to.equal("specified project dir is already exists");
      expect(err.projectRootDir).to.equal(projectRootDir);
    }

    expect(pathExistsStub.calledOnceWith(projectRootDir)).to.be.true;
    expect(createNewProjectStub.notCalled).to.be.true;
  });

  it("should throw an error if the project name is invalid", async ()=>{
    const mockProjectDir = "/new/project/dir";
    const projectName = "dir";
    const projectRootDir = `${mockProjectDir}.wheel`;
    pathExistsStub.withArgs(projectRootDir).resolves(false);
    isValidNameStub.withArgs(projectName).returns(false);

    try {
      await projectFilesOperator.addProject(mockProjectDir, "Test description");
      throw new Error("Expected addProject to throw an error");
    } catch (err) {
      expect(err.message).to.equal("illegal project name");
    }

    expect(isValidNameStub.calledOnceWith(projectName)).to.be.true;
    expect(createNewProjectStub.notCalled).to.be.true;
  });

  it("should create a new project and add it to the project list", async ()=>{
    const mockProjectDir = "/new/project/dir";
    const projectName = "dir";
    const projectRootDir = `${mockProjectDir}.wheel`;
    const mockDescription = "Test description";

    pathExistsStub.withArgs(projectRootDir).resolves(false);
    isValidNameStub.withArgs(projectName).returns(true);
    createNewProjectStub.resolves(projectRootDir);

    await projectFilesOperator.addProject(mockProjectDir, mockDescription);

    expect(createNewProjectStub.calledOnceWith(
      projectRootDir,
      projectName,
      mockDescription,
      "wheel",
      "wheel@example.com"
    )).to.be.true;
    expect(projectListUnshiftStub.calledOnceWith({ path: projectRootDir })).to.be.true;
  });
});