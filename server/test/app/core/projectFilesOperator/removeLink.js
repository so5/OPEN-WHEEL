/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import path from "path";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#removeLink", ()=>{
  let sandbox;
  let getComponentDirStub;
  let readComponentJsonStub;
  let writeComponentJsonStub;

  beforeEach(()=>{
    sandbox = sinon.createSandbox();
    getComponentDirStub = sandbox.stub(projectFilesOperator._internal, "getComponentDir");
    readComponentJsonStub = sandbox.stub(projectFilesOperator._internal, "readComponentJson");
    writeComponentJsonStub = sandbox.stub(projectFilesOperator._internal, "writeComponentJson").resolves();
  });

  afterEach(()=>{
    sandbox.restore();
  });

  it("should remove dst from srcJson.next when isElse is false, and remove src from dstJson.previous", async ()=>{
    const projectRootDir = "/mock/project/root";
    const src = "componentSrc";
    const dst = "componentDst";
    const isElse = false;

    const mockSrcDir = "/mock/project/root/srcDir";
    const mockDstDir = "/mock/project/root/dstDir";

    const mockSrcJson = {
      next: ["componentX", "componentDst", "componentY"],
      else: ["componentA"]
    };

    const mockDstJson = {
      previous: ["componentQ", "componentSrc", "componentW"]
    };

    getComponentDirStub.withArgs(projectRootDir, src, true).resolves(mockSrcDir);
    getComponentDirStub.withArgs(projectRootDir, dst, true).resolves(mockDstDir);

    readComponentJsonStub.withArgs(mockSrcDir).resolves(mockSrcJson);
    readComponentJsonStub.withArgs(mockDstDir).resolves(mockDstJson);

    await projectFilesOperator.removeLink(projectRootDir, src, dst, isElse);

    expect(mockSrcJson.next).to.deep.equal(["componentX", "componentY"]);
    expect(mockSrcJson.else).to.deep.equal(["componentA"]);
    expect(mockDstJson.previous).to.deep.equal(["componentQ", "componentW"]);

    expect(writeComponentJsonStub.callCount).to.equal(2);
    expect(writeComponentJsonStub.firstCall.args[1]).to.equal(mockSrcDir);
    expect(writeComponentJsonStub.firstCall.args[2]).to.equal(mockSrcJson);
    expect(writeComponentJsonStub.secondCall.args[1]).to.equal(mockDstDir);
    expect(writeComponentJsonStub.secondCall.args[2]).to.equal(mockDstJson);
  });

  it("should remove dst from srcJson.else when isElse is true, and remove src from dstJson.previous", async ()=>{
    const projectRootDir = "/mock/project/root";
    const src = "componentSrc";
    const dst = "componentDst";
    const isElse = true;

    const mockSrcDir = "/mock/project/root/srcDir";
    const mockDstDir = "/mock/project/root/dstDir";

    const mockSrcJson = {
      next: ["componentB"],
      else: ["componentDst", "componentC"]
    };

    const mockDstJson = {
      previous: ["componentSrc", "componentZ"]
    };

    getComponentDirStub.withArgs(projectRootDir, src, true).resolves(mockSrcDir);
    getComponentDirStub.withArgs(projectRootDir, dst, true).resolves(mockDstDir);

    readComponentJsonStub.withArgs(mockSrcDir).resolves(mockSrcJson);
    readComponentJsonStub.withArgs(mockDstDir).resolves(mockDstJson);

    await projectFilesOperator.removeLink(projectRootDir, src, dst, isElse);

    expect(mockSrcJson.else).to.deep.equal(["componentC"]);
    expect(mockSrcJson.next).to.deep.equal(["componentB"]);
    expect(mockDstJson.previous).to.deep.equal(["componentZ"]);
    expect(writeComponentJsonStub.callCount).to.equal(2);
  });

  it("should do nothing if dst does not exist in srcJson.next/else, and still remove src from dstJson.previous", async ()=>{
    const projectRootDir = "/mock/project/root";
    const src = "componentSrc";
    const dst = "notInArray";
    const isElse = false;

    const mockSrcDir = "/mock/project/root/srcDir";
    const mockDstDir = "/mock/project/root/dstDir";

    const mockSrcJson = {
      next: ["componentX", "componentY"],
      else: []
    };
    const mockDstJson = {
      previous: ["componentSrc", "componentQ"]
    };

    getComponentDirStub.withArgs(projectRootDir, src, true).resolves(mockSrcDir);
    getComponentDirStub.withArgs(projectRootDir, dst, true).resolves(mockDstDir);

    readComponentJsonStub.withArgs(mockSrcDir).resolves(mockSrcJson);
    readComponentJsonStub.withArgs(mockDstDir).resolves(mockDstJson);

    await projectFilesOperator.removeLink(projectRootDir, src, dst, isElse);

    expect(mockSrcJson.next).to.deep.equal(["componentX", "componentY"]);
    expect(mockDstJson.previous).to.deep.equal(["componentQ"]);
    expect(writeComponentJsonStub.callCount).to.equal(2);
  });

  it("should do nothing if src does not exist in dstJson.previous, but still remove dst from srcJson", async ()=>{
    const projectRootDir = "/mock/project/root";
    const src = "componentSrc";
    const dst = "componentDst";
    const isElse = false;

    const mockSrcDir = "/mock/project/root/srcDir";
    const mockDstDir = "/mock/project/root/dstDir";

    const mockSrcJson = {
      next: ["componentDst", "componentK"],
      else: []
    };
    const mockDstJson = {
      previous: ["componentM", "componentN"]
    };

    getComponentDirStub.withArgs(projectRootDir, src, true).resolves(mockSrcDir);
    getComponentDirStub.withArgs(projectRootDir, dst, true).resolves(mockDstDir);

    readComponentJsonStub.withArgs(mockSrcDir).resolves(mockSrcJson);
    readComponentJsonStub.withArgs(mockDstDir).resolves(mockDstJson);

    await projectFilesOperator.removeLink(projectRootDir, src, dst, isElse);

    expect(mockSrcJson.next).to.deep.equal(["componentK"]);
    expect(mockDstJson.previous).to.deep.equal(["componentM", "componentN"]);
    expect(writeComponentJsonStub.callCount).to.equal(2);
  });
});
