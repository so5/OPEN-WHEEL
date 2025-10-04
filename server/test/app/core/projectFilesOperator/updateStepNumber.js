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


describe.skip("#updateStepNumber", ()=>{
  let rewireProjectFilesOperator;
  let updateStepNumber;
  let getAllComponentIDsMock;
  let getComponentDirMock;
  let readComponentJsonMock;
  let writeComponentJsonMock;
  let arrangeComponentMock;

  const mockProjectRootDir = "/mock/project/root";

  beforeEach(()=>{
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    updateStepNumber = rewireProjectFilesOperator.__get__("updateStepNumber");

    getAllComponentIDsMock = sinon.stub();
    getComponentDirMock = sinon.stub();
    readComponentJsonMock = sinon.stub();
    writeComponentJsonMock = sinon.stub().resolves();
    arrangeComponentMock = sinon.stub();

    rewireProjectFilesOperator.__set__({
      getAllComponentIDs: getAllComponentIDsMock,
      getComponentDir: getComponentDirMock,
      readComponentJson: readComponentJsonMock,
      writeComponentJson: writeComponentJsonMock,
      arrangeComponent: arrangeComponentMock
    });
  });

  it("should update 'stepnum' for all stepjobTask components in the arranged order", async ()=>{
    const componentIDs = ["compStepjob", "compTaskA", "compTaskB", "compOther"];
    getAllComponentIDsMock.resolves(componentIDs);

    const mockStepjob = { ID: "compStepjob", type: "stepjob" };
    const mockTaskA = { ID: "compTaskA", type: "stepjobTask", parent: "compStepjob" };
    const mockTaskB = { ID: "compTaskB", type: "stepjobTask", parent: "compStepjob" };
    const mockOther = { ID: "compOther", type: "storage" };

    getComponentDirMock.callsFake(async (_, id)=>`/mock/dir/${id}`);
    readComponentJsonMock.callsFake(async (dirPath)=>{
      switch (dirPath) {
        case "/mock/dir/compStepjob": return mockStepjob;
        case "/mock/dir/compTaskA": return mockTaskA;
        case "/mock/dir/compTaskB": return mockTaskB;
        case "/mock/dir/compOther": return mockOther;
        default: return {};
      }
    });

    arrangeComponentMock.callsFake(async (stepjobGroup)=>{
      //stepjobGroup は [[mockTaskA, mockTaskB]] の形を想定
      return stepjobGroup[0] || [];
    });

    await updateStepNumber(mockProjectRootDir);

    expect(getAllComponentIDsMock.calledOnce).to.be.true;
    expect(readComponentJsonMock.callCount).to.equal(componentIDs.length);
    expect(arrangeComponentMock.calledOnce).to.be.true;
    expect(writeComponentJsonMock.callCount).to.equal(2);

    const firstWriteArg = writeComponentJsonMock.firstCall.args[2];
    const secondWriteArg = writeComponentJsonMock.secondCall.args[2];
    expect(firstWriteArg.stepnum).to.equal(0);
    expect(secondWriteArg.stepnum).to.equal(1);
  });

  it("should do nothing if there are no stepjobTask components", async ()=>{
    getAllComponentIDsMock.resolves(["comp1", "comp2"]);
    readComponentJsonMock.resolves({ ID: "compX", type: "storage" });
    arrangeComponentMock.resolves([]);

    await updateStepNumber(mockProjectRootDir);

    expect(arrangeComponentMock.calledOnce).to.be.true;
    expect(arrangeComponentMock.firstCall.args[0]).to.deep.equal([]);
    expect(writeComponentJsonMock.notCalled).to.be.true;
  });

  it("should handle error if getAllComponentIDs fails", async ()=>{
    //getAllComponentIDs が例外を投げるケース
    const mockError = new Error("getAllComponentIDs failed");
    getAllComponentIDsMock.rejects(mockError);

    try {
      await updateStepNumber(mockProjectRootDir);
      expect.fail("Expected updateStepNumber to throw an error");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    //途中で例外が出たので何も書き込みが起こらない
    expect(writeComponentJsonMock.notCalled).to.be.true;
  });

  it("should handle error if readComponentJson fails", async ()=>{
    getAllComponentIDsMock.resolves(["compStepjob", "compTaskA"]);
    getComponentDirMock.returns("/mock/dir/any");
    //1回目はStepjob読み込み成功、2回目でエラー発生
    readComponentJsonMock.onCall(0).resolves({ ID: "compStepjob", type: "stepjob" });
    readComponentJsonMock.onCall(1).rejects(new Error("readComponentJson failed"));

    try {
      await updateStepNumber(mockProjectRootDir);
      expect.fail("Expected to throw an error");
    } catch (err) {
      expect(err.message).to.equal("readComponentJson failed");
    }

    //途中でエラーが出たので writeComponentJson は呼ばれない
    expect(writeComponentJsonMock.notCalled).to.be.true;
  });

  it("should process multiple stepjobs independently", async ()=>{
    //stepjobが2つあり、それぞれにstepjobTaskがあるケース
    getAllComponentIDsMock.resolves([
      "stepjobA", "taskA1", "taskA2",
      "stepjobB", "taskB1", "taskB2"
    ]);

    const stepjobA = { ID: "stepjobA", type: "stepjob" };
    const stepjobB = { ID: "stepjobB", type: "stepjob" };
    const taskA1 = { ID: "taskA1", type: "stepjobTask", parent: "stepjobA" };
    const taskA2 = { ID: "taskA2", type: "stepjobTask", parent: "stepjobA" };
    const taskB1 = { ID: "taskB1", type: "stepjobTask", parent: "stepjobB" };
    const taskB2 = { ID: "taskB2", type: "stepjobTask", parent: "stepjobB" };

    getComponentDirMock.callsFake(async (_, id)=>`/mock/dir/${id}`);
    readComponentJsonMock.callsFake(async (dirPath)=>{
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
    //arrangeComponent は stepjob単位でタスクリストを渡される
    //ここでは2つのstepjob => 配列長2 の配列が渡ってくる想定
    arrangeComponentMock.callsFake(async (groups)=>{
      //groups は [ [taskA1, taskA2], [taskB1, taskB2] ] のような形を想定
      //テストでは一切ソートせずそのまま返す
      const result = [];
      for (const group of groups) {
        result.push(...group);
      }
      return result; //[taskA1, taskA2, taskB1, taskB2]
    });

    await updateStepNumber(mockProjectRootDir);

    //A1->A2->B1->B2 の順で stepnum が割り当てられる
    expect(writeComponentJsonMock.callCount).to.equal(4);
    expect(writeComponentJsonMock.getCall(0).args[2].stepnum).to.equal(0);
    expect(writeComponentJsonMock.getCall(1).args[2].stepnum).to.equal(1);
    expect(writeComponentJsonMock.getCall(2).args[2].stepnum).to.equal(2);
    expect(writeComponentJsonMock.getCall(3).args[2].stepnum).to.equal(3);
  });

  it("should handle arrangeComponent throwing an error", async ()=>{
    getAllComponentIDsMock.resolves(["compStepjob", "compTaskA"]);
    readComponentJsonMock.onCall(0).resolves({ ID: "compStepjob", type: "stepjob" });
    readComponentJsonMock.onCall(1).resolves({ ID: "compTaskA", type: "stepjobTask", parent: "compStepjob" });

    arrangeComponentMock.rejects(new Error("arrangeComponent failed"));

    try {
      await updateStepNumber(mockProjectRootDir);
      expect.fail("Expected updateStepNumber to throw");
    } catch (err) {
      expect(err.message).to.equal("arrangeComponent failed");
    }

    //arrangeComponent 失敗後はwriteComponentJsonは呼ばれない
    expect(writeComponentJsonMock.notCalled).to.be.true;
  });

  it("should skip tasks if their parent is not a stepjob", async ()=>{
    //stepjobTask だが parent が workflow とか storage とかになっている場合を想定
    getAllComponentIDsMock.resolves(["normalStepjob", "weirdTask1", "weirdTask2"]);
    readComponentJsonMock.callsFake(async ()=>({})); //デフォルトは空
    //normalStepjob は stepjob
    readComponentJsonMock.onCall(0).resolves({ ID: "normalStepjob", type: "stepjob" });
    //weirdTask1/2 は stepjobTask だが parent="workflow" のようなケース
    readComponentJsonMock.onCall(1).resolves({ ID: "weirdTask1", type: "stepjobTask", parent: "workflow" });
    readComponentJsonMock.onCall(2).resolves({ ID: "weirdTask2", type: "stepjobTask", parent: "normalStepjob" });

    arrangeComponentMock.callsFake(async (groups)=>{
      //groups => [ [ {ID: weirdTask2} ] ] だけが親stepjob=normalStepjob
      //weirdTask1 は親がstepjobでない => そもそも追加されない想定
      return groups[0] || [];
    });

    await updateStepNumber(mockProjectRootDir);

    //weirdTask1 は親が stepjob でないのでスキップ
    //weirdTask2 は有効 => stepnum=0
    expect(writeComponentJsonMock.calledOnce).to.be.true;
    const updatedTask = writeComponentJsonMock.firstCall.args[2];
    expect(updatedTask.ID).to.equal("weirdTask2");
    expect(updatedTask.stepnum).to.equal(0);
  });
});
