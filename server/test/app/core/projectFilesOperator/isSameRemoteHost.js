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


describe.skip("#isSameRemoteHost", ()=>{
  let isSameRemoteHost;
  let readComponentJsonByIDMock;
  let remoteHostMock;

  beforeEach(()=>{
    isSameRemoteHost = projectFilesOperator._internal.isSameRemoteHost;

    readComponentJsonByIDMock = sinon.stub();
    remoteHostMock = {
      query: sinon.stub()
    };

    projectFilesOperator._internal.readComponentJsonByID = readComponentJsonByIDMock;
    projectFilesOperator._internal.remoteHost = remoteHostMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return null if src and dst are the same", async ()=>{
    const result = await isSameRemoteHost("/project/root", "componentA", "componentA");
    expect(result).to.be.null;
  });

  it("should return false if either component is local", async ()=>{
    readComponentJsonByIDMock
      .withArgs("/project/root", "componentA").resolves({ host: "localhost" })
      .withArgs("/project/root", "componentB")
      .resolves({ host: "host1" });

    const result = await isSameRemoteHost("/project/root", "componentA", "componentB");
    expect(result).to.be.false;
  });

  it("should return true if both components have the same host name", async ()=>{
    readComponentJsonByIDMock
      .withArgs("/project/root", "componentA").resolves({ host: "host1" })
      .withArgs("/project/root", "componentB")
      .resolves({ host: "host1" });

    const result = await isSameRemoteHost("/project/root", "componentA", "componentB");
    expect(result).to.be.true;
  });

  it("should return true if both components have matching remote host info", async ()=>{
    readComponentJsonByIDMock
      .withArgs("/project/root", "componentA").resolves({ host: "host1" })
      .withArgs("/project/root", "componentB")
      .resolves({ host: "host2" });
    remoteHostMock.query
      .withArgs("name", "host1").returns({ host: "sharedHost", port: 22 })
      .withArgs("name", "host2")
      .returns({ host: "sharedHost", port: 22 });

    const result = await isSameRemoteHost("/project/root", "componentA", "componentB");
    expect(result).to.be.true;
  });

  it("should return false if remote hosts do not match", async ()=>{
    readComponentJsonByIDMock
      .withArgs("/project/root", "componentA").resolves({ host: "host1" })
      .withArgs("/project/root", "componentB")
      .resolves({ host: "host2" });
    remoteHostMock.query
      .withArgs("name", "host1").returns({ host: "host1", port: 22, sharedHost: "host1", name: "host1" })
      .withArgs("name", "host2")
      .returns({ host: "host2", port: 22, sharedHost: "host2", name: "host2" });

    const result = await isSameRemoteHost("/project/root", "componentA", "componentB");
    expect(result).to.be.false;
  });

  it("should return true if dstHostInfo.sharedHost matches srcHostInfo.name", async ()=>{
    readComponentJsonByIDMock
      .withArgs("/project/root", "componentA").resolves({ host: "host1" })
      .withArgs("/project/root", "componentB")
      .resolves({ host: "host2" });
    remoteHostMock.query
      .withArgs("name", "host1").returns({ host: "host1", name: "host1" })
      .withArgs("name", "host2")
      .returns({ sharedHost: "host1" });

    const result = await isSameRemoteHost("/project/root", "componentA", "componentB");
    expect(result).to.be.true;
  });
});
