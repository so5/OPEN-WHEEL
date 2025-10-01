/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const { stageIn, stageOut, _internal } = require("../../../app/core/transferrer.js");

describe("#stageIn", ()=>{
  beforeEach(()=>{
    sinon.stub(_internal, "setTaskState").resolves();
    sinon.stub(_internal, "getSshHostinfo").returns({ host: "mock-host" });
    sinon.stub(_internal, "replaceCRLF").resolves();
    sinon.stub(_internal, "addX").resolves();
    sinon.stub(_internal, "register").resolves("register-result");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should set stage-in state, convert CRLF, add exec permission, and register file transfer", async ()=>{
    const task = {
      projectRootDir: "/dummy/project",
      remotehostID: "host-123",
      workingDir: "/local/work/dir",
      script: "execute.sh",
      remoteWorkingDir: "/remote/work/dir/sub"
    };

    const result = await stageIn(task);

    expect(_internal.setTaskState.calledOnceWithExactly(task, "stage-in")).to.be.true;
    expect(_internal.getSshHostinfo.calledOnceWithExactly("/dummy/project", "host-123")).to.be.true;
    expect(_internal.replaceCRLF.calledOnceWithExactly("/local/work/dir/execute.sh")).to.be.true;
    expect(_internal.addX.calledOnceWithExactly("/local/work/dir/execute.sh")).to.be.true;
    expect(_internal.register.calledOnceWithExactly(
      { host: "mock-host" },
      task,
      "send",
      ["/local/work/dir"],
      "/remote/work/dir/"
    )).to.be.true;
    expect(result).to.equal("register-result");
  });
});

