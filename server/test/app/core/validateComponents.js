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
const { createNewProject, createNewComponent } = require("../../../app/core/projectFilesOperator");

//testee
const validateComponents = require("../../../app/core/validateComponents.js");
const {
  checkScript,
  checkPSSettingFile,
  validateTask,
  validateStepjobTask,
  validateStepjob,
  validateBulkjobTask,
  validateConditionalCheck,
  validateKeepProp,
  validateForLoop,
  validateParameterStudy,
  validateForeach,
  validateStorage,
  validateInputFiles,
  validateOutputFiles,
  getCycleGraph,
  isCycleGraph,
  getNextComponents,
  getComponentIDsInCycle,
  validateComponent,
  checkComponentDependency,
  recursiveValidateComponents,
  _internal
} = validateComponents;


//test data
const testDirRoot = "WHEEL_TEST_TMP";

const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");
describe("validation component UT", function() {
  beforeEach(async function() {
    this.timeout(10000);
    await fs.remove(testDirRoot);
    sinon.stub(_internal.remoteHost, "query").callsFake((name, hostname) => {
      if (hostname === "OK") {
        return { name: "dummy" };
      }
      if (hostname === "jobOK") {
        return { name: "dummy", jobScheduler: "hoge" };
      }
      if (hostname === "stepjobNG") {
        return { name: "dummy", jobScheduler: "huga" };
      }
      if (hostname === "stepjobOK") {
        return { name: "dummy", jobScheduler: "huga", useStepjob: true };
      }
      if (hostname === "bulkjobNG") {
        return { name: "dummy", jobScheduler: "hige" };
      }
      if (hostname === "bulkjobOK") {
        return { name: "dummy", jobScheduler: "hige", useBulkjob: true };
      }
      return undefined;
    });

    _internal.jobScheduler.hoge = { queueOpt: "-q" };
    _internal.jobScheduler.huga = { queueOpt: "-q", supportStepjob: true };
    _internal.jobScheduler.hige = { queueOpt: "-q", supportBulkjob: true };

    try {
      await createNewProject(projectRootDir, "test project", null, "test", "test@example.com");
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
  afterEach(() => {
    sinon.restore();
  });
  after(async () => {
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
  });
  describe("checkScript", () => {
    //各テストケースで独自にコンポーネントを作成する

    it("should be rejected if script is not specified", async () => {
      //コンポーネントを作成
      const component = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //scriptプロパティが指定されていない場合
      await expect(checkScript(projectRootDir, component)).to.be.rejectedWith("script is not specified");
    });

    it("should be rejected if script is empty string", async () => {
      //コンポーネントを作成
      const component = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //scriptプロパティが空文字列の場合
      component.script = "";
      await expect(checkScript(projectRootDir, component)).to.be.rejectedWith(/script is not file/);
    });

    it("should be rejected if script file does not exist", async () => {
      //コンポーネントを作成
      const component = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //スクリプトファイルが存在しない場合
      component.script = "nonexistent_script.sh";
      await expect(checkScript(projectRootDir, component)).to.be.rejectedWith("script is not existing file");
    });

    it("should be rejected if script is a directory", async () => {
      //コンポーネントを作成
      const component = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //スクリプトがディレクトリの場合
      component.script = "script_dir";
      fs.mkdirSync(path.resolve(projectRootDir, component.name, "script_dir"));
      await expect(checkScript(projectRootDir, component)).to.be.rejectedWith("script is not file");
    });

    it("should be resolved with true if script is a valid file", async () => {
      //コンポーネントを作成
      const component = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //スクリプトが有効なファイルの場合
      component.script = "valid_script.sh";
      fs.writeFileSync(path.resolve(projectRootDir, component.name, "valid_script.sh"), "#!/bin/bash\necho 'Hello'");
      const result = await checkScript(projectRootDir, component);
      expect(result).to.be.true;
    });

    it("should handle fs.stat errors other than ENOENT", async () => {
      //コンポーネントを作成
      const component = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //fs.statがENOENT以外のエラーを投げる場合
      component.script = "error_script.sh";
      fs.writeFileSync(path.resolve(projectRootDir, component.name, "error_script.sh"), "#!/bin/bash\necho 'Hello'");

      //fs.statをモック化してエラーを投げるようにする
      sinon.stub(fs, "stat").rejects(Object.assign(new Error("Permission denied"), { code: "EACCES" }));

      //エラーが伝播することを確認
      await expect(checkScript(projectRootDir, component)).to.be.rejectedWith("Permission denied");
    });
  });

  describe("validateTask", () => {
    let task;
    beforeEach(async () => {
      task = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });
    });
    it("should be rejected with 'no script' error for default component", () => {
      return expect(validateTask(projectRootDir, task)).to.be.rejectedWith("script is not specified");
    });
    it("should be rejected if name is not defined", () => {
      task.name = null;
      return expect(validateTask(projectRootDir, task)).to.be.rejectedWith("illegal path");
    });
    it("should be rejected if not existing remote host is set", () => {
      task.useJobScheduler = true;
      task.host = "hoge";
      return expect(validateTask(projectRootDir, task)).to.be.rejectedWith(/remote host setting for .* not found/);
    });
    it("should be rejected if not existing jobScheduler is set", () => {
      task.useJobScheduler = true;
      task.host = "OK";
      return expect(validateTask(projectRootDir, task)).to.be.rejectedWith(/job scheduler for .* is not supported/);
    });
    it("should be rejected if not existing jobScheduler is set", () => {
      task.useJobScheduler = true;
      task.host = "jobOK";
      task.submitOption = "-q foo bar -i hoge";
      return expect(validateTask(projectRootDir, task)).to.be.rejectedWith("submit option duplicate queue option");
    });
    it("should be rejected if script is not existing", () => {
      task.script = "hoge";
      return expect(validateTask(projectRootDir, task)).to.be.rejectedWith("script is not existing file");
    });
    it("should be rejected if script is not file", () => {
      task.script = "hoge";
      fs.mkdirSync(path.resolve(projectRootDir, task.name, "hoge"));
      return expect(validateTask(projectRootDir, task)).to.be.rejectedWith("script is not file");
    });
    it("should be resolved with true if required prop is set", async () => {
      task.script = "hoge";
      fs.writeFileSync(path.resolve(projectRootDir, task.name, "hoge"), "hoge");
      return expect(await validateTask(projectRootDir, task)).to.be.true;
    });

    it("should be resolved with true for local job (no host set)", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testTask = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //スクリプトファイルを作成
      testTask.script = "local_script.sh";
      const scriptPath = path.resolve(projectRootDir, testTask.name, "local_script.sh");
      await fs.writeFile(scriptPath, "#!/bin/bash\necho 'Hello'");

      //ホストを設定しない（ローカルジョブ）
      testTask.useJobScheduler = false;

      //テスト実行
      expect(await validateTask(projectRootDir, testTask)).to.be.true;
    });

    it("should be resolved with true if remote host and job scheduler are correctly set", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testTask = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //スクリプトファイルを作成
      testTask.script = "remote_script.sh";
      const scriptPath = path.resolve(projectRootDir, testTask.name, "remote_script.sh");
      await fs.writeFile(scriptPath, "#!/bin/bash\necho 'Hello'");

      //リモートホストとジョブスケジューラを設定
      testTask.useJobScheduler = true;
      testTask.host = "jobOK";

      //テスト実行
      expect(await validateTask(projectRootDir, testTask)).to.be.true;
    });

    it("should be resolved with true if submit option is set and does not duplicate queue option", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testTask = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //スクリプトファイルを作成
      testTask.script = "submit_script.sh";
      const scriptPath = path.resolve(projectRootDir, testTask.name, "submit_script.sh");
      await fs.writeFile(scriptPath, "#!/bin/bash\necho 'Hello'");

      //リモートホストとジョブスケジューラを設定
      testTask.useJobScheduler = true;
      testTask.host = "jobOK";

      //submitOptionを設定（queueOptionと重複しない）
      testTask.submitOption = "-p high -t 10:00";

      //テスト実行
      expect(await validateTask(projectRootDir, testTask)).to.be.true;
    });
  });
  describe("validateStepjobTask", () => {
    let stepjobTask;
    beforeEach(async () => {
      stepjobTask = await createNewComponent(projectRootDir, projectRootDir, "stepjobTask", { x: 0, y: 0 });
    });
    it("should be rejected with 'no script' error for default component", () => {
      return expect(validateStepjobTask(projectRootDir, stepjobTask)).to.be.rejectedWith("script is not specified");
    });
    it("should be rejected with 'initial stepjobTask cannot specified the Dependency form' if initial stepjob task has dependency form", () => {
      stepjobTask.useDependency = "hoge";
      return expect(validateStepjobTask(projectRootDir, stepjobTask)).to.be.rejectedWith("initial stepjobTask cannot specified the Dependency form");
    });
    it("should be rejected if script file is not existing", () => {
      stepjobTask.script = "hoge";
      return expect(validateStepjobTask(projectRootDir, stepjobTask)).to.be.rejectedWith("script is not existing file");
    });
    it("should be rejected if script is not file", () => {
      stepjobTask.script = "hoge";
      fs.mkdirSync(path.resolve(projectRootDir, stepjobTask.name, "hoge"));
      return expect(validateStepjobTask(projectRootDir, stepjobTask)).to.be.rejectedWith("script is not file");
    });
    it("should be resolved with true if required prop is set", async () => {
      stepjobTask.script = "hoge";
      fs.writeFileSync(path.resolve(projectRootDir, stepjobTask.name, "hoge"), "hoge");
      expect(await validateStepjobTask(projectRootDir, stepjobTask)).to.be.true;
    });

    it("should allow useDependency for non-initial stepjobTask", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testStepjobTask = await createNewComponent(projectRootDir, projectRootDir, "stepjobTask", { x: 0, y: 0 });
      testStepjobTask.script = "script.sh";

      //スクリプトファイルを作成
      const scriptPath = path.resolve(projectRootDir, testStepjobTask.name, "script.sh");
      await fs.writeFile(scriptPath, "#!/bin/bash\necho 'Hello'");

      sinon.stub(_internal, "isInitialComponent").resolves(false);

      //useDependencyを設定
      testStepjobTask.useDependency = "afterok";

      //テスト実行
      const result = await validateStepjobTask(projectRootDir, testStepjobTask);

      //非初期コンポーネントの場合、useDependencyが設定されていても拒否されないことを確認
      expect(result).to.be.true;
    });

    it("should be resolved with true if script is executable", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testStepjobTask = await createNewComponent(projectRootDir, projectRootDir, "stepjobTask", { x: 0, y: 0 });

      //実行可能スクリプトファイルを作成
      testStepjobTask.script = "executable.sh";
      const scriptPath = path.resolve(projectRootDir, testStepjobTask.name, "executable.sh");
      await fs.writeFile(scriptPath, "#!/bin/bash\necho 'Hello'");

      //Windows環境ではchmodが機能しないため、ファイルの存在確認のみ行う
      const stats = await fs.stat(scriptPath);
      expect(stats.isFile()).to.be.true;

      //テスト実行
      expect(await validateStepjobTask(projectRootDir, testStepjobTask)).to.be.true;
    });
  });
  describe("validateStepjob", () => {
    let stepjob;
    beforeEach(async () => {
      stepjob = await createNewComponent(projectRootDir, projectRootDir, "stepjob", { x: 0, y: 0 });
    });
    it("should be rejected if useJobScheduler is not set", () => {
      stepjob.useJobScheduler = false;
      return expect(validateStepjob(projectRootDir, stepjob)).to.be.rejectedWith("useJobScheduler must be set");
    });
    it("should be rejected if host is not set", () => {
      return expect(validateStepjob(projectRootDir, stepjob)).to.be.rejectedWith("stepjob is only supported on remotehost");
    });
    it("should be rejected if host not found", () => {
      stepjob.host = "hoge";
      return expect(validateStepjob(projectRootDir, stepjob)).to.be.rejectedWith(/remote host setting for .* not found/);
    });
    it("should be rejected if host is not support job", () => {
      stepjob.host = "OK";
      return expect(validateStepjob(projectRootDir, stepjob)).to.be.rejectedWith(/job scheduler for .* is not supported/);
    });
    it("should be rejected if jobscheduler is not support stepjob", () => {
      stepjob.host = "jobOK";
      return expect(validateStepjob(projectRootDir, stepjob)).to.be.rejectedWith(/job scheduler .* does not support stepjob/);
    });
    it("should be rejected if host is not set to use stepjob", () => {
      stepjob.host = "stepjobNG";
      return expect(validateStepjob(projectRootDir, stepjob)).to.be.rejectedWith(/.* does not set to use stepjob/);
    });
    it("should be rejected if host supports stepjob but useStepjob is false", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testStepjob = await createNewComponent(projectRootDir, projectRootDir, "stepjob", { x: 0, y: 0 });
      testStepjob.useJobScheduler = true;

      //stepjobNGはジョブスケジューラがstepjobをサポートしているが、useStepjobがfalse
      testStepjob.host = "stepjobNG";

      //テスト実行
      await expect(validateStepjob(projectRootDir, testStepjob)).to.be.rejectedWith(/.* does not set to use stepjob/);
    });

    it("should be resolved with true if all requirements are met", async () => {
      stepjob.host = "stepjobOK";
      expect(await validateStepjob(projectRootDir, stepjob)).to.be.true;
    });

    it("should be resolved with true if host is set to use stepjob and jobscheduler supports stepjob", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testStepjob = await createNewComponent(projectRootDir, projectRootDir, "stepjob", { x: 0, y: 0 });
      testStepjob.useJobScheduler = true;

      //stepjobOKはジョブスケジューラがstepjobをサポートしており、useStepjobがtrue
      testStepjob.host = "stepjobOK";

      //テスト実行
      expect(await validateStepjob(projectRootDir, testStepjob)).to.be.true;
    });
  });
  describe("validateBulkjobTask", () => {
    let bulkjobTask;
    beforeEach(async () => {
      bulkjobTask = await createNewComponent(projectRootDir, projectRootDir, "bulkjobTask", { x: 0, y: 0 });
    });
    it("should be rejected if name is not defined", () => {
      bulkjobTask.name = null;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("illegal path");
    });
    it("should be rejected if useJobScheduler is not set", () => {
      bulkjobTask.useJobScheduler = false;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("useJobScheduler must be set");
    });
    it("should be rejected if host is not set", () => {
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("bulkjobTask is only supported on remotehost");
    });
    it("should be rejected if host not found", () => {
      bulkjobTask.host = "hoge";
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith(/remote host setting for .* not found/);
    });
    it("should be rejected if host is not support job", () => {
      bulkjobTask.host = "OK";
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith(/job scheduler for .* is not supported/);
    });
    it("should be rejected if jobscheduler is not support bulkjobTask", () => {
      bulkjobTask.host = "jobOK";
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith(/job scheduler .* does not support bulkjob/);
    });
    it("should be rejected if host is not set to use bulkjob", () => {
      bulkjobTask.host = "bulkjobNG";
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith(/.* does not set to use bulkjob/);
    });
    it("should be rejected if usePSSettingFile is set but parameterFile is not set", async () => {
      bulkjobTask.host = "bulkjobOK";
      //bulkjobTask.usePSSettingFile is true by default, so we do not set it here
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("usePSSettingFile is set but parameter setting file is not specified");
    });

    it("should be rejected if script is not specified for usePSSettingFile=true case", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testBulkjobTask = await createNewComponent(projectRootDir, projectRootDir, "bulkjobTask", { x: 0, y: 0 });
      testBulkjobTask.host = "bulkjobOK";
      testBulkjobTask.usePSSettingFile = true;
      testBulkjobTask.parameterFile = "nonexistent.json";
      //scriptを設定しない

      //テスト実行
      await expect(validateBulkjobTask(projectRootDir, testBulkjobTask)).to.be.rejectedWith(/script is not specified/);
    });

    it("should be rejected if script does not exist for usePSSettingFile=true case", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testBulkjobTask = await createNewComponent(projectRootDir, projectRootDir, "bulkjobTask", { x: 0, y: 0 });
      testBulkjobTask.host = "bulkjobOK";
      testBulkjobTask.usePSSettingFile = true;
      testBulkjobTask.parameterFile = "paramFile.json";
      testBulkjobTask.script = "nonexistent.sh";

      //テスト実行
      await expect(validateBulkjobTask(projectRootDir, testBulkjobTask)).to.be.rejectedWith(/script is not existing file/);
    });

    it("should be rejected if script is not a file for usePSSettingFile=true case", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testBulkjobTask = await createNewComponent(projectRootDir, projectRootDir, "bulkjobTask", { x: 0, y: 0 });
      testBulkjobTask.host = "bulkjobOK";
      testBulkjobTask.usePSSettingFile = true;
      testBulkjobTask.parameterFile = "paramFile.json";
      testBulkjobTask.script = "scriptDir";

      //スクリプトディレクトリを作成
      const scriptDirPath = path.resolve(projectRootDir, testBulkjobTask.name, "scriptDir");
      await fs.mkdir(scriptDirPath);

      //テスト実行
      await expect(validateBulkjobTask(projectRootDir, testBulkjobTask)).to.be.rejectedWith(/script is not file/);
    });

    it("should be rejected if usePSSettingFile is not set and startBulkNumber is not set", async () => {
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("startBulkNumber must be specified");
    });
    it("should be rejected if usePSSettingFile is not set and startBulkNumber is negative value", async () => {
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = -1;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("startBulkNumber must be integer and 0 or more");
    });
    it("should be rejected if usePSSettingFile is not set and endBulkNumber is not set", async () => {
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = 1;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("endBulkNumber must be specified");
    });
    it("should be rejected if endBulkNumber is less or equal startBulkNumber", async () => {
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = 1;
      bulkjobTask.endBulkNumber = 1;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("endBulkNumber must be integer and greater than startBulkNumber");
    });
    it("should be rejected if manualFinishCondition is set but condition is not specidied", async () => {
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = 1;
      bulkjobTask.endBulkNumber = 2;
      bulkjobTask.manualFinishCondition = true;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("condition is not specified");
    });
    //TODO conditionを実際に指定したケースの確認

    it("should be rejected if script is not set", async () => {
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = 1;
      bulkjobTask.endBulkNumber = 2;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("script is not specified");
    });
    it("should be rejected if script is not existing", () => {
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = 1;
      bulkjobTask.endBulkNumber = 2;
      bulkjobTask.script = "hoge";
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("script is not exist");
    });
    it("should be rejected if script is not file", () => {
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = 1;
      bulkjobTask.endBulkNumber = 2;
      bulkjobTask.script = "hoge";
      fs.mkdirSync(path.resolve(projectRootDir, bulkjobTask.name, "hoge"));
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("script is not file");
    });
    it("should be resolved with true", async () => {
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = 1;
      bulkjobTask.endBulkNumber = 2;
      bulkjobTask.script = "hoge";
      fs.writeFileSync(path.resolve(projectRootDir, bulkjobTask.name, "hoge"), "hoge");
      expect(await validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.true;
    });
  });
  describe("validateConditionalCheck", () => {
    let ifComponent;
    let whileComponent;
    beforeEach(async () => {
      ifComponent = await createNewComponent(projectRootDir, projectRootDir, "if", { x: 0, y: 0 });
      whileComponent = await createNewComponent(projectRootDir, projectRootDir, "while", { x: 0, y: 0 });
    });
    it("should reject if condition is not specified", () => {
      expect(validateConditionalCheck(projectRootDir, ifComponent)).to.be.rejectedWith("condition is not specified");
      return expect(validateConditionalCheck(projectRootDir, whileComponent)).to.be.rejectedWith("condition is not specified");
    });
    it("should reject if condition exists but it is not file", () => {
      ifComponent.condition = "hoge";
      fs.mkdirSync(path.resolve(projectRootDir, ifComponent.name, "hoge"));
      whileComponent.condition = "hoge";
      fs.mkdirSync(path.resolve(projectRootDir, whileComponent.name, "hoge"));
      expect(validateConditionalCheck(projectRootDir, ifComponent)).to.be.rejectedWith(/condition is exist but it is not file .*/);
      return expect(validateConditionalCheck(projectRootDir, whileComponent)).to.be.rejectedWith(/condition is exist but it is not file .*/);
    });

    it("should be resolved with true if condition is a valid file", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testIfComponent = await createNewComponent(projectRootDir, projectRootDir, "if", { x: 0, y: 0 });
      const testWhileComponent = await createNewComponent(projectRootDir, projectRootDir, "while", { x: 0, y: 0 });

      //条件ファイルを作成
      testIfComponent.condition = "valid_condition.js";
      testWhileComponent.condition = "valid_condition.js";

      const ifConditionPath = path.resolve(projectRootDir, testIfComponent.name, "valid_condition.js");
      const whileConditionPath = path.resolve(projectRootDir, testWhileComponent.name, "valid_condition.js");

      await fs.writeFile(ifConditionPath, "module.exports = function() { return true; }");
      await fs.writeFile(whileConditionPath, "module.exports = function() { return true; }");

      //テスト実行
      expect(await validateConditionalCheck(projectRootDir, testIfComponent)).to.be.true;
      expect(await validateConditionalCheck(projectRootDir, testWhileComponent)).to.be.true;
    });

    it("should be resolved with true if condition is a JavaScript expression", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testIfComponent = await createNewComponent(projectRootDir, projectRootDir, "if", { x: 0, y: 0 });
      const testWhileComponent = await createNewComponent(projectRootDir, projectRootDir, "while", { x: 0, y: 0 });

      //JavaScriptの式として評価される条件を設定
      testIfComponent.condition = "js_expression.js";
      testWhileComponent.condition = "js_expression.js";

      //条件ファイルを作成（中身はJavaScriptの式）
      const ifConditionPath = path.resolve(projectRootDir, testIfComponent.name, "js_expression.js");
      const whileConditionPath = path.resolve(projectRootDir, testWhileComponent.name, "js_expression.js");

      await fs.writeFile(ifConditionPath, "module.exports = function() { return true; }");
      await fs.writeFile(whileConditionPath, "module.exports = function() { return 1 < 2; }");

      //テスト実行
      expect(await validateConditionalCheck(projectRootDir, testIfComponent)).to.be.true;
      expect(await validateConditionalCheck(projectRootDir, testWhileComponent)).to.be.true;
    });
  });
  describe("validateKeepProp", () => {
    let whileComponent;
    let forComponent;
    let foreachComponent;
    beforeEach(async () => {
      forComponent = await createNewComponent(projectRootDir, projectRootDir, "for", { x: 0, y: 0 });
      foreachComponent = await createNewComponent(projectRootDir, projectRootDir, "foreach", { x: 0, y: 0 });
      whileComponent = await createNewComponent(projectRootDir, projectRootDir, "while", { x: 0, y: 0 });
    });
    it("should be rejected if keep is non-empty string", () => {
      whileComponent.keep = "hoge";
      forComponent.keep = "hoge";
      foreachComponent.keep = "hoge";
      expect(validateKeepProp(whileComponent)).to.be.rejectedWith("keep must be positive integer");
      expect(validateKeepProp(forComponent)).to.be.rejectedWith("keep must be positive integer");
      return expect(validateKeepProp(foreachComponent)).to.be.rejectedWith("keep must be positive integer");
    });
    it("should be rejected if keep is a string that looks like a number", () => {
      whileComponent.keep = "5";
      forComponent.keep = "5";
      foreachComponent.keep = "5";
      expect(validateKeepProp(whileComponent)).to.be.rejectedWith("keep must be positive integer");
      expect(validateKeepProp(forComponent)).to.be.rejectedWith("keep must be positive integer");
      return expect(validateKeepProp(foreachComponent)).to.be.rejectedWith("keep must be positive integer");
    });
    it("should be rejected if keep is real number", () => {
      whileComponent.keep = 3.1;
      forComponent.keep = 3.1;
      foreachComponent.keep = 3.1;
      expect(validateKeepProp(whileComponent)).to.be.rejectedWith("keep must be positive integer");
      expect(validateKeepProp(forComponent)).to.be.rejectedWith("keep must be positive integer");
      return expect(validateKeepProp(foreachComponent)).to.be.rejectedWith("keep must be positive integer");
    });
    it("should be rejected if keep is negative integer", () => {
      whileComponent.keep = -1;
      forComponent.keep = -1;
      foreachComponent.keep = -1;
      expect(validateKeepProp(whileComponent)).to.be.rejectedWith("keep must be positive integer");
      expect(validateKeepProp(forComponent)).to.be.rejectedWith("keep must be positive integer");
      return expect(validateKeepProp(foreachComponent)).to.be.rejectedWith("keep must be positive integer");
    });
    it("should be rejected if keep is boolean", () => {
      whileComponent.keep = true;
      forComponent.keep = true;
      foreachComponent.keep = true;
      expect(validateKeepProp(whileComponent)).to.be.rejectedWith("keep must be positive integer");
      expect(validateKeepProp(forComponent)).to.be.rejectedWith("keep must be positive integer");
      return expect(validateKeepProp(foreachComponent)).to.be.rejectedWith("keep must be positive integer");
    });
    it("should be resolved with true if keep is empty string", async () => {
      whileComponent.keep = "";
      forComponent.keep = "";
      foreachComponent.keep = "";
      expect(await validateKeepProp(whileComponent)).to.be.true;
      expect(await validateKeepProp(forComponent)).to.be.true;
      expect(await validateKeepProp(foreachComponent)).to.be.true;
    });
    it("should be resolved with true if keep is null", async () => {
      whileComponent.keep = null;
      forComponent.keep = null;
      foreachComponent.keep = null;
      expect(await validateKeepProp(whileComponent)).to.be.true;
      expect(await validateKeepProp(forComponent)).to.be.true;
      expect(await validateKeepProp(foreachComponent)).to.be.true;
    });
    it("should be rejected if keep is undefined", () => {
      whileComponent.keep = undefined;
      forComponent.keep = undefined;
      foreachComponent.keep = undefined;
      expect(validateKeepProp(whileComponent)).to.be.rejectedWith("keep must be positive integer");
      expect(validateKeepProp(forComponent)).to.be.rejectedWith("keep must be positive integer");
      return expect(validateKeepProp(foreachComponent)).to.be.rejectedWith("keep must be positive integer");
    });
    it("should be resolved with true if keep is 0", async () => {
      whileComponent.keep = 0;
      forComponent.keep = 0;
      foreachComponent.keep = 0;
      expect(await validateKeepProp(whileComponent)).to.be.true;
      expect(await validateKeepProp(forComponent)).to.be.true;
      expect(await validateKeepProp(foreachComponent)).to.be.true;
    });
    it("should be resolved with true if keep is positive integer", async () => {
      whileComponent.keep = 5;
      forComponent.keep = 5;
      foreachComponent.keep = 5;
      expect(await validateKeepProp(whileComponent)).to.be.true;
      expect(await validateKeepProp(forComponent)).to.be.true;
      expect(await validateKeepProp(foreachComponent)).to.be.true;
    });
    it("should be resolved with true if keep is large positive integer", async () => {
      whileComponent.keep = 1000000;
      forComponent.keep = 1000000;
      foreachComponent.keep = 1000000;
      expect(await validateKeepProp(whileComponent)).to.be.true;
      expect(await validateKeepProp(forComponent)).to.be.true;
      expect(await validateKeepProp(foreachComponent)).to.be.true;
    });
  });
  describe("validateForLoop", () => {
    let forComponent;
    beforeEach(async () => {
      forComponent = await createNewComponent(projectRootDir, projectRootDir, "foreach", { x: 0, y: 0 });
    });
    it("should be rejected if start is not number", () => {
      forComponent.start = "hoge";
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("start must be number");
    });
    it("should be rejected if start is null", () => {
      forComponent.start = null;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("start must be number");
    });
    it("should be rejected if start is undefined", () => {
      forComponent.start = undefined;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("start must be number");
    });
    it("should be rejected if step is not number", () => {
      forComponent.start = 1;
      forComponent.step = "hoge";
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("step must be number");
    });
    it("should be rejected if step is null", () => {
      forComponent.start = 1;
      forComponent.step = null;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("step must be number");
    });
    it("should be rejected if step is undefined", () => {
      forComponent.start = 1;
      forComponent.step = undefined;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("step must be number");
    });
    it("should be rejected if end is not number", () => {
      forComponent.start = 1;
      forComponent.step = 2;
      forComponent.end = "hoge";
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("end must be number");
    });
    it("should be rejected if end is null", () => {
      forComponent.start = 1;
      forComponent.step = 2;
      forComponent.end = null;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("end must be number");
    });
    it("should be rejected if end is undefined", () => {
      forComponent.start = 1;
      forComponent.step = 2;
      forComponent.end = undefined;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("end must be number");
    });
    it("should be rejected if step is 0", () => {
      forComponent.start = 1;
      forComponent.step = 0;
      forComponent.end = 3;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("infinite loop");
    });
    it("should be rejected if step is wrong direction (positive step with start > end)", () => {
      forComponent.start = 5;
      forComponent.step = 1;
      forComponent.end = 3;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("infinite loop");
    });
    it("should be rejected if step is wrong direction (negative step with start < end)", () => {
      forComponent.start = 1;
      forComponent.step = -1;
      forComponent.end = 3;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("infinite loop");
    });
    it("should be resolved with true for positive step with start < end", async () => {
      forComponent.start = 1;
      forComponent.step = 2;
      forComponent.end = 10;
      expect(await validateForLoop(forComponent)).to.be.true;
    });
    it("should be resolved with true for negative step with start > end", async () => {
      forComponent.start = 10;
      forComponent.step = -2;
      forComponent.end = 1;
      expect(await validateForLoop(forComponent)).to.be.true;
    });
    it("should be resolved with true for decimal values", async () => {
      forComponent.start = 1.5;
      forComponent.step = 0.5;
      forComponent.end = 3.5;
      expect(await validateForLoop(forComponent)).to.be.true;
    });
    it("should be resolved with true for negative values", async () => {
      forComponent.start = -10;
      forComponent.step = 2;
      forComponent.end = -2;
      expect(await validateForLoop(forComponent)).to.be.true;
    });
    it("should be resolved with true if start and end are equal", async () => {
      forComponent.start = 5;
      forComponent.step = 1;
      forComponent.end = 5;
      expect(await validateForLoop(forComponent)).to.be.true;
    });
  });
  describe("validateForeach", () => {
    let foreachComponent;
    beforeEach(async () => {
      foreachComponent = await createNewComponent(projectRootDir, projectRootDir, "foreach", { x: 0, y: 0 });
    });
    it("should be rejected if indexList is not array", () => {
      foreachComponent.indexList = "hoge";
      return expect(validateForeach(foreachComponent)).to.be.rejectedWith("index list is broken");
    });
    it("should be rejected if indexList is null", () => {
      foreachComponent.indexList = null;
      return expect(validateForeach(foreachComponent)).to.be.rejectedWith("index list is broken");
    });
    it("should be rejected if indexList is undefined", () => {
      foreachComponent.indexList = undefined;
      return expect(validateForeach(foreachComponent)).to.be.rejectedWith("index list is broken");
    });
    it("should be rejected if indexList is empty array", () => {
      return expect(validateForeach(foreachComponent)).to.be.rejectedWith("index list is empty");
    });
    it("should be resolved with true if indexList has one string element", async () => {
      foreachComponent.indexList.push("hoge");
      expect(await validateForeach(foreachComponent)).to.be.true;
    });
    it("should be resolved with true if indexList has multiple string elements", async () => {
      foreachComponent.indexList.push("item1");
      foreachComponent.indexList.push("item2");
      foreachComponent.indexList.push("item3");
      expect(await validateForeach(foreachComponent)).to.be.true;
    });
    it("should be resolved with true if indexList has number elements", async () => {
      foreachComponent.indexList.push(1);
      foreachComponent.indexList.push(2);
      foreachComponent.indexList.push(3);
      expect(await validateForeach(foreachComponent)).to.be.true;
    });
    it("should be resolved with true if indexList has mixed type elements", async () => {
      foreachComponent.indexList.push("item1");
      foreachComponent.indexList.push(2);
      foreachComponent.indexList.push(true);
      expect(await validateForeach(foreachComponent)).to.be.true;
    });
    it("should be resolved with true if indexList has empty string", async () => {
      foreachComponent.indexList.push("");
      expect(await validateForeach(foreachComponent)).to.be.true;
    });
  });
  describe("validateParameterStudy", () => {
    let ps;
    beforeEach(async () => {
      ps = await createNewComponent(projectRootDir, projectRootDir, "PS", { x: 0, y: 0 });
    });
    it("should be rejected if parameterFile is not set", () => {
      ps.parameterFile = null;
      return expect(validateParameterStudy(projectRootDir, ps)).to.be.rejectedWith("parameter setting file is not specified");
    });
    it("should be rejected if parameterFile is not file", () => {
      ps.parameterFile = "hoge";
      fs.mkdirSync(path.resolve(projectRootDir, ps.name, "hoge"));
      return expect(validateParameterStudy(projectRootDir, ps)).to.be.rejectedWith("parameter setting file is not file");
    });
    it("should be rejected if parameterFile is not valid JSON file", () => {
      ps.parameterFile = "hoge";
      fs.writeFileSync(path.resolve(projectRootDir, ps.name, "hoge"), "hoge");
      return expect(validateParameterStudy(projectRootDir, ps)).to.be.rejectedWith("parameter setting file is not JSON file");
    });
    it("should be resolved with true if required prop is set", async () => {
      ps.parameterFile = "hoge";
      const params = {
        version: 2,
        targetFiles: [
          { targetName: "foo" }
        ],
        params: [
          { keyword: "foo", type: "min-max-step", min: 0, max: 4, step: 1 }
        ]
      };

      fs.writeJsonSync(path.resolve(projectRootDir, ps.name, "hoge"), params);
      expect(await validateParameterStudy(projectRootDir, ps)).to.be.true;
    });

    it("should be rejected if parameter file is missing required properties", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testPS = await createNewComponent(projectRootDir, projectRootDir, "PS", { x: 0, y: 0 });

      //パラメータファイルを設定
      testPS.parameterFile = "invalid_params.json";

      //必要なプロパティが欠けているJSONファイルを作成
      const invalidParams = {
        version: 2,
        //targetFilesが欠けている
        params: [
          { keyword: "foo", type: "min-max-step", min: 0, max: 4, step: 1 }
        ]
      };

      fs.writeJsonSync(path.resolve(projectRootDir, testPS.name, "invalid_params.json"), invalidParams);

      const validate = sinon.stub().returns(false);
      validate.errors = [{ message: "should have required property 'targetFiles'" }];
      sinon.stub(_internal, "validate").value(validate);

      //テスト実行
      await expect(validateParameterStudy(projectRootDir, testPS)).to.be.rejectedWith("parameter setting file does not have valid JSON data");
    });

    it("should be rejected if parameter file has incorrect property types", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testPS = await createNewComponent(projectRootDir, projectRootDir, "PS", { x: 0, y: 0 });

      //パラメータファイルを設定
      testPS.parameterFile = "wrong_types.json";

      //プロパティの型が正しくないJSONファイルを作成
      const wrongTypeParams = {
        version: "2", //数値ではなく文字列
        targetFiles: [
          { targetName: "foo" }
        ],
        params: [
          { keyword: "foo", type: "min-max-step", min: "0", max: "4", step: "1" } //数値ではなく文字列
        ]
      };

      fs.writeJsonSync(path.resolve(projectRootDir, testPS.name, "wrong_types.json"), wrongTypeParams);

      const validate = sinon.stub().returns(false);
      validate.errors = [{ message: "should be number" }];
      sinon.stub(_internal, "validate").value(validate);

      //テスト実行
      await expect(validateParameterStudy(projectRootDir, testPS)).to.be.rejectedWith("parameter setting file does not have valid JSON data");
    });

    it("should be rejected if parameter file has incorrect version", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testPS = await createNewComponent(projectRootDir, projectRootDir, "PS", { x: 0, y: 0 });

      //パラメータファイルを設定
      testPS.parameterFile = "wrong_version.json";

      //バージョンが正しくないJSONファイルを作成
      const wrongVersionParams = {
        version: 1, //バージョン1は無効
        targetFiles: [
          { targetName: "foo" }
        ],
        params: [
          { keyword: "foo", type: "min-max-step", min: 0, max: 4, step: 1 }
        ]
      };

      fs.writeJsonSync(path.resolve(projectRootDir, testPS.name, "wrong_version.json"), wrongVersionParams);
      const validate = sinon.stub().returns(false);
      validate.errors = [{ message: "should be equal to constant" }];
      sinon.stub(_internal, "validate").value(validate);

      //テスト実行
      await expect(validateParameterStudy(projectRootDir, testPS)).to.be.rejectedWith("parameter setting file does not have valid JSON data");
    });
  });
  describe("validateStorage", () => {
    let storage;
    beforeEach(async () => {
      storage = await createNewComponent(projectRootDir, projectRootDir, "storage", { x: 0, y: 0 });
    });
    it("should be rejected if storagePath is not set", () => {
      storage.storagePath = null;
      return expect(validateStorage(storage)).to.be.rejectedWith("storagePath is not set");
    });
    it("should be rejected if storagePath is empty string", () => {
      storage.storagePath = "";
      return expect(validateStorage(storage)).to.be.rejectedWith("specified path does not exist on localhost");
    });
    it("should be rejected if storagePath is blank", () => {
      storage.storagePath = "   ";
      return expect(validateStorage(storage)).to.be.rejectedWith("specified path does not exist on localhost");
    });
    it("should be rejected if storagePath is not existing path", () => {
      storage.storagePath = path.resolve(projectRootDir, "hoge");
      return expect(validateStorage(storage)).to.be.rejectedWith("specified path does not exist on localhost");
    });
    it("should be rejected if storagePath is existing file", () => {
      fs.writeFileSync(path.resolve(projectRootDir, "hoge"), "hoge");
      storage.storagePath = path.resolve(projectRootDir, "hoge");
      return expect(validateStorage(storage)).to.be.rejectedWith("specified path is not directory");
    });
    it("should be rejected if invalid host is set", () => {
      storage.host = "hoge";
      storage.storagePath = "hoge";
      return expect(validateStorage(storage)).to.be.rejectedWith(/remote host setting for .* not found/);
    });
    it("should be resolved with true if storagePath is not existing path but host is set", async () => {
      storage.storagePath = path.resolve(projectRootDir, "hoge");
      storage.host = "OK";
      expect(await validateStorage(storage)).to.be.true;
    });
    it("should be resolved with true if storagePath is existing file but host is set", async () => {
      fs.writeFileSync(path.resolve(projectRootDir, "hoge"), "hoge");
      storage.storagePath = path.resolve(projectRootDir, "hoge");
      storage.host = "OK";
      expect(await validateStorage(storage)).to.be.true;
    });
    it("should be resolved with true if storagePath is existing directory", async () => {
      //projectRootDirは既に存在するディレクトリ
      storage.storagePath = projectRootDir;
      expect(await validateStorage(storage)).to.be.true;
    });
    it("should be resolved with true if storagePath is existing directory and host is set", async () => {
      storage.storagePath = projectRootDir;
      storage.host = "OK";
      expect(await validateStorage(storage)).to.be.true;
    });
    it("should be resolved with true if storagePath is relative path and host is set", async () => {
      storage.storagePath = "./relative/path";
      storage.host = "OK";
      expect(await validateStorage(storage)).to.be.true;
    });
    it("should be resolved with true if storagePath is absolute path and host is set", async () => {
      storage.storagePath = "/absolute/path";
      storage.host = "OK";
      expect(await validateStorage(storage)).to.be.true;
    });
  });
  describe("validateInputFiles", () => {
    let component;
    beforeEach(() => {
      component = { inputFiles: [] };
    });
    it("should be rejected if one of input filename is invalid", () => {
      component.inputFiles.push({ name: "hoge", src: [] });
      component.inputFiles.push({ name: "h*ge", src: [] });
      return expect(validateInputFiles(component)).to.be.rejectedWith(/.* is not allowed as input file./);
    });
    it("should be rejected if input filename is null", () => {
      component.inputFiles.push({ name: null, src: [] });
      return expect(validateInputFiles(component)).to.be.rejectedWith(/.* is not allowed as input file./);
    });
    it("should be rejected if input filename is empty string", () => {
      component.inputFiles.push({ name: "", src: [] });
      return expect(validateInputFiles(component)).to.be.rejectedWith(/.* is not allowed as input file./);
    });
    it("should be rejected if input filename is blank", () => {
      component.inputFiles.push({ name: "   ", src: [] });
      return expect(validateInputFiles(component)).to.be.rejectedWith(/.* is not allowed as input file./);
    });
    it("should be rejected if inputFile is file and has 2 or more connection", () => {
      component.inputFiles.push({ name: "hoge", src: [{}, {}] });
      return expect(validateInputFiles(component)).to.be.rejectedWith(/inputFile .* data type is 'file' but it has two or more outputFiles./);
    });
    it("should be resolved with true if inputFile is file and is not connected", async () => {
      component.inputFiles.push({ name: "hoge", src: [] });
      expect(await validateInputFiles(component)).to.be.true;
    });
    it("should be resolved with true if inputFile is file and has only 1 connection", async () => {
      component.inputFiles.push({ name: "hoge", src: [{}] });
      expect(await validateInputFiles(component)).to.be.true;
    });
    it("should be resolved with true if inputFile is directory and has 2 or more connection", async () => {
      component.inputFiles.push({ name: "hoge/", src: [{}, {}] });
      expect(await validateInputFiles(component)).to.be.true;
    });
    it("should be resolved with true if multiple valid inputFiles", async () => {
      component.inputFiles.push({ name: "file1.txt", src: [] });
      component.inputFiles.push({ name: "file2.txt", src: [] });
      component.inputFiles.push({ name: "directory/", src: [] });
      expect(await validateInputFiles(component)).to.be.true;
    });
    it("should be resolved with true if no inputFiles", async () => {
      //inputFilesは空の配列のまま
      expect(await validateInputFiles(component)).to.be.true;
    });
    it("should be resolved with true if inputFile has valid path format", async () => {
      component.inputFiles.push({ name: "path/to/file.txt", src: [] });
      expect(await validateInputFiles(component)).to.be.true;
    });
  });
  describe("validateOutputFiles", () => {
    let component;
    beforeEach(() => {
      component = { outputFiles: [] };
    });
    it("should be rejected if output filename is blank", () => {
      component.outputFiles.push({ name: "   ", dst: [] });
      return expect(validateOutputFiles(component)).to.be.rejectedWith(/.* is not allowed as output filename./);
    });
    it("should be resolved with true if output filename contains special characters", async () => {
      component.outputFiles.push({ name: "file*name", dst: [] });
      expect(await validateOutputFiles(component)).to.be.true;
    });
    it("should be rejected if output filename is null", () => {
      component.outputFiles.push({ name: null, dst: [] });
      return expect(validateOutputFiles(component)).to.be.rejectedWith(/.* is not allowed as output filename./);
    });
    it("should be rejected if output filename is empty string", () => {
      component.outputFiles.push({ name: "", dst: [] });
      return expect(validateOutputFiles(component)).to.be.rejectedWith(/.* is not allowed as output filename./);
    });
    it("should be resolved with true if output filename is valid", async () => {
      component.outputFiles.push({ name: "validfile.txt", dst: [] });
      expect(await validateOutputFiles(component)).to.be.true;
    });
    it("should be resolved with true if multiple output files with valid names", async () => {
      component.outputFiles.push({ name: "file1.txt", dst: [] });
      component.outputFiles.push({ name: "file2.txt", dst: [] });
      component.outputFiles.push({ name: "file3.txt", dst: [] });
      expect(await validateOutputFiles(component)).to.be.true;
    });
    it("should be resolved with true if no output files", async () => {
      //outputFilesは空の配列のまま
      expect(await validateOutputFiles(component)).to.be.true;
    });
    it("should be resolved with true if output filename is a directory path", async () => {
      component.outputFiles.push({ name: "directory/", dst: [] });
      expect(await validateOutputFiles(component)).to.be.true;
    });
  });
});

