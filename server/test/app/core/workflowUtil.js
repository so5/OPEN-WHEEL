/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";

const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const { getThreeGenerationFamily, getChildren, _internal } = require("../../../app/core/workflowUtil.js");

describe("#getThreeGenerationFamily", ()=>{
  beforeEach(()=>{
    //依存関数をSinon.stub() でモック化
    sinon.stub(_internal, "readComponentJson");
    sinon.stub(_internal, "getChildren");
    sinon.stub(_internal, "hasChild");
  });

  afterEach(()=>{
    //テストごとに stub/spy をリセット
    sinon.restore();
  });

  it("should return a root component with empty descendants if no children exist", async ()=>{
    //-- 準備 --
    //readComponentJson は ルートコンポーネントのJSONを返す
    _internal.readComponentJson.resolves({
      ID: "rootID",
      type: "workflow"
    });

    //getChildren は 空配列を返す => 子供なし
    _internal.getChildren.resolves([]);

    //-- 実行 --
    const result = await getThreeGenerationFamily("/dummy/projectRoot", "/dummy/rootComponentDir");

    //-- 検証 --
    expect(result).to.have.property("ID", "rootID");
    expect(result).to.have.property("type", "workflow");
    expect(result).to.have.property("descendants").that.is.an("array").with.lengthOf(0);

    //stub が正しく呼ばれたか(参考)
    expect(_internal.readComponentJson.calledOnceWithExactly("/dummy/rootComponentDir")).to.be.true;
    expect(_internal.getChildren.calledOnceWithExactly("/dummy/projectRoot", "rootID")).to.be.true;
  });

  it("should remove handler from each child if present, but skip grandsons if hasChild is false", async ()=>{
    //-- 準備 --
    //ルートコンポーネント
    _internal.readComponentJson.resolves({
      ID: "rootID",
      type: "workflow"
    });
    //直下の子供を2つ用意
    const child1 = { ID: "child1ID", type: "group", handler: "someHandlerValue" };
    const child2 = { ID: "child2ID", type: "other" };
    _internal.getChildren.resolves([child1, child2]);

    //いずれの子供も hasChild => false とする
    _internal.hasChild.onCall(0).returns(false); //for child1
    _internal.hasChild.onCall(1).returns(false); //for child2

    //-- 実行 --
    const result = await getThreeGenerationFamily("/dummy/projectRoot", "/dummy/rootComponentDir");

    //-- 検証 --
    //root
    expect(result).to.have.property("ID", "rootID");
    expect(result).to.have.property("descendants").that.is.an("array").with.lengthOf(2);

    //child1 => handler が削除されている
    const [c1, c2] = result.descendants;
    expect(c1).to.have.property("ID", "child1ID");
    expect(c1).to.not.have.property("handler"); //削除されている
    //child2 => もともと handler なし
    expect(c2).to.have.property("ID", "child2ID");

    //hasChild が false なので => どちらの子供も descenants (孫) は付与されない
    expect(c1).to.not.have.property("descendants");
    expect(c2).to.not.have.property("descendants");
  });

  it("should map grandsons when hasChild is true, and transform 'task' type differently", async ()=>{
    //-- 準備 --
    //root の情報
    _internal.readComponentJson.resolves({
      ID: "rootID",
      type: "workflow"
    });

    //子供は1つだけ存在
    const childA = { ID: "childAID", type: "group" };
    _internal.getChildren.onCall(0).resolves([childA]);
    //↑ getChildren が呼ばれるのは root 用(最初の呼び出し)

    //childA は hasChild => true とする
    _internal.hasChild.onCall(0).returns(true);

    //childA の子供 (孫にあたる) は2つ
    const grandTask = { ID: "g1", type: "task", pos: { x: 100, y: 200 }, host: "someHost", useJobScheduler: true };
    const grandOther = { ID: "g2", type: "group", pos: { x: 300, y: 400 } };

    //2回目の getChildren 呼び出し => childA の孫取得
    _internal.getChildren.onCall(1).resolves([grandTask, grandOther]);

    //-- 実行 --
    const result = await getThreeGenerationFamily("/dummy/proj", "/dummy/rootComp");

    //-- 検証 --
    expect(result).to.have.property("ID", "rootID");
    expect(result).to.have.property("descendants").that.is.an("array").with.lengthOf(1);

    const cA = result.descendants[0];
    expect(cA).to.have.property("ID", "childAID");
    //hasChild => true なので cA の descendants がある
    expect(cA).to.have.property("descendants").that.is.an("array").with.lengthOf(2);

    //孫要素のチェック
    const [g1, g2] = cA.descendants;
    //g1.type === 'task' => host, useJobScheduler も含む
    expect(g1).to.deep.equal({
      type: "task",
      pos: { x: 100, y: 200 },
      host: "someHost",
      useJobScheduler: true
    });
    //g2.type !== 'task' => type, pos のみ
    expect(g2).to.deep.equal({
      type: "group",
      pos: { x: 300, y: 400 }
    });
  });
});

