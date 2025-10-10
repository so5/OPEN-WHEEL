/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import path from "path";
import fs from "fs-extra";
import os from "os";
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

import { runProject, cleanProject, _internal } from "../../../../../app/core/projectController.js";
import { eventEmitters } from "../../../../../app/core/global.js";
import { _internal as gitOpe2Internal } from "../../../../../app/core/gitOperator2.js";

//test data
const testDirRoot = "WHEEL_TEST_TMP";
const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");

//helper functions
import { projectJsonFilename, componentJsonFilename } from "../../../../../app/db/db.js";
import { renameOutputFile, updateComponent, createNewComponent, addInputFile, addFileLink, createNewProject } from "../../../../../app/core/projectFilesOperator.js";
import { gitAdd, gitCommit } from "../../../../../app/core/gitOperator2.js";

import testScript from "../../../../testScript.js";
const { scriptName, pwdCmd, scriptHeader } = testScript;
const scriptPwd = `${scriptHeader}\n${pwdCmd}`;

describe("#runProject with miscellaneous features", function () {
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
  describe("force overwrite flag in PS", ()=>{
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
      await fs.outputFile(path.join(projectRootDir, "PS0", "task0", scriptName), `${scriptPwd}\nexit 1\n`);

      //1st run
      await runProject(projectRootDir);
      //modify run.sh
      await fs.outputFile(path.join(projectRootDir, "PS0", "task0", scriptName), `${scriptPwd}|tee result.log\n`);
    });
    it("should not overwrite files and run project ", async ()=>{
      await runProject(projectRootDir);
      expect(path.resolve(projectRootDir, projectJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["failed"] }
        }
      });
      expect(path.resolve(projectRootDir, componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["failed"] }
        }
      });
      expect(path.resolve(projectRootDir, "PS0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["failed"] }
        }
      });
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_1", "result.log")).not.to.be.a.path();
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_2", "result.log")).not.to.be.a.path();
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_3", "result.log")).not.to.be.a.path();
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_1", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["failed"] }
        }
      });
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_2", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["failed"] }
        }
      });
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_3", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["failed"] }
        }
      });
    });
    it("should overwrite files and run project ", async ()=>{
      const ps0 = await fs.readJson(path.join(projectRootDir, "PS0", componentJsonFilename));
      await updateComponent(projectRootDir, ps0.ID, "forceOverwrite", true);
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
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_1", "task0", "result.log")).to.be.a.file().with.content(`${path.resolve(projectRootDir, "PS0_KEYWORD1_1", "task0")}${os.EOL}`);
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_2", "task0", "result.log")).to.be.a.file().with.content(`${path.resolve(projectRootDir, "PS0_KEYWORD1_2", "task0")}${os.EOL}`);
      expect(path.resolve(projectRootDir, "PS0_KEYWORD1_3", "task0", "result.log")).to.be.a.file().with.content(`${path.resolve(projectRootDir, "PS0_KEYWORD1_3", "task0")}${os.EOL}`);
    });
  });
  describe("[reproduction test] root workflow has only source and connected for loop", ()=>{
    let task0;
    let for0;
    let source0;
    beforeEach(async ()=>{
      source0 = await createNewComponent(projectRootDir, projectRootDir, "source", { x: 10, y: 10 });
      await renameOutputFile(projectRootDir, source0.ID, 0, "foo");

      for0 = await createNewComponent(projectRootDir, projectRootDir, "for", { x: 10, y: 10 });
      await updateComponent(projectRootDir, for0.ID, "start", 0);
      await updateComponent(projectRootDir, for0.ID, "end", 2);
      await updateComponent(projectRootDir, for0.ID, "step", 1);
      await addInputFile(projectRootDir, for0.ID, "foo");

      task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, for0.name), "task", { x: 10, y: 10 });
      await updateComponent(projectRootDir, task0.ID, "script", scriptName);
      await addInputFile(projectRootDir, task0.ID, "foo");
      await fs.outputFile(path.join(projectRootDir, for0.name, task0.name, scriptName), "echo hoge ${WHEEL_CURRENT_INDEX} > hoge");
      await gitAdd(projectRootDir, path.join(projectRootDir, for0.name, task0.name, scriptName));

      await addFileLink(projectRootDir, source0.ID, "foo", for0.ID, "foo");
      await addFileLink(projectRootDir, for0.ID, "foo", task0.ID, "foo");
      await gitCommit(projectRootDir);
    });
    it("should run after cleanProject", async ()=>{
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
      expect(path.resolve(projectRootDir, "for0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      await cleanProject(projectRootDir);
      expect(path.resolve(projectRootDir, projectJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["not-started"] }
        }
      });
      expect(path.resolve(projectRootDir, componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["not-started"] }
        }
      });
      expect(path.resolve(projectRootDir, "for0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["not-started"] }
        }
      });
      expect(path.resolve(projectRootDir, "for0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["not-started"] }
        }
      });
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
      expect(path.resolve(projectRootDir, "for0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
    });
  });
  describe("error case", ()=>{
    before(()=>{
      _internal.rootDispatchers.set(projectRootDir, "dummy");
    });
    after(()=>{
      _internal.rootDispatchers.delete(projectRootDir);
    });
    it("returns an error if the project is already running", async ()=>{
      const result = await runProject(projectRootDir);
      expect(result).to.be.an("error");
      expect(result.message).to.include("project is already running");
    });
  });
});
