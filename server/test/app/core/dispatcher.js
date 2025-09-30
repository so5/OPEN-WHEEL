/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const path = require("path");
const fs = require("fs-extra");
const SshClientWrapper = require("ssh-client-wrapper");

//setup test framework
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
chai.use(require("sinon-chai"));
chai.use(require("chai-fs"));
chai.use(require("chai-json-schema"));

//test data
const testDirRoot = "WHEEL_TEST_TMP";
const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");
//testee
const Dispatcher = require("../../../app/core/dispatcher");
const { _internal } = require("../../../app/core/dispatcher");
const { eventEmitters } = require("../../../app/core/global.js");
eventEmitters.set(projectRootDir, { emit: sinon.stub() });

//helper functions
const { projectJsonFilename, componentJsonFilename } = require("../../../app/db/db.js");
const { createNewProject, updateComponent, createNewComponent, addInputFile, addOutputFile, addLink, addFileLink, renameOutputFile } = require("../../../app/core/projectFilesOperator.js");
const { scriptName, pwdCmd, scriptHeader } = require("../../testScript.js");
const scriptPwd = `${scriptHeader}\n${pwdCmd}`;
const wait = ()=>{
  return new Promise((resolve)=>{
    setTimeout(resolve, 10);
  });
};

const { remoteHost } = require("../../../app/db/db.js");
const { addSsh } = require("../../../app/core/sshManager.js");

