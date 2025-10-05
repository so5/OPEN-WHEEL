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


describe("#addLink", ()=>{
  let getComponentDirStub;
  let readComponentJsonStub;
  let writeComponentJsonStub;
  let updateStepNumberStub;

  const projectRootDir = "/mock/project/root";

  beforeEach(()=>{
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
    readComponentJsonStub = sinon.stub(projectFilesOperator._internal, "readComponentJson");
    writeComponentJsonStub = sinon.stub(projectFilesOperator._internal, "writeComponentJson").resolves();
    updateStepNumberStub = sinon.stub(projectFilesOperator._internal, "updateStepNumber").resolves();
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if src === dst (cyclic link not allowed)", async ()=>{
    try {
      await projectFilesOperator.addLink(projectRootDir, "sameID", "sameID");
      throw new Error("Expected addLink to reject");
    } catch (err) {
      expect(err.message).to.equal("cyclic link is not allowed");
    }
  });

  it("should reject if either component is 'viewer'", async ()=>{
    getComponentDirStub.onFirstCall().resolves("/mock/srcDir");
    readComponentJsonStub.onFirstCall().resolves({
      type: "viewer", name: "ViewerComponent", else: [], next: [], previous: []
    });
    getComponentDirStub.onSecondCall().resolves("/mock/dstDir");
    readComponentJsonStub.onSecondCall().resolves({
      type: "task", name: "SomeTask", else: [], next: [], previous: []
    });

    try {
      await projectFilesOperator.addLink(projectRootDir, "viewerID", "taskID", false);
      throw new Error("Expected addLink to reject");
    } catch (err) {
      expect(err.message).to.equal("viewer can not have link");
      expect(err.code).to.equal("ELINK");
      expect(err.src).to.equal("viewerID");
      expect(err.dst).to.equal("taskID");
      expect(err.isElse).to.be.false;
    }
  });

  it("should reject if either component is 'source'", async ()=>{
    getComponentDirStub.onFirstCall().resolves("/mock/srcDir");
    readComponentJsonStub.onFirstCall().resolves({
      type: "task", name: "TaskComp", else: [], next: [], previous: []
    });
    getComponentDirStub.onSecondCall().resolves("/mock/dstDir");
    readComponentJsonStub.onSecondCall().resolves({
      type: "source", name: "SourceComp", else: [], next: [], previous: []
    });

    try {
      await projectFilesOperator.addLink(projectRootDir, "taskID", "sourceID", true);
      throw new Error("Expected addLink to reject");
    } catch (err) {
      expect(err.message).to.equal("source can not have link");
      expect(err.code).to.equal("ELINK");
      expect(err.src).to.equal("taskID");
      expect(err.dst).to.equal("sourceID");
      expect(err.isElse).to.be.true;
    }
  });

  it("should add dst to src.else if isElse is true, and not already in the array", async ()=>{
    const srcJson = {
      ID: "srcID",
      type: "task",
      name: "TaskA",
      else: ["existingElseID"],
      next: [],
      previous: []
    };
    getComponentDirStub.onFirstCall().resolves("/mock/srcDir");
    readComponentJsonStub.onFirstCall().resolves(srcJson);

    const dstJson = {
      ID: "dstID",
      type: "task",
      name: "TaskB",
      else: [],
      next: [],
      previous: []
    };
    getComponentDirStub.onSecondCall().resolves("/mock/dstDir");
    readComponentJsonStub.onSecondCall().resolves(dstJson);

    await projectFilesOperator.addLink(projectRootDir, "srcID", "dstID", true);

    const srcWriteCallArg = writeComponentJsonStub.firstCall.args[2];
    expect(srcWriteCallArg.else).to.deep.equal(["existingElseID", "dstID"]);

    const dstWriteCallArg = writeComponentJsonStub.secondCall.args[2];
    expect(dstWriteCallArg.previous).to.deep.equal(["srcID"]);
  });

  it("should add dst to src.next if isElse is false, and not already in the array", async ()=>{
    const srcJson = {
      ID: "srcID",
      type: "task",
      name: "TaskA",
      else: [],
      next: ["alreadyThere"],
      previous: []
    };
    getComponentDirStub.onFirstCall().resolves("/mock/srcDir");
    readComponentJsonStub.onFirstCall().resolves(srcJson);

    const dstJson = {
      ID: "dstID",
      type: "task",
      name: "TaskB",
      else: [],
      next: [],
      previous: []
    };
    getComponentDirStub.onSecondCall().resolves("/mock/dstDir");
    readComponentJsonStub.onSecondCall().resolves(dstJson);

    await projectFilesOperator.addLink(projectRootDir, "srcID", "dstID", false);

    const srcWriteCallArg = writeComponentJsonStub.firstCall.args[2];
    expect(srcWriteCallArg.next).to.deep.equal(["alreadyThere", "dstID"]);

    const dstWriteCallArg = writeComponentJsonStub.secondCall.args[2];
    expect(dstWriteCallArg.previous).to.deep.equal(["srcID"]);
  });

  it("should not duplicate dst in srcJson.else or srcJson.next if it already exists", async ()=>{
    const srcJson = {
      ID: "srcID",
      type: "task",
      name: "TaskA",
      else: ["dstID"],
      next: [],
      previous: []
    };
    getComponentDirStub.onFirstCall().resolves("/mock/srcDir");
    readComponentJsonStub.onFirstCall().resolves(srcJson);

    const dstJson = {
      ID: "dstID",
      type: "task",
      name: "TaskB",
      else: [],
      next: [],
      previous: ["srcID"]
    };
    getComponentDirStub.onSecondCall().resolves("/mock/dstDir");
    readComponentJsonStub.onSecondCall().resolves(dstJson);

    await projectFilesOperator.addLink(projectRootDir, "srcID", "dstID", true);

    const srcWriteCallArg = writeComponentJsonStub.firstCall.args[2];
    expect(srcWriteCallArg.else).to.deep.equal(["dstID"]);

    const dstWriteCallArg = writeComponentJsonStub.secondCall.args[2];
    expect(dstWriteCallArg.previous).to.deep.equal(["srcID"]);
  });

  it("should call updateStepNumber if both src and dst are stepjobTask", async ()=>{
    getComponentDirStub.onFirstCall().resolves("/mock/srcDir");
    readComponentJsonStub.onFirstCall().resolves({
      type: "stepjobTask", else: [], next: [], previous: []
    });

    getComponentDirStub.onSecondCall().resolves("/mock/dstDir");
    readComponentJsonStub.onSecondCall().resolves({
      type: "stepjobTask", else: [], next: [], previous: []
    });

    await projectFilesOperator.addLink(projectRootDir, "srcID", "dstID", false);
    expect(updateStepNumberStub.calledOnce).to.be.true;
  });

  it("should not call updateStepNumber if src is stepjobTask but dst is task", async ()=>{
    getComponentDirStub.onFirstCall().resolves("/mock/srcDir");
    readComponentJsonStub.onFirstCall().resolves({
      type: "stepjobTask", else: [], next: [], previous: []
    });

    getComponentDirStub.onSecondCall().resolves("/mock/dstDir");
    readComponentJsonStub.onSecondCall().resolves({
      type: "task", else: [], next: [], previous: []
    });

    await projectFilesOperator.addLink(projectRootDir, "srcID", "dstID");
    expect(updateStepNumberStub.notCalled).to.be.true;
  });

  it("should handle writeComponentJson rejections", async ()=>{
    getComponentDirStub.resolves("/mock/dir");
    readComponentJsonStub.resolves({ type: "task", else: [], next: [], previous: [] });
    writeComponentJsonStub.rejects(new Error("write failed"));

    try {
      await projectFilesOperator.addLink(projectRootDir, "x", "y", false);
      throw new Error("Expected addLink to throw");
    } catch (err) {
      expect(err.message).to.equal("write failed");
    }
  });
});