/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import path from "path";
import fs from "fs-extra";
import sinon from "sinon";

//setup test framework
import chai from "chai";
import sinonChai from "sinon-chai";
import chaiFs from "chai-fs";
import chaiJsonSchema from "chai-json-schema";
import deepEqualInAnyOrder from "deep-equal-in-any-order";
import chaiAsPromised from "chai-as-promised";
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiFs);
chai.use(chaiJsonSchema);
chai.use(deepEqualInAnyOrder);
chai.use(chaiAsPromised);
import { createNewProject, createNewComponent } from "../../../../app/core/projectFilesOperator.js";

//testee
import { validateTask, _internal } from "../../../../app/core/validateComponents.js";

//test data
const testDirRoot = "WHEEL_TEST_TMP";

const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");
describe("validateTask UT", function () {
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
  describe("validateTask", ()=>{
    let task;
    beforeEach(async ()=>{
      task = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });
    });
    it("should be rejected with 'no script' error for default component", ()=>{
      return expect(validateTask(projectRootDir, task)).to.be.rejectedWith("script is not specified");
    });
    it("should be rejected if name is not defined", ()=>{
      task.name = null;
      return expect(validateTask(projectRootDir, task)).to.be.rejectedWith("illegal path");
    });
    it("should be rejected if not existing remote host is set", ()=>{
      task.useJobScheduler = true;
      task.host = "hoge";
      return expect(validateTask(projectRootDir, task)).to.be.rejectedWith(/remote host setting for .* not found/);
    });
    it("should be rejected if not existing jobScheduler is set", ()=>{
      task.useJobScheduler = true;
      task.host = "OK";
      return expect(validateTask(projectRootDir, task)).to.be.rejectedWith(/job scheduler for .* is not supported/);
    });
    it("should be rejected if not existing jobScheduler is set", ()=>{
      task.useJobScheduler = true;
      task.host = "jobOK";
      task.submitOption = "-q foo bar -i hoge";
      return expect(validateTask(projectRootDir, task)).to.be.rejectedWith("submit option duplicate queue option");
    });
    it("should be rejected if script is not existing", ()=>{
      task.script = "hoge";
      return expect(validateTask(projectRootDir, task)).to.be.rejectedWith("script is not existing file");
    });
    it("should be rejected if script is not file", ()=>{
      task.script = "hoge";
      fs.mkdirSync(path.resolve(projectRootDir, task.name, "hoge"));
      return expect(validateTask(projectRootDir, task)).to.be.rejectedWith("script is not file");
    });
    it("should be resolved with true if required prop is set", async ()=>{
      task.script = "hoge";
      fs.writeFileSync(path.resolve(projectRootDir, task.name, "hoge"), "hoge");
      return expect(await validateTask(projectRootDir, task)).to.be.true;
    });

    it("should be resolved with true for local job (no host set)", async function () {
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

    it("should be resolved with true if remote host and job scheduler are correctly set", async function () {
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

    it("should be resolved with true if submit option is set and does not duplicate queue option", async function () {
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
});
