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
const { updateComponent, createNewComponent, addInputFile, addOutputFile, addFileLink, createNewProject } = require("../../../../../app/core/projectFilesOperator.js");

const { scriptName, pwdCmd, scriptHeader } = require("../../../../testScript.js");
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
});