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
import * as projectFilesOperator from "../../../../../app/core/projectFilesOperator.js";
import { _internal as gitOpe2Internal } from "../../../../../app/core/gitOperator2.js";

//test data
const testDirRoot = "WHEEL_TEST_TMP";
const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");

//helper functions
import { projectJsonFilename, componentJsonFilename } from "../../../../../app/db/db.js";
import { updateComponent, createNewComponent, addInputFile, addOutputFile, addFileLink, createNewProject } from "../../../../../app/core/projectFilesOperator.js";

import testScript from "../../../../testScript.js";
const { scriptName, pwdCmd, scriptHeader } = testScript;
const scriptPwd = `${scriptHeader}\n${pwdCmd}`;

describe("#runProject with workflows", function () {
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
  describe("task in the sub workflow", ()=>{
    let task0;
    let wf0;
    beforeEach(async ()=>{
      wf0 = await createNewComponent(projectRootDir, projectRootDir, "workflow", { x: 10, y: 10 });
      task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "workflow0"), "task", { x: 10, y: 10 });
      await updateComponent(projectRootDir, task0.ID, "script", scriptName);
      await fs.outputFile(path.join(projectRootDir, "workflow0", "task0", scriptName), scriptPwd);
    });
    it("should not run disable workflow and its sub-component but successfully finished project", async ()=>{
      await updateComponent(projectRootDir, wf0.ID, "disable", true);

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
      expect(path.resolve(projectRootDir, "workflow0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["not-started"] }
        }
      });
      expect(path.resolve(projectRootDir, "workflow0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["not-started"] }
        }
      });
    });
    it("should not run disable task and successfully finished parent sub-workflow", async ()=>{
      await updateComponent(projectRootDir, task0.ID, "disable", true);

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
      expect(path.resolve(projectRootDir, "workflow0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "workflow0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["not-started"] }
        }
      });
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
      expect(path.resolve(projectRootDir, "workflow0", "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
    });
  });
  describe("file dependency between parent and child", ()=>{
    beforeEach(async ()=>{
      const wf0 = await createNewComponent(projectRootDir, projectRootDir, "workflow", { x: 10, y: 10 });
      await updateComponent(projectRootDir, wf0.ID, "name", "wf0");
      const parentTask0 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
      const parentTask1 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
      await updateComponent(projectRootDir, parentTask0.ID, "name", "parentTask0");
      await updateComponent(projectRootDir, parentTask0.ID, "script", scriptName);
      await updateComponent(projectRootDir, parentTask1.ID, "name", "parentTask1");
      await updateComponent(projectRootDir, parentTask1.ID, "script", scriptName);

      const childTask0 = await createNewComponent(projectRootDir, path.join(projectRootDir, "wf0"), "task", { x: 10, y: 10 });
      const childTask1 = await createNewComponent(projectRootDir, path.join(projectRootDir, "wf0"), "task", { x: 10, y: 10 });
      await updateComponent(projectRootDir, childTask0.ID, "name", "childTask0");
      await updateComponent(projectRootDir, childTask0.ID, "script", scriptName);
      await updateComponent(projectRootDir, childTask1.ID, "name", "childTask1");
      await updateComponent(projectRootDir, childTask1.ID, "script", scriptName);

      //add file dependency
      await fs.outputFile(path.join(projectRootDir, "parentTask0", "a"), "a");
      await addOutputFile(projectRootDir, parentTask0.ID, "a");
      await addInputFile(projectRootDir, wf0.ID, "b");
      await addInputFile(projectRootDir, childTask0.ID, "c");
      await addOutputFile(projectRootDir, childTask0.ID, "c");
      await addInputFile(projectRootDir, childTask1.ID, "d");
      await addOutputFile(projectRootDir, childTask1.ID, "d");
      await addOutputFile(projectRootDir, wf0.ID, "e");
      await addInputFile(projectRootDir, parentTask1.ID, "f");

      await addFileLink(projectRootDir, parentTask0.ID, "a", wf0.ID, "b");
      await addFileLink(projectRootDir, "parent", "b", childTask0.ID, "c");
      await addFileLink(projectRootDir, childTask0.ID, "c", childTask1.ID, "d");
      await addFileLink(projectRootDir, childTask1.ID, "d", "parent", "e");
      await addFileLink(projectRootDir, wf0.ID, "e", parentTask1.ID, "f");

      //create script
      await fs.outputFile(path.join(projectRootDir, "parentTask0", scriptName), scriptPwd);
      await fs.outputFile(path.join(projectRootDir, "parentTask1", scriptName), scriptPwd);
      await fs.outputFile(path.join(projectRootDir, "wf0", "childTask0", scriptName), scriptPwd);
      await fs.outputFile(path.join(projectRootDir, "wf0", "childTask1", scriptName), scriptPwd);
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
      expect(path.resolve(projectRootDir, "wf0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "wf0", "childTask0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "wf0", "childTask1", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });

      expect(path.resolve(projectRootDir, "parentTask0", "a")).to.be.a.file().with.contents("a");
      expect(path.resolve(projectRootDir, "wf0", "b")).to.be.a.file().with.contents("a");
      expect(path.resolve(projectRootDir, "wf0", "childTask0", "c")).to.be.a.file().with.contents("a");
      expect(path.resolve(projectRootDir, "wf0", "childTask1", "d")).to.be.a.file().with.contents("a");
      expect(path.resolve(projectRootDir, "wf0", "e")).not.to.be.a.path();
      expect(path.resolve(projectRootDir, "parentTask1", "f")).to.be.a.file().with.contents("a");
    });
  });
  describe("[reproduction test] root workflow has only source and connected for loop", ()=>{
    let task0;
    let for0;
    let source0;
    beforeEach(async ()=>{
      source0 = await createNewComponent(projectRootDir, projectRootDir, "source", { x: 10, y: 10 });
      await projectFilesOperator.renameOutputFile(projectRootDir, source0.ID, 0, "foo");

      for0 = await createNewComponent(projectRootDir, projectRootDir, "for", { x: 10, y: 10 });
      await updateComponent(projectRootDir, for0.ID, "start", 0);
      await updateComponent(projectRootDir, for0.ID, "end", 2);
      await updateComponent(projectRootDir, for0.ID, "step", 1);
      await addInputFile(projectRootDir, for0.ID, "foo");

      task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, for0.name), "task", { x: 10, y: 10 });
      await updateComponent(projectRootDir, task0.ID, "script", scriptName);
      await addInputFile(projectRootDir, task0.ID, "foo");
      await fs.outputFile(path.join(projectRootDir, for0.name, task0.name, scriptName), "echo hoge ${WHEEL_CURRENT_INDEX} > hoge");
      await gitOpe2Internal.gitAdd(projectRootDir, path.join(projectRootDir, for0.name, task0.name, scriptName));

      await addFileLink(projectRootDir, source0.ID, "foo", for0.ID, "foo");
      await addFileLink(projectRootDir, for0.ID, "foo", task0.ID, "foo");
      await gitOpe2Internal.gitCommit(projectRootDir, "hoge");
    });
    it("should run task0", async ()=>{
      await runProject(projectRootDir);
      expect(path.resolve(projectRootDir, for0.name, task0.name, "hoge")).to.be.a.file().with.content("hoge 2\n");
      expect(path.resolve(projectRootDir, `${for0.name}_0`, task0.name, "hoge")).to.be.a.file().with.content("hoge 0\n");
      expect(path.resolve(projectRootDir, `${for0.name}_1`, task0.name, "hoge")).to.be.a.file().with.content("hoge 1\n");
      expect(path.resolve(projectRootDir, `${for0.name}_2`, task0.name, "hoge")).to.be.a.file().with.content("hoge 2\n");
    });
  });
});
