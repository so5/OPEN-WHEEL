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

const { scriptName, pwdCmd, scriptHeader } = require("../../../../testScript.js");
const scriptPwd = `${scriptHeader}\n${pwdCmd}`;

describe("#runProject with nested components", function () {
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
    describe.skip("task in nested PS(does not work for now)", ()=>{
        beforeEach(async ()=>{
          const ps0 = await createNewComponent(projectRootDir, projectRootDir, "PS", { x: 10, y: 10 });
          await updateComponent(projectRootDir, ps0.ID, "parameterFile", "input.txt.json");

          const ps1 = await createNewComponent(projectRootDir, path.join(projectRootDir, "PS0"), "PS", { x: 10, y: 10 });
          await updateComponent(projectRootDir, ps1.ID, "name", "PS1");
          await updateComponent(projectRootDir, ps1.ID, "parameterFile", "input.txt.json");

          const task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "PS0", "PS1"), "task", { x: 10, y: 10 });
          await updateComponent(projectRootDir, task0.ID, "script", scriptName);
          await fs.outputFile(path.join(projectRootDir, "PS0", "PS1", "task0", scriptName), scriptPwd);

          await fs.outputFile(path.join(projectRootDir, "PS0", "input.txt"), "%%KEYWORD1%%");
          await fs.outputFile(path.join(projectRootDir, "PS0", "PS1", "input.txt"), "%%KEYWORD1%%");
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
          await fs.writeJson(path.join(projectRootDir, "PS0", "PS1", "input.txt.json"), parameterSetting, { spaces: 4 });
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
          expect(path.resolve(projectRootDir, "PS0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "PS0", "PS1", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "PS0_KEYWORD1_1", "PS1_KEYWORD1_1", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "PS0_KEYWORD1_1", "PS1_KEYWORD1_2", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "PS0_KEYWORD1_1", "PS1_KEYWORD1_3", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "PS0_KEYWORD1_2", "PS1_KEYWORD1_1", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "PS0_KEYWORD1_2", "PS1_KEYWORD1_2", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "PS0_KEYWORD1_2", "PS1_KEYWORD1_3", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "PS0_KEYWORD1_3", "PS1_KEYWORD1_1", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "PS0_KEYWORD1_3", "PS1_KEYWORD1_2", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "PS0_KEYWORD1_3", "PS1_KEYWORD1_3", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
        });
    });
    describe("task in nested loop", ()=>{
        beforeEach(async ()=>{
          const for0 = await createNewComponent(projectRootDir, projectRootDir, "for", { x: 10, y: 10 });
          await updateComponent(projectRootDir, for0.ID, "start", 0);
          await updateComponent(projectRootDir, for0.ID, "end", 1);
          await updateComponent(projectRootDir, for0.ID, "step", 1);

          const for1 = await createNewComponent(projectRootDir, path.join(projectRootDir, "for0"), "for", { x: 10, y: 10 });
          await updateComponent(projectRootDir, for1.ID, "name", "for1");
          await updateComponent(projectRootDir, for1.ID, "start", 0);
          await updateComponent(projectRootDir, for1.ID, "end", 1);
          await updateComponent(projectRootDir, for1.ID, "step", 1);

          const task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "for0", "for1"), "task", { x: 10, y: 10 });
          await updateComponent(projectRootDir, task0.ID, "script", scriptName);
          await fs.outputFile(path.join(projectRootDir, "for0", "for1", "task0", scriptName), scriptPwd);
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
          expect(path.resolve(projectRootDir, "for0", "for1", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "for0_0", "for1", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "for0_0", "for1_0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "for0_0", "for1_1", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "for0_1", "for1_0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "for0_1", "for1_1", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
        });
    });
});