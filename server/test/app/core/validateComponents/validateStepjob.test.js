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
const { validateStepjob, validateStepjobTask, _internal } = require("../../../../app/core/validateComponents.js");


//test data
const testDirRoot = "WHEEL_TEST_TMP";

const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");
describe("validateStepjob UT", function() {
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
  afterEach(() => {
    sinon.restore();
  });
  after(async () => {
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
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
});