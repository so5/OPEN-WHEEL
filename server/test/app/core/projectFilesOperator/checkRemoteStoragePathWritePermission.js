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


describe.skip("#checkRemoteStoragePathWritePermission", ()=>{
  let checkRemoteStoragePathWritePermission;
  let getSshMock;
  let remoteHostMock;
  let sshExecMock;

  beforeEach(()=>{
    checkRemoteStoragePathWritePermission = projectFilesOperator._internal.checkRemoteStoragePathWritePermission;

    remoteHostMock = {
      getID: sinon.stub()
    };

    sshExecMock = sinon.stub();
    getSshMock = sinon.stub().returns({ exec: sshExecMock });
    projectFilesOperator._internal.getSsh = getSshMock;
    projectFilesOperator._internal.remoteHost = remoteHostMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should resolve when the storage path has write permission", async ()=>{
    const projectRootDir = "/mock/project/root";
    const params = { host: "remoteHost1", storagePath: "/remote/path" };

    remoteHostMock.getID.withArgs("name", "remoteHost1").returns("host123");
    sshExecMock.withArgs("test -w /remote/path").returns(0);

    await expect(checkRemoteStoragePathWritePermission(projectRootDir, params)).to.be.fulfilled;
    expect(remoteHostMock.getID.calledOnceWithExactly("name", "remoteHost1")).to.be.true;
    expect(getSshMock.calledOnceWithExactly(projectRootDir, "host123")).to.be.true;
    expect(sshExecMock.calledOnceWithExactly("test -w /remote/path")).to.be.true;
  });

  it("should throw an error when the storage path does not have write permission", async ()=>{
    const projectRootDir = "/mock/project/root";
    const params = { host: "remoteHost1", storagePath: "/remote/path" };

    remoteHostMock.getID.withArgs("name", "remoteHost1").returns("host123");
    sshExecMock.withArgs("test -w /remote/path").returns(1);

    await expect(checkRemoteStoragePathWritePermission(projectRootDir, params)).to.be.rejectedWith("bad permission");
  });

  it("should throw an error when SSH instance is not available", async ()=>{
    const projectRootDir = "/mock/project/root";
    const params = { host: "remoteHost1", storagePath: "/remote/path" };

    remoteHostMock.getID.withArgs("name", "remoteHost1").returns("host123");
    getSshMock.throws(new Error("ssh instance is not registerd for the project"));

    await expect(checkRemoteStoragePathWritePermission(projectRootDir, params)).to.be.rejectedWith("ssh instance is not registerd for the project");
  });
});
