/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const path = require("path");
const fs = require("fs-extra");
const os = require("os");
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
const { updateComponent, createNewComponent, addInputFile, addOutputFile, addFileLink, createNewProject } = require("../../../../../app/core/projectFilesOperator.js");

const { scriptName, pwdCmd, scriptHeader, referenceEnv } = require("../../../../testScript.js");
const scriptPwd = `${scriptHeader}\n${pwdCmd}`;

describe("#runProject with loop components", function () {
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
    describe("task in a For component", ()=>{
        beforeEach(async ()=>{
          const for0 = await createNewComponent(projectRootDir, projectRootDir, "for", { x: 10, y: 10 });
          await updateComponent(projectRootDir, for0.ID, "start", 0);
          await updateComponent(projectRootDir, for0.ID, "end", 2);
          await updateComponent(projectRootDir, for0.ID, "step", 1);
          const task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "for0"), "task", { x: 10, y: 10 });
          await updateComponent(projectRootDir, task0.ID, "script", scriptName);
          await fs.outputFile(path.join(projectRootDir, "for0", "task0", scriptName), scriptPwd);
        });
        it("should run project and successfully finish", async ()=>{
          await runProject(projectRootDir);
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
          expect(path.resolve(projectRootDir, "for0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "for0_0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "for0_1", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "for0_2", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "for0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
        });
    });
    describe("task in a While component", ()=>{
        beforeEach(async ()=>{
          const while0 = await createNewComponent(projectRootDir, projectRootDir, "while", { x: 10, y: 10 });
          await updateComponent(projectRootDir, while0.ID, "condition", "WHEEL_CURRENT_INDEX < 3");
          const task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "while0"), "task", { x: 10, y: 10 });
          await updateComponent(projectRootDir, task0.ID, "script", scriptName);
          await fs.outputFile(path.join(projectRootDir, "while0", "task0", scriptName), scriptPwd);
        });
        it("should run project and successfully finish", async ()=>{
          await runProject(projectRootDir);
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
          expect(path.resolve(projectRootDir, "while0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "while0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "while0_0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "while0_1", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "while0_2", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
        });
        it("should copy 3 times and delete all component", async ()=>{
          const while0 = await fs.readJson(path.resolve(projectRootDir, "while0", componentJsonFilename));
          await updateComponent(projectRootDir, while0.ID, "keep", 0);
          await runProject(projectRootDir);
          expect(path.resolve(projectRootDir, `${while0.name}_0`)).not.to.be.a.path();
          expect(path.resolve(projectRootDir, `${while0.name}_1`)).not.to.be.a.path();
          expect(path.resolve(projectRootDir, `${while0.name}_2`)).not.to.be.a.path();
          expect(path.resolve(projectRootDir, `${while0.name}_3`)).not.to.be.a.path();
        });
        it("should copy 3 times and keep last component", async ()=>{
          const while0 = await fs.readJson(path.resolve(projectRootDir, "while0", componentJsonFilename));
          await updateComponent(projectRootDir, while0.ID, "keep", 1);
          await runProject(projectRootDir);
          expect(path.resolve(projectRootDir, `${while0.name}_0`)).not.to.be.a.path();
          expect(path.resolve(projectRootDir, `${while0.name}_1`)).not.to.be.a.path();
          expect(path.resolve(projectRootDir, `${while0.name}_2`)).to.be.a.directory();
          expect(path.resolve(projectRootDir, `${while0.name}_3`)).not.to.be.a.path();
        });
        it("should copy 3 times and keep last 2 component", async ()=>{
          const while0 = await fs.readJson(path.resolve(projectRootDir, "while0", componentJsonFilename));
          await updateComponent(projectRootDir, while0.ID, "keep", 2);
          await runProject(projectRootDir);
          expect(path.resolve(projectRootDir, `${while0.name}_0`)).not.to.be.a.path();
          expect(path.resolve(projectRootDir, `${while0.name}_1`)).to.be.a.directory();
          expect(path.resolve(projectRootDir, `${while0.name}_2`)).to.be.a.directory();
          expect(path.resolve(projectRootDir, `${while0.name}_3`)).not.to.be.a.path();
        });
    });
    describe("task in a Foreach component", ()=>{
        beforeEach(async ()=>{
          const foreach0 = await createNewComponent(projectRootDir, projectRootDir, "foreach", { x: 10, y: 10 });
          await updateComponent(projectRootDir, foreach0.ID, "indexList", ["foo", "bar", "baz", "fizz"]);
          const task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "foreach0"), "task", { x: 10, y: 10 });
          await updateComponent(projectRootDir, task0.ID, "script", scriptName);
          await fs.outputFile(path.join(projectRootDir, "foreach0", "task0", scriptName), scriptPwd);
        });
        it("should run project and successfully finish", async ()=>{
          await runProject(projectRootDir);
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
          expect(path.resolve(projectRootDir, "foreach0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "foreach0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "foreach0_foo", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "foreach0_bar", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "foreach0_baz", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "foreach0_fizz", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
        });
        it("should copy 4 times and delete all component", async ()=>{
          const foreach0 = await fs.readJson(path.resolve(projectRootDir, "foreach0", componentJsonFilename));
          await updateComponent(projectRootDir, foreach0.ID, "keep", 0);
          await runProject(projectRootDir);
          expect(path.resolve(projectRootDir, `${foreach0.name}_foo`)).not.to.be.a.path();
          expect(path.resolve(projectRootDir, `${foreach0.name}_bar`)).not.to.be.a.path();
          expect(path.resolve(projectRootDir, `${foreach0.name}_baz`)).not.to.be.a.path();
          expect(path.resolve(projectRootDir, `${foreach0.name}_fizz`)).not.to.be.a.path();
        });
        it("should copy 4 times and keep last component", async ()=>{
          const foreach0 = await fs.readJson(path.resolve(projectRootDir, "foreach0", componentJsonFilename));
          await updateComponent(projectRootDir, foreach0.ID, "keep", 1);
          await runProject(projectRootDir);
          expect(path.resolve(projectRootDir, `${foreach0.name}_foo`)).not.to.be.a.path();
          expect(path.resolve(projectRootDir, `${foreach0.name}_bar`)).not.to.be.a.path();
          expect(path.resolve(projectRootDir, `${foreach0.name}_baz`)).not.to.be.a.path();
          expect(path.resolve(projectRootDir, `${foreach0.name}_fizz`)).to.be.a.directory();
        });
        it("should copy 4 times and keep last 2 component", async ()=>{
          const foreach0 = await fs.readJson(path.resolve(projectRootDir, "foreach0", componentJsonFilename));
          await updateComponent(projectRootDir, foreach0.ID, "keep", 2);
          await runProject(projectRootDir);
          expect(path.resolve(projectRootDir, `${foreach0.name}_foo`)).not.to.be.a.path();
          expect(path.resolve(projectRootDir, `${foreach0.name}_bar`)).not.to.be.a.path();
          expect(path.resolve(projectRootDir, `${foreach0.name}_baz`)).to.be.a.directory();
          expect(path.resolve(projectRootDir, `${foreach0.name}_fizz`)).to.be.a.directory();
        });
    });
    describe("file dependency between task in the For component", ()=>{
        beforeEach(async ()=>{
          const for0 = await createNewComponent(projectRootDir, projectRootDir, "for", { x: 10, y: 10 });
          const parentTask0 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
          const parentTask1 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
          await updateComponent(projectRootDir, for0.ID, "start", 0);
          await updateComponent(projectRootDir, for0.ID, "end", 2);
          await updateComponent(projectRootDir, for0.ID, "step", 1);
          await updateComponent(projectRootDir, parentTask0.ID, "name", "parentTask0");
          await updateComponent(projectRootDir, parentTask1.ID, "name", "parentTask1");
          await updateComponent(projectRootDir, parentTask0.ID, "script", scriptName);
          await updateComponent(projectRootDir, parentTask1.ID, "script", scriptName);

          await addOutputFile(projectRootDir, parentTask0.ID, "a");
          await addInputFile(projectRootDir, for0.ID, "b");
          await addOutputFile(projectRootDir, for0.ID, "e");
          await addInputFile(projectRootDir, parentTask1.ID, "f");
          await addFileLink(projectRootDir, parentTask0.ID, "a", for0.ID, "b");
          await addFileLink(projectRootDir, for0.ID, "e", parentTask1.ID, "f");

          const task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "for0"), "task", { x: 10, y: 10 });
          await updateComponent(projectRootDir, task0.ID, "script", scriptName);
          await addInputFile(projectRootDir, task0.ID, "c");
          await addOutputFile(projectRootDir, task0.ID, "d");
          await addFileLink(projectRootDir, for0.ID, "b", task0.ID, "c");
          await addFileLink(projectRootDir, task0.ID, "d", for0.ID, "e");

          await fs.outputFile(path.join(projectRootDir, "parentTask0", "a"), "a");
          await fs.outputFile(path.join(projectRootDir, "parentTask0", scriptName), scriptPwd);
          await fs.outputFile(path.join(projectRootDir, "parentTask1", scriptName), scriptPwd);
          await fs.outputFile(path.join(projectRootDir, "for0", "task0", scriptName), `${scriptPwd}\necho ${referenceEnv("WHEEL_CURRENT_INDEX")} > d\n`);
        });
        it("should run project and successfully finish", async ()=>{
          await runProject(projectRootDir);
          expect(path.resolve(projectRootDir, "parentTask0", "a")).to.be.a.file().with.content("a");
          expect(path.resolve(projectRootDir, "for0", "b")).to.be.a.file().with.content("a");
          expect(path.resolve(projectRootDir, "for0", "task0", "c")).to.be.a.file().with.content("a");
          expect(path.resolve(projectRootDir, "for0", "task0", "d")).to.be.a.file().with.content(`2${os.EOL}`);
          expect(path.resolve(projectRootDir, "for0_0", "task0", "c")).to.be.a.file().with.content("a");
          expect(path.resolve(projectRootDir, "for0_0", "task0", "d")).to.be.a.file().with.content(`0${os.EOL}`);
          expect(path.resolve(projectRootDir, "for0_1", "task0", "c")).to.be.a.file().with.content("a");
          expect(path.resolve(projectRootDir, "for0_1", "task0", "d")).to.be.a.file().with.content(`1${os.EOL}`);
          expect(path.resolve(projectRootDir, "for0_2", "task0", "c")).to.be.a.file().with.content("a");
          expect(path.resolve(projectRootDir, "for0_2", "task0", "d")).to.be.a.file().with.content(`2${os.EOL}`);
          expect(path.resolve(projectRootDir, "for0", "e")).not.to.be.a.path();
          expect(path.resolve(projectRootDir, "parentTask1", "f")).to.be.a.file().with.content(`2${os.EOL}`);

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
          expect(path.resolve(projectRootDir, "for0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "for0_0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "for0_1", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "for0_2", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "for0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "parentTask0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "parentTask1", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
        });
    });
    describe("[reproduction test] task with sub directory in a for loop", ()=>{
      beforeEach(async ()=>{
        const for0 = await createNewComponent(projectRootDir, projectRootDir, "for", { x: 10, y: 10 });
        await updateComponent(projectRootDir, for0.ID, "start", 0);
        await updateComponent(projectRootDir, for0.ID, "end", 2);
        await updateComponent(projectRootDir, for0.ID, "step", 1);
        const task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "for0"), "task", { x: 10, y: 10 });
        await updateComponent(projectRootDir, task0.ID, "script", scriptName);
        await fs.outputFile(path.join(projectRootDir, "for0", "task0", scriptName), scriptPwd);
        await fs.mkdir(path.join(projectRootDir, "for0", "task0", "empty_dir"));
      });
      it("should run and successfully finished", async ()=>{
        await runProject(projectRootDir);
        expect(path.resolve(projectRootDir, "for0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
          required: ["state"],
          properties: {
            state: { enum: ["finished"] }
          }
        });
        expect(path.resolve(projectRootDir, "for0_0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
          required: ["state"],
          properties: {
            state: { enum: ["finished"] }
          }
        });
        expect(path.resolve(projectRootDir, "for0_1", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
          required: ["state"],
          properties: {
            state: { enum: ["finished"] }
          }
        });
        expect(path.resolve(projectRootDir, "for0_2", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
          required: ["state"],
          properties: {
            state: { enum: ["finished"] }
          }
        });
        expect(path.resolve(projectRootDir, "for0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
          required: ["state"],
          properties: {
            state: { enum: ["finished"] }
          }
        });
      });
    });
    describe("[reproduction test] PS in loop", ()=>{
      let for0;
      let PS0;
      let task0;
      beforeEach(async ()=>{
        for0 = await createNewComponent(projectRootDir, projectRootDir, "for", { x: 10, y: 10 });
        await updateComponent(projectRootDir, for0.ID, "start", 0);
        await updateComponent(projectRootDir, for0.ID, "end", 3);
        await updateComponent(projectRootDir, for0.ID, "step", 1);

        PS0 = await createNewComponent(projectRootDir, path.resolve(projectRootDir, for0.name), "PS", { x: 10, y: 10 });
        await updateComponent(projectRootDir, PS0.ID, "parameterFile", "input.txt.json");
        await fs.outputFile(path.join(projectRootDir, for0.name, PS0.name, "input.txt"), "%%KEYWORD1%%");
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
        await fs.writeJson(path.join(projectRootDir, for0.name, PS0.name, "input.txt.json"), parameterSetting, { spaces: 4 });

        task0 = await createNewComponent(projectRootDir, path.resolve(projectRootDir, for0.name, PS0.name), "task", { x: 10, y: 10 });
        await updateComponent(projectRootDir, task0.ID, "script", scriptName);
        await fs.outputFile(path.join(projectRootDir, for0.name, PS0.name, task0.name, scriptName), "if [ ${WHEEL_CURRENT_INDEX} -eq 0 ];then echo hoge ${WHEEL_CURRENT_INDEX} > hoge;fi");
      });
      it("should run project and successfully finish", async ()=>{
        await runProject(projectRootDir);
        expect(path.resolve(projectRootDir, for0.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
          properties: {
            numFinishd: {
              type: "integer",
              minimum: 4,
              maximum: 4
            },
            numTotal: {
              type: "integer",
              minimum: 4,
              maximum: 4
            }
          }
        });
        expect(path.resolve(projectRootDir, for0.name, PS0.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
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
        expect(path.resolve(projectRootDir, for0.name, "PS0_KEYWORD1_1", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
          properties: {
            state: {
              type: "string",
              pattern: "^finished$"
            }
          }
        });
        expect(path.resolve(projectRootDir, for0.name, "PS0_KEYWORD1_2", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
          properties: {
            state: {
              type: "string",
              pattern: "^finished$"
            }
          }
        });
        expect(path.resolve(projectRootDir, for0.name, "PS0_KEYWORD1_3", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
          properties: {
            state: {
              type: "string",
              pattern: "^finished$"
            }
          }
        });
        expect(path.resolve(projectRootDir, "for0_0", "PS0_KEYWORD1_1", "task0", "hoge")).to.be.a.file().with.content("hoge 0\n");
        expect(path.resolve(projectRootDir, "for0_0", "PS0_KEYWORD1_2", "task0", "hoge")).to.be.a.file().with.content("hoge 0\n");
        expect(path.resolve(projectRootDir, "for0_0", "PS0_KEYWORD1_3", "task0", "hoge")).to.be.a.file().with.content("hoge 0\n");
        expect(path.resolve(projectRootDir, "for0_1", "PS0_KEYWORD1_1", "task0", "hoge")).not.to.be.a.path();
        expect(path.resolve(projectRootDir, "for0_1", "PS0_KEYWORD1_2", "task0", "hoge")).not.to.be.a.path();
        expect(path.resolve(projectRootDir, "for0_1", "PS0_KEYWORD1_3", "task0", "hoge")).not.to.be.a.path();
        expect(path.resolve(projectRootDir, "for0_2", "PS0_KEYWORD1_1", "task0", "hoge")).not.to.be.a.path();
        expect(path.resolve(projectRootDir, "for0_2", "PS0_KEYWORD1_2", "task0", "hoge")).not.to.be.a.path();
        expect(path.resolve(projectRootDir, "for0_2", "PS0_KEYWORD1_3", "task0", "hoge")).not.to.be.a.path();
        expect(path.resolve(projectRootDir, "for0_3", "PS0_KEYWORD1_1", "task0", "hoge")).not.to.be.a.path();
        expect(path.resolve(projectRootDir, "for0_3", "PS0_KEYWORD1_2", "task0", "hoge")).not.to.be.a.path();
        expect(path.resolve(projectRootDir, "for0_3", "PS0_KEYWORD1_3", "task0", "hoge")).not.to.be.a.path();
      });
    });
});