describe("#getChildren", ()=>{
  let getComponentDirStub;
  let readJsonGreedyStub;
  let globStub;
  const componentJsonFilename = "component.json";

  beforeEach(()=>{
    sinon.stub(_internal, "path").value(require("path"));
    sinon.stub(_internal, "componentJsonFilename").value(componentJsonFilename);
    getComponentDirStub = sinon.stub(_internal, "getComponentDir");
    readJsonGreedyStub = sinon.stub(_internal, "readJsonGreedy");
    globStub = sinon.stub(_internal, "glob");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return an empty array if the directory is not found", async ()=>{
    getComponentDirStub.resolves(null);

    const result = await getChildren("/mock/project", "invalidID", false);

    expect(result).to.deep.equal([]);
    expect(getComponentDirStub.calledOnce).to.be.true;
    expect(globStub.notCalled).to.be.true;
  });

  it("should return an empty array if no child components are found", async ()=>{
    getComponentDirStub.resolves("/mock/project/component");
    globStub.callsArgWith(1, null, []);

    const result = await getChildren("/mock/project", "validID", false);

    expect(result).to.deep.equal([]);
    expect(globStub.calledOnce).to.be.true;
  });

  it("should return an array of child components excluding subComponents", async ()=>{
    const child1Path = "/mock/project/component/child1/cmp.wheel.json";
    const child2Path = "/mock/project/component/child2/cmp.wheel.json";
    getComponentDirStub.resolves("/mock/project/component");
    globStub.callsArgWith(1, null, [child1Path, child2Path]);

    const child1Json = { ID: "child1", subComponent: false };
    const child2Json = { ID: "child2", subComponent: true };
    readJsonGreedyStub.withArgs(child1Path).resolves(child1Json);
    readJsonGreedyStub.withArgs(child2Path).resolves(child2Json);

    const result = await getChildren("/mock/project", "validID", false);

    expect(result).to.deep.equal([child1Json]);
    expect(readJsonGreedyStub.calledTwice).to.be.true;
  });

  it("should handle the case where parentID is a directory path", async ()=>{
    const childPath = "/mock/project/parent/child/cmp.wheel.json";
    globStub.callsArgWith(1, null, [childPath]);
    const childJson = { ID: "child", subComponent: false };
    readJsonGreedyStub.resolves(childJson);

    const result = await getChildren("/mock/project", "/mock/project/parent", true);

    expect(result).to.deep.equal([childJson]);
    expect(getComponentDirStub.notCalled).to.be.true;
  });

  it("should return an empty array if getComponentDir returns a falsy value", async ()=>{
    _internal.getComponentDir.resolves(null);

    const result = await getChildren("/some/project", "parentID");
    expect(result).to.be.an("array").that.is.empty;

    expect(_internal.getComponentDir.calledOnceWithExactly("/some/project", "parentID", true)).to.be.true;
    expect(globStub.notCalled).to.be.true;
  });

  it("should return an empty array if no children are found by glob", async ()=>{
    _internal.getComponentDir.resolves("/path/to/component");
    globStub.callsArgWith(1, null, []);

    const result = await getChildren("/projRoot", "someParent");
    expect(result).to.be.an("array").that.is.empty;

    const expectedGlobPath = require("path").join("/path/to/component", "*", componentJsonFilename);
    expect(globStub.calledOnceWith(expectedGlobPath)).to.be.true;
  });

  it("should filter out subComponent objects and return the rest", async ()=>{
    _internal.getComponentDir.resolves("/my/component");
    globStub.callsArgWith(1, null, [
      "/my/component/child1/component.json",
      "/my/component/child2/component.json",
      "/my/component/child3/component.json"
    ]);

    _internal.readJsonGreedy.onCall(0).resolves({ ID: "child1", subComponent: false });
    _internal.readJsonGreedy.onCall(1).resolves({ ID: "child2", subComponent: true });
    _internal.readJsonGreedy.onCall(2).resolves({ ID: "child3" }); //subComponent が undefined

    const result = await getChildren("/projRoot", "myParentID");
    expect(result).to.have.lengthOf(2);
    expect(result).to.deep.include({ ID: "child1", subComponent: false });
    expect(result).to.deep.include({ ID: "child3" });

    const expectedGlobPath = require("path").join("/my/component", "*", componentJsonFilename);
    expect(globStub.calledOnceWith(expectedGlobPath)).to.be.true;

    expect(_internal.readJsonGreedy.callCount).to.equal(3);
  });
});
