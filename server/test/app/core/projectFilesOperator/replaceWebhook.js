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


describe.skip("#replaceWebhook", ()=>{
  let rewireProjectFilesOperator;
  let replaceWebhook;

  //モック用
  let getProjectJsonMock;
  let writeProjectJsonMock;
  let diffMock;
  let diffApplyMock;

  beforeEach(()=>{
    //rewiredモジュール読込
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    replaceWebhook = rewireProjectFilesOperator.__get__("replaceWebhook");

    //sinon.stubでMockを作成
    getProjectJsonMock = sinon.stub();
    writeProjectJsonMock = sinon.stub();
    diffMock = sinon.stub();
    diffApplyMock = sinon.stub();

    //projectFilesOperator内部の呼び出しを__set__で差し替え
    rewireProjectFilesOperator.__set__({
      getProjectJson: getProjectJsonMock,
      writeProjectJson: writeProjectJsonMock,
      diff: diffMock,
      diffApply: diffApplyMock
    });
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

    getProjectJsonMock.resolves(mockProjectJson);
    writeProjectJsonMock.resolves();

    const result = await replaceWebhook(mockProjectRootDir, newWebhook);

    //返り値はundefinedのまま
    expect(result).to.deep.equal(undefined);

    //副作用確認: projectJson.webhookがnewWebhookになったか
    expect(writeProjectJsonMock.calledOnceWithExactly(
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

    //diffパッチのモック
    const mockPatch = [{ op: "replace", path: "/URL", value: "https://new.example.com" }];

    getProjectJsonMock.resolves(mockProjectJson);
    writeProjectJsonMock.resolves();
    diffMock.returns(mockPatch);
    diffApplyMock.callsFake((target, patch)=>{
      target.URL = patch[0].value;
      target.project = true;
      target.component = true;
    });

    const result = await replaceWebhook(mockProjectRootDir, newWebhook);

    //diff呼び出しの検証
    expect(diffMock.calledOnceWithExactly(existingWebhook, newWebhook)).to.be.true;
    expect(diffApplyMock.calledOnce).to.be.true;

    //更新後のprojectJsonを書き込み
    expect(writeProjectJsonMock.calledOnceWithExactly(mockProjectRootDir, {
      name: "testProject",
      webhook: existingWebhook //diffApply適用後のオブジェクト
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
    getProjectJsonMock.rejects(mockError);

    try {
      await replaceWebhook(mockProjectRootDir, newWebhook);
      throw new Error("Expected replaceWebhook to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    //他が呼ばれていないことを確認
    expect(writeProjectJsonMock.notCalled).to.be.true;
    expect(diffMock.notCalled).to.be.true;
    expect(diffApplyMock.notCalled).to.be.true;
  });

  it("should throw an error if writeProjectJson fails", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const newWebhook = { URL: "https://example.com/webhook", project: true, component: true };
    const existingWebhook = { URL: "https://old.example.com", project: false, component: false };
    const mockPatch = [{ op: "replace", path: "/URL", value: "https://example.com/webhook" }];

    getProjectJsonMock.resolves({ webhook: existingWebhook });
    diffMock.returns(mockPatch);
    diffApplyMock.callsFake((target, patch)=>{
      target.URL = patch[0].value;
      target.project = true;
      target.component = true;
    });

    //writeProjectJson失敗
    const mockError = new Error("Failed to write JSON");
    writeProjectJsonMock.rejects(mockError);

    try {
      await replaceWebhook(mockProjectRootDir, newWebhook);
      throw new Error("Expected replaceWebhook to throw");
    } catch (err) {
      expect(err).to.equal(mockError);
    }

    expect(getProjectJsonMock.calledOnce).to.be.true;
    expect(diffMock.calledOnce).to.be.true;
    expect(diffApplyMock.calledOnce).to.be.true;
    expect(writeProjectJsonMock.calledOnce).to.be.true;
  });
});
