/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const path = require("path");
const fs = require("fs-extra");
const sinon = require("sinon");

//setup test framework
const chai = require("chai");
const expect = chai.expect;
chai.use(require("sinon-chai"));
chai.use(require("chai-fs"));
chai.use(require("chai-json-schema"));
chai.use(require("deep-equal-in-any-order"));
chai.use(require("chai-as-promised"));
const { createNewProject, createNewComponent } = require("../../../../app/core/projectFilesOperator");

//testee
const validateComponents = require("../../../../app/core/validateComponents.js");
const {
  validateComponent,
  validateBulkjobTask,
  getCycleGraph,
  recursiveValidateComponents,
  _internal
} = validateComponents;

//test data
const testDirRoot = "WHEEL_TEST_TMP";

const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");

describe("validateComponents function", function () {
  this.timeout(10000); //タイムアウト時間を延長
  beforeEach(async function () {
    await fs.remove(testDirRoot);

    try {
      await createNewProject(projectRootDir, "test project", null, "test", "test@example.com");
    } catch (e) {
      console.log(e);
      throw e;
    }

    sinon.stub(_internal, "getComponentDir").callsFake(async (projectRootDir, ID, isAbsolute)=>{
      //テスト用のコンポーネントディレクトリを返す
      if (ID === "test-ps") {
        return path.resolve(projectRootDir, "test-ps");
      }
      //それ以外のIDの場合は元の関数を呼び出す
      return validateComponents._internal.getComponentDir.wrappedMethod.call(null, projectRootDir, ID, isAbsolute);
    });
  });
  afterEach(()=>{
    sinon.restore();
  });
  after(async function () {
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
  });

  it("should validate if component with else branch", async function () {
    //ifコンポーネントを作成（else分岐あり）
    const ifComponent = await createNewComponent(projectRootDir, projectRootDir, "if", { x: 0, y: 0 });
    ifComponent.condition = "condition.js";
    ifComponent.else = ["else-branch-id"]; //else分岐を追加

    //条件ファイルを作成
    const conditionPath = path.resolve(projectRootDir, ifComponent.name, "condition.js");
    await fs.writeFile(conditionPath, "module.exports = function() { return true; }");

    sinon.stub(_internal, "getNextComponents").callsFake((components, component)=>{
      const nextComponentIDs = [];
      if (component.next) {
        nextComponentIDs.push(...component.next);
      }
      if (component.else) {
        nextComponentIDs.push(...component.else);
      }
      return components.filter((c)=>{ return nextComponentIDs.includes(c.ID); });
    });

    //validateComponentを実行
    const error = await validateComponent(projectRootDir, ifComponent);

    //エラーがないことを確認
    expect(error).to.be.null;
  });

  it("should validate bulkjobTask with manualFinishCondition", async function () {
    //bulkjobTaskコンポーネントを作成（manualFinishConditionあり）
    const bulkjobTask = await createNewComponent(projectRootDir, projectRootDir, "bulkjobTask", { x: 0, y: 0 });
    bulkjobTask.host = "bulkjobOK";
    bulkjobTask.usePSSettingFile = false;
    bulkjobTask.startBulkNumber = 1;
    bulkjobTask.endBulkNumber = 5;
    bulkjobTask.script = "script.sh";
    bulkjobTask.manualFinishCondition = true;
    bulkjobTask.condition = "condition.js";
    sinon.stub(_internal.remoteHost, "query").returns({ name: "dummy", jobScheduler: "hige", useBulkjob: true });
    sinon.stub(_internal, "jobScheduler").value({
      hoge: { queueOpt: "-q" },
      huga: { queueOpt: "-q", supportStepjob: true },
      hige: { queueOpt: "-q", supportBulkjob: true }
    });

    //スクリプトファイルを作成
    const scriptPath = path.resolve(projectRootDir, bulkjobTask.name, "script.sh");
    await fs.writeFile(scriptPath, "#!/bin/bash\necho 'Hello'");

    //条件ファイルを作成
    const conditionPath = path.resolve(projectRootDir, bulkjobTask.name, "condition.js");
    await fs.writeFile(conditionPath, "module.exports = function() { return true; }");

    //validateBulkjobTaskを実行
    const result = await validateBulkjobTask(projectRootDir, bulkjobTask);

    //結果がtrueであることを確認
    expect(result).to.be.true;
  });

  it("should validate component with outputFiles having multiple destinations", async function () {
    //タスクコンポーネントを作成（複数の出力先を持つoutputFiles）
    const task = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });
    task.script = "script.sh";
    task.outputFiles = [
      {
        name: "output.txt",
        dst: [
          { dstNode: "comp1" },
          { dstNode: "comp2" },
          { origin: "some-origin", dstNode: "comp3" } //originプロパティを持つ
        ]
      }
    ];

    //スクリプトファイルを作成
    const scriptPath = path.resolve(projectRootDir, task.name, "script.sh");
    await fs.writeFile(scriptPath, "#!/bin/bash\necho 'Hello'");

    sinon.stub(_internal, "getNextComponents").callsFake((components, component)=>{
      const nextComponentIDs = [];
      if (component.outputFiles) {
        component.outputFiles.forEach((outputFile)=>{
          outputFile.dst.forEach((dst)=>{
            if (!dst.origin) {
              nextComponentIDs.push(dst.dstNode);
            }
          });
        });
      }
      return components.filter((c)=>{ return nextComponentIDs.includes(c.ID); });
    });

    //validateComponentを実行
    const error = await validateComponent(projectRootDir, task);

    //エラーがないことを確認
    expect(error).to.be.null;
  });

  it("should handle complex component hierarchy in recursiveValidateComponents", async function () {
    //複雑な階層構造を持つコンポーネントをモック
    sinon.stub(_internal, "getChildren").callsFake(async (projectRootDir, parentID)=>{
      if (parentID === "root") {
        return [
          { ID: "parent1", name: "parent1", type: "task", script: "script.sh" },
          { ID: "parent2", name: "parent2", type: "task", script: "script.sh" }
        ];
      }
      if (parentID === "parent1") {
        return [
          { ID: "child1", name: "child1", type: "task", script: "script.sh" },
          { ID: "child2", name: "child2", type: "task", script: "script.sh" }
        ];
      }
      if (parentID === "parent2") {
        return [
          { ID: "child3", name: "child3", type: "task", script: "script.sh", disable: true }, //無効化されたコンポーネント
          { ID: "child4", name: "child4", type: "task", script: undefined } //エラーになるコンポーネント
        ];
      }
      return [];
    });

    sinon.stub(_internal, "hasChild").callsFake((component)=>{
      return component.ID === "parent1" || component.ID === "parent2";
    });

    sinon.stub(_internal, "isInitialComponent").resolves(true);

    //レポート配列を作成
    const report = [];

    //recursiveValidateComponentsを実行
    await recursiveValidateComponents(projectRootDir, "root", report);

    //レポートにエラーが含まれていることを確認（child4のみエラー、child3は無効化されているためスキップ）
    expect(report).to.be.an("array");
    expect(report.some((item)=>{ return item.ID === "child4"; })).to.be.true;
    expect(report.some((item)=>{ return item.ID === "child3"; })).to.be.false;
  });
  it("should validate component correctly", async function () {
    //実際のコンポーネントを作成
    const task = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });
    task.script = "script.sh";
    //スクリプトファイルを作成
    fs.writeFileSync(path.resolve(projectRootDir, task.name, "script.sh"), "#!/bin/bash\necho 'Hello'");
    //validateComponentを実行
    const error = await validateComponent(projectRootDir, task);
    expect(error).to.be.null;
  });
  it("should detect invalid component", async function () {
    //validateComponentを直接テスト - 無効なコンポーネント
    const task = {
      type: "task",
      ID: "test-task",
      name: "test-task"
      //scriptが指定されていない
    };
    //validateComponentを実行
    const error = await validateComponent(projectRootDir, task);
    expect(error).to.not.be.null;
    expect(error).to.include("script is not specified");
  });
  it("should detect cycle graph", async function () {
    //循環依存関係のあるコンポーネントを作成
    const cycleComponents = [
      { ID: "comp1", name: "comp1", parent: "root", next: ["comp2"] },
      { ID: "comp2", name: "comp2", parent: "root", next: ["comp3"] },
      { ID: "comp3", name: "comp3", parent: "root", next: ["comp1"] } //循環依存
    ];
    //getCycleGraphを直接テスト
    const result = await getCycleGraph("dummy", cycleComponents);
    expect(result).to.be.an("array").that.is.not.empty;
    expect(result).to.include("comp1");
    expect(result).to.include("comp2");
    expect(result).to.include("comp3");
  });

  it("should validate parameterStudy component correctly", async function () {
    //parameterStudyコンポーネントを直接作成
    const ps = {
      type: "parameterStudy",
      ID: "test-ps",
      name: "test-ps",
      parameterFile: "params.json"
    };

    //コンポーネントディレクトリを作成
    await fs.ensureDir(path.resolve(projectRootDir, ps.name));

    //パラメータファイルを作成
    const params = {
      version: 2,
      targetFiles: [
        { targetName: "foo" }
      ],
      params: [
        { keyword: "foo", type: "min-max-step", min: 0, max: 4, step: 1 }
      ]
    };
    await fs.writeJson(path.resolve(projectRootDir, ps.name, "params.json"), params);

    //validateComponentを実行
    const error = await validateComponent(projectRootDir, ps);
    expect(error).to.be.null;
  });

  it("should validate component with inputFiles and outputFiles", async function () {
    //コンポーネントを作成
    const task = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });
    task.script = "script.sh";
    fs.writeFileSync(path.resolve(projectRootDir, task.name, "script.sh"), "#!/bin/bash\necho 'Hello'");

    //入出力ファイルを追加
    task.inputFiles = [
      { name: "input.txt", src: [] },
      { name: "data/", src: [{ srcNode: "other" }] }
    ];
    task.outputFiles = [
      { name: "output.txt", dst: [] },
      { name: "results/", dst: [] }
    ];

    //validateComponentを実行
    const error = await validateComponent(projectRootDir, task);
    expect(error).to.be.null;
  });

  it("should call validateComponents with startComponentID", async function () {
    //コンポーネントを作成
    const task = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });
    task.script = "script.sh";
    fs.writeFileSync(path.resolve(projectRootDir, task.name, "script.sh"), "#!/bin/bash\necho 'Hello'");

    //validateComponentsを実行（startComponentIDを指定）
    const report = await validateComponents.validateComponents(projectRootDir, task.ID);
    expect(report).to.be.an("array");
  });

  it("should call validateComponents without startComponentID", async function () {
    //validateComponentsを実行（startComponentIDを指定しない）
    const report = await validateComponents.validateComponents(projectRootDir);
    expect(report).to.be.an("array");
  });
});
