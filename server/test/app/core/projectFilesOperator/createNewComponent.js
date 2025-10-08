/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const path = require("path");
const projectFilesOperator = require("../../../../app/core/projectFilesOperator.js");

describe("#createNewComponent", ()=>{
  let readJsonGreedyStub;
  let makeDirStub;
  let componentFactoryStub;
  let writeComponentJsonStub;
  let updateComponentPathStub;
  let writeJsonWrapperStub;
  let gitAddStub;

  const dummyProjectRootDir = "/dummy/projectRootDir";
  const dummyParentDir = "/dummy/parentDir";
  const dummyPos = { x: 100, y: 200 };
  const dummyParentJson = { ID: "parent-123" };
  const dummyAbsDirName = "/dummy/parentDir/task0";
  const dummyComponent = {
    type: "task",
    pos: dummyPos,
    parent: "parent-123",
    ID: "new-component-id",
    name: "task0"
  };
  const dummyPsComponent = {
    type: "PS",
    pos: dummyPos,
    parent: "parent-123",
    ID: "new-ps-id",
    name: "PS0"
  };

  beforeEach(()=>{
    readJsonGreedyStub = sinon.stub(projectFilesOperator._internal, "readJsonGreedy").resolves(dummyParentJson);
    makeDirStub = sinon.stub(projectFilesOperator._internal, "makeDir").resolves(dummyAbsDirName);
    componentFactoryStub = sinon.stub(projectFilesOperator._internal, "componentFactory").returns(dummyComponent);
    writeComponentJsonStub = sinon.stub(projectFilesOperator._internal, "writeComponentJson").resolves();
    updateComponentPathStub = sinon.stub(projectFilesOperator._internal, "updateComponentPath").resolves();
    writeJsonWrapperStub = sinon.stub(projectFilesOperator._internal, "writeJsonWrapper").resolves();
    gitAddStub = sinon.stub(projectFilesOperator._internal, "gitAdd").resolves();
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should successfully create a new component when type is 'task'", async ()=>{
    const result = await projectFilesOperator.createNewComponent(dummyProjectRootDir, dummyParentDir, "task", dummyPos);

    expect(readJsonGreedyStub.calledOnce).to.be.true;
    expect(readJsonGreedyStub.firstCall.args[0])
      .to.equal(path.resolve(dummyParentDir, "cmp.wheel.json"));

    expect(makeDirStub.calledOnce).to.be.true;
    expect(makeDirStub.firstCall.args[0])
      .to.equal(path.resolve(dummyParentDir, "task"));
    expect(makeDirStub.firstCall.args[1]).to.equal(0);

    expect(componentFactoryStub.calledOnce).to.be.true;
    expect(componentFactoryStub.firstCall.args).to.deep.equal(["task", dummyPos, "parent-123"]);

    expect(writeComponentJsonStub.calledOnce).to.be.true;
    expect(writeComponentJsonStub.firstCall.args[0]).to.equal(dummyProjectRootDir);
    expect(writeComponentJsonStub.firstCall.args[1]).to.equal(dummyAbsDirName);
    expect(writeComponentJsonStub.firstCall.args[2]).to.equal(dummyComponent);

    expect(updateComponentPathStub.calledOnce).to.be.true;
    expect(updateComponentPathStub.firstCall.args[0]).to.equal(dummyProjectRootDir);
    expect(updateComponentPathStub.firstCall.args[1]).to.equal("new-component-id");
    expect(updateComponentPathStub.firstCall.args[2]).to.equal(dummyAbsDirName);

    expect(writeJsonWrapperStub.called).to.be.false;
    expect(gitAddStub.called).to.be.false;

    expect(result).to.equal(dummyComponent);
    expect(result.type).to.equal("task");
  });

  it("should create additional parameterSetting.json when type is 'PS'", async ()=>{
    componentFactoryStub.returns(dummyPsComponent);
    const pathToPS = path.resolve(dummyAbsDirName, "parameterSetting.json");

    const result = await projectFilesOperator.createNewComponent(dummyProjectRootDir, dummyParentDir, "PS", dummyPos);

    expect(componentFactoryStub.calledOnce).to.be.true;
    expect(result.type).to.equal("PS");

    expect(writeJsonWrapperStub.calledOnce).to.be.true;
    expect(writeJsonWrapperStub.firstCall.args[0]).to.equal(pathToPS);
    expect(writeJsonWrapperStub.firstCall.args[1]).to.deep.equal({
      version: 2,
      targetFiles: [],
      params: [],
      scatter: [],
      gather: []
    });

    expect(gitAddStub.calledOnce).to.be.true;
    expect(gitAddStub.firstCall.args[0]).to.equal(dummyProjectRootDir);
    expect(gitAddStub.firstCall.args[1]).to.equal(pathToPS);
  });

  it("should throw an error if parent componentJson read fails", async ()=>{
    const readError = new Error("Failed to read parent cmp.wheel.json");
    readJsonGreedyStub.rejects(readError);

    try {
      await projectFilesOperator.createNewComponent(dummyProjectRootDir, dummyParentDir, "task", dummyPos);
      expect.fail("Expected createNewComponent to throw an error");
    } catch (err) {
      expect(err).to.equal(readError);
    }
  });
});
