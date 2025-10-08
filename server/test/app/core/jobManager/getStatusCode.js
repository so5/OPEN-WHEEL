/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const { getStatusCode, _internal } = require("../../../../app/core/jobManager.js");

describe("#getStatusCode", ()=>{
  let loggerMock;

  beforeEach(()=>{
    //loggerのMockオブジェクト作成
    loggerMock = {
      debug: sinon.stub(),
      warn: sinon.stub()
    };

    //依存関数のMock化
    sinon.stub(_internal, "getLogger").returns(loggerMock);
    sinon.stub(_internal, "getFirstCapture");
    sinon.stub(_internal, "getBulkFirstCapture");
    sinon.stub(_internal, "createBulkStatusFile").resolves();
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return parsed int when (task.type !== 'bulkjobTask') and everything is normal", async ()=>{
    //テスト用のダミー引数
    const JS = {
      reJobStatusCode: "RE_JOB_STATUSCODE_{{ JOBID }}=(\\d+)",
      reReturnCode: "RE_RETURNCODE_{{ JOBID }}=(\\d+)",
      acceptableRt: [0, 1]
    };
    const task = {
      type: "normalTask",
      jobID: "123",
      projectRootDir: "/dummy/dir"
    };
    const statCmdRt = 0; //ステータスコマンド自体が正常終了
    const outputText = "RE_JOB_STATUSCODE_123=0\nRE_RETURNCODE_123=5"; //jobStatus=0, returnCode=5

    //getFirstCaptureの戻り値を設定
    _internal.getFirstCapture.onFirstCall().returns("0"); //jobStatus
    _internal.getFirstCapture.onSecondCall().returns("5"); //returnCode

    const result = await getStatusCode(JS, task, statCmdRt, outputText);

    expect(result).to.equal(5);
    expect(task.jobStatus).to.equal("0");
    expect(task.rt).to.equal(5);
    //loggerが想定どおり呼ばれているか(呼ばれていないメソッドなどは呼ばれない)
    expect(loggerMock.debug.called).to.be.false;
    expect(loggerMock.warn.called).to.be.false;
  });

  it("should use JS.reJobStatus instead of JS.reJobStatusCode if the latter is undefined", async ()=>{
    //reJobStatusCodeが存在しないケース => reJobStatusを使う
    const JS = {
      reJobStatus: "FALLBACK_{{ JOBID }}=(\\d+)",
      reReturnCode: "FALLBACK_RET_{{ JOBID }}=(\\d+)",
      acceptableRt: [0]
    };
    const task = {
      type: "normalTask",
      jobID: "999",
      projectRootDir: "/dummy/fallback"
    };
    const statCmdRt = 0;
    const outputText = "FALLBACK_999=2\nFALLBACK_RET_999=4";

    //Stub応答をセット
    _internal.getFirstCapture.onFirstCall().returns("2"); //jobStatus
    _internal.getFirstCapture.onSecondCall().returns("4"); //returnCode

    const result = await getStatusCode(JS, task, statCmdRt, outputText);

    expect(result).to.equal(4);
    expect(task.jobStatus).to.equal("2");
    expect(loggerMock.warn.called).to.be.false;
  });

  it("should set jobStatus to -2 when jobStatus is not found (null)", async ()=>{
    const JS = {
      reJobStatusCode: "NO_MATCH_{{ JOBID }}=(\\d+)",
      reReturnCode: "ANY_RET_{{ JOBID }}=(\\d+)",
      acceptableRt: [0]
    };
    const task = {
      type: "normalTask",
      jobID: "111",
      projectRootDir: "/dummy/null"
    };
    const statCmdRt = 0;
    const outputText = "SOME_OTHER_TEXT"; //マッチしない => jobStatus=null

    //getFirstCaptureでjobStatus用をnullに
    _internal.getFirstCapture.onFirstCall().returns(null);
    //returnCodeは一応5を返しておく(最後まで進む)
    _internal.getFirstCapture.onSecondCall().returns("5");

    const result = await getStatusCode(JS, task, statCmdRt, outputText);

    expect(result).to.equal(5);
    expect(task.jobStatus).to.equal(-2);
    expect(loggerMock.warn.called).to.be.true; //warnログが出ている
  });

  it("should return -2 immediately if statCmdRt is not acceptable", async ()=>{
    const JS = {
      reJobStatusCode: "ANY_{{ JOBID }}=(\\d+)",
      reReturnCode: "ANY_RET_{{ JOBID }}=(\\d+)",
      acceptableRt: [0, 5] //3は含まれない
    };
    const task = {
      type: "normalTask",
      jobID: "222",
      projectRootDir: "/dummy/stat"
    };
    const statCmdRt = 3; //acceptableRtに入っていない
    const outputText = "";

    const result = await getStatusCode(JS, task, statCmdRt, outputText);
    expect(result).to.equal(-2);
    //warnログが呼ばれている
    expect(loggerMock.warn.calledWithMatch("status check command failed (3)")).to.be.true;
  });

  it("should return 0 if statCmdRt is acceptable but not zero", async ()=>{
    const JS = {
      reJobStatusCode: "ANY_{{ JOBID }}=(\\d+)",
      reReturnCode: "ANY_RET_{{ JOBID }}=(\\d+)",
      acceptableRt: [0, 8] //8はOK
    };
    const task = {
      type: "normalTask",
      jobID: "333",
      projectRootDir: "/dummy/stat"
    };
    const statCmdRt = 8; //acceptable
    const outputText = "";

    const result = await getStatusCode(JS, task, statCmdRt, outputText);
    expect(result).to.equal(0);
    //warnログが呼ばれている
    expect(loggerMock.warn.calledWithMatch("it may fail to get job script's return code. so it is overwirted by 0")).to.be.true;
  });

  it("should return -2 when strRt is null", async ()=>{
    //statCmdRtが0 => 次の分岐へ進むが、reReturnCodeがマッチせずstrRt=nullのケース
    const JS = {
      reJobStatusCode: "JS_{{ JOBID }}=(\\d+)",
      reReturnCode: "RET_{{ JOBID }}=(\\d+)",
      acceptableRt: [0]
    };
    const task = {
      type: "normalTask",
      jobID: "444",
      projectRootDir: "/dummy/nullret"
    };
    const statCmdRt = 0;
    const outputText = "JS_444=0"; //returnCodeにマッチしない => null

    //jobStatus=0 を返すように
    _internal.getFirstCapture.onFirstCall().returns("0");
    //returnCodeはnull
    _internal.getFirstCapture.onSecondCall().returns(null);

    const result = await getStatusCode(JS, task, statCmdRt, outputText);
    expect(result).to.equal(-2);
    expect(loggerMock.warn.calledWithMatch("get return code failed")).to.be.true;
  });

  it("should return 0 when strRt is '6'", async ()=>{
    //ステップジョブ依存でキャンセルされたケース
    const JS = {
      reJobStatusCode: "JS_{{ JOBID }}=(\\d+)",
      reReturnCode: "RET_{{ JOBID }}=(\\d+)",
      acceptableRt: [0]
    };
    const task = {
      type: "normalTask",
      jobID: "555",
      projectRootDir: "/dummy/cancel"
    };
    const statCmdRt = 0;
    const outputText = "JS_555=3\nRET_555=6";

    //jobStatus=3を適当に返す
    _internal.getFirstCapture.onFirstCall().returns("3");
    //returnCodeに'6'を返す
    _internal.getFirstCapture.onSecondCall().returns("6");

    const result = await getStatusCode(JS, task, statCmdRt, outputText);
    expect(result).to.equal(0);
    expect(loggerMock.warn.calledWithMatch("this job was canceled by stepjob dependency")).to.be.true;
  });

  it("should handle bulkjobTask by calling createBulkStatusFile", async ()=>{
    const JS = {
      reJobStatusCode: "NO_USE", //bulkjobTaskなので使わない
      reSubJobStatusCode: "SUBSTATUS_{{ JOBID }}=(\\d+)",
      reReturnCode: "NO_USE", //同上
      reSubReturnCode: "SUBRET_{{ JOBID }}=(\\d+)",
      acceptableRt: [0]
    };
    const task = {
      type: "bulkjobTask",
      jobID: "666",
      projectRootDir: "/dummy/bulk"
    };
    const statCmdRt = 0;
    const outputText = "SUBSTATUS_666=0\nSUBRET_666=1\nSUBSTATUS_666=0\nSUBRET_666=0";

    //getBulkFirstCaptureの戻り値
    //[jobStatus, jobStatusList], [rt, rtCodeList]
    //例: jobStatus=0, jobStatusList=[0,0],  returnCode=1(または0), rtCodeList=[1,0]みたいなイメージ
    _internal.getBulkFirstCapture.onFirstCall().returns([0, ["0", "0"]]); //jobStatus=0
    _internal.getBulkFirstCapture.onSecondCall().returns([1, ["1", "0"]]); //returnCode=1 (最後にparseInt => 1)

    const result = await getStatusCode(JS, task, statCmdRt, outputText);

    expect(result).to.equal(1);
    expect(task.jobStatus).to.equal(0); //最初の getBulkFirstCapture で取得した値
    expect(task.rt).to.equal(1);
    //createBulkStatusFileが呼ばれているか
    expect(_internal.createBulkStatusFile.calledOnce).to.be.true;
    //debugログが呼ばれているか
    expect(loggerMock.debug.calledWithMatch("JobStatus: 0 ,jobStatusList: 0,0")).to.be.true;
    expect(loggerMock.debug.calledWithMatch("rt: 1 ,rtCodeList: 1,0")).to.be.true;
  });
});
