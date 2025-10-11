/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#isParent", ()=>{
  let readComponentJsonByIDStub;

  beforeEach(()=>{
    readComponentJsonByIDStub = sinon.stub(projectFilesOperator._internal, "readComponentJsonByID");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return true if parentID is 'parent'", async ()=>{
    const result = await projectFilesOperator._internal.isParent("/mock/project", "parent", "childID");
    expect(result).to.be.true;
    expect(readComponentJsonByIDStub.notCalled).to.be.true;
  });

  it("should return false if childID is 'parent'", async ()=>{
    const result = await projectFilesOperator._internal.isParent("/mock/project", "parentID", "parent");
    expect(result).to.be.false;
    expect(readComponentJsonByIDStub.notCalled).to.be.true;
  });

  it("should return false if childJson is null", async ()=>{
    readComponentJsonByIDStub.resolves(null);

    const result = await projectFilesOperator._internal.isParent("/mock/project", "parentID", "childID");
    expect(result).to.be.false;
    expect(readComponentJsonByIDStub.calledOnceWith("/mock/project", "childID")).to.be.true;
  });

  it("should return false if childID is not a string", async ()=>{
    const result = await projectFilesOperator._internal.isParent("/mock/project", "parentID", 123);
    expect(result).to.be.false;
    expect(readComponentJsonByIDStub.calledOnceWith("/mock/project", 123)).to.be.true;
  });

  it("should return true if childJson.parent matches parentID", async ()=>{
    readComponentJsonByIDStub.resolves({ parent: "parentID" });

    const result = await projectFilesOperator._internal.isParent("/mock/project", "parentID", "childID");
    expect(result).to.be.true;
    expect(readComponentJsonByIDStub.calledOnceWith("/mock/project", "childID")).to.be.true;
  });

  it("should return false if childJson.parent does not match parentID", async ()=>{
    readComponentJsonByIDStub.resolves({ parent: "otherParentID" });

    const result = await projectFilesOperator._internal.isParent("/mock/project", "parentID", "childID");
    expect(result).to.be.false;
    expect(readComponentJsonByIDStub.calledOnceWith("/mock/project", "childID")).to.be.true;
  });
});