describe("#stageOut", ()=>{
  let sshMock;

  beforeEach(()=>{
    sinon.stub(_internal, "setTaskState");
    sinon.stub(_internal, "getSshHostinfo");
    sinon.stub(_internal, "needDownload");
    sinon.stub(_internal, "makeDownloadRecipe");
    sinon.stub(_internal, "register");
    sinon.stub(_internal, "getSsh");

    sshMock = {
      exec: sinon.stub()
    };

    const loggerStub = {
      debug: sinon.stub(),
      trace: sinon.stub(),
      warn: sinon.stub()
    };
    sinon.stub(_internal, "getLogger").returns(loggerStub);
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return immediately if task.state is not 'finished'", async ()=>{
    const task = {
      state: "running",
      projectRootDir: "/path/to/project",
      remotehostID: "hostID"
    };

    await stageOut(task);

    expect(_internal.setTaskState.called).to.be.false;
    expect(_internal.getSshHostinfo.called).to.be.false;
    expect(_internal.register.called).to.be.false;
  });

  it("should set task state to 'stage-out' and then restore it, if state is 'finished'", async ()=>{
    const task = {
      state: "finished",
      projectRootDir: "/project",
      remotehostID: "hostA",
      outputFiles: [],
      ID: "someTaskID"
    };
    _internal.getSshHostinfo.returns({ host: "dummyHost" });

    await stageOut(task);

    expect(_internal.setTaskState.callCount).to.equal(2);
    expect(_internal.setTaskState.firstCall.args).to.deep.equal([task, "stage-out"]);
    expect(_internal.setTaskState.secondCall.args).to.deep.equal([task, "finished"]);
  });

  it("should skip download if outputFiles is empty", async ()=>{
    const task = {
      state: "finished",
      projectRootDir: "/project",
      remotehostID: "hostA",
      outputFiles: [],
      ID: "someTaskID"
    };
    _internal.getSshHostinfo.returns({ host: "dummyHost" });

    await stageOut(task);

    expect(_internal.needDownload.called).to.be.false;
    expect(_internal.makeDownloadRecipe.called).to.be.false;
    expect(_internal.register.called).to.be.false;
  });

  it("should download files only if needDownload() returns true", async ()=>{
    const task = {
      state: "finished",
      projectRootDir: "/project",
      remotehostID: "hostA",
      workingDir: "/local/workingDir",
      remoteWorkingDir: "/remote/workingDir",
      outputFiles: [
        { name: "file1.txt" },
        { name: "file2.txt" }
      ],
      ID: "taskID"
    };
    _internal.getSshHostinfo.returns({ host: "dummyHost" });
    _internal.needDownload.onFirstCall().resolves(true);
    _internal.needDownload.onSecondCall().resolves(false);
    _internal.makeDownloadRecipe.returns({ src: "/remote/workingDir/file1.txt", dst: "/local/workingDir" });

    await stageOut(task);

    expect(_internal.makeDownloadRecipe.calledOnce).to.be.true;
    expect(_internal.register.calledOnce).to.be.true;
    const registerArgs = _internal.register.firstCall.args;
    expect(registerArgs[0]).to.deep.equal({ host: "dummyHost" });
    expect(registerArgs[1]).to.equal(task);
    expect(registerArgs[2]).to.equal("recv");
    expect(registerArgs[3]).to.deep.equal(["/remote/workingDir/file1.txt"]);
    expect(registerArgs[4]).to.equal("/local/workingDir");
  });

  it("should handle multiple files with the same dst as one register call", async ()=>{
    const task = {
      state: "finished",
      projectRootDir: "/project",
      remotehostID: "hostA",
      workingDir: "/local/dir",
      remoteWorkingDir: "/remote/dir",
      outputFiles: [
        { name: "a.bin" },
        { name: "b.bin" }
      ],
      ID: "taskID"
    };
    _internal.getSshHostinfo.returns({ host: "dummyHost" });
    _internal.needDownload.resolves(true);
    _internal.makeDownloadRecipe.onFirstCall().returns({ src: "/remote/dir/a.bin", dst: "/local/dir" });
    _internal.makeDownloadRecipe.onSecondCall().returns({ src: "/remote/dir/b.bin", dst: "/local/dir" });

    await stageOut(task);

    expect(_internal.register.calledOnce).to.be.true;
    const args = _internal.register.firstCall.args;
    expect(args[3]).to.deep.equal(["/remote/dir/a.bin", "/remote/dir/b.bin"]);
  });

  it("should pass exclude options to register only for the included files", async ()=>{
    const task = {
      state: "finished",
      projectRootDir: "/project",
      remotehostID: "hostA",
      workingDir: "/local/dir",
      remoteWorkingDir: "/remote/dir",
      outputFiles: [
        { name: "main.out" }
      ],
      exclude: ["*.tmp", "*.log"],
      include: ["extra.dat", "data/another.out"],
      ID: "taskID"
    };
    _internal.getSshHostinfo.returns({ host: "dummyHost" });
    _internal.needDownload.resolves(true);
    _internal.makeDownloadRecipe.onFirstCall().returns({ src: "/remote/dir/main.out", dst: "/local/dir" });
    _internal.makeDownloadRecipe.onSecondCall().returns({ src: "/remote/dir/extra.dat", dst: "/local/dir" });
    _internal.makeDownloadRecipe.onThirdCall().returns({ src: "/remote/dir/data/another.out", dst: "/local/dir" });

    await stageOut(task);

    expect(_internal.register.callCount).to.equal(2);
    const call1 = _internal.register.getCall(0).args;
    expect(call1[5]).to.be.undefined;
    const call2 = _internal.register.getCall(1).args;
    expect(call2[5]).to.deep.equal(["--exclude=*.tmp", "--exclude=*.log"]);
  });

  it("should do remote cleanup if doCleanup is true, ignoring any errors", async ()=>{
    const task = {
      state: "finished",
      projectRootDir: "/proj",
      remotehostID: "hostB",
      workingDir: "/local",
      remoteWorkingDir: "/remote",
      outputFiles: [],
      doCleanup: true,
      ID: "X000"
    };
    _internal.getSshHostinfo.returns({ host: "dummyHost" });
    _internal.getSsh.returns(sshMock);
    sshMock.exec.rejects(new Error("Some SSH error"));

    await stageOut(task);

    expect(_internal.getSsh.calledOnceWithExactly("/proj", "hostB")).to.be.true;
    expect(sshMock.exec.calledOnceWithExactly("rm -fr /remote")).to.be.true;
    expect(_internal.setTaskState.secondCall.args).to.deep.equal([task, "finished"]);
  });

  it("should skip remote cleanup if doCleanup is false", async ()=>{
    const task = {
      state: "finished",
      projectRootDir: "/proj",
      remotehostID: "hostB",
      workingDir: "/local",
      remoteWorkingDir: "/remote",
      outputFiles: [],
      doCleanup: false,
      ID: "X001"
    };
    _internal.getSshHostinfo.returns({ host: "dummyHost" });

    await stageOut(task);

    expect(_internal.getSsh.called).to.be.false;
    expect(sshMock.exec.called).to.be.false;
  });
});
