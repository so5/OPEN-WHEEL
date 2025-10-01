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

describe("#replaceEnv", ()=>{
  let readComponentJsonByIDStub;
  let writeComponentJsonByIDStub;
  let diffStub;
  let diffApplyStub;
  let componentJson;

  beforeEach(()=>{
    readComponentJsonByIDStub = sinon.stub(projectFilesOperator._internal, "readComponentJsonByID");
    writeComponentJsonByIDStub = sinon.stub(projectFilesOperator._internal, "writeComponentJsonByID");
    diffStub = sinon.stub(projectFilesOperator._internal, "diff");
    diffApplyStub = sinon.stub(projectFilesOperator._internal, "diffApply");

    componentJson = {
      ID: "testComponent",
      env: { OLD_KEY: "old_value", UNUSED_KEY: "unused" }
    };
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should replace env with newEnv and write the updated component JSON", async ()=>{
    readComponentJsonByIDStub.resolves(componentJson);
    writeComponentJsonByIDStub.resolves();
    diffStub.returns([{ op: "replace", path: "/OLD_KEY", value: "new_value" }]);

    diffApplyStub.callsFake((target, _patch)=>{
      target.OLD_KEY = "new_value";
      delete target.UNUSED_KEY;
    });

    const newEnv = { OLD_KEY: "new_value" };

    const result = await projectFilesOperator.replaceEnv("/project/root", "testComponent", newEnv);

    expect(readComponentJsonByIDStub.calledOnceWithExactly("/project/root", "testComponent")).to.be.true;
    expect(diffStub.calledOnceWithExactly(componentJson.env, newEnv)).to.be.true;
    expect(diffApplyStub.calledOnce).to.be.true;
    expect(writeComponentJsonByIDStub.calledOnceWithExactly("/project/root", "testComponent", componentJson)).to.be.true;

    expect(result.env).to.deep.equal({ OLD_KEY: "new_value" });
  });

  it("should throw an error if readComponentJsonByID fails", async ()=>{
    const mockError = new Error("Failed to read component JSON");
    readComponentJsonByIDStub.rejects(mockError);

    try {
      await projectFilesOperator.replaceEnv("/project/root", "testComponent", {});
      throw new Error("Expected replaceEnv to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(readComponentJsonByIDStub.calledOnceWithExactly("/project/root", "testComponent")).to.be.true;
    expect(writeComponentJsonByIDStub.notCalled).to.be.true;
    expect(diffStub.notCalled).to.be.true;
    expect(diffApplyStub.notCalled).to.be.true;
  });

  it("should throw an error if writeComponentJsonByID fails", async ()=>{
    readComponentJsonByIDStub.resolves(componentJson);
    diffStub.returns([]);
    diffApplyStub.callsFake(()=>{});

    const mockError = new Error("Failed to write component JSON");
    writeComponentJsonByIDStub.rejects(mockError);

    try {
      await projectFilesOperator.replaceEnv("/project/root", "testComponent", { NEW_KEY: "new_value" });
      throw new Error("Expected replaceEnv to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(diffStub.calledOnce).to.be.true;
    expect(diffApplyStub.calledOnce).to.be.true;
    expect(writeComponentJsonByIDStub.calledOnce).to.be.true;
  });
});
