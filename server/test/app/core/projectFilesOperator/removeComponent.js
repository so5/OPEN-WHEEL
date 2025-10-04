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


describe.skip("#removeComponent", ()=>{
  let rewireProjectFilesOperator;
  let removeComponent;
  let getComponentDirMock;
  let getDescendantsIDsMock;
  let removeAllLinkFromComponentMock;
  let gitRmMock;
  let fsRemoveMock;
  let removeComponentPathMock;

  beforeEach(()=>{
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    removeComponent = rewireProjectFilesOperator.__get__("removeComponent");

    //モック／スタブの用意
    getComponentDirMock = sinon.stub().resolves("/mock/targetDir");
    getDescendantsIDsMock = sinon.stub().resolves(["compA", "compB", "compC"]);
    removeAllLinkFromComponentMock = sinon.stub().resolves();
    gitRmMock = sinon.stub().resolves();
    fsRemoveMock = sinon.stub().resolves();
    removeComponentPathMock = sinon.stub().resolves("removePathResult");

    //rewireで本体に差し込む
    rewireProjectFilesOperator.__set__({
      getComponentDir: getComponentDirMock,
      getDescendantsIDs: getDescendantsIDsMock,
      removeAllLinkFromComponent: removeAllLinkFromComponentMock,
      gitRm: gitRmMock,
      fs: {
        remove: fsRemoveMock
      },
      removeComponentPath: removeComponentPathMock
    });
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should remove the component and all its descendants successfully", async ()=>{
    const projectRootDir = "/mock/project/root";
    const componentID = "compA";

    const result = await removeComponent(projectRootDir, componentID);

    //各stubが正しく呼ばれたかの検証
    expect(getComponentDirMock.calledOnceWithExactly(projectRootDir, componentID, true)).to.be.true;
    expect(getDescendantsIDsMock.calledOnceWithExactly(projectRootDir, componentID)).to.be.true;

    //3つのdescendantID（["compA", "compB", "compC"]）それぞれにremoveAllLinkFromComponentが呼ばれる
    expect(removeAllLinkFromComponentMock.callCount).to.equal(3);
    expect(removeAllLinkFromComponentMock.getCall(0).args).to.deep.equal([projectRootDir, "compA"]);
    expect(removeAllLinkFromComponentMock.getCall(1).args).to.deep.equal([projectRootDir, "compB"]);
    expect(removeAllLinkFromComponentMock.getCall(2).args).to.deep.equal([projectRootDir, "compC"]);

    expect(gitRmMock.calledOnceWithExactly(projectRootDir, "/mock/targetDir")).to.be.true;
    expect(fsRemoveMock.calledOnceWithExactly("/mock/targetDir")).to.be.true;
    expect(removeComponentPathMock.calledOnceWithExactly(projectRootDir, ["compA", "compB", "compC"])).to.be.true;

    //戻り値の検証
    expect(result).to.equal("removePathResult");
  });

  it("should throw an error if getComponentDir fails", async ()=>{
    getComponentDirMock.rejects(new Error("Failed to get component dir"));
    await expect(removeComponent("/mock/project/root", "compA"))
      .to.be.rejectedWith("Failed to get component dir");
  });

  it("should throw an error if getDescendantsIDs fails", async ()=>{
    getDescendantsIDsMock.rejects(new Error("Failed to get descendants"));
    await expect(removeComponent("/mock/project/root", "compA"))
      .to.be.rejectedWith("Failed to get descendants");
  });

  it("should throw an error if removeAllLinkFromComponent fails for one descendant", async ()=>{
    //二番目の呼び出しでエラーを投げる
    removeAllLinkFromComponentMock.onCall(1).rejects(new Error("removeAllLinkFromComponent error"));

    await expect(removeComponent("/mock/project/root", "compA"))
      .to.be.rejectedWith("removeAllLinkFromComponent error");

    //エラーが起きる前には1回だけ呼ばれている
    expect(removeAllLinkFromComponentMock.callCount).to.equal(2);
  });

  it("should throw an error if gitRm fails", async ()=>{
    gitRmMock.rejects(new Error("Failed gitRm"));
    await expect(removeComponent("/mock/project/root", "compA"))
      .to.be.rejectedWith("Failed gitRm");
  });

  it("should throw an error if fs.remove fails", async ()=>{
    fsRemoveMock.rejects(new Error("Failed fsRemove"));
    await expect(removeComponent("/mock/project/root", "compA"))
      .to.be.rejectedWith("Failed fsRemove");
  });

  it("should throw an error if removeComponentPath fails", async ()=>{
    removeComponentPathMock.rejects(new Error("Failed removeComponentPath"));
    await expect(removeComponent("/mock/project/root", "compA"))
      .to.be.rejectedWith("Failed removeComponentPath");
  });
});
