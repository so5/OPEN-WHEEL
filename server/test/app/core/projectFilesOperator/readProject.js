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

describe("#readProject", function() {
  let getProjectJsonStub;
  let rewriteAllIncludeExcludePropertyStub;
  let writeProjectJsonStub;
  let gitInitStub;
  let setProjectStateStub;
  let setComponentStateRStub;
  let gitAddStub;
  let gitCommitStub;
  let projectListQueryStub;
  let projectListUnshiftStub;
  let pathExistsStub;
  let outputFileStub;
  let pathBasenameStub;
  let originalPath;

  const projectRootDir = "/mock/project/root.wheel";

  beforeEach(()=>{
    getProjectJsonStub = sinon.stub(projectFilesOperator._internal, "getProjectJson");
    rewriteAllIncludeExcludePropertyStub = sinon.stub(projectFilesOperator._internal, "rewriteAllIncludeExcludeProperty").resolves();
    writeProjectJsonStub = sinon.stub(projectFilesOperator._internal, "writeProjectJson").resolves();
    gitInitStub = sinon.stub(projectFilesOperator._internal, "gitInit").resolves();
    setProjectStateStub = sinon.stub(projectFilesOperator._internal, "setProjectState").resolves();
    setComponentStateRStub = sinon.stub(projectFilesOperator._internal, "setComponentStateR").resolves();
    gitAddStub = sinon.stub(projectFilesOperator._internal, "gitAdd").resolves();
    gitCommitStub = sinon.stub(projectFilesOperator._internal, "gitCommit").resolves();
    projectListQueryStub = sinon.stub(projectFilesOperator._internal.projectList, "query");
    projectListUnshiftStub = sinon.stub(projectFilesOperator._internal.projectList, "unshift");
    pathExistsStub = sinon.stub(projectFilesOperator._internal.fs, "pathExists");
    outputFileStub = sinon.stub(projectFilesOperator._internal.fs, "outputFile").resolves();

    originalPath = { ...projectFilesOperator._internal.path };
    pathBasenameStub = sinon.stub(projectFilesOperator._internal.path, "basename");
  });

  afterEach(()=>{
    sinon.restore();
    projectFilesOperator._internal.path = originalPath;
  });

  it("should skip processing if project is already in the project list", async ()=>{
    getProjectJsonStub.resolves({ version: 2.1 });
    projectListQueryStub.withArgs("path", projectRootDir).returns({ path: projectRootDir });

    const result = await projectFilesOperator._internal.readProject(projectRootDir);

    expect(result).to.equal(projectRootDir);
    expect(getProjectJsonStub.calledOnce).to.be.true;
    expect(projectListQueryStub.calledOnce).to.be.true;
    expect(rewriteAllIncludeExcludePropertyStub.notCalled).to.be.true;
  });

  it("should upgrade project version if it is <= 2", async ()=>{
    getProjectJsonStub.resolves({ version: 2, name: "root" });
    projectListQueryStub.returns(null);
    pathExistsStub.withArgs(`${projectRootDir}/.git`).resolves(true);
    pathExistsStub.withArgs(`${projectRootDir}/.gitignore`).resolves(true);
    pathBasenameStub.withArgs(projectRootDir).returns("root.wheel");

    await projectFilesOperator._internal.readProject(projectRootDir);

    expect(rewriteAllIncludeExcludePropertyStub.calledOnce).to.be.true;
    expect(writeProjectJsonStub.calledWith(projectRootDir, sinon.match({ version: 2.1 }))).to.be.true;
    expect(gitCommitStub.called).to.be.true;
  });

  it("should fix project name if it does not match the directory name", async ()=>{
    getProjectJsonStub.resolves({ version: 2.1, name: "wrongName" });
    projectListQueryStub.returns(null);
    pathExistsStub.withArgs(`${projectRootDir}/.git`).resolves(true);
    pathExistsStub.withArgs(`${projectRootDir}/.gitignore`).resolves(true);
    pathBasenameStub.withArgs(projectRootDir).returns("root.wheel");

    await projectFilesOperator._internal.readProject(projectRootDir);

    expect(writeProjectJsonStub.calledWith(projectRootDir, sinon.match({ name: "root" }))).to.be.true;
    expect(gitAddStub.calledWith(projectRootDir, "prj.wheel.json")).to.be.true;
    expect(gitCommitStub.called).to.be.true;
  });

  it("should initialize git repository if it does not exist", async ()=>{
    getProjectJsonStub.resolves({ version: 2.1, name: "root" });
    projectListQueryStub.returns(null);
    pathExistsStub.withArgs(`${projectRootDir}/.git`).resolves(false);
    pathBasenameStub.withArgs(projectRootDir).returns("root.wheel");

    await projectFilesOperator._internal.readProject(projectRootDir);

    expect(gitInitStub.calledOnceWith(projectRootDir, "wheel", "wheel@example.com")).to.be.true;
    expect(setProjectStateStub.calledOnceWith(projectRootDir, "not-started")).to.be.true;
    expect(setComponentStateRStub.calledOnceWith(projectRootDir, projectRootDir, "not-started")).to.be.true;
    expect(gitAddStub.calledOnceWith(projectRootDir, "./")).to.be.true;
    expect(gitCommitStub.calledOnceWith(projectRootDir, "import project")).to.be.true;
  });

  it("should create .gitignore if it does not exist in a git repo", async ()=>{
    getProjectJsonStub.resolves({ version: 2.1, name: "root" });
    projectListQueryStub.returns(null);
    pathExistsStub.withArgs(`${projectRootDir}/.git`).resolves(true);
    pathExistsStub.withArgs(`${projectRootDir}/.gitignore`).resolves(false);
    pathBasenameStub.withArgs(projectRootDir).returns("root.wheel");

    await projectFilesOperator._internal.readProject(projectRootDir);

    expect(outputFileStub.calledOnceWith(`${projectRootDir}/.gitignore`, "wheel.log")).to.be.true;
    expect(gitAddStub.calledWith(projectRootDir, ".gitignore")).to.be.true;
    expect(gitCommitStub.called).to.be.true;
  });

  it("should return null if git initialization fails", async ()=>{
    getProjectJsonStub.resolves({ version: 2.1, name: "root" });
    projectListQueryStub.returns(null);
    pathExistsStub.withArgs(`${projectRootDir}/.git`).resolves(false);
    gitInitStub.rejects(new Error("git init failed"));
    pathBasenameStub.withArgs(projectRootDir).returns("root.wheel");

    const result = await projectFilesOperator._internal.readProject(projectRootDir);

    expect(result).to.be.null;
  });
});