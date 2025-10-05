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
const { updateComponent, createNewComponent, addInputFile, addOutputFile, addLink, addFileLink, createNewProject } = require("../../../../../app/core/projectFilesOperator.js");

const { scriptName, pwdCmd, scriptHeader } = require("../../../../testScript.js");
const scriptPwd = `${scriptHeader}\n${pwdCmd}`;

describe("#runProject with conditional components", function () {
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
    describe("If component", ()=>{
        beforeEach(async ()=>{
          const if0 = await createNewComponent(projectRootDir, projectRootDir, "if", { x: 10, y: 10 });
          const if1 = await createNewComponent(projectRootDir, projectRootDir, "if", { x: 10, y: 10 });
          const if2 = await createNewComponent(projectRootDir, projectRootDir, "if", { x: 10, y: 10 });
          const if3 = await createNewComponent(projectRootDir, projectRootDir, "if", { x: 10, y: 10 });
          const task0 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
          const task1 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
          await updateComponent(projectRootDir, if0.ID, "condition", scriptName);
          await updateComponent(projectRootDir, if1.ID, "condition", scriptName);
          await updateComponent(projectRootDir, if2.ID, "condition", "true");
          await updateComponent(projectRootDir, if3.ID, "condition", "(()=>{return false})()");
          await updateComponent(projectRootDir, task0.ID, "script", scriptName);
          await updateComponent(projectRootDir, task1.ID, "script", scriptName);
          await addLink(projectRootDir, if0.ID, task0.ID);
          await addLink(projectRootDir, if0.ID, task1.ID, true);
          await addLink(projectRootDir, if1.ID, task1.ID);
          await addLink(projectRootDir, if1.ID, task0.ID, true);
          await addLink(projectRootDir, if2.ID, task0.ID);
          await addLink(projectRootDir, if2.ID, task1.ID, true);
          await addLink(projectRootDir, if3.ID, task1.ID);
          await addLink(projectRootDir, if3.ID, task0.ID, true);
          await fs.outputFile(path.join(projectRootDir, "if0", scriptName), "#!/bin/bash\nexit 0\n");
          await fs.outputFile(path.join(projectRootDir, "if1", scriptName), "#!/bin/bash\nexit 1\n");
          await fs.outputFile(path.join(projectRootDir, "task0", scriptName), scriptPwd);
          await fs.outputFile(path.join(projectRootDir, "task1", scriptName), scriptPwd);
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
          expect(path.resolve(projectRootDir, "if0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "if1", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "if2", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
          expect(path.resolve(projectRootDir, "if3", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
        });
    });
    describe("If component", ()=>{
        beforeEach(async ()=>{
          const if0 = await createNewComponent(projectRootDir, projectRootDir, "if", { x: 10, y: 10 });
          const task0 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
          const task1 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
          const task2 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
          await updateComponent(projectRootDir, if0.ID, "condition", scriptName);
          await updateComponent(projectRootDir, task0.ID, "script", scriptName);
          await updateComponent(projectRootDir, task1.ID, "script", scriptName);
          await updateComponent(projectRootDir, task2.ID, "script", scriptName);
          await fs.outputFile(path.join(projectRootDir, "task0", "a"), "a");
          await addOutputFile(projectRootDir, task0.ID, "a");
          await addInputFile(projectRootDir, if0.ID, "b");
          await addInputFile(projectRootDir, task2.ID, "c");
          await addFileLink(projectRootDir, task0.ID, "a", if0.ID, "b");
          await addFileLink(projectRootDir, task0.ID, "a", task2.ID, "c");
          await addLink(projectRootDir, if0.ID, task1.ID);
          await addLink(projectRootDir, if0.ID, task2.ID, true);
          await fs.outputFile(path.join(projectRootDir, "if0", scriptName), "#!/bin/bash\nexit 0\n");
          await fs.outputFile(path.join(projectRootDir, "task0", scriptName), scriptPwd);
          await fs.outputFile(path.join(projectRootDir, "task1", scriptName), scriptPwd);
          await fs.outputFile(path.join(projectRootDir, "task2", scriptName), scriptPwd);
        });
        it("should not make link from outputFile to inputFile behind If Component", async ()=>{
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
              state: { enum: ["not-started"] }
            }
          });
          expect(path.resolve(projectRootDir, "if0", componentJsonFilename)).to.be.a.file().with.json.using.schema({
            required: ["state"],
            properties: {
              state: { enum: ["finished"] }
            }
          });
        });
    });
});