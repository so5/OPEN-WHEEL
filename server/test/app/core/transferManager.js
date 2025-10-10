/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";

import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import * as transferManager from "../../../app/core/transferManager.js";

const { getKey, register, removeTransferrers, _internal } = transferManager;

describe("#getKey", ()=>{
  it("should return correct key string if task has projectRootDir and remotehostID", ()=>{
    const task = {
      projectRootDir: "/path/to/projectA",
      remotehostID: "remoteHost123"
    };

    const result = getKey(task);
    expect(result).to.equal("/path/to/projectA-remoteHost123");
  });

  it("should return a string even if remotehostID is undefined", ()=>{
    //remotehostID を定義していないケース
    const task = {
      projectRootDir: "/path/to/projectB"
      //remotehostID: undefined
    };

    const result = getKey(task);
    //undefined部分も文字列化されるだけで、エラーにはならない
    expect(result).to.equal("/path/to/projectB-undefined");
  });
});

describe("#register", ()=>{
  //Mock 変数 (Stub 変数) はすべてdescribe内で定義
  let getSshStub;
  let getDateStringStub;
  let getLoggerStub;
  let loggerStub;
  let SBSStub;
  let qsubAndWaitStub;
  let sshSendStub;
  let sshRecvStub;

  beforeEach(()=>{
    //各Mock定義
    getSshStub = sinon.stub(_internal, "getSsh");
    getDateStringStub = sinon.stub(_internal, "getDateString");

    loggerStub = {
      debug: sinon.stub()
    };
    getLoggerStub = sinon.stub(_internal, "getLogger").returns(loggerStub);

    sshSendStub = sinon.stub().resolves();
    sshRecvStub = sinon.stub().resolves();

    qsubAndWaitStub = sinon.stub().resolves("qsubResultMock");

    SBSStub = sinon.stub().callsFake((options)=>{
      return {
        qsubAndWait: qsubAndWaitStub,
        exec: options.exec,
        maxConcurrent: options.maxConcurrent,
        name: options.name
      };
    });
    sinon.replace(_internal, "SBS", SBSStub);

    _internal.transferrers.clear();
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should create a new SBS instance if it does not exist, then call qsubAndWait", async ()=>{
    getSshStub.returns({
      send: sshSendStub,
      recv: sshRecvStub
    });

    getDateStringStub.returns("mockDateString");

    const hostinfo = {
      name: "testHost",
      user: "testUser",
      port: 2222,
      maxNumParallelTransfer: 2
    };
    const task = {
      projectRootDir: "/path/to/project",
      remotehostID: "remoteHostA",
      workingDir: "/local/dir",
      remoteWorkingDir: "/remote/dir"
    };
    const direction = "send";
    const src = ["/some/local/file.txt"];
    const dst = "/some/remote/dir/";
    const opt = ["-p", "optionX"];

    //_internal.transferrersにはまだ何もないので、新規SBSが生成される想定
    expect(_internal.transferrers.size).to.equal(0);

    //実行
    const result = await register(hostinfo, task, direction, src, dst, opt);

    //qsubAndWaitの結果が返ってくる
    expect(result).to.equal("qsubResultMock");

    //SBSStubが呼ばれた回数は1回
    expect(SBSStub.calledOnce).to.be.true;

    //生成されたtransferrerがMapに登録されたか
    expect(_internal.transferrers.size).to.equal(1);

    //qsubAndWaitが呼ばれる
    expect(qsubAndWaitStub.calledOnce).to.be.true;
    //qsubAndWaitの引数
    expect(qsubAndWaitStub.args[0][0]).to.deep.equal({
      direction,
      src,
      dst,
      task
    });

    //SBSコンストラクタに設定されたmaxConcurrent / name を検証
    const sbsOpts = SBSStub.args[0][0];
    expect(sbsOpts.maxConcurrent).to.equal(2); //hostinfo.maxNumParallelTransfer
    expect(sbsOpts.name).to.equal("transfer-testUser@testHost:2222");

    //実際のexec処理のテスト (direction=send)
    //qsubAndWait 内部で exec を呼ぶ想定だが、テストでは強制実行
    await sbsOpts.exec({ direction, src, dst, task });

    //direction=sendなのでssh.sendが呼ばれる
    expect(sshSendStub.calledWith(src, dst, opt)).to.be.true;

    //task.preparedTimeが設定される
    expect(task.preparedTime).to.equal("mockDateString");

    //ログ出力(debug)が2回呼ばれる
    expect(loggerStub.debug.callCount).to.equal(2);
  });

  it("should reuse existing transferrer if it already exists", async ()=>{
    //すでに _internal.transferrers に格納されている場合
    const existingTransferrer = {
      qsubAndWait: sinon.stub().resolves("existingTransferrerResult")
    };
    //何らかのキーでセットしておく
    const key = "/path/to/project-remoteHostB"; //getKey(task) の戻り
    _internal.transferrers.set(key, existingTransferrer);

    const hostinfo = { name: "reuseTest" };
    const task = {
      projectRootDir: "/path/to/project",
      remotehostID: "remoteHostB"
    };
    const direction = "recv";
    const src = ["remote/file"];
    const dst = "/local/dir";
    const opt = [];

    //実行
    const result = await register(hostinfo, task, direction, src, dst, opt);

    //既存のtransferrerが使われるのでSBSStubは呼ばれない
    expect(SBSStub.notCalled).to.be.true;

    //既存のqsubAndWaitが呼ばれる
    expect(existingTransferrer.qsubAndWait.calledOnce).to.be.true;
    expect(result).to.equal("existingTransferrerResult");
  });

  it("should handle direction=recv correctly", async ()=>{
    getSshStub.returns({
      send: sshSendStub,
      recv: sshRecvStub
    });
    getDateStringStub.returns("unusedDateString");

    //direction=recv のテストでは "task.preparedTime" を書き換えないことに注意
    const hostinfo = { name: "dummyHost" };
    const task = {
      projectRootDir: "/proj",
      remotehostID: "hostC",
      workingDir: "/local/dir",
      remoteWorkingDir: "/remote/dir"
    };
    const direction = "recv";
    const src = ["/some/remote/data"];
    const dst = "/local/destination/";
    const opt = [];

    //新規SBS生成ルートへ
    const ret = await register(hostinfo, task, direction, src, dst, opt);
    expect(ret).to.equal("qsubResultMock"); //qsubAndWait の戻り

    //direction=recv 時、exec 内部で ssh.recv が呼ばれるか
    const sbsOpts = SBSStub.args[0][0];
    await sbsOpts.exec({ direction, src, dst, task });

    expect(sshRecvStub.calledWith(src, dst, opt)).to.be.true;
    expect(task.preparedTime).to.be.undefined; //send時のみ代入

    //ログ出力(debug)は direction=recv では呼ばれない
    expect(loggerStub.debug.notCalled).to.be.true;
  });

  it("should throw error if direction is invalid", async ()=>{
    getSshStub.returns({
      send: sshSendStub,
      recv: sshRecvStub
    });

    const hostinfo = { name: "invalidHost" };
    const task = {
      projectRootDir: "/projX",
      remotehostID: "hostX"
    };
    const direction = "unknown";
    const src = [];
    const dst = "";
    const opt = null;

    //register呼び出し自体は成功するが、
    //SBSStubのexec呼び出し時に例外が起こる
    await register(hostinfo, task, direction, src, dst, opt);

    //SBSのconstructor引数
    const sbsOpts = SBSStub.args[0][0];

    let thrownError;
    try {
      await sbsOpts.exec({ direction, src, dst, task });
    } catch (err) {
      thrownError = err;
    }
    expect(thrownError).to.be.instanceOf(Error);
    expect(thrownError.message).to.equal("invalid direction");
    expect(thrownError.direction).to.equal("unknown");
  });

  it("should use default values if hostinfo fields are not set", async ()=>{
    //user が無い場合 => process.env.USER (テスト環境でセットされていないなら undefined だが、名前だけチェック)
    //port が無い場合 => 22
    getSshStub.returns({ send: sshSendStub, recv: sshRecvStub });
    getDateStringStub.returns("dateMock");

    const hostinfo = {
      name: "defaultPortHost"
      //userなし
      //portなし
      //maxNumParallelTransferなし
    };
    const task = {
      projectRootDir: "/default",
      remotehostID: "defHost"
    };
    //direction="send" で実行
    await register(hostinfo, task, "send", ["fileA"], "/dest", []);

    //SBSの引数
    const sbsOpts = SBSStub.args[0][0];
    //maxNumParallelTransfer が無い => 1
    expect(sbsOpts.maxConcurrent).to.equal(1);
    //user が無い => process.env.USER(もし未定義ならundefined)
    //port が無い => 22
    expect(sbsOpts.name).to.include("transfer-");
    expect(sbsOpts.name).to.include("@defaultPortHost:22");
  });
});

