/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import { registerJob, _internal } from "../../../../app/core/jobManager.js";
import { EventEmitter } from "events";

describe("#registerJob", ()=>{
  let hostinfo;
  let task;

  beforeEach(()=>{
    //jobSchedulerのモック
    const jobSchedulerMock = {
      dummyJS: {
        maxStatusCheckError: 2,
        stat: "dummyStatCommand",
        bulkstat: "dummyBulkStatCommand",
        statAfter: "dummyAfterCommand",
        bulkstatAfter: "dummyBulkAfterCommand",
        statDelimiter: "\n",
        reRunning: "RUNNING",
        allowEmptyOutput: false,
        acceptableRt: [0]
      }
    };
    sinon.replace(_internal, "jobScheduler", jobSchedulerMock);
    sinon.stub(_internal, "addRequest");
    sinon.stub(_internal, "getRequest");
    sinon.stub(_internal, "delRequest");
    sinon.stub(_internal, "getLogger").returns({
      debug: sinon.stub(),
      trace: sinon.stub(),
      warn: sinon.stub()
    });
    sinon.stub(_internal, "createRequestForWebAPI");
    sinon.stub(_internal, "createRequest");
    sinon.stub(_internal, "getStatusCode");
    sinon.stub(_internal, "isJobFailed");

    //hostinfo, taskの初期化
    hostinfo = {
      jobScheduler: "dummyJS",
      useWebAPI: false,
      statusCheckInterval: 1
    };
    task = {
      projectRootDir: "/some/project",
      jobID: "12345",
      type: "normalTask"
    };
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should reject if jobScheduler setting not found", async ()=>{
    hostinfo.jobScheduler = "notFoundScheduler"; //存在しないキー

    try {
      await registerJob(hostinfo, task);
      expect.fail("Expected registerJob to throw, but it did not");
    } catch (err) {
      expect(err.message).to.equal("jobscheduler setting not found!");
      expect(err.hostinfo).to.deep.equal(hostinfo);
    }
  });

  it("should use createRequestForWebAPI if useWebAPI=true", async ()=>{
    //useWebAPI=trueの場合
    hostinfo.useWebAPI = true;

    //createRequestForWebAPIMock / getRequestMockが返すオブジェクトを用意
    const eventEmitter = new EventEmitter();
    const requestObj = {
      argument: "12345",
      hostInfo: { host: "localhost" },
      event: eventEmitter
    };

    _internal.createRequestForWebAPI.returns(requestObj);
    _internal.addRequest.returns("req-999");
    _internal.getRequest.returns(requestObj);

    //テスト実行
    const p = registerJob(hostinfo, task);

    //createRequestForWebAPIが呼ばれていることを確認
    expect(_internal.createRequestForWebAPI.calledOnce).to.be.true;
    expect(_internal.createRequest.notCalled).to.be.true;

    //finishedLocalHookを参照 => "finished"イベント
    _internal.getStatusCode.resolves(0);
    _internal.isJobFailed.returns(false);

    eventEmitter.emit("finished", {
      argument: "12345",
      hostInfo: { host: "localhost" },
      finishedLocalHook: {
        rt: 0,
        output: "some dummy output"
      }
    });

    const result = await p;
    expect(result).to.equal(0);
  });

  it("should re-check output if after cmd output is empty, then continue", async ()=>{
    //1回目リクエスト
    const firstEmitter = new EventEmitter();
    const firstRequestObj = {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      event: firstEmitter
    };
    _internal.createRequest.returns(firstRequestObj);

    let addRequestCallCount = 0;
    _internal.addRequest.callsFake(()=>{
      if (addRequestCallCount === 0) {
        addRequestCallCount++;
        return "req-987"; //1回目
      } else if (addRequestCallCount === 1) {
        addRequestCallCount++;
        return "req-recheck"; //2回目(再チェック用)
      } else {
        //3回目以降、もし呼ばれるならここ
        addRequestCallCount++;
        return "req-other";
      }
    });

    //2回目リクエスト
    const secondEmitter = new EventEmitter();
    const secondRequestObj = {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      event: secondEmitter
    };
    _internal.getRequest.callsFake((id)=>{
      //返すオブジェクトを場合分け
      if (id === "req-987") {
        return firstRequestObj;
      } else if (id === "req-recheck") {
        return secondRequestObj;
      }
      return undefined;
    });

    //実行
    const p = registerJob(hostinfo, task);

    //1回目finished => output空
    firstEmitter.emit("finished", {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      finishedHook: { rt: 0, output: "" }
    });

    _internal.getStatusCode.resolves(0);
    _internal.isJobFailed.returns(false);

    //2回目finished
    secondEmitter.emit("finished", {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      finishedHook: { rt: 0, output: "recheck success" }
    });

    const result = await p;
    expect(result).to.equal(0);

    //2回addRequestされたか
    expect(_internal.addRequest.callCount).to.equal(2);
  });

  it("should use createRequest if useWebAPI=false", async ()=>{
    //デフォルト: useWebAPI = false
    const eventEmitter = new EventEmitter();
    const requestObj = {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      event: eventEmitter
    };
    _internal.createRequest.returns(requestObj);
    _internal.addRequest.returns("req-123");
    _internal.getRequest.returns(requestObj);

    const p = registerJob(hostinfo, task);

    //createRequest が呼ばれる
    expect(_internal.createRequestForWebAPI.notCalled).to.be.true;
    expect(_internal.createRequest.calledOnce).to.be.true;

    //finishedHook を参照 => "finished"イベント
    _internal.getStatusCode.resolves(0);
    _internal.isJobFailed.returns(false);

    eventEmitter.emit("finished", {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      finishedHook: {
        rt: 0,
        output: "some normal output"
      }
    });

    const result = await p;
    expect(result).to.equal(0);
  });

  it("should increment error count on 'checked' if request.rt != 0 and reject when it exceeds max", async ()=>{
    //createRequestMock + getRequestMock の両方で同じオブジェクトを返す
    const eventEmitter = new EventEmitter();
    const requestObj = {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      event: eventEmitter
    };
    _internal.createRequest.returns(requestObj);
    _internal.addRequest.returns("req-abc");
    _internal.getRequest.returns(requestObj);

    //実行
    const p = registerJob(hostinfo, task);

    //"checked"イベントを3回発火 => 3回目でmaxを超えてreject
    eventEmitter.emit("checked", {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      rt: 999,
      checkCount: 1,
      lastOutput: "some output"
    });
    eventEmitter.emit("checked", {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      rt: 999,
      checkCount: 2,
      lastOutput: "some output"
    });

    try {
      eventEmitter.emit("checked", {
        argument: "12345",
        hostInfo: { host: "dummyHost" },
        rt: 999,
        checkCount: 3,
        lastOutput: "some output"
      });
      await p;
      expect.fail("Expected to reject, but resolved");
    } catch (err) {
      expect(err.message).to.equal("max status check error exceeded");
      expect(_internal.delRequest.calledOnceWithExactly("req-abc")).to.be.true;
    }
  });

  it("should reject if isJobFailed returns true", async ()=>{
    //reject時に比較しやすいようセット
    task.jobStatus = -999;

    const eventEmitter = new EventEmitter();
    const requestObj = {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      event: eventEmitter
    };
    _internal.createRequest.returns(requestObj);
    _internal.addRequest.returns("req-555");
    _internal.getRequest.returns(requestObj);

    const p = registerJob(hostinfo, task);

    _internal.getStatusCode.resolves(123);
    _internal.isJobFailed.returns(true);

    eventEmitter.emit("finished", {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      finishedHook: {
        rt: 0,
        output: "some output"
      }
    });

    try {
      await p;
      expect.fail("Expected to reject, but it resolved");
    } catch (err) {
      //実装では isJobFailed===true で reject(task.jobStatus)
      expect(err).to.equal(task.jobStatus);
    }
  });

  it("should resolve if isJobFailed is false", async ()=>{
    const eventEmitter = new EventEmitter();
    const requestObj = {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      event: eventEmitter
    };
    _internal.createRequest.returns(requestObj);
    _internal.addRequest.returns("req-666");
    _internal.getRequest.returns(requestObj);

    const p = registerJob(hostinfo, task);

    _internal.getStatusCode.resolves(0);
    _internal.isJobFailed.returns(false);

    eventEmitter.emit("finished", {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      finishedHook: {
        rt: 0,
        output: "normal output"
      }
    });

    const result = await p;
    expect(result).to.equal(0);
  });

  it("should reject on 'failed' event", async ()=>{
    const eventEmitter = new EventEmitter();
    const requestObj = {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      event: eventEmitter
    };
    _internal.createRequest.returns(requestObj);
    _internal.addRequest.returns("req-failTest");
    _internal.getRequest.returns(requestObj);

    const p = registerJob(hostinfo, task);

    const hookErr = new Error("some hook error");
    eventEmitter.emit("failed", {
      argument: "12345",
      hostInfo: { host: "dummyHost" },
      rt: 1,
      lastOutput: "failed..."
    }, hookErr);

    try {
      await p;
      expect.fail("Expected to reject, but it resolved");
    } catch (err) {
      expect(err.message).to.equal("fatal error occurred during job status check");
      //実装上 err.request = request
      expect(err.request.argument).to.equal("12345");
      expect(err.hookErr).to.equal(hookErr);
    }
  });
});