describe("validateComponents function", function() {
  this.timeout(10000); //タイムアウト時間を延長
  beforeEach(async function() {
    await fs.remove(testDirRoot);

    try {
      await createNewProject(projectRootDir, "test project", null, "test", "test@example.com");
    } catch (e) {
      console.log(e);
      throw e;
    }

    sinon.stub(_internal, "getComponentDir").callsFake(async (projectRootDir, ID, isAbsolute) => {
      //テスト用のコンポーネントディレクトリを返す
      if (ID === "test-ps") {
        return path.resolve(projectRootDir, "test-ps");
      }
      //それ以外のIDの場合は元の関数を呼び出す
      return validateComponents._internal.getComponentDir.wrappedMethod.call(null, projectRootDir, ID, isAbsolute);
    });
  });
  afterEach(() => {
    sinon.restore();
  });
  after(async function() {
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
  });

  it("should validate if component with else branch", async function() {
    //ifコンポーネントを作成（else分岐あり）
    const ifComponent = await createNewComponent(projectRootDir, projectRootDir, "if", { x: 0, y: 0 });
    ifComponent.condition = "condition.js";
    ifComponent.else = ["else-branch-id"]; //else分岐を追加

    //条件ファイルを作成
    const conditionPath = path.resolve(projectRootDir, ifComponent.name, "condition.js");
    await fs.writeFile(conditionPath, "module.exports = function() { return true; }");

    sinon.stub(_internal, "getNextComponents").callsFake((components, component) => {
      const nextComponentIDs = [];
      if (component.next) {
        nextComponentIDs.push(...component.next);
      }
      if (component.else) {
        nextComponentIDs.push(...component.else);
      }
      return components.filter((c) => nextComponentIDs.includes(c.ID));
    });

    //validateComponentを実行
    const error = await validateComponent(projectRootDir, ifComponent);

    //エラーがないことを確認
    expect(error).to.be.null;
  });

  it("should validate bulkjobTask with manualFinishCondition", async function() {
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

  it("should validate component with outputFiles having multiple destinations", async function() {
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

    sinon.stub(_internal, "getNextComponents").callsFake((components, component) => {
      const nextComponentIDs = [];
      if (component.outputFiles) {
        component.outputFiles.forEach((outputFile) => {
          outputFile.dst.forEach((dst) => {
            if (!dst.origin) {
              nextComponentIDs.push(dst.dstNode);
            }
          });
        });
      }
      return components.filter((c) => nextComponentIDs.includes(c.ID));
    });

    //validateComponentを実行
    const error = await validateComponent(projectRootDir, task);

    //エラーがないことを確認
    expect(error).to.be.null;
  });

  it("should handle complex component hierarchy in recursiveValidateComponents", async function() {
    //複雑な階層構造を持つコンポーネントをモック
    sinon.stub(_internal, "getChildren").callsFake(async (projectRootDir, parentID) => {
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

    sinon.stub(_internal, "hasChild").callsFake((component) => {
      return component.ID === "parent1" || component.ID === "parent2";
    });

    sinon.stub(_internal, "isInitialComponent").resolves(true);

    //レポート配列を作成
    const report = [];

    //recursiveValidateComponentsを実行
    await recursiveValidateComponents(projectRootDir, "root", report);

    //レポートにエラーが含まれていることを確認（child4のみエラー、child3は無効化されているためスキップ）
    expect(report).to.be.an("array");
    expect(report.some((item) => item.ID === "child4")).to.be.true;
    expect(report.some((item) => item.ID === "child3")).to.be.false;
  });
  it("should validate component correctly", async function() {
    //実際のコンポーネントを作成
    const task = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });
    task.script = "script.sh";
    //スクリプトファイルを作成
    fs.writeFileSync(path.resolve(projectRootDir, task.name, "script.sh"), "#!/bin/bash\necho 'Hello'");
    //validateComponentを実行
    const error = await validateComponent(projectRootDir, task);
    expect(error).to.be.null;
  });
  it("should detect invalid component", async function() {
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
  it("should detect cycle graph", async function() {
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

  it("should validate parameterStudy component correctly", async function() {
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

  it("should validate component with inputFiles and outputFiles", async function() {
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

  it("should call validateComponents with startComponentID", async function() {
    //コンポーネントを作成
    const task = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });
    task.script = "script.sh";
    fs.writeFileSync(path.resolve(projectRootDir, task.name, "script.sh"), "#!/bin/bash\necho 'Hello'");

    //validateComponentsを実行（startComponentIDを指定）
    const report = await validateComponents.validateComponents(projectRootDir, task.ID);
    expect(report).to.be.an("array");
  });

  it("should call validateComponents without startComponentID", async function() {
    //validateComponentsを実行（startComponentIDを指定しない）
    const report = await validateComponents.validateComponents(projectRootDir);
    expect(report).to.be.an("array");
  });
});