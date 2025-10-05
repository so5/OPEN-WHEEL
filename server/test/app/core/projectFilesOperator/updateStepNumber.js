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

describe("#updateStepNumber", ()=>{
  let sandbox;
  let getAllComponentIDsStub;
  let getComponentDirStub;
  let readComponentJsonStub;
  let writeComponentJsonStub;
  let arrangeComponentStub;

  const mockProjectRootDir = "/mock/project/root";

  beforeEach(()=>{
    sandbox = sinon.createSandbox();
    getAllComponentIDsStub = sandbox.stub(projectFilesOperator._internal, "getAllComponentIDs");
    getComponentDirStub = sandbox.stub(projectFilesOperator._internal, "getComponentDir");
    readComponentJsonStub = sandbox.stub(projectFilesOperator._internal, "readComponentJson");
    writeComponentJsonStub = sandbox.stub(projectFilesOperator._internal, "writeComponentJson").resolves();
    arrangeComponentStub = sandbox.stub(projectFilesOperator._internal, "arrangeComponent");
  });

  afterEach(()=>{
    sandbox.restore();
  });

  it("should update 'stepnum' for all stepjobTask components in the arranged order", async ()=>{
    const componentIDs = ["compStepjob", "compTaskA", "compTaskB", "compOther"];
    getAllComponentIDsStub.resolves(componentIDs);

    const mockStepjob = { ID: "compStepjob", type: "stepjob" };
    const mockTaskA = { ID: "compTaskA", type: "stepjobTask", parent: "compStepjob" };
    const mockTaskB = { ID: "compTaskB", type: "stepjobTask", parent: "compStepjob" };
    const mockOther = { ID: "compOther", type: "storage" };

    getComponentDirStub.callsFake(async (_, id)=>`/mock/dir/${id}`);
    readComponentJsonStub.callsFake(async (dirPath)=>{
      switch (dirPath) {
        case "/mock/dir/compStepjob": return mockStepjob;
        case "/mock/dir/compTaskA": return mockTaskA;
        case "/mock/dir/compTaskB": return mockTaskB;
        case "/mock/dir/compOther": return mockOther;
        default: return {};
      }
    });

    arrangeComponentStub.callsFake(async (stepjobGroup)=>{
      return stepjobGroup[0] || [];
    });

    await projectFilesOperator._internal.updateStepNumber(mockProjectRootDir);

    expect(getAllComponentIDsStub.calledOnce).to.be.true;
    expect(readComponentJsonStub.callCount).to.equal(componentIDs.length);
    expect(arrangeComponentStub.calledOnce).to.be.true;
    expect(writeComponentJsonStub.callCount).to.equal(2);

    const firstWriteArg = writeComponentJsonStub.firstCall.args[2];
    const secondWriteArg = writeComponentJsonStub.secondCall.args[2];
    expect(firstWriteArg.stepnum).to.equal(0);
    expect(secondWriteArg.stepnum).to.equal(1);
  });

  it("should do nothing if there are no stepjobTask components", async ()=>{
    getAllComponentIDsStub.resolves(["comp1", "comp2"]);
    readComponentJsonStub.resolves({ ID: "compX", type: "storage" });
    arrangeComponentStub.resolves([]);

    await projectFilesOperator._internal.updateStepNumber(mockProjectRootDir);

    expect(arrangeComponentStub.calledOnce).to.be.true;
    expect(arrangeComponentStub.firstCall.args[0]).to.deep.equal([]);
    expect(writeComponentJsonStub.notCalled).to.be.true;
  });

  it("should handle error if getAllComponentIDs fails", async ()=>{
    const mockError = new Error("getAllComponentIDs failed");
    getAllComponentIDsStub.rejects(mockError);

    try {
      await projectFilesOperator._internal.updateStepNumber(mockProjectRootDir);
      expect.fail("Expected updateStepNumber to throw an error");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(writeComponentJsonStub.notCalled).to.be.true;
  });

  it("should handle error if readComponentJson fails", async ()=>{
    getAllComponentIDsStub.resolves(["compStepjob", "compTaskA"]);
    getComponentDirStub.returns("/mock/dir/any");
    readComponentJsonStub.onCall(0).resolves({ ID: "compStepjob", type: "stepjob" });
    readComponentJsonStub.onCall(1).rejects(new Error("readComponentJson failed"));

    try {
      await projectFilesOperator._internal.updateStepNumber(mockProjectRootDir);
      expect.fail("Expected to throw an error");
    } catch (err) {
      expect(err.message).to.equal("readComponentJson failed");
    }

    expect(writeComponentJsonStub.notCalled).to.be.true;
  });

  it("should process multiple stepjobs independently", async ()=>{
    getAllComponentIDsStub.resolves([
      "stepjobA", "taskA1", "taskA2",
      "stepjobB", "taskB1", "taskB2"
    ]);

    const stepjobA = { ID: "stepjobA", type: "stepjob" };
    const stepjobB = { ID: "stepjobB", type: "stepjob" };
    const taskA1 = { ID: "taskA1", type: "stepjobTask", parent: "stepjobA" };
    const taskA2 = { ID: "taskA2", type: "stepjobTask", parent: "stepjobA" };
    const taskB1 = { ID: "taskB1", type: "stepjobTask", parent: "stepjobB" };
    const taskB2 = { ID: "taskB2", type: "stepjobTask", parent: "stepjobB" };

    getComponentDirStub.callsFake(async (_, id)=>`/mock/dir/${id}`);
    readComponentJsonStub.callsFake(async (dirPath)=>{
      switch (dirPath) {
        case "/mock/dir/stepjobA": return stepjobA;
        case "/mock/dir/stepjobB": return stepjobB;
        case "/mock/dir/taskA1": return taskA1;
        case "/mock/dir/taskA2": return taskA2;
        case "/mock/dir/taskB1": return taskB1;
        case "/mock/dir/taskB2": return taskB2;
        default: return {};
      }
    });
    arrangeComponentStub.callsFake(async (groups)=>{
      const result = [];
      for (const group of groups) {
        result.push(...group);
      }
      return result;
    });

    await projectFilesOperator._internal.updateStepNumber(mockProjectRootDir);

    expect(writeComponentJsonStub.callCount).to.equal(4);
    expect(writeComponentJsonStub.getCall(0).args[2].stepnum).to.equal(0);
    expect(writeComponentJsonStub.getCall(1).args[2].stepnum).to.equal(1);
    expect(writeComponentJsonStub.getCall(2).args[2].stepnum).to.equal(2);
    expect(writeComponentJsonStub.getCall(3).args[2].stepnum).to.equal(3);
  });

  it("should handle arrangeComponent throwing an error", async ()=>{
    getAllComponentIDsStub.resolves(["compStepjob", "compTaskA"]);
    readComponentJsonStub.onCall(0).resolves({ ID: "compStepjob", type: "stepjob" });
    readComponentJsonStub.onCall(1).resolves({ ID: "compTaskA", type: "stepjobTask", parent: "compStepjob" });

    arrangeComponentStub.rejects(new Error("arrangeComponent failed"));

    try {
      await projectFilesOperator._internal.updateStepNumber(mockProjectRootDir);
      expect.fail("Expected updateStepNumber to throw");
    } catch (err) {
      expect(err.message).to.equal("arrangeComponent failed");
    }

    expect(writeComponentJsonStub.notCalled).to.be.true;
  });

  it("should skip tasks if their parent is not a stepjob", async ()=>{
    getAllComponentIDsStub.resolves(["normalStepjob", "weirdTask1", "weirdTask2"]);
    readComponentJsonStub.callsFake(async ()=>({}));
    readComponentJsonStub.onCall(0).resolves({ ID: "normalStepjob", type: "stepjob" });
    readComponentJsonStub.onCall(1).resolves({ ID: "weirdTask1", type: "stepjobTask", parent: "workflow" });
    readComponentJsonStub.onCall(2).resolves({ ID: "weirdTask2", type: "stepjobTask", parent: "normalStepjob" });

    arrangeComponentStub.callsFake(async (groups)=>{
      return groups[0] || [];
    });

    await projectFilesOperator._internal.updateStepNumber(mockProjectRootDir);

    expect(writeComponentJsonStub.calledOnce).to.be.true;
    const updatedTask = writeComponentJsonStub.firstCall.args[2];
    expect(updatedTask.ID).to.equal("weirdTask2");
    expect(updatedTask.stepnum).to.equal(0);
  });
});
