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


describe.skip("#recursiveGetHosts", ()=>{
  let recursiveGetHosts, getChildrenMock, hasChildMock;

  beforeEach(()=>{
    recursiveGetHosts = projectFilesOperator._internal.recursiveGetHosts;

    getChildrenMock = sinon.stub();
    hasChildMock = sinon.stub();

    projectFilesOperator._internal.getChildren = getChildrenMock;
    projectFilesOperator._internal.hasChild = hasChildMock;
  });

  it("should not add any hosts if there are no children", async ()=>{
    getChildrenMock.resolves([]);
    const hosts = [];
    const storageHosts = [];

    await recursiveGetHosts("mockProjectRoot", "rootID", hosts, storageHosts);

    expect(hosts).to.be.empty;
    expect(storageHosts).to.be.empty;
  });

  it("should add task component hosts correctly", async ()=>{
    getChildrenMock.resolves([{ ID: "comp1", type: "task", host: "remote1" }]);
    hasChildMock.returns(false);

    const hosts = [];
    const storageHosts = [];

    await recursiveGetHosts("mockProjectRoot", "rootID", hosts, storageHosts);

    expect(hosts).to.deep.equal([{ hostname: "remote1" }]);
    expect(storageHosts).to.be.empty;
  });

  it("should add storage component hosts correctly", async ()=>{
    getChildrenMock.resolves([{ ID: "comp2", type: "storage", host: "storage1" }]);
    hasChildMock.returns(false);

    const hosts = [];
    const storageHosts = [];

    await recursiveGetHosts("mockProjectRoot", "rootID", hosts, storageHosts);

    expect(hosts).to.be.empty;
    expect(storageHosts).to.deep.equal([{ hostname: "storage1", isStorage: true }]);
  });

  it("should skip disabled components", async ()=>{
    getChildrenMock.resolves([{ ID: "comp3", type: "task", host: "remote2", disable: true }]);
    hasChildMock.returns(false);

    const hosts = [];
    const storageHosts = [];

    await recursiveGetHosts("mockProjectRoot", "rootID", hosts, storageHosts);

    expect(hosts).to.be.empty;
    expect(storageHosts).to.be.empty;
  });

  it("should skip localhost components", async ()=>{
    getChildrenMock.resolves([{ ID: "comp4", type: "task", host: "localhost" }]);
    hasChildMock.returns(false);

    const hosts = [];
    const storageHosts = [];

    await recursiveGetHosts("mockProjectRoot", "rootID", hosts, storageHosts);

    expect(hosts).to.be.empty;
    expect(storageHosts).to.be.empty;
  });

  it("should recursively add child hosts", async ()=>{
    getChildrenMock.onFirstCall().resolves([{ ID: "comp5", type: "for", host: "remote3" }]);
    getChildrenMock.onSecondCall().resolves([{ ID: "comp6", type: "task", host: "remote4" }]);

    hasChildMock.withArgs({ ID: "comp5", type: "for", host: "remote3" }).returns(true);
    hasChildMock.withArgs({ ID: "comp6", type: "task", host: "remote4" }).returns(false);

    const hosts = [];
    const storageHosts = [];

    await recursiveGetHosts("mockProjectRoot", "rootID", hosts, storageHosts);

    expect(hosts).to.deep.equal([{ hostname: "remote4" }]);
    expect(storageHosts).to.be.empty;
  });
});