describe("UT for Dispatcher class", function() {
  this.timeout(0);
  let rootWF;
  let projectJson;
  beforeEach(async ()=>{
    await fs.remove(testDirRoot);
    await createNewProject(projectRootDir, "test project", null, "test", "test@example.com");
    rootWF = await fs.readJson(path.resolve(projectRootDir, componentJsonFilename));
  });
  after(async ()=>{
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
  });

  describe("#replaceByNunjucksForBulkjob test", async ()=>{
    const templateRoot = path.resolve(testDirRoot, "templates");
    const targetFiles = ["template1.txt", "template2.txt"];
    const params = { key1: "value1", key2: "value2" };
    const bulkNumber = 42;
    const templates = {
      "template1.txt": "Hello, {{ key1 }}!",
      "template2.txt": "Goodbye, {{ key2 }}!"
    };
    const replaceByNunjucksForBulkjob = _internal.replaceByNunjucksForBulkjob;

    beforeEach(async function() {
      await fs.ensureDir(templateRoot);

      for (const [file, content] of Object.entries(templates)) {
        await fs.outputFile(path.join(templateRoot, file), content);
      }
    });
    afterEach(async function() {
      await fs.remove(testDirRoot);
    });
    it("should replace target files and save with new filenames", async function() {
      await replaceByNunjucksForBulkjob(templateRoot, targetFiles, params, bulkNumber);
      const newFile1 = path.resolve(templateRoot, `${bulkNumber}.template1.txt`);
      const newFile2 = path.resolve(templateRoot, `${bulkNumber}.template2.txt`);
      expect(newFile1).to.be.a.file().with.content("Hello, value1!");
      expect(newFile2).to.be.a.file().with.content("Goodbye, value2!");
    });
    it("should throw an error if a target file does not exist", async function() {
      const invalidFiles = ["template1.txt", "nonexistent.txt"];
      await expect(
        replaceByNunjucksForBulkjob(templateRoot, invalidFiles, params, bulkNumber)
      ).to.be.rejectedWith(Error);
    });
    it("should handle empty targetFiles gracefully", async function() {
      await replaceByNunjucksForBulkjob(templateRoot, [], params, bulkNumber);
      //ファイルが作成されていないことを確認
      const files = await fs.readdir(templateRoot);
      expect(files).to.have.members(Object.keys(templates));
    });
  });

  describe("writeParameterSetFile test", function() {
    const templateRoot = path.resolve(testDirRoot, "templates");
    const targetFiles = ["file1.txt", "file2.txt"];
    const params = { key1: "value1", key2: "value2" };
    const bulkNumber = 42;
    const writeParameterSetFile = _internal.writeParameterSetFile;
    beforeEach(async function() {
      await fs.ensureDir(templateRoot);

      for (const file of targetFiles) {
        await fs.outputFile(path.join(templateRoot, file), "content");
      }
    });
    afterEach(async function() {
      await fs.remove(testDirRoot);
    });
    it("should write parameters to parameterSet.wheel.txt", async function() {
      const parameterSetFilePath = path.resolve(templateRoot, "parameterSet.wheel.txt");
      await writeParameterSetFile(templateRoot, targetFiles, params, bulkNumber);
      expect(parameterSetFilePath).to.be.a.file();
      const expectedContent = [
        `BULKNUM_${bulkNumber}_TARGETNUM_0_FILE="./file1.txt"`,
        `BULKNUM_${bulkNumber}_TARGETNUM_0_KEY="key1"`,
        `BULKNUM_${bulkNumber}_TARGETNUM_0_VALUE="value1"`,
        `BULKNUM_${bulkNumber}_TARGETNUM_1_FILE="./file2.txt"`,
        `BULKNUM_${bulkNumber}_TARGETNUM_1_KEY="key2"`,
        `BULKNUM_${bulkNumber}_TARGETNUM_1_VALUE="value2"`
      ].join("\n") + "\n";
      const actualContent = await fs.readFile(parameterSetFilePath, "utf-8");
      expect(actualContent).to.equal(expectedContent);
    });
    it("should handle empty targetFiles gracefully", async function() {
      const parameterSetFilePath = path.resolve(templateRoot, "parameterSet.wheel.txt");
      await writeParameterSetFile(templateRoot, [], {}, bulkNumber);
      expect(parameterSetFilePath).not.to.be.a.path();
    });
    it("should append parameters to an existing file", async function() {
      const parameterSetFilePath = path.resolve(templateRoot, "parameterSet.wheel.txt");
      await fs.outputFile(parameterSetFilePath, "Initial content\n");
      await writeParameterSetFile(templateRoot, targetFiles, params, bulkNumber);
      const expectedContent = [
        `BULKNUM_${bulkNumber}_TARGETNUM_0_FILE="./file1.txt"`,
        `BULKNUM_${bulkNumber}_TARGETNUM_0_KEY="key1"`,
        `BULKNUM_${bulkNumber}_TARGETNUM_0_VALUE="value1"`,
        `BULKNUM_${bulkNumber}_TARGETNUM_1_FILE="./file2.txt"`,
        `BULKNUM_${bulkNumber}_TARGETNUM_1_KEY="key2"`,
        `BULKNUM_${bulkNumber}_TARGETNUM_1_VALUE="value2"`
      ].join("\n") + "\n";
      const actualContent = await fs.readFile(parameterSetFilePath, "utf-8");
      expect(actualContent).to.equal(expectedContent);
    });
    it("should throw an error if a file cannot be written", async function() {
      const nonWritableDir = path.resolve(testDirRoot, "nonWritable");
      await fs.ensureDir(nonWritableDir);
      await fs.chmod(nonWritableDir, 0o400); //読み取り専用に設定
      const invalidTemplateRoot = path.join(nonWritableDir, "templates");
      await expect(
        writeParameterSetFile(invalidTemplateRoot, targetFiles, params, bulkNumber)
      ).to.be.rejectedWith(Error);
      //権限を元に戻してディレクトリを削除
      await fs.chmod(nonWritableDir, 0o700);
      await fs.remove(nonWritableDir);
    });
  });

  describe("#outputFile delivery functionality", async ()=>{
    let previous;
    let next;
    let storage;
    const storageArea = path.resolve(testDirRoot, "storageArea");
    beforeEach(async ()=>{
      previous = await createNewComponent(projectRootDir, projectRootDir, "workflow", { x: 10, y: 10 });
      next = await createNewComponent(projectRootDir, projectRootDir, "workflow", { x: 10, y: 10 });
      storage = await createNewComponent(projectRootDir, projectRootDir, "storage", { x: 10, y: 10 });
      await updateComponent(projectRootDir, storage.ID, "storagePath", storageArea);
      projectJson = await fs.readJson(path.resolve(projectRootDir, projectJsonFilename));
    });
    it("should make link from outputFile to inputFile", async ()=>{
      await addOutputFile(projectRootDir, previous.ID, "a");
      await addInputFile(projectRootDir, next.ID, "b");
      await addFileLink(projectRootDir, previous.ID, "a", next.ID, "b");
      await fs.outputFile(path.resolve(projectRootDir, previous.name, "a"), "hoge");
      const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, {}, "");
      expect(await DP.start()).to.be.equal("finished");
      expect(path.resolve(projectRootDir, next.name, "a")).not.to.be.a.path();
      expect(path.resolve(projectRootDir, next.name, "b")).to.be.a.file().and.equal(path.resolve(projectRootDir, previous.name, "a"));
    });
    it("should do nothing if outputFile has glob which match nothing", async ()=>{
      await addOutputFile(projectRootDir, previous.ID, "a*");
      await addInputFile(projectRootDir, next.ID, "b");
      await addFileLink(projectRootDir, previous.ID, "a*", next.ID, "b");
      const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, {}, "");
      expect(await DP.start()).to.be.equal("finished");
      expect(path.resolve(projectRootDir, next.name, "b")).not.to.be.a.path();
      expect(path.resolve(projectRootDir, next.name, "a*")).not.to.be.a.path();
    });
    it("should accept environment variable as part of outputFile name ", async ()=>{
      await addOutputFile(projectRootDir, previous.ID, "{{ WHEEL_CURRENT_INDEX }}a");
      await addInputFile(projectRootDir, next.ID, "b");
      await addFileLink(projectRootDir, previous.ID, "{{ WHEEL_CURRENT_INDEX }}a", next.ID, "b");
      await fs.outputFile(path.resolve(projectRootDir, previous.name, "3a"), "hoge");
      projectJson.env = { WHEEL_CURRENT_INDEX: 3 };
      const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, projectJson.env, "");
      expect(await DP.start()).to.be.equal("finished");
      expect(path.resolve(projectRootDir, next.name, "3a")).not.to.be.a.path();
      expect(path.resolve(projectRootDir, next.name, "b")).to.be.a.file().and.equal(path.resolve(projectRootDir, previous.name, "3a"));
    });
    it("should accept environment variable as part of inputFile name ", async ()=>{
      await addOutputFile(projectRootDir, previous.ID, "a");
      await addInputFile(projectRootDir, next.ID, "b{{ WHEEL_CURRENT_INDEX }}");
      await addFileLink(projectRootDir, previous.ID, "a", next.ID, "b{{ WHEEL_CURRENT_INDEX }}");
      await fs.outputFile(path.resolve(projectRootDir, previous.name, "a"), "hoge");
      projectJson.env = { WHEEL_CURRENT_INDEX: "hoge" };
      const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, projectJson.env, "");
      expect(await DP.start()).to.be.equal("finished");
      expect(path.resolve(projectRootDir, next.name, "a")).not.to.be.a.path();
      expect(path.resolve(projectRootDir, next.name, "bhoge")).to.be.a.file().and.equal(path.resolve(projectRootDir, previous.name, "a"));
    });
    it("should copy files from storage component's outputFile to inputFile", async ()=>{
      await addOutputFile(projectRootDir, storage.ID, "a");
      await addInputFile(projectRootDir, next.ID, "b");
      await addFileLink(projectRootDir, storage.ID, "a", next.ID, "b");
      await fs.outputFile(path.join(storageArea, "a"), "hoge");
      const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, {}, "");
      expect(await DP.start()).to.be.equal("finished");
      expect(path.resolve(projectRootDir, next.name, "a")).not.to.be.a.path();
      expect(path.resolve(projectRootDir, next.name, "b")).to.be.a.file().and.equal(path.resolve(storageArea, "a"));
      const stats = await fs.lstat(path.resolve(projectRootDir, next.name, "b"));
      expect(stats.isSymbolicLink()).to.be.false;
    });
    it("should move storage component's inputFile to storagePath", async ()=>{
      await addOutputFile(projectRootDir, previous.ID, "a");
      await addInputFile(projectRootDir, storage.ID, "b");
      await addFileLink(projectRootDir, previous.ID, "a", storage.ID, "b");
      await fs.outputFile(path.resolve(projectRootDir, previous.name, "a"), "hoge");
      const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, {}, "");
      expect(await DP.start()).to.be.equal("finished");
      expect(path.resolve(projectRootDir, storage.name, "a")).not.to.be.a.path();
      expect(path.resolve(projectRootDir, storage.name, "b")).not.to.be.a.path();
      expect(path.resolve(storageArea, "b")).to.be.a.file().and.equal(path.resolve(projectRootDir, previous.name, "a"));
    });
    describe("run on remote host", ()=>{
      let ssh;
      const remotehostName = process.env.WHEEL_TEST_REMOTEHOST;
      const password = process.env.WHEEL_TEST_REMOTE_PASSWORD;
      before(async function() {
        if (!remotehostName) {
          console.log("remote exec test will be skipped because WHEEL_TEST_REMOTEHOST is not set");
          this.skip();
        }

        if (!password) {
          console.log("remote exec test will be done without password because WHEEL_TEST_REMOTE_PASSWORD is not set");
        }
        const hostInfo = remoteHost.query("name", remotehostName);
        hostInfo.password = password;
        hostInfo.noStrictHostKeyChecking = true;
        ssh = new SshClientWrapper(hostInfo);

        try {
          const rt = await ssh.canConnect();

          if (!rt) {
            throw new Error("canConnect failed");
          }
          addSsh(projectRootDir, hostInfo, ssh);
        } catch (e) {
          console.log(`ssh connection failed to ${remotehostName} due to "${e}" so remote exec test is skipped`);
          this.skip();
        } finally {
          await ssh.disconnect();
        }
      });
      after(async ()=>{
        if (ssh) {
          await ssh.disconnect();
        }
      });
      describe("[reproduction test] subsequent component can get inputFile from remote storage component", ()=>{
        const remoteStorageArea = `/tmp/${storageArea}`;
        beforeEach(async ()=>{
          await updateComponent(projectRootDir, storage.ID, "host", remotehostName);
          await updateComponent(projectRootDir, storage.ID, "storagePath", remoteStorageArea);
          await addOutputFile(projectRootDir, storage.ID, "a");
          await addInputFile(projectRootDir, next.ID, "b");
          await addFileLink(projectRootDir, storage.ID, "a", next.ID, "b");
          await ssh.exec(`mkdir -p ${remoteStorageArea} && echo hoge > ${remoteStorageArea}/a`);
        });
        it("should deliver file as real file", async ()=>{
          const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, {}, "");
          expect(await DP.start()).to.be.equal("finished");
          expect(path.resolve(projectRootDir, next.name, "a")).not.to.be.a.path();
          expect(path.resolve(projectRootDir, next.name, "b")).to.be.a.file();
          const stats = await fs.lstat(path.resolve(projectRootDir, next.name, "b"));
          expect(stats.isSymbolicLink()).to.be.false;
        });
      });
    });
  });
  describe("#For component", ()=>{
    let for0;
    beforeEach(async ()=>{
      for0 = await createNewComponent(projectRootDir, projectRootDir, "for", { x: 10, y: 10 });
      projectJson = await fs.readJson(path.resolve(projectRootDir, projectJsonFilename));
    });
    it("should copy 3 times and delete all component", async ()=>{
      await updateComponent(projectRootDir, for0.ID, "start", 0);
      await updateComponent(projectRootDir, for0.ID, "end", 2);
      await updateComponent(projectRootDir, for0.ID, "step", 1);
      await updateComponent(projectRootDir, for0.ID, "keep", 0);
      const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, {}, "");
      expect(await DP.start()).to.be.equal("finished");
      await wait();
      expect(path.resolve(projectRootDir, `${for0.name}_0`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, `${for0.name}_1`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, `${for0.name}_2`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, `${for0.name}_3`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, for0.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
        properties: {
          numFinishd: {
            type: "integer",
            minimum: 3,
            maximum: 3

          },
          numTotal: {
            type: "integer",
            minimum: 3,
            maximum: 3
          }
        }
      });
    });

    it("should work with negative step number", async ()=>{
      await updateComponent(projectRootDir, for0.ID, "end", 0);
      await updateComponent(projectRootDir, for0.ID, "start", 2);
      await updateComponent(projectRootDir, for0.ID, "step", -1);
      const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, {}, "");
      expect(await DP.start()).to.be.equal("finished");
      expect(path.resolve(projectRootDir, `${for0.name}_0`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_1`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_2`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_3`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, for0.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
        properties: {
          numFinishd: {
            type: "integer",
            minimum: 3,
            maximum: 3

          },
          numTotal: {
            type: "integer",
            minimum: 3,
            maximum: 3
          }
        }
      });
    });
    it("should work with step number which is greater than 1", async ()=>{
      await updateComponent(projectRootDir, for0.ID, "start", 1);
      await updateComponent(projectRootDir, for0.ID, "end", 3);
      await updateComponent(projectRootDir, for0.ID, "step", 2);
      const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, {}, "");
      expect(await DP.start()).to.be.equal("finished");
      expect(path.resolve(projectRootDir, `${for0.name}_1`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_2`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, `${for0.name}_3`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_4`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, `${for0.name}_5`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, for0.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
        properties: {
          numFinishd: {
            type: "integer",
            minimum: 2,
            maximum: 2

          },
          numTotal: {
            type: "integer",
            minimum: 2,
            maximum: 2
          }
        }
      });
    });
    it("should work beyond 0", async ()=>{
      await updateComponent(projectRootDir, for0.ID, "start", -1);
      await updateComponent(projectRootDir, for0.ID, "end", 1);
      await updateComponent(projectRootDir, for0.ID, "step", 1);
      const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, {}, "");
      expect(await DP.start()).to.be.equal("finished");
      expect(path.resolve(projectRootDir, `${for0.name}_-1`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_0`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_1`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_2`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, for0.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
        properties: {
          numFinishd: {
            type: "integer",
            minimum: 3,
            maximum: 3

          },
          numTotal: {
            type: "integer",
            minimum: 3,
            maximum: 3
          }
        }
      });
    });
    it("should copy 3 times and back to original component", async ()=>{
      await updateComponent(projectRootDir, for0.ID, "start", 0);
      await updateComponent(projectRootDir, for0.ID, "end", 2);
      await updateComponent(projectRootDir, for0.ID, "step", 1);
      const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, {}, "");
      expect(await DP.start()).to.be.equal("finished");
      expect(path.resolve(projectRootDir, `${for0.name}_0`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_1`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_2`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_3`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, for0.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
        properties: {
          numFinishd: {
            type: "integer",
            minimum: 3,
            maximum: 3

          },
          numTotal: {
            type: "integer",
            minimum: 3,
            maximum: 3
          }
        }
      });
    });
    it("should copy 3 times and delete all", async ()=>{
      await updateComponent(projectRootDir, for0.ID, "start", 0);
      await updateComponent(projectRootDir, for0.ID, "end", 2);
      await updateComponent(projectRootDir, for0.ID, "step", 1);
      await updateComponent(projectRootDir, for0.ID, "keep", 0);
      const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, {}, "");
      expect(await DP.start()).to.be.equal("finished");
      expect(path.resolve(projectRootDir, `${for0.name}_0`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, `${for0.name}_1`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, `${for0.name}_2`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, `${for0.name}_3`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, for0.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
        properties: {
          numFinishd: {
            type: "integer",
            minimum: 3,
            maximum: 3

          },
          numTotal: {
            type: "integer",
            minimum: 3,
            maximum: 3
          }
        }
      });
    });
    it("should copy 3 times and keep last", async ()=>{
      await updateComponent(projectRootDir, for0.ID, "start", 0);
      await updateComponent(projectRootDir, for0.ID, "end", 2);
      await updateComponent(projectRootDir, for0.ID, "step", 1);
      await updateComponent(projectRootDir, for0.ID, "keep", 1);
      const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, {}, "");
      expect(await DP.start()).to.be.equal("finished");
      expect(path.resolve(projectRootDir, `${for0.name}_0`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, `${for0.name}_1`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, `${for0.name}_2`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_3`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, for0.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
        properties: {
          numFinishd: {
            type: "integer",
            minimum: 3,
            maximum: 3

          },
          numTotal: {
            type: "integer",
            minimum: 3,
            maximum: 3
          }
        }
      });
    });
    it("should copy 3 times and keep last 2", async ()=>{
      await updateComponent(projectRootDir, for0.ID, "start", 0);
      await updateComponent(projectRootDir, for0.ID, "end", 2);
      await updateComponent(projectRootDir, for0.ID, "step", 1);
      await updateComponent(projectRootDir, for0.ID, "keep", 2);
      const DP = new Dispatcher(projectRootDir, rootWF.ID, projectRootDir, "dummy start time", projectJson.componentPath, {}, "");
      expect(await DP.start()).to.be.equal("finished");
      expect(path.resolve(projectRootDir, `${for0.name}_0`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, `${for0.name}_1`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_2`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_3`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, for0.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
        properties: {
          numFinishd: {
            type: "integer",
            minimum: 3,
            maximum: 3

          },
          numTotal: {
            type: "integer",
            minimum: 3,
            maximum: 3
          }
        }
      });
    });
  });
});