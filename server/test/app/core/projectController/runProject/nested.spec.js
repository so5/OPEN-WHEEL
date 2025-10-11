/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import path from "path";
import fs from "fs-extra";
import sinon from "sinon";
import { EventEmitter } from "events";

//setup test framework
import chai, { expect } from "chai";
import sinonChai from "sinon-chai";
import chaiFs from "chai-fs";
import chaiJsonSchema from "chai-json-schema";
chai.use(sinonChai);
chai.use(chaiFs);
chai.use(chaiJsonSchema);

import { runProject } from "../../../../../app/core/projectController.js";
import { eventEmitters } from "../../../../../app/core/global.js";
import { _internal as gitOpe2Internal } from "../../../../../app/core/gitOperator2.js";

//test data
const testDirRoot = "WHEEL_TEST_TMP";
const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");

//helper functions
import { projectJsonFilename, componentJsonFilename } from "../../../../../app/db/db.js";
import { updateComponent, createNewComponent, createNewProject } from "../../../../../app/core/projectFilesOperator.js";

import testScript from "../../../../testScript.js";
const { scriptName, pwdCmd, scriptHeader } = testScript;
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
  describe("check ancestors prop in task component", ()=>{
    beforeEach(async ()=>{
      const for0 = await createNewComponent(projectRootDir, projectRootDir, "for", { x: 10, y: 10 });
      await updateComponent(projectRootDir, for0.ID, "start", 0);
      await updateComponent(projectRootDir, for0.ID, "end", 1);
      await updateComponent(projectRootDir, for0.ID, "step", 1);

      const while0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "for0"), "while", { x: 10, y: 10 });
      await updateComponent(projectRootDir, while0.ID, "condition", "WHEEL_CURRENT_INDEX < 2");
      await createNewComponent(projectRootDir, path.join(projectRootDir, "for0", "while0"), "workflow", { x: 10, y: 10 });
      const ps0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "for0", "while0", "workflow0"), "PS", { x: 10, y: 10 });
      await updateComponent(projectRootDir, ps0.ID, "parameterFile", "input.txt.json");
      await fs.outputFile(path.join(projectRootDir, "for0", "while0", "workflow0", "PS0", "input.txt"), "%%KEYWORD1%%");
      const parameterSetting = {
        version: 2,
        target_file: "input.txt",
        target_param: [
          {
            target: "hoge",
            keyword: "KEYWORD1",
            type: "integer",
            min: 1,
            max: 2,
            step: 1,
            list: ""
          }
        ]
      };
      await fs.writeJson(path.join(projectRootDir, "for0", "while0", "workflow0", "PS0", "input.txt.json"), parameterSetting, { spaces: 4 });

      const foreach0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "for0", "while0", "workflow0", "PS0"), "foreach", { x: 10, y: 10 });
      await updateComponent(projectRootDir, foreach0.ID, "indexList", ["foo", "bar"]);

      const task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "for0", "while0", "workflow0", "PS0", "foreach0"), "task", { x: 10, y: 10 });
      await updateComponent(projectRootDir, task0.ID, "script", scriptName);
      await fs.outputFile(path.join(projectRootDir, "for0", "while0", "workflow0", "PS0", "foreach0", "task0", scriptName), scriptPwd);
    });
    it("should have acestors name and type in task object", async ()=>{
      await runProject(projectRootDir);

      for (const i1 of ["for0_0", "for0_1"]) {
        for (const i2 of ["while0_0", "while0_1"]) {
          for (const i3 of ["PS0_KEYWORD1_1", "PS0_KEYWORD1_2"]) {
            for (const i4 of ["foreach0_foo", "foreach0_bar"]) {
              expect(path.resolve(projectRootDir, i1, i2, "workflow0", i3, i4, "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
                required: ["state", "ancestorsName", "ancestorsType"],
                properties: {
                  state: { enum: ["finished"] },
                  ancestorsName: { type: "string", enum: [`${i1}/${i2}/workflow0/${i3}/${i4}`] },
                  ancestorsType: { type: "string", enum: ["for/while/workflow/parameterStudy/foreach"] }
                }
              });
            }
          }
        }
      }
    });
  });
});
