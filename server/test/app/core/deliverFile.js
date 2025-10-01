/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const { deliverFile, deliverFilesOnRemote, deliverFilesFromRemote, _internal } = require("../../../app/core/deliverFile.js");
const { rsyncExcludeOptionOfWheelSystemFiles } = require("../../../app/db/db");

describe("#deliverFile", ()=>{
  let lstatStub;
  let copyStub;
  let removeStub;
  let ensureSymlinkStub;
  const statsMock = { isDirectory: sinon.stub() };

  beforeEach(()=>{
    lstatStub = sinon.stub(_internal.fs, "lstat").resolves(statsMock);
    copyStub = sinon.stub(_internal.fs, "copy").resolves();
    removeStub = sinon.stub(_internal.fs, "remove").resolves();
    ensureSymlinkStub = sinon.stub(_internal.fs, "ensureSymlink").resolves();
  });
  afterEach(()=>{
    sinon.restore();
  });

  it("should deliver directory with symlink if not forced to copy", async ()=>{
    statsMock.isDirectory.returns(true);
    const src = "/path/to/srcDir";
    const dst = "/path/to/dstDir";
    const result = await deliverFile(src, dst, false);

    expect(lstatStub.calledOnceWithExactly(src)).to.be.true;
    expect(removeStub.calledOnceWithExactly(dst)).to.be.true;
    expect(ensureSymlinkStub.calledOnceWithExactly(src, dst, "dir")).to.be.true;
    expect(result).to.deep.equal({
      type: "link-dir",
      src,
      dst
    });
  });

  it("should deliver file with symlink if not forced to copy", async ()=>{
    statsMock.isDirectory.returns(false);
    const src = "/path/to/srcFile";
    const dst = "/path/to/dstFile";
    const result = await deliverFile(src, dst, false);

    expect(lstatStub.calledOnceWithExactly(src)).to.be.true;
    expect(removeStub.calledOnceWithExactly(dst)).to.be.true;
    expect(ensureSymlinkStub.calledOnceWithExactly(src, dst, "file")).to.be.true;
    expect(result).to.deep.equal({
      type: "link-file",
      src,
      dst
    });
  });

  it("should deliver by copying if forceCopy is true", async ()=>{
    statsMock.isDirectory.returns(true);

    const src = "/path/to/srcAny";
    const dst = "/path/to/dstAny";

    const result = await deliverFile(src, dst, true);

    expect(removeStub.notCalled).to.be.true;
    expect(ensureSymlinkStub.notCalled).to.be.true;
    expect(copyStub.calledOnceWithExactly(src, dst, { overwrite: true })).to.be.true;
    expect(result).to.deep.equal({
      type: "copy",
      src,
      dst
    });
  });

  it("should fallback to copy when ensureSymlink throws EPERM error", async ()=>{
    statsMock.isDirectory.returns(false);
    const epermError = new Error("EPERM error");
    epermError.code = "EPERM";
    ensureSymlinkStub.rejects(epermError);

    const src = "/dir/src";
    const dst = "/dir/dst";

    const result = await deliverFile(src, dst, false);

    expect(removeStub.calledOnceWithExactly(dst)).to.be.true;
    expect(ensureSymlinkStub.calledOnce).to.be.true;
    expect(copyStub.calledOnceWithExactly(src, dst, { overwrite: false })).to.be.true;

    expect(result).to.deep.equal({
      type: "copy",
      src,
      dst
    });
  });

  it("should reject promise if ensureSymlink throws error with non-EPERM code", async ()=>{
    statsMock.isDirectory.returns(false);
    const otherError = new Error("Some other error");
    otherError.code = "EACCES";
    ensureSymlinkStub.rejects(otherError);

    const src = "/some/src";
    const dst = "/some/dst";

    try {
      await deliverFile(src, dst, false);
      expect.fail("Expected deliverFile to reject, but it resolved");
    } catch (err) {
      expect(err).to.equal(otherError);
    }

    expect(removeStub.calledOnceWithExactly(dst)).to.be.true;
    expect(ensureSymlinkStub.calledOnce).to.be.true;
    expect(copyStub.notCalled).to.be.true;
  });
});

