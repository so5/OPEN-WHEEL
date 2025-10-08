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
const { validateBulkjobTask, _internal } = require("../../../../app/core/validateComponents.js");

//test data
const testDirRoot = "WHEEL_TEST_TMP";

const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");
describe("validateBulkjob UT", function () {
  beforeEach(async function () {
    this.timeout(10000);
    await fs.remove(testDirRoot);
    sinon.stub(_internal.remoteHost, "query").callsFake((name, hostname)=>{
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

    sinon.stub(_internal, "jobScheduler").value({
      hoge: { queueOpt: "-q" },
      huga: { queueOpt: "-q", supportStepjob: true },
      hige: { queueOpt: "-q", supportBulkjob: true }
    });

    try {
      await createNewProject(projectRootDir, "test project", null, "test", "test@example.com");
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
  afterEach(()=>{
    sinon.restore();
  });
  after(async ()=>{
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
  });
  describe("validateBulkjobTask", ()=>{
    let bulkjobTask;
    beforeEach(async ()=>{
      bulkjobTask = await createNewComponent(projectRootDir, projectRootDir, "bulkjobTask", { x: 0, y: 0 });
    });
    it("should be rejected if name is not defined", ()=>{
      bulkjobTask.name = null;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("illegal path");
    });
    it("should be rejected if useJobScheduler is not set", ()=>{
      bulkjobTask.useJobScheduler = false;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("useJobScheduler must be set");
    });
    it("should be rejected if host is not set", ()=>{
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("bulkjobTask is only supported on remotehost");
    });
    it("should be rejected if host not found", ()=>{
      bulkjobTask.host = "hoge";
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith(/remote host setting for .* not found/);
    });
    it("should be rejected if host is not support job", ()=>{
      bulkjobTask.host = "OK";
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith(/job scheduler for .* is not supported/);
    });
    it("should be rejected if jobscheduler is not support bulkjobTask", ()=>{
      bulkjobTask.host = "jobOK";
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith(/job scheduler .* does not support bulkjob/);
    });
    it("should be rejected if host is not set to use bulkjob", ()=>{
      bulkjobTask.host = "bulkjobNG";
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith(/.* does not set to use bulkjob/);
    });
    it("should be rejected if usePSSettingFile is set but parameterFile is not set", async ()=>{
      bulkjobTask.host = "bulkjobOK";
      //bulkjobTask.usePSSettingFile is true by default, so we do not set it here
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("usePSSettingFile is set but parameter setting file is not specified");
    });

    it("should be rejected if script is not specified for usePSSettingFile=true case", async function () {
      //各テストケースで新しいコンポーネントを作成
      const testBulkjobTask = await createNewComponent(projectRootDir, projectRootDir, "bulkjobTask", { x: 0, y: 0 });
      testBulkjobTask.host = "bulkjobOK";
      testBulkjobTask.usePSSettingFile = true;
      testBulkjobTask.parameterFile = "nonexistent.json";
      //scriptを設定しない

      //テスト実行
      await expect(validateBulkjobTask(projectRootDir, testBulkjobTask)).to.be.rejectedWith(/script is not specified/);
    });

    it("should be rejected if script does not exist for usePSSettingFile=true case", async function () {
      //各テストケースで新しいコンポーネントを作成
      const testBulkjobTask = await createNewComponent(projectRootDir, projectRootDir, "bulkjobTask", { x: 0, y: 0 });
      testBulkjobTask.host = "bulkjobOK";
      testBulkjobTask.usePSSettingFile = true;
      testBulkjobTask.parameterFile = "paramFile.json";
      testBulkjobTask.script = "nonexistent.sh";

      //テスト実行
      await expect(validateBulkjobTask(projectRootDir, testBulkjobTask)).to.be.rejectedWith(/script is not existing file/);
    });

    it("should be rejected if script is not a file for usePSSettingFile=true case", async function () {
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

    it("should be rejected if usePSSettingFile is not set and startBulkNumber is not set", async ()=>{
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("startBulkNumber must be specified");
    });
    it("should be rejected if usePSSettingFile is not set and startBulkNumber is negative value", async ()=>{
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = -1;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("startBulkNumber must be integer and 0 or more");
    });
    it("should be rejected if usePSSettingFile is not set and endBulkNumber is not set", async ()=>{
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = 1;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("endBulkNumber must be specified");
    });
    it("should be rejected if endBulkNumber is less or equal startBulkNumber", async ()=>{
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = 1;
      bulkjobTask.endBulkNumber = 1;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("endBulkNumber must be integer and greater than startBulkNumber");
    });
    it("should be rejected if manualFinishCondition is set but condition is not specidied", async ()=>{
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = 1;
      bulkjobTask.endBulkNumber = 2;
      bulkjobTask.manualFinishCondition = true;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("condition is not specified");
    });
    //TODO conditionを実際に指定したケースの確認

    it("should be rejected if script is not set", async ()=>{
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = 1;
      bulkjobTask.endBulkNumber = 2;
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("script is not specified");
    });
    it("should be rejected if script is not existing", ()=>{
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = 1;
      bulkjobTask.endBulkNumber = 2;
      bulkjobTask.script = "hoge";
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("script is not exist");
    });
    it("should be rejected if script is not file", ()=>{
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = 1;
      bulkjobTask.endBulkNumber = 2;
      bulkjobTask.script = "hoge";
      fs.mkdirSync(path.resolve(projectRootDir, bulkjobTask.name, "hoge"));
      return expect(validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.rejectedWith("script is not file");
    });
    it("should be resolved with true", async ()=>{
      bulkjobTask.host = "bulkjobOK";
      bulkjobTask.usePSSettingFile = false;
      bulkjobTask.startBulkNumber = 1;
      bulkjobTask.endBulkNumber = 2;
      bulkjobTask.script = "hoge";
      fs.writeFileSync(path.resolve(projectRootDir, bulkjobTask.name, "hoge"), "hoge");
      expect(await validateBulkjobTask(projectRootDir, bulkjobTask)).to.be.true;
    });
  });
});
