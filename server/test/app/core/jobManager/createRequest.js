/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import { createRequestForWebAPI, createRequest } from "../../../../app/core/jobManager.js";

describe("#createRequestForWebAPI", ()=>{
  //環境変数のバックアップ用
  let originalCertFilename;
  let originalCertPassphrase;

  let hostinfo;
  let task;
  let JS;

  beforeEach(()=>{
    //process.env をバックアップしてから、テスト用に上書き
    originalCertFilename = process.env.WHEEL_CERT_FILENAME;
    originalCertPassphrase = process.env.WHEEL_CERT_PASSPHRASE;
    process.env.WHEEL_CERT_FILENAME = "testCertFile.p12";
    process.env.WHEEL_CERT_PASSPHRASE = "testCertPass";

    //テスト用のダミーデータを用意
    hostinfo = {
      statusCheckInterval: 5
    };
    task = {
      jobID: "12345"
    };
    JS = {
      statDelimiter: "\n",
      reRunning: "RUNNING_{{ JOBID }}",
      allowEmptyOutput: false
    };
  });

  afterEach(()=>{
    //process.env を元に戻す
    process.env.WHEEL_CERT_FILENAME = originalCertFilename;
    process.env.WHEEL_CERT_PASSPHRASE = originalCertPassphrase;
    sinon.restore();
  });

  it("should return a valid request object for Fugaku webAPI", ()=>{
    const result = createRequestForWebAPI(hostinfo, task, JS);

    expect(result).to.be.an("object");

    //cmd の確認
    expect(result.cmd).to.be.a("string");
    expect(result.cmd).to.include("curl");
    expect(result.cmd).to.include("testCertFile.p12");
    expect(result.cmd).to.include("testCertPass");

    //withoutArgument の確認
    expect(result.withoutArgument).to.be.true;

    //finishedLocalHook の確認
    expect(result.finishedLocalHook).to.be.an("object");
    expect(result.finishedLocalHook.cmd).to.include("12345");

    //delimiter
    expect(result.delimiter).to.equal("\n");

    //re (reRunning)
    expect(result.re).to.equal("RUNNING_12345");

    //interval
    expect(result.interval).to.equal(5 * 1000);

    //argument
    expect(result.argument).to.equal("12345");

    //hostInfo
    expect(result.hostInfo).to.deep.equal({ host: "localhost" });

    //numAllowFirstFewEmptyOutput
    expect(result.numAllowFirstFewEmptyOutput).to.equal(3);

    //allowEmptyOutput
    expect(result.allowEmptyOutput).to.be.false;
  });
});

describe("#createRequest", ()=>{
  let hostinfo;
  let task;
  let JS;

  beforeEach(()=>{
    hostinfo = {
      statusCheckInterval: 10,
      someOtherProperty: "dummy"
    };
    task = {
      jobID: "9999"
      //task.type を後で変更してテスト
    };
    JS = {
      stat: "qstat",
      statAfter: "qstat -f",
      bulkstat: "qstat-bulk",
      bulkstatAfter: "qstat-bulk -f",
      statDelimiter: "\n",
      reRunning: "RUNNING_{{ JOBID }}",
      allowEmptyOutput: true
    };
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return correct object when task.type is not 'bulkjobTask'", ()=>{
    task.type = "normalTask";

    const result = createRequest(hostinfo, task, JS);
    expect(result).to.be.an("object");

    //cmd
    expect(result.cmd).to.equal("qstat");
    //finishedHook
    expect(result.finishedHook).to.deep.equal({
      cmd: "qstat -f",
      withArgument: true
    });
    //delimiter
    expect(result.delimiter).to.equal("\n");
    //re
    expect(result.re).to.equal("RUNNING_9999");
    //interval
    expect(result.interval).to.equal(10 * 1000);
    //argument
    expect(result.argument).to.equal("9999");
    //hostInfo
    expect(result.hostInfo).to.equal(hostinfo);
    //numAllowFirstFewEmptyOutput
    expect(result.numAllowFirstFewEmptyOutput).to.equal(3);
    //allowEmptyOutput
    expect(result.allowEmptyOutput).to.be.true;
  });

  it("should return correct object when task.type is 'bulkjobTask'", ()=>{
    task.type = "bulkjobTask";

    const result = createRequest(hostinfo, task, JS);
    expect(result).to.be.an("object");

    //cmd
    expect(result.cmd).to.equal("qstat-bulk");
    //finishedHook
    expect(result.finishedHook).to.deep.equal({
      cmd: "qstat-bulk -f",
      withArgument: true
    });
    //delimiter
    expect(result.delimiter).to.equal("\n");
    //re
    expect(result.re).to.equal("RUNNING_9999");
    //interval
    expect(result.interval).to.equal(10 * 1000);
    //argument
    expect(result.argument).to.equal("9999");
    //hostInfo
    expect(result.hostInfo).to.equal(hostinfo);
    //numAllowFirstFewEmptyOutput
    expect(result.numAllowFirstFewEmptyOutput).to.equal(3);
    //allowEmptyOutput
    expect(result.allowEmptyOutput).to.be.true;
  });
});
