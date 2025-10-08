/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const path = require("path");
const fs = require("fs-extra");
const sinon = require("sinon");
const EventEmitter = require("events");

//setup test framework
const chai = require("chai");
const expect = chai.expect;
chai.use(require("sinon-chai"));
chai.use(require("chai-fs"));
chai.use(require("chai-json-schema"));

const { runProject } = require("../../../../../app/core/projectController.js");
const { eventEmitters } = require("../../../../../app/core/global.js");
const { _internal: gitOpe2Internal } = require("../../../../../app/core/gitOperator2.js");

//test data
const testDirRoot = "WHEEL_TEST_TMP";
const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");

//helper functions
const { projectJsonFilename, componentJsonFilename } = require("../../../../../app/db/db.js");
const { updateComponent, createNewComponent, createNewProject } = require("../../../../../app/core/projectFilesOperator.js");
const { sleep } = require("../../../../testUtil.js");

const { scriptName, pwdCmd, scriptHeader } = require("../../../../testScript.js");
const scriptPwd = `${scriptHeader}\n${pwdCmd}`;

describe("#runProject with parameter study component", function () {
  this.timeout(0);
  beforeEach(async ()=>{
    const originalGitPromise = gitOpe2Internal.gitPromise;
    sinon.stub(gitOpe2Internal, "gitPromise").callsFake(async (cwd, args, rootDir)=>{
      if (Array.isArray(args) && args[0] === "lfs" && args[1] === "install") {
        return Promise.resolve();
      }
      return originalGitPromise(cwd, args, rootDir);
    });
    await fs.remove(testDirRoot);
    await createNewProject(projectRootDir, "test project", null, "test", "test@example.com");
    eventEmitters.set(projectRootDir, new EventEmitter());
  });
  afterEach(()=>{
    sinon.restore();
    eventEmitters.delete(projectRootDir);
  });
  after(async ()=>{
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
  });
  describe("task in PS", ()=>{
    beforeEach(async ()=>{
      const ps0 = await createNewComponent(projectRootDir, projectRootDir, "PS", { x: 10, y: 10 });
      await updateComponent(projectRootDir, ps0.ID, "parameterFile", "input.txt.json");
      await fs.outputFile(path.join(projectRootDir, "PS0", "input.txt"), "%%KEYWORD1%%");
      const parameterSetting = {
        version: 2,
        target_file: "input.txt",
        target_param: [
          {
            target: "hoge",
            keyword: "KEYWORD1",
            type: "integer",
            min: 1,
            max: 3,
            step: 1,
            list: ""
          }
        ]
      };
      await fs.writeJson(path.join(projectRootDir, "PS0", "input.txt.json"), parameterSetting, { spaces: 4 });

      const task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "PS0"), "task", { x: 10, y: 10 });
      await updateComponent(projectRootDir, task0.ID, "script", scriptName);
      await fs.outputFile(path.join(projectRootDir, "PS0", "task0", scriptName), scriptPwd);
    });
    it("should run project and successfully finish", async ()=>{
      await runProject(projectRootDir);
      await sleep(1000);
      expect(path.resolve(projectRootDir, projectJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "PS0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_1", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_2", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_3", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_1")).to.be.a.directory();
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_2")).to.be.a.directory();
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_3")).to.be.a.directory();
    });
  });
  describe("task in PS ver.2", ()=>{
    beforeEach(async ()=>{
      const ps0 = await createNewComponent(projectRootDir, projectRootDir, "PS", { x: 10, y: 10 });
      await updateComponent(projectRootDir, ps0.ID, "parameterFile", "input.txt.json");
      const task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "PS0"), "task", { x: 10, y: 10 });
      await updateComponent(projectRootDir, task0.ID, "script", scriptName);

      await fs.outputFile(path.join(projectRootDir, "PS0", "input1.txt"), "{{ KEYWORD1 }} {{ KEYWORD3 }}");
      await fs.outputFile(path.join(projectRootDir, "PS0", "non-targetFile.txt"), "{{ filename }} {{ KEYWORD2 }}");
      await fs.outputFile(path.join(projectRootDir, "PS0", "task0", "input2.txt"), "{{ KEYWORD1 }}{{ KEYWORD2 }}");
      await fs.outputFile(path.join(projectRootDir, "PS0", "input3.txt"), "{{ KEYWORD1 }}{{ KEYWORD2 }}");
      await fs.outputFile(path.join(projectRootDir, "PS0", "testData"), "hoge");
      await fs.outputFile(path.join(projectRootDir, "PS0", "testData_foo"), "foo");
      await fs.outputFile(path.join(projectRootDir, "PS0", "testData_bar"), "bar");
      await fs.outputFile(path.join(projectRootDir, "PS0", "data_1"), "data_1");
      await fs.outputFile(path.join(projectRootDir, "PS0", "data_2"), "data_2");
      await fs.outputFile(path.join(projectRootDir, "PS0", "data_3"), "data_3");
      const parameterSetting = {
        version: 2,
        targetFiles: ["input1.txt", { targetNode: task0.ID, targetName: "input2.txt" }, { targetName: "input3.txt" }],
        target_param: [
          {
            keyword: "KEYWORD1",
            min: 1,
            max: 3,
            step: 1
          },
          {
            keyword: "KEYWORD3",
            list: ["foo", "bar"]
          },
          {
            keyword: "filename",
            files: ["data_*"]
          }
        ],
        scatter: [
          { srcName: "testData", dstNode: task0.ID, dstName: "hoge{{ KEYWORD1 }}" },
          { srcName: "testData_{{ KEYWORD3 }}", dstNode: task0.ID, dstName: "foobar" }
        ],
        gather: [
          { srcName: "hoge{{ KEYWORD1 }}", srcNode: task0.ID, dstName: "results/{{ KEYWORD1 }}/{{ KEYWORD3 }}_{{ filename }}/" },
          { srcName: "input2.txt", srcNode: task0.ID, dstName: "results/{{ KEYWORD1 }}/{{ KEYWORD3 }}_{{ filename }}/input2.txt" }
        ]
      };
      await fs.writeJson(path.join(projectRootDir, "PS0", "input.txt.json"), parameterSetting, { spaces: 4 });
      await fs.outputFile(path.join(projectRootDir, "PS0", "task0", scriptName), `${scriptPwd}|tee output.log\n`);
    });
    it("should run project and successfully finish", async ()=>{
      await runProject(projectRootDir);

      for (const filename of ["data_1", "data_2", "data_3"]) {
        for (const KEYWORD1 of [1, 2, 3]) {
          for (const KEYWORD3 of ["foo", "bar"]) {
            //check parameter expansion for input file
            expect(path.resolve(projectRootDir, `PS0_KEYWORD1_${KEYWORD1}_KEYWORD3_${KEYWORD3}_filename_${filename}`, "input1.txt")).to.be.a.file().with.content(`${KEYWORD1} ${KEYWORD3}`);
            //check parameter expansion for input file with targetName and targetNode option and not-defiend parameter
            expect(path.resolve(projectRootDir, `PS0_KEYWORD1_${KEYWORD1}_KEYWORD3_${KEYWORD3}_filename_${filename}`, "task0", "input2.txt")).to.be.a.file().with.content(`${KEYWORD1}`);
            //check parameter expansion for input file only with targetName
            expect(path.resolve(projectRootDir, `PS0_KEYWORD1_${KEYWORD1}_KEYWORD3_${KEYWORD3}_filename_${filename}`, "input3.txt")).to.be.a.file().with.content(`${KEYWORD1}`);
            //check parameter expansion is not performed on non-target file
            expect(path.resolve(projectRootDir, `PS0_KEYWORD1_${KEYWORD1}_KEYWORD3_${KEYWORD3}_filename_${filename}`, "non-targetFile.txt")).to.be.a.file().with.content("{{ filename }} {{ KEYWORD2 }}");
            //check scatter 1 (testData)
            expect(path.resolve(projectRootDir, `PS0_KEYWORD1_${KEYWORD1}_KEYWORD3_${KEYWORD3}_filename_${filename}`, "task0", `hoge${KEYWORD1}`)).to.be.a.file().with.content("hoge");
            //check scatter 2 (testData_{foo|bar})
            expect(path.resolve(projectRootDir, `PS0_KEYWORD1_${KEYWORD1}_KEYWORD3_${KEYWORD3}_filename_${filename}`, "task0", "foobar")).to.be.a.file().with.content(KEYWORD3);
            //check gather 1 (hoge_*)
            expect(path.resolve(projectRootDir, "PS0", "results", `${KEYWORD1}`, `${KEYWORD3}_${filename}`, `hoge${KEYWORD1}`)).to.be.a.file().with.content("hoge");
            //check gather 2 (input2.txt)
            expect(path.resolve(projectRootDir, "PS0", "results", `${KEYWORD1}`, `${KEYWORD3}_${filename}`, "input2.txt")).to.be.a.file().with.content(`${KEYWORD1}`);

            //check task status
            expect(path.resolve(projectRootDir, `PS0_KEYWORD1_${KEYWORD1}_KEYWORD3_${KEYWORD3}_filename_${filename}`, "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({ required: ["state"], properties: { state: { enum: ["finished"] } } });
          }
        }
      }
      expect(path.resolve(projectRootDir, projectJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "PS0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
    });
  });
  describe("with deleteLoopInstance option", ()=>{
    let ps0;
    beforeEach(async ()=>{
      ps0 = await createNewComponent(projectRootDir, projectRootDir, "PS", { x: 10, y: 10 });
      await updateComponent(projectRootDir, ps0.ID, "parameterFile", "input.txt.json");
      await fs.outputFile(path.join(projectRootDir, "PS0", "input.txt"), "%%KEYWORD1%%");
      const parameterSetting = {
        version: 2,
        target_file: "input.txt",
        target_param: [
          {
            target: "hoge",
            keyword: "KEYWORD1",
            type: "integer",
            min: 1,
            max: 3,
            step: 1,
            list: ""
          }
        ]
      };
      await fs.writeJson(path.join(projectRootDir, "PS0", "input.txt.json"), parameterSetting, { spaces: 4 });

      const task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "PS0"), "task", { x: 10, y: 10 });
      await updateComponent(projectRootDir, task0.ID, "script", scriptName);
      await fs.outputFile(path.join(projectRootDir, "PS0", "task0", scriptName), scriptPwd);
      await updateComponent(projectRootDir, ps0.ID, "deleteLoopInstance", true);
    });
    it("should delete all loop instance", async ()=>{
      await runProject(projectRootDir);
      expect(path.resolve(projectRootDir, `${ps0.name}_KEYWORD1_1`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, `${ps0.name}_KEYWORD1_2`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, `${ps0.name}_KEYWORD1_3`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, ps0.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
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
