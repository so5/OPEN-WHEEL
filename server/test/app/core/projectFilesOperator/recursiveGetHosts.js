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

describe("#recursiveGetHosts", ()=>{
  let getChildrenStub;
  let hasChildStub;

  beforeEach(()=>{
    getChildrenStub = sinon.stub(projectFilesOperator._internal, "getChildren");
    hasChildStub = sinon.stub(projectFilesOperator._internal, "hasChild");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should not add any hosts if there are no children", async ()=>{
    getChildrenStub.resolves([]);
    const hosts = [];
    const storageHosts = [];
    const gfarmHosts = [];

    await projectFilesOperator._internal.recursiveGetHosts("mockProjectRoot", "rootID", hosts, storageHosts, gfarmHosts);

    expect(hosts).to.be.empty;
    expect(storageHosts).to.be.empty;
    expect(gfarmHosts).to.be.empty;
  });

  it("should add task component hosts correctly", async ()=>{
    const taskComponent = { ID: "comp1", type: "task", host: "remote1" };
    getChildrenStub.resolves([taskComponent]);
    hasChildStub.withArgs(taskComponent).returns(false);
    const hosts = [];
    const storageHosts = [];
    const gfarmHosts = [];

    await projectFilesOperator._internal.recursiveGetHosts("mockProjectRoot", "rootID", hosts, storageHosts, gfarmHosts);

    expect(hosts).to.deep.equal([{ hostname: "remote1" }]);
    expect(storageHosts).to.be.empty;
  });

  it("should add storage component hosts correctly", async ()=>{
    const storageComponent = { ID: "comp2", type: "storage", host: "storage1" };
    getChildrenStub.resolves([storageComponent]);
    hasChildStub.withArgs(storageComponent).returns(false);
    const hosts = [];
    const storageHosts = [];
    const gfarmHosts = [];

    await projectFilesOperator._internal.recursiveGetHosts("mockProjectRoot", "rootID", hosts, storageHosts, gfarmHosts);

    expect(hosts).to.be.empty;
    expect(storageHosts).to.deep.equal([{ hostname: "storage1", isStorage: true }]);
  });

  it("should skip disabled components", async ()=>{
    getChildrenStub.resolves([{ ID: "comp3", type: "task", host: "remote2", disable: true }]);
    hasChildStub.returns(false);
    const hosts = [];
    const storageHosts = [];
    const gfarmHosts = [];

    await projectFilesOperator._internal.recursiveGetHosts("mockProjectRoot", "rootID", hosts, storageHosts, gfarmHosts);

    expect(hosts).to.be.empty;
    expect(storageHosts).to.be.empty;
  });

  it("should skip localhost components", async ()=>{
    getChildrenStub.resolves([{ ID: "comp4", type: "task", host: "localhost" }]);
    hasChildStub.returns(false);
    const hosts = [];
    const storageHosts = [];
    const gfarmHosts = [];

    await projectFilesOperator._internal.recursiveGetHosts("mockProjectRoot", "rootID", hosts, storageHosts, gfarmHosts);

    expect(hosts).to.be.empty;
    expect(storageHosts).to.be.empty;
  });

  it("should recursively add child hosts", async ()=>{
    const parentComponent = { ID: "comp5", type: "for", host: "remote3" };
    const childComponent = { ID: "comp6", type: "task", host: "remote4" };

    getChildrenStub.onFirstCall().resolves([parentComponent]);
    getChildrenStub.onSecondCall().resolves([childComponent]);
    hasChildStub.withArgs(parentComponent).returns(true);
    hasChildStub.withArgs(childComponent).returns(false);
    const hosts = [];
    const storageHosts = [];
    const gfarmHosts = [];

    await projectFilesOperator._internal.recursiveGetHosts("mockProjectRoot", "rootID", hosts, storageHosts, gfarmHosts);

    //parent is not a task, so it should not be added.
    expect(hosts).to.deep.equal([{ hostname: "remote4" }]);
    expect(storageHosts).to.be.empty;
  });
});
