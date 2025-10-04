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


describe.skip("#getHosts", ()=>{
  let getHosts;
  let recursiveGetHostsMock;

  beforeEach(()=>{
    getHosts = projectFilesOperator._internal.getHosts;

    recursiveGetHostsMock = sinon.stub();
    projectFilesOperator._internal.recursiveGetHosts = recursiveGetHostsMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should call recursiveGetHosts with correct arguments", async ()=>{
    const projectRootDir = "/mock/project";
    const rootID = "rootComponent";
    recursiveGetHostsMock.resolves();

    await getHosts(projectRootDir, rootID);

    expect(recursiveGetHostsMock).to.be.calledOnceWithExactly(projectRootDir, rootID, [], [], []);
  });

  it("should correctly classify task and storage hosts", async ()=>{
    recursiveGetHostsMock.resolves();
    const projectRootDir = "/mock/project";
    const rootID = "rootComponent";

    const taskHosts = [{ hostname: "task1" }, { hostname: "task2" }];
    const storageHosts = [{ hostname: "storage1", isStorage: true }];

    recursiveGetHostsMock.callsFake(async (_, __, hosts, storageHostsList)=>{
      hosts.push(...taskHosts);
      storageHostsList.push(...storageHosts);
    });

    const result = await getHosts(projectRootDir, rootID);

    expect(result).to.deep.include.members([...storageHosts, ...taskHosts]);
  });

  it("should return an empty array if no hosts are found", async ()=>{
    recursiveGetHostsMock.resolves();
    const projectRootDir = "/mock/project";
    const rootID = "rootComponent";

    const result = await getHosts(projectRootDir, rootID);

    expect(result).to.deep.equal([]);
  });
});
