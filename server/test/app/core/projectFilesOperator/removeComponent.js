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

describe("#removeComponent", ()=>{
  let getComponentDirStub;
  let getDescendantsIDsStub;
  let removeAllLinkFromComponentStub;
  let gitRmStub;
  let fsRemoveStub;
  let removeComponentPathStub;
  const projectRootDir = "/mock/project/root";
  const componentID = "compA";

  beforeEach(()=>{
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir").resolves("/mock/targetDir");
    getDescendantsIDsStub = sinon.stub(projectFilesOperator._internal, "getDescendantsIDs").resolves(["compA", "compB", "compC"]);
    removeAllLinkFromComponentStub = sinon.stub(projectFilesOperator._internal, "removeAllLinkFromComponent").resolves();
    gitRmStub = sinon.stub(projectFilesOperator._internal, "gitRm").resolves();
    fsRemoveStub = sinon.stub(projectFilesOperator._internal.fs, "remove").resolves();
    removeComponentPathStub = sinon.stub(projectFilesOperator._internal, "removeComponentPath").resolves("removePathResult");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should remove the component and all its descendants successfully", async ()=>{
    const result = await projectFilesOperator._internal.removeComponent(projectRootDir, componentID);

    expect(getComponentDirStub.calledOnceWith(projectRootDir, componentID, true)).to.be.true;
    expect(getDescendantsIDsStub.calledOnceWith(projectRootDir, componentID)).to.be.true;
    expect(removeAllLinkFromComponentStub.callCount).to.equal(3);
    expect(removeAllLinkFromComponentStub.getCall(0).args).to.deep.equal([projectRootDir, "compA"]);
    expect(removeAllLinkFromComponentStub.getCall(1).args).to.deep.equal([projectRootDir, "compB"]);
    expect(removeAllLinkFromComponentStub.getCall(2).args).to.deep.equal([projectRootDir, "compC"]);
    expect(gitRmStub.calledOnceWith(projectRootDir, "/mock/targetDir")).to.be.true;
    expect(fsRemoveStub.calledOnceWith("/mock/targetDir")).to.be.true;
    expect(removeComponentPathStub.calledOnceWith(projectRootDir, ["compA", "compB", "compC"])).to.be.true;
    expect(result).to.equal("removePathResult");
  });

  const testCases = [
    { stub: "getComponentDir", error: "Failed to get component dir" },
    { stub: "getDescendantsIDs", error: "Failed to get descendants" },
    { stub: "removeAllLinkFromComponent", error: "removeAllLinkFromComponent error" },
    { stub: "gitRm", error: "Failed gitRm" },
    { stub: "fsRemove", error: "Failed fsRemove" },
    { stub: "removeComponentPath", error: "Failed removeComponentPath" }
  ];

  for (const { stub, error } of testCases) {
    it(`should throw an error if ${stub} fails`, async ()=>{
      let targetStub;
      if (stub === "fsRemove") {
        targetStub = fsRemoveStub;
      } else {
        targetStub = {
          getComponentDir: getComponentDirStub,
          getDescendantsIDs: getDescendantsIDsStub,
          removeAllLinkFromComponent: removeAllLinkFromComponentStub,
          gitRm: gitRmStub,
          removeComponentPath: removeComponentPathStub
        }[stub];
      }
      targetStub.rejects(new Error(error));

      try {
        await projectFilesOperator._internal.removeComponent(projectRootDir, componentID);
        throw new Error("should have been rejected");
      } catch (err) {
        expect(err.message).to.equal(error);
      }
    });
  }
});
