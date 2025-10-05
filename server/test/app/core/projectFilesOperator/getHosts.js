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

describe("#getHosts", ()=>{
  let recursiveGetHostsStub;

  beforeEach(()=>{
    recursiveGetHostsStub = sinon.stub(projectFilesOperator._internal, "recursiveGetHosts");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should call recursiveGetHosts with correct initial arguments", async ()=>{
    const projectRootDir = "/mock/project";
    const rootID = "rootComponent";
    recursiveGetHostsStub.resolves();

    await projectFilesOperator.getHosts(projectRootDir, rootID);

    expect(recursiveGetHostsStub.calledOnceWith(projectRootDir, rootID, [], [], [])).to.be.true;
  });

  it("should correctly classify and combine hosts, removing duplicates", async ()=>{
    const projectRootDir = "/mock/project";
    const rootID = "rootComponent";

    recursiveGetHostsStub.callsFake(async (projectRootDir, rootID, hosts, storageHosts, gfarmHosts)=>{
      hosts.push({ hostname: "task1" }, { hostname: "task2" }, { hostname: "task1" });
      storageHosts.push({ hostname: "storage1", isStorage: true }, { hostname: "storage1", isStorage: true });
      gfarmHosts.push({ hostname: "gfarm1", isGfarm: true });
    });

    const result = await projectFilesOperator.getHosts(projectRootDir, rootID);

    expect(result).to.have.deep.members([
      { hostname: "storage1", isStorage: true },
      { hostname: "gfarm1", isGfarm: true },
      { hostname: "task1" },
      { hostname: "task2" }
    ]);
  });

  it("should not include task hosts that are already listed as storage or gfarm hosts", async ()=>{
    const projectRootDir = "/mock/project";
    const rootID = "rootComponent";

    recursiveGetHostsStub.callsFake(async (projectRootDir, rootID, hosts, storageHosts, gfarmHosts)=>{
      hosts.push({ hostname: "host1" }, { hostname: "host2" });
      storageHosts.push({ hostname: "host1", isStorage: true });
      gfarmHosts.push({ hostname: "host2", isGfarm: true });
    });

    const result = await projectFilesOperator.getHosts(projectRootDir, rootID);

    expect(result).to.have.deep.members([
      { hostname: "host1", isStorage: true },
      { hostname: "host2", isGfarm: true }
    ]);
    expect(result.filter((h)=>!h.isStorage && !h.isGfarm)).to.be.empty;
  });

  it("should return an empty array if no hosts are found", async ()=>{
    const projectRootDir = "/mock/project";
    const rootID = "rootComponent";
    recursiveGetHostsStub.resolves();

    const result = await projectFilesOperator.getHosts(projectRootDir, rootID);

    expect(result).to.deep.equal([]);
  });
});