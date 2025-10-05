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


describe("#replaceWebhook", ()=>{
  let getProjectJsonStub;
  let writeProjectJsonStub;
  let diffStub;
  let diffApplyStub;

  beforeEach(()=>{
    getProjectJsonStub = sinon.stub(projectFilesOperator._internal, "getProjectJson");
    writeProjectJsonStub = sinon.stub(projectFilesOperator._internal, "writeProjectJson");
    diffStub = sinon.stub(projectFilesOperator._internal, "diff");
    diffApplyStub = sinon.stub(projectFilesOperator._internal, "diffApply");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should set the new webhook if the existing one is undefined", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const newWebhook = {
      URL: "https://example.com/webhook",
      project: true,
      component: true
    };

    const mockProjectJson = {
      name: "testProject",
      webhook: undefined
    };

    getProjectJsonStub.resolves(mockProjectJson);
    writeProjectJsonStub.resolves();

    const result = await projectFilesOperator.replaceWebhook(mockProjectRootDir, newWebhook);

    expect(result).to.deep.equal(undefined);

    expect(writeProjectJsonStub.calledOnceWithExactly(
      mockProjectRootDir,
      {
        name: "testProject",
        webhook: newWebhook
      }
    )).to.be.true;
  });

  it("should diff and apply patch if the existing webhook is not undefined", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const existingWebhook = {
      URL: "https://old.example.com",
      project: false,
      component: false
    };
    const newWebhook = {
      URL: "https://new.example.com",
      project: true,
      component: true
    };

    const mockProjectJson = {
      name: "testProject",
      webhook: existingWebhook
    };

    const mockPatch = [{ op: "replace", path: "/URL", value: "https://new.example.com" }];

    getProjectJsonStub.resolves(mockProjectJson);
    writeProjectJsonStub.resolves();
    diffStub.returns(mockPatch);
    diffApplyStub.callsFake((target, patch)=>{
      target.URL = patch[0].value;
      target.project = true;
      target.component = true;
    });

    const result = await projectFilesOperator.replaceWebhook(mockProjectRootDir, newWebhook);

    expect(diffStub.calledOnceWithExactly(existingWebhook, newWebhook)).to.be.true;
    expect(diffApplyStub.calledOnce).to.be.true;

    expect(writeProjectJsonStub.calledOnceWithExactly(mockProjectRootDir, {
      name: "testProject",
      webhook: existingWebhook
    })).to.be.true;

    expect(result).to.deep.equal({
      URL: "https://new.example.com",
      project: true,
      component: true
    });
  });

  it("should throw an error if getProjectJson fails", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const newWebhook = { URL: "https://example.com/webhook", project: true, component: true };

    const mockError = new Error("Failed to read project JSON");
    getProjectJsonStub.rejects(mockError);

    try {
      await projectFilesOperator.replaceWebhook(mockProjectRootDir, newWebhook);
      throw new Error("Expected replaceWebhook to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(writeProjectJsonStub.notCalled).to.be.true;
    expect(diffStub.notCalled).to.be.true;
    expect(diffApplyStub.notCalled).to.be.true;
  });

  it("should throw an error if writeProjectJson fails", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const newWebhook = { URL: "https://example.com/webhook", project: true, component: true };
    const existingWebhook = { URL: "https://old.example.com", project: false, component: false };
    const mockPatch = [{ op: "replace", path: "/URL", value: "https://example.com/webhook" }];

    getProjectJsonStub.resolves({ webhook: existingWebhook });
    diffStub.returns(mockPatch);
    diffApplyStub.callsFake((target, patch)=>{
      target.URL = patch[0].value;
      target.project = true;
      target.component = true;
    });

    const mockError = new Error("Failed to write JSON");
    writeProjectJsonStub.rejects(mockError);

    try {
      await projectFilesOperator.replaceWebhook(mockProjectRootDir, newWebhook);
      throw new Error("Expected replaceWebhook to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(getProjectJsonStub.calledOnce).to.be.true;
    expect(diffStub.calledOnce).to.be.true;
    expect(diffApplyStub.calledOnce).to.be.true;
    expect(writeProjectJsonStub.calledOnce).to.be.true;
  });
});
