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


describe.skip("#readProject", ()=>{
  let readProject;
  let getProjectJsonMock, rewriteAllIncludeExcludePropertyMock, writeProjectJsonMock;
  let setProjectStateMock, setComponentStateRMock;
  let gitInitMock, gitAddMock, gitCommitMock, projectListMock;
  let fsPathExistsMock, fsOutputFileMock;

  beforeEach(()=>{
    readProject = projectFilesOperator._internal.readProject;

    getProjectJsonMock = sinon.stub();
    rewriteAllIncludeExcludePropertyMock = sinon.stub();
    writeProjectJsonMock = sinon.stub();
    setProjectStateMock = sinon.stub();
    setComponentStateRMock = sinon.stub();
    gitInitMock = sinon.stub();
    gitAddMock = sinon.stub();
    gitCommitMock = sinon.stub();
    projectListMock = { query: sinon.stub(), unshift: sinon.stub() };
    fsPathExistsMock = sinon.stub();
    fsOutputFileMock = sinon.stub();

    projectFilesOperator._internal.getProjectJson = getProjectJsonMock;
    projectFilesOperator._internal.rewriteAllIncludeExcludeProperty = rewriteAllIncludeExcludePropertyMock;
    projectFilesOperator._internal.writeProjectJson = writeProjectJsonMock;
    projectFilesOperator._internal.gitInit = gitInitMock;
    projectFilesOperator._internal.setProjectState = setProjectStateMock;
    projectFilesOperator._internal.setComponentStateR = setComponentStateRMock;
    projectFilesOperator._internal.gitAdd = gitAddMock;
    projectFilesOperator._internal.gitCommit = gitCommitMock;
    projectFilesOperator._internal.projectList = projectListMock;
    projectFilesOperator._internal.fs = { pathExists: fsPathExistsMock, outputFile: fsOutputFileMock };
    projectFilesOperator._internal.path = {
      ...path,
      resolve: sinon.stub().callsFake((...args)=>args.join("/")),
      join: sinon.stub().callsFake((...args)=>args.join("/"))
    };
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should handle project version <= 2 and update version", async function () {
    getProjectJsonMock.resolves({ version: 1.9, name: "test_project" });
    rewriteAllIncludeExcludePropertyMock.resolves();
    fsPathExistsMock.resolves(false);
    gitInitMock.resolves();
    setProjectStateMock.resolves();
    setComponentStateRMock.resolves();
    gitCommitMock.resolves();
    projectListMock.query.returns(false);
    projectListMock.unshift.returns(true);

    const result = await readProject("/mock/project/root");

    expect(rewriteAllIncludeExcludePropertyMock.calledOnce).to.be.true;
    expect(writeProjectJsonMock.calledWith("/mock/project/root", sinon.match({ version: 2.1 }))).to.be.true;
    expect(gitInitMock.calledWith("/mock/project/root", "wheel", "wheel@example.com")).to.be.true;
    expect(setProjectStateMock.calledWith("/mock/project/root", "not-started")).to.be.true;
    expect(setComponentStateRMock.calledWith("/mock/project/root", "/mock/project/root", "not-started")).to.be.true;
    expect(gitAddMock.calledWith("/mock/project/root", "./")).to.be.true;
    expect(gitCommitMock.calledWith("/mock/project/root", "import project")).to.be.true;
    expect(projectListMock.unshift.calledWith({ path: "/mock/project/root" })).to.be.true;
    expect(result).to.equal("/mock/project/root");
  });

  it("should skip processing if project is already imported", async function () {
    getProjectJsonMock.resolves({ version: 2.1 });
    projectListMock.query.returns({ path: "/mock/project/already" });

    const result = await readProject("/mock/project/already");

    expect(rewriteAllIncludeExcludePropertyMock.calledWith("/mock/project/already", [])).to.be.false;
    expect(gitAddMock.calledOnce).to.be.false;//projectList.queryでtrueが返るので、後続のgitAddは呼ばれない。
    expect(result).to.equal("/mock/project/already");
  });

  it("should handle invalid directory names", async function () {
    getProjectJsonMock.resolves({ version: 2.1, name: "test_project" });
    fsPathExistsMock.resolves(true);
    projectListMock.query.returns(null);
    gitAddMock.resolves();
    writeProjectJsonMock.resolves();

    const result = await readProject("/mock/project/root");

    expect(writeProjectJsonMock.calledOnce).to.be.true;
    expect(gitAddMock.calledOnce).to.be.true;
    expect(gitCommitMock.calledWith("/mock/project/root", "import project", ["--", ".gitignore", "prj.wheel.json"])).to.be.true;

    expect(result).to.equal("/mock/project/root");
  });

  it("should initialize git repository if not already initialized", async function () {
    getProjectJsonMock.resolves({ version: 2.1 });
    projectListMock.query.returns(false);
    writeProjectJsonMock.resolves();
    fsPathExistsMock.onFirstCall().resolves(true)
      .onSecondCall()
      .resolves(false);
    fsOutputFileMock.resolves();
    gitAddMock.resolves();
    gitCommitMock.resolves();
    projectListMock.unshift.returns(true);

    const result = await readProject("/mock/project/root");

    expect(fsOutputFileMock.calledWith("/mock/project/root/.gitignore", "wheel.log")).to.be.true;
    expect(gitAddMock.calledWith("/mock/project/root", ".gitignore")).to.be.true;
    expect(gitCommitMock.calledWith("/mock/project/root", "import project", ["--", ".gitignore", "prj.wheel.json"])).to.be.true;
    expect(result).to.equal("/mock/project/root");
  });

  it("should handle errors during git operations", async function () {
    getProjectJsonMock.resolves({ version: 2.1 });
    projectListMock.query.returns(false);
    writeProjectJsonMock.resolves();
    fsPathExistsMock.resolves(false);
    gitInitMock.rejects(new Error("git init failed"));

    const result = await readProject("/mock/project/root");

    expect(result).to.null;
  });
});
