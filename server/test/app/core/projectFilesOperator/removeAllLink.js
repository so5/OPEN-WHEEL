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

describe("#removeAllLink", ()=>{
  let getComponentDirStub;
  let readComponentJsonStub;
  let writeComponentJsonStub;
  const projectRootDir = "/mock/project/root";
  const componentID = "dstCompID";
  const dstDir = "/mock/project/root/dstDir";

  beforeEach(()=>{
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
    readComponentJsonStub = sinon.stub(projectFilesOperator._internal, "readComponentJson");
    writeComponentJsonStub = sinon.stub(projectFilesOperator._internal, "writeComponentJson").resolves();
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should do nothing when dstJson.previous is an empty array", async ()=>{
    getComponentDirStub.withArgs(projectRootDir, componentID, true).resolves(dstDir);
    readComponentJsonStub.withArgs(dstDir).resolves({ previous: [] });

    await projectFilesOperator.removeAllLink(projectRootDir, componentID);

    expect(getComponentDirStub.calledOnce).to.be.true;
    expect(readComponentJsonStub.calledOnce).to.be.true;
    expect(writeComponentJsonStub.calledOnce).to.be.true;
    const [writtenRootDir, writtenDir, writtenJson] = writeComponentJsonStub.firstCall.args;
    expect(writtenRootDir).to.equal(projectRootDir);
    expect(writtenDir).to.equal(dstDir);
    expect(writtenJson).to.deep.equal({ previous: [] });
  });

  it("should remove componentID from srcJson's next and else arrays", async ()=>{
    getComponentDirStub.withArgs(projectRootDir, componentID, true).resolves(dstDir);
    readComponentJsonStub.withArgs(dstDir).resolves({ previous: ["srcCompA", "srcCompB"] });

    const srcDirA = "/mock/project/root/srcCompA";
    const srcJsonA = { next: [componentID, "anotherID"], else: ["otherID", componentID] };
    getComponentDirStub.withArgs(projectRootDir, "srcCompA", true).resolves(srcDirA);
    readComponentJsonStub.withArgs(srcDirA).resolves(srcJsonA);

    const srcDirB = "/mock/project/root/srcCompB";
    const srcJsonB = { next: ["someID"], else: ["x", "y"] };
    getComponentDirStub.withArgs(projectRootDir, "srcCompB", true).resolves(srcDirB);
    readComponentJsonStub.withArgs(srcDirB).resolves(srcJsonB);

    await projectFilesOperator.removeAllLink(projectRootDir, componentID);

    expect(getComponentDirStub.callCount).to.equal(3);
    expect(readComponentJsonStub.callCount).to.equal(3);
    expect(writeComponentJsonStub.callCount).to.equal(3);

    const writtenJsonA = writeComponentJsonStub.getCall(0).args[2];
    expect(writtenJsonA.next).to.deep.equal(["anotherID"]);
    expect(writtenJsonA.else).to.deep.equal(["otherID"]);

    const writtenJsonB = writeComponentJsonStub.getCall(1).args[2];
    expect(writtenJsonB.next).to.deep.equal(["someID"]);
    expect(writtenJsonB.else).to.deep.equal(["x", "y"]);

    const writtenDstJson = writeComponentJsonStub.getCall(2).args[2];
    expect(writtenDstJson.previous).to.deep.equal([]);
  });

  it("should not modify srcJson.next if it is not an array", async ()=>{
    getComponentDirStub.withArgs(projectRootDir, componentID, true).resolves(dstDir);
    readComponentJsonStub.withArgs(dstDir).resolves({ previous: ["srcCompC"] });

    const srcDirC = "/mock/project/root/srcCompC";
    const srcJsonC = { next: "not-an-array", else: [componentID] };
    getComponentDirStub.withArgs(projectRootDir, "srcCompC", true).resolves(srcDirC);
    readComponentJsonStub.withArgs(srcDirC).resolves(srcJsonC);

    await projectFilesOperator.removeAllLink(projectRootDir, componentID);

    expect(writeComponentJsonStub.callCount).to.equal(2);
    const writtenJsonC = writeComponentJsonStub.getCall(0).args[2];
    expect(writtenJsonC.next).to.equal("not-an-array");
    expect(writtenJsonC.else).to.deep.equal([]);
  });

  it("should not modify srcJson.else if it is not an array", async ()=>{
    getComponentDirStub.withArgs(projectRootDir, componentID, true).resolves(dstDir);
    readComponentJsonStub.withArgs(dstDir).resolves({ previous: ["srcCompD"] });

    const srcDirD = "/mock/project/root/srcCompD";
    const srcJsonD = { next: [componentID], else: "not-an-array" };
    getComponentDirStub.withArgs(projectRootDir, "srcCompD", true).resolves(srcDirD);
    readComponentJsonStub.withArgs(srcDirD).resolves(srcJsonD);

    await projectFilesOperator.removeAllLink(projectRootDir, componentID);

    expect(writeComponentJsonStub.callCount).to.equal(2);
    const writtenJsonD = writeComponentJsonStub.getCall(0).args[2];
    expect(writtenJsonD.next).to.deep.equal([]);
    expect(writtenJsonD.else).to.equal("not-an-array");
  });
});