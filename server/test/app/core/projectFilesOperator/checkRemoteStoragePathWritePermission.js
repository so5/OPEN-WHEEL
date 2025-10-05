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

describe("#checkRemoteStoragePathWritePermission", ()=>{
  let getSshStub;
  let remoteHostGetIDStub;
  let sshExecStub;

  beforeEach(()=>{
    sshExecStub = sinon.stub();
    getSshStub = sinon.stub(projectFilesOperator._internal, "getSsh").returns({ exec: sshExecStub });
    remoteHostGetIDStub = sinon.stub(projectFilesOperator._internal.remoteHost, "getID");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should resolve when the storage path has write permission", async ()=>{
    const projectRootDir = "/mock/project/root";
    const params = { host: "remoteHost1", storagePath: "/remote/path" };
    const hostID = "host123";

    remoteHostGetIDStub.withArgs("name", params.host).returns(hostID);
    sshExecStub.withArgs(`test -w ${params.storagePath}`).returns(0);

    await projectFilesOperator._internal.checkRemoteStoragePathWritePermission(projectRootDir, params);

    expect(remoteHostGetIDStub.calledOnceWith("name", params.host)).to.be.true;
    expect(getSshStub.calledOnceWith(projectRootDir, hostID)).to.be.true;
    expect(sshExecStub.calledOnceWith(`test -w ${params.storagePath}`)).to.be.true;
  });

  it("should throw an error when the storage path does not have write permission", async ()=>{
    const projectRootDir = "/mock/project/root";
    const params = { host: "remoteHost1", storagePath: "/remote/path" };
    const hostID = "host123";

    remoteHostGetIDStub.withArgs("name", params.host).returns(hostID);
    sshExecStub.withArgs(`test -w ${params.storagePath}`).returns(1);

    try {
      await projectFilesOperator._internal.checkRemoteStoragePathWritePermission(projectRootDir, params);
      throw new Error("should have been rejected");
    } catch (err) {
      expect(err.message).to.equal("bad permission");
      expect(err.host).to.equal(params.host);
      expect(err.storagePath).to.equal(params.storagePath);
      expect(err.reason).to.equal("invalidRemoteStorage");
    }
  });

  it("should throw an error when SSH instance is not available", async ()=>{
    const projectRootDir = "/mock/project/root";
    const params = { host: "remoteHost1", storagePath: "/remote/path" };
    const hostID = "host123";
    const sshError = new Error("ssh instance is not registered for the project");

    remoteHostGetIDStub.withArgs("name", params.host).returns(hostID);
    getSshStub.throws(sshError);

    try {
      await projectFilesOperator._internal.checkRemoteStoragePathWritePermission(projectRootDir, params);
      throw new Error("should have been rejected");
    } catch (err) {
      expect(err).to.equal(sshError);
    }
  });
});