describe("#removeTransferrers", ()=>{
  beforeEach(()=>{
    _internal.transferrers.clear();
  });

  it("should remove all keys that start with the given projectRootDir", ()=>{
    //テスト用に複数のキーをセット
    _internal.transferrers.set("/path/to/projectA-fileX", { dummy: "data1" });
    _internal.transferrers.set("/path/to/projectA-fileY", { dummy: "data2" });
    _internal.transferrers.set("/path/to/otherProject-fileZ", { dummy: "data3" });

    //実行
    removeTransferrers("/path/to/projectA");

    //projectA で始まるキーは削除される想定
    expect(_internal.transferrers.has("/path/to/projectA-fileX")).to.be.false;
    expect(_internal.transferrers.has("/path/to/projectA-fileY")).to.be.false;

    //他のキーは残る
    expect(_internal.transferrers.has("/path/to/otherProject-fileZ")).to.be.true;
    //結果としてキーは1個だけ
    expect(_internal.transferrers.size).to.equal(1);
  });

  it("should do nothing if there are no keys starting with the given projectRootDir", ()=>{
    //テスト用にキーをセット（どれも "/path/to/projectB" で始まらない）
    _internal.transferrers.set("/path/to/unrelated1", { dummy: "data1" });
    _internal.transferrers.set("/foo/bar", { dummy: "data2" });

    removeTransferrers("/path/to/projectB");

    //どのキーも削除されない
    expect(_internal.transferrers.has("/path/to/unrelated1")).to.be.true;
    expect(_internal.transferrers.has("/foo/bar")).to.be.true;
    expect(_internal.transferrers.size).to.equal(2);
  });
});