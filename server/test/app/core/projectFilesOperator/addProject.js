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


describe.skip("#addProject", ()=>{
  let addProject;
  let createNewProjectMock;
  let fsMock;

  beforeEach(()=>{
    addProject = projectFilesOperator._internal.addProject;
    createNewProjectMock = sinon.stub();

    fsMock = {
      pathExists: sinon.stub()
    };

    projectFilesOperator._internal.createNewProject = createNewProjectMock;
    projectFilesOperator._internal.fs = fsMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should throw an error if the project directory already exists", async ()=>{
    const mockProjectDir = "/existing/project/dir";

    fsMock.pathExists.resolves(true);

    try {
      await addProject(mockProjectDir, "Test description");
      throw new Error("Expected addProject to throw an error");
    } catch (err) {
      expect(err.message).to.equal("specified project dir is already exists");
      expect(err.projectRootDir).to.equal(`${mockProjectDir}.wheel`);
    }

    expect(fsMock.pathExists.calledOnceWithExactly(`${mockProjectDir}.wheel`)).to.be.true;
  });

  it("should throw an error if the project name is invalid", async ()=>{
    const mockProjectDir = "/valid/dir";
    const invalidProjectName = "Invalid/Name";

    fsMock.pathExists.resolves(false);
    sinon.stub(path, "basename").returns(invalidProjectName);

    try {
      await addProject(mockProjectDir, "Test description");
      throw new Error("Expected addProject to throw an error");
    } catch (err) {
      expect(err.message).to.equal("illegal project name");
    }
  });

  it("should create a new project and add it to the project list", async ()=>{
    const mockProjectDir = "/new/project/dir";
    const validProjectName = "validName";
    const mockCreatedProjectDir = `${mockProjectDir}.wheel`;

    fsMock.pathExists.resolves(false);
    sinon.stub(path, "basename").returns(validProjectName);
    createNewProjectMock.resolves(mockCreatedProjectDir);

    const projectListUnshiftStub = sinon.stub();
    projectFilesOperator._internal.projectList = { unshift: projectListUnshiftStub };

    await addProject(mockProjectDir, "Test description");

    expect(createNewProjectMock.calledOnceWithExactly(
      `${mockProjectDir}.wheel`,
      validProjectName,
      "Test description",
      "wheel",
      "wheel@example.com"
    )).to.be.true;
    expect(projectListUnshiftStub.calledOnceWithExactly({ path: mockCreatedProjectDir })).to.be.true;
  });
});