describe("#deliverFilesOnRemote", ()=>{
  const loggerMock = {
    warn: sinon.stub(),
    debug: sinon.stub()
  };
  const sshMock = {
    exec: sinon.stub()
  };

  beforeEach(()=>{
    sinon.stub(_internal, "getLogger").returns(loggerMock);
    sinon.stub(_internal, "getSsh").returns(sshMock);
    sinon.stub(_internal, "path").value(require("path"));
  });

  afterEach(()=>{
    sinon.restore();
    loggerMock.warn.resetHistory();
    loggerMock.debug.resetHistory();
    sshMock.exec.resetHistory();
  });

  it("should return null and log a warning if recipe.onSameRemote is false", async ()=>{
    const recipe = {
      onSameRemote: false,
      projectRootDir: "/dummy/dir",
      remotehostID: "hostID"
    };
    const result = await deliverFilesOnRemote(recipe);

    expect(result).to.be.null;
    expect(loggerMock.warn.calledOnceWithExactly("deliverFilesOnRemote must be called with onSameRemote flag")).to.be.true;
    expect(_internal.getSsh.notCalled).to.be.true;
  });

  it("should execute ln -sf if forceCopy is false and ssh.exec returns 0 (success)", async ()=>{
    const recipe = {
      onSameRemote: true,
      forceCopy: false,
      projectRootDir: "/project/test",
      remotehostID: "testHostID",
      srcRoot: "/remote/src",
      srcName: "fileA",
      dstRoot: "/remote/dest",
      dstName: "fileB"
    };
    sshMock.exec.resolves(0);

    const result = await deliverFilesOnRemote(recipe);

    const expectedCmdPart = "ln -sf";
    expect(sshMock.exec.callCount).to.equal(1);
    const calledCmd = sshMock.exec.getCall(0).args[0];
    expect(calledCmd).to.include(expectedCmdPart);
    expect(loggerMock.debug.calledWithExactly("execute on remote", sinon.match.string)).to.be.true;
    expect(result).to.deep.equal({
      type: "copy",
      src: "/remote/src/fileA",
      dst: "/remote/dest/fileB"
    });
  });

  it("should execute cp -r if forceCopy is true and ssh.exec returns 0 (success)", async ()=>{
    const recipe = {
      onSameRemote: true,
      forceCopy: true,
      projectRootDir: "/project/copy",
      remotehostID: "copyHostID",
      srcRoot: "/remote/src2",
      srcName: "folderA",
      dstRoot: "/remote/dest2",
      dstName: "folderB"
    };
    sshMock.exec.resolves(0);

    const result = await deliverFilesOnRemote(recipe);

    const expectedCmdPart = "cp -r";
    expect(sshMock.exec.callCount).to.equal(1);
    const calledCmd = sshMock.exec.getCall(0).args[0];
    expect(calledCmd).to.include(expectedCmdPart);

    expect(result).to.deep.equal({
      type: "copy",
      src: "/remote/src2/folderA",
      dst: "/remote/dest2/folderB"
    });
  });

  it("should throw an error if ssh.exec returns a non-zero code", async ()=>{
    const recipe = {
      onSameRemote: true,
      forceCopy: false,
      projectRootDir: "/project/fail",
      remotehostID: "failHostID",
      srcRoot: "/remote/srcX",
      srcName: "badfile",
      dstRoot: "/remote/destX",
      dstName: "destfile"
    };
    sshMock.exec.resolves(1);

    try {
      await deliverFilesOnRemote(recipe);
      expect.fail("Expected deliverFilesOnRemote to throw, but it did not");
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal("deliver file on remote failed");
      expect(loggerMock.warn.calledWithExactly("deliver file on remote failed", 1)).to.be.true;
      expect(err).to.have.property("rt", 1);
    }
  });
});

describe("#deliverFilesFromRemote", ()=>{
  const loggerMock = {
    warn: sinon.stub(),
    debug: sinon.stub()
  };
  const sshMock = {
    recv: sinon.stub()
  };

  beforeEach(()=>{
    sinon.stub(_internal, "getLogger").returns(loggerMock);
    sinon.stub(_internal, "getSsh").returns(sshMock);
    sinon.stub(_internal, "rsyncExcludeOptionOfWheelSystemFiles").value(rsyncExcludeOptionOfWheelSystemFiles);
  });

  afterEach(()=>{
    sinon.restore();
    loggerMock.warn.resetHistory();
    sshMock.recv.resetHistory();
  });

  it("should return null and log a warning if recipe.remoteToLocal is false", async ()=>{
    const recipe = {
      projectRootDir: "/dummy/project",
      remoteToLocal: false
    };
    const result = await deliverFilesFromRemote(recipe);

    expect(result).to.be.null;
    expect(loggerMock.warn.calledOnceWithExactly("deliverFilesFromRemote must be called with remoteToLocal flag")).to.be.true;
  });

  it("should reject with an error if ssh.recv throws an error", async ()=>{
    const recipe = {
      projectRootDir: "/dummy/project",
      remoteToLocal: true,
      remotehostID: "host-001",
      srcRoot: "/remote/src",
      srcName: "fileA.txt",
      dstRoot: "/local/dst",
      dstName: "fileA.txt"
    };

    const fakeError = new Error("recv failed");
    sshMock.recv.rejects(fakeError);

    try {
      await deliverFilesFromRemote(recipe);
      expect.fail("Expected deliverFilesFromRemote to reject, but it resolved");
    } catch (err) {
      expect(err).to.equal(fakeError);
    }
  });

  it("should call ssh.recv and return an object if successful", async ()=>{
    const recipe = {
      projectRootDir: "/dummy/project",
      remoteToLocal: true,
      remotehostID: "host-002",
      srcRoot: "/remote/src",
      srcName: "fileB.dat",
      dstRoot: "/local/dst",
      dstName: "fileB.dat"
    };
    sshMock.recv.resolves();
    const result = await deliverFilesFromRemote(recipe);

    expect(result).to.deep.equal({
      type: "copy",
      src: "/remote/src/fileB.dat",
      dst: "/local/dst/fileB.dat"
    });
    expect(sshMock.recv.calledOnceWithExactly(
      ["/remote/src/fileB.dat"],
      "/local/dst/fileB.dat",
      ["-vv", ...rsyncExcludeOptionOfWheelSystemFiles]
    )).to.be.true;
  });
});
