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


describe.skip("#setComponentStateR", ()=>{
  let setComponentStateR;
  let globMock, readJsonGreedyMock, writeComponentJsonMock;

  beforeEach(()=>{
    setComponentStateR = projectFilesOperator._internal.setComponentStateR;

    globMock = sinon.stub();
    readJsonGreedyMock = sinon.stub();
    writeComponentJsonMock = sinon.stub();

    projectFilesOperator._internal.promisify = ()=>globMock;
    projectFilesOperator._internal.readJsonGreedy = readJsonGreedyMock;
    projectFilesOperator._internal.writeComponentJson = writeComponentJsonMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should update the state for all components and call writeComponentJson", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockDir = "/mock/project/root/components";
    const state = "finished";

    const globMockFilenames = [
      path.join(mockDir, "component1.json"),
      path.join(mockDir, "component2.json")
    ];
    const expectedFilenames = [
      path.join(mockDir, "component1.json"),
      path.join(mockDir, "component2.json"),
      path.join(mockDir, "cmp.wheel.json")
    ];

    const mockComponents = [
      { state: "not-started" },
      { state: "not-started" },
      { state: "default" }
    ];

    globMock.resolves(globMockFilenames);
    readJsonGreedyMock.onCall(0).resolves(mockComponents[0]);
    readJsonGreedyMock.onCall(1).resolves(mockComponents[1]);
    readJsonGreedyMock.onCall(2).resolves(mockComponents[2]);
    writeComponentJsonMock.resolves("success");

    await setComponentStateR(mockProjectRootDir, mockDir, state);

    expect(globMock.calledOnceWithExactly(path.join(mockDir, "**", "cmp.wheel.json"))).to.be.true;
    expect(readJsonGreedyMock.calledThrice).to.be.true;
    expect(writeComponentJsonMock.calledThrice).to.be.true;

    expect(writeComponentJsonMock.firstCall.args[1]).to.equal(path.dirname(expectedFilenames[0]));
    expect(writeComponentJsonMock.secondCall.args[1]).to.equal(path.dirname(expectedFilenames[1]));
    expect(writeComponentJsonMock.thirdCall.args[1]).to.equal(path.dirname(expectedFilenames[2]));

    expect(writeComponentJsonMock.firstCall.args[2].state).to.equal(state);
    expect(writeComponentJsonMock.secondCall.args[2].state).to.equal(state);
    expect(writeComponentJsonMock.thirdCall.args[2].state).to.equal(state);
  });

  it("should skip updating components in ignoreStates", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockDir = "/mock/project/root/components";
    const mockState = "finished";
    const ignoreStates = ["running", "finished"];

    const globMockFilenames = [
      path.join(mockDir, "component1.json"),
      path.join(mockDir, "component2.json")
    ];
    const expectedFilenames = [
      path.join(mockDir, "component1.json"),
      path.join(mockDir, "component2.json"),
      path.join(mockDir, "cmp.wheel.json")
    ];

    const mockComponents = [
      { state: "not-started" }, //更新対象
      { state: "running" }, //スキップ対象
      { state: "default" } //更新対象
    ];

    globMock.resolves(globMockFilenames);
    readJsonGreedyMock.onCall(0).resolves(mockComponents[0]);
    readJsonGreedyMock.onCall(1).resolves(mockComponents[1]);
    readJsonGreedyMock.onCall(2).resolves(mockComponents[2]);
    writeComponentJsonMock.resolves("success");

    await setComponentStateR(mockProjectRootDir, mockDir, mockState, false, ignoreStates);

    expect(globMock.calledOnceWithExactly(path.join(mockDir, "**", "cmp.wheel.json"))).to.be.true;
    expect(readJsonGreedyMock.calledThrice).to.be.true;
    expect(writeComponentJsonMock.calledTwice).to.be.true; //2回のみ更新

    expect(writeComponentJsonMock.firstCall.args[1]).to.equal(path.dirname(expectedFilenames[0]));
    expect(writeComponentJsonMock.secondCall.args[1]).to.equal(path.dirname(expectedFilenames[2]));

    expect(writeComponentJsonMock.firstCall.args[2].state).to.equal(mockState);
    expect(writeComponentJsonMock.secondCall.args[2].state).to.equal(mockState);
  });

  it("should handle an empty directory gracefully", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockDir = "/mock/project/root/components";
    const mockState = "finished";

    const globMockFilenames = []; //空ディレクトリとして設定
    const expectedFilenames = [
      path.join(mockDir, "cmp.wheel.json") //自動追加される
    ];

    globMock.resolves(globMockFilenames);
    readJsonGreedyMock.onCall(0).resolves({ state: "default" });
    writeComponentJsonMock.resolves("success");

    await setComponentStateR(mockProjectRootDir, mockDir, mockState);

    expect(globMock.calledOnceWithExactly(path.join(mockDir, "**", "cmp.wheel.json"))).to.be.true;
    expect(readJsonGreedyMock.calledOnce).to.be.true; //cmp.wheel.json のみ処理される
    expect(writeComponentJsonMock.calledOnce).to.be.true;

    expect(writeComponentJsonMock.firstCall.args[1]).to.equal(path.dirname(expectedFilenames[0]));
    expect(writeComponentJsonMock.firstCall.args[2].state).to.equal(mockState);
  });
});
