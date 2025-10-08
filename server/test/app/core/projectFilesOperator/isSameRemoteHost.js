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

describe("#isSameRemoteHost", ()=>{
  let readComponentJsonByIDStub;
  let remoteHostQueryStub;

  beforeEach(()=>{
    readComponentJsonByIDStub = sinon.stub(projectFilesOperator._internal, "readComponentJsonByID");
    remoteHostQueryStub = sinon.stub(projectFilesOperator._internal.remoteHost, "query");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return null if src and dst are the same", async ()=>{
    const result = await projectFilesOperator.isSameRemoteHost("/project/root", "componentA", "componentA");
    expect(result).to.be.null;
  });

  it("should return false if either component is local", async ()=>{
    readComponentJsonByIDStub.withArgs("/project/root", "componentA").resolves({ host: "localhost" });
    readComponentJsonByIDStub.withArgs("/project/root", "componentB").resolves({ host: "host1" });

    const result = await projectFilesOperator.isSameRemoteHost("/project/root", "componentA", "componentB");
    expect(result).to.be.false;
  });

  it("should return true if both components have the same host name", async ()=>{
    readComponentJsonByIDStub.withArgs("/project/root", "componentA").resolves({ host: "host1" });
    readComponentJsonByIDStub.withArgs("/project/root", "componentB").resolves({ host: "host1" });

    const result = await projectFilesOperator.isSameRemoteHost("/project/root", "componentA", "componentB");
    expect(result).to.be.true;
  });

  it("should return true if both components have matching remote host info", async ()=>{
    readComponentJsonByIDStub.withArgs("/project/root", "componentA").resolves({ host: "host1" });
    readComponentJsonByIDStub.withArgs("/project/root", "componentB").resolves({ host: "host2" });
    remoteHostQueryStub.withArgs("name", "host1").returns({ host: "sharedHost", user: "user", port: 22 });
    remoteHostQueryStub.withArgs("name", "host2").returns({ host: "sharedHost", user: "user", port: 22 });

    const result = await projectFilesOperator.isSameRemoteHost("/project/root", "componentA", "componentB");
    expect(result).to.be.true;
  });

  it("should return false if remote hosts do not match", async ()=>{
    readComponentJsonByIDStub.withArgs("/project/root", "componentA").resolves({ host: "host1" });
    readComponentJsonByIDStub.withArgs("/project/root", "componentB").resolves({ host: "host2" });
    remoteHostQueryStub.withArgs("name", "host1").returns({ host: "host1", name: "host1" });
    remoteHostQueryStub.withArgs("name", "host2").returns({ host: "host2", name: "host2" });

    const result = await projectFilesOperator.isSameRemoteHost("/project/root", "componentA", "componentB");
    expect(result).to.be.false;
  });

  it("should return true if dstHostInfo.sharedHost matches srcHostInfo.name", async ()=>{
    readComponentJsonByIDStub.withArgs("/project/root", "componentA").resolves({ host: "host1" });
    readComponentJsonByIDStub.withArgs("/project/root", "componentB").resolves({ host: "host2" });
    remoteHostQueryStub.withArgs("name", "host1").returns({ host: "host1", name: "host1" });
    remoteHostQueryStub.withArgs("name", "host2").returns({ sharedHost: "host1" });

    const result = await projectFilesOperator.isSameRemoteHost("/project/root", "componentA", "componentB");
    expect(result).to.be.true;
  });
});
