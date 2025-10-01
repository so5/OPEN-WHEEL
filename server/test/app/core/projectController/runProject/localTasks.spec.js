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

const { runProject, _internal } = require("../../../../../app/core/projectController.js");
const { eventEmitters } = require("../../../../../app/core/global.js");
const { _internal: gitOpe2Internal } = require("../../../../../app/core/gitOperator2.js");

//test data
const testDirRoot = "WHEEL_TEST_TMP";
const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");

//helper functions
const { projectJsonFilename, componentJsonFilename, statusFilename } = require("../../../../../app/db/db.js");
const { updateComponent, createNewComponent, addInputFile, addOutputFile, addLink, addFileLink, createNewProject } = require("../../../../../app/core/projectFilesOperator.js");

const { scriptName, pwdCmd, scriptHeader, exit } = require("../../../../testScript.js");
const scriptPwd = `${scriptHeader}\n${pwdCmd}`;

describe("#runProject with local tasks", function () {
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
  describe("one local task", ()=>{
    let task0;
    beforeEach(async ()=>{
      task0 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
      await updateComponent(projectRootDir, task0.ID, "script", scriptName);
    });
    it("should retry 2 times and fail", async ()=>{
      await updateComponent(projectRootDir, task0.ID, "retryTimes", 2);
      await updateComponent(projectRootDir, task0.ID, "retryCondition", true);
      await fs.outputFile(path.join(projectRootDir, "task0", scriptName), `${scriptPwd}\n${exit(10)}`);
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
      expect(path.resolve(projectRootDir, "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state", "ancestorsName"],
        properties: {
          state: { enum: ["failed"] },
          ancestorsName: { enum: [""] }
        }
      });
      expect(path.resolve(projectRootDir, "task0", statusFilename)).to.be.a.file().with.content("failed\n10\nundefined");
    });
    it("should run project and fail", async ()=>{
      await fs.outputFile(path.join(projectRootDir, "task0", scriptName), `${scriptPwd}\n${exit(10)}`);
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
      expect(path.resolve(projectRootDir, "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state", "ancestorsName"],
        properties: {
          state: { enum: ["failed"] },
          ancestorsName: { enum: [""] }
        }
      });
      expect(path.resolve(projectRootDir, "task0", statusFilename)).to.be.a.file().with.content("failed\n10\nundefined");
    });
    it("should run project and successfully finish", async ()=>{
      await fs.outputFile(path.join(projectRootDir, "task0", scriptName), scriptPwd);
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
      expect(path.resolve(projectRootDir, "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state", "ancestorsName"],
        properties: {
          state: { enum: ["finished"] },
          ancestorsName: { enum: [""] }
        }
      });
      expect(path.resolve(projectRootDir, "task0", statusFilename)).to.be.a.file().with.content("finished\n0\nundefined");
    });
  });
  describe("3 local tasks with execution order dependency", ()=>{
    let task0 = null;
    let task1 = null;
    let task2 = null;
    beforeEach(async ()=>{
      task0 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
      task1 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
      task2 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
      await updateComponent(projectRootDir, task0.ID, "script", scriptName);
      await updateComponent(projectRootDir, task1.ID, "script", scriptName);
      await updateComponent(projectRootDir, task2.ID, "script", scriptName);
      await fs.outputFile(path.join(projectRootDir, "task0", scriptName), scriptPwd);
      await fs.outputFile(path.join(projectRootDir, "task1", scriptName), scriptPwd);
      await fs.outputFile(path.join(projectRootDir, "task2", scriptName), scriptPwd);
      await addLink(projectRootDir, task0.ID, task1.ID);
      await addLink(projectRootDir, task1.ID, task2.ID);
    });
    it("should not run disable task and its dependent task but project should be successfully finished", async ()=>{
      await updateComponent(projectRootDir, task1.ID, "disable", true);

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
      expect(path.resolve(projectRootDir, "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "task1", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["not-started"] }
        }
      });
      expect(path.resolve(projectRootDir, "task2", componentJsonFilename)).to.be.a.file().with.json.using.schema({
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
      expect(path.resolve(projectRootDir, "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "task1", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "task2", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
    });
  });
  describe("3 local tasks with file dependency", ()=>{
    let task0 = null;
    let task1 = null;
    let task2 = null;
    beforeEach(async ()=>{
      task0 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
      task1 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
      task2 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
      await updateComponent(projectRootDir, task0.ID, "script", scriptName);
      await updateComponent(projectRootDir, task1.ID, "script", scriptName);
      await updateComponent(projectRootDir, task2.ID, "script", scriptName);
      await fs.outputFile(path.join(projectRootDir, "task0", scriptName), scriptPwd);
      await fs.outputFile(path.join(projectRootDir, "task0", "a"), "a");
      await fs.outputFile(path.join(projectRootDir, "task1", scriptName), scriptPwd);
      await fs.outputFile(path.join(projectRootDir, "task2", scriptName), scriptPwd);

      await addOutputFile(projectRootDir, task0.ID, "a");
      await addInputFile(projectRootDir, task1.ID, "b");

      await addOutputFile(projectRootDir, task1.ID, "b");
      await addInputFile(projectRootDir, task2.ID, "c");

      await addFileLink(projectRootDir, task0.ID, "a", task1.ID, "b");
      await addFileLink(projectRootDir, task1.ID, "b", task2.ID, "c");
    });
    it("should not run disable task and its dependent task but project should be successfully finished", async ()=>{
      await updateComponent(projectRootDir, task1.ID, "disable", true);

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
      expect(path.resolve(projectRootDir, "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "task1", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["not-started"] }
        }
      });
      expect(path.resolve(projectRootDir, "task2", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["not-started"] }
        }
      });
      expect(path.resolve(projectRootDir, "task0", "a")).to.be.a.file().with.contents("a");
      expect(path.resolve(projectRootDir, "task1", "b")).not.to.be.a.path();
      expect(path.resolve(projectRootDir, "task2", "c")).not.to.be.a.path();
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
      expect(path.resolve(projectRootDir, "task0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "task1", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "task2", componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["finished"] }
        }
      });
      expect(path.resolve(projectRootDir, "task0", "a")).to.be.a.file().with.contents("a");
      expect(path.resolve(projectRootDir, "task1", "b")).to.be.a.file().with.contents("a");
      expect(path.resolve(projectRootDir, "task2", "c")).to.be.a.file().with.contents("a");
    });
  });
});
