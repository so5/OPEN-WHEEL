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
import { updateComponent, createNewComponent, addInputFile, addOutputFile, addLink, addFileLink, createNewProject } from "../../../../../app/core/projectFilesOperator.js";

import testScript from "../../../../testScript.js";
const { scriptName, pwdCmd, scriptHeader } = testScript;

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
  describe("Break", ()=>{
    let for0;
    let task0;
    let task1;
    let break0;
    beforeEach(async ()=>{
      for0 = await createNewComponent(projectRootDir, projectRootDir, "for", { x: 10, y: 10 });
      await updateComponent(projectRootDir, for0.ID, "start", 0);
      await updateComponent(projectRootDir, for0.ID, "end", 3);
      await updateComponent(projectRootDir, for0.ID, "step", 1);
      task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, for0.name), "task", { x: 10, y: 10 });
      task1 = await createNewComponent(projectRootDir, path.join(projectRootDir, for0.name), "task", { x: 10, y: 10 });
      await updateComponent(projectRootDir, task0.ID, "script", scriptName);
      await updateComponent(projectRootDir, task1.ID, "script", scriptName);
      await fs.outputFile(path.join(projectRootDir, for0.name, task0.name, scriptName), "echo task0 ${WHEEL_CURRENT_INDEX} >hoge");
      await fs.outputFile(path.join(projectRootDir, for0.name, task1.name, scriptName), "echo task1 ${WHEEL_CURRENT_INDEX} >hoge");
      break0 = await createNewComponent(projectRootDir, path.join(projectRootDir, for0.name), "break", { x: 10, y: 10 });
      await updateComponent(projectRootDir, break0.ID, "condition", "WHEEL_CURRENT_INDEX == 2");
      await addLink(projectRootDir, task0.ID, break0.ID);
      await addLink(projectRootDir, break0.ID, task1.ID);
    });
    it("should run from 0 to 2 and task1 under for0_2 should not run", async ()=>{
      await runProject(projectRootDir);
      expect(path.resolve(projectRootDir, `${for0.name}_0`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_1`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_2`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_3`)).not.to.be.a.path();
      expect(path.resolve(projectRootDir, `${for0.name}`, task0.name, "hoge")).to.be.a.file().with.content("task0 2\n");
      expect(path.resolve(projectRootDir, `${for0.name}`, task1.name, "hoge")).to.be.a.file().with.content("task1 1\n");
      expect(path.resolve(projectRootDir, `${for0.name}_0`, task0.name, "hoge")).to.be.a.file().with.content("task0 0\n");
      expect(path.resolve(projectRootDir, `${for0.name}_0`, task1.name, "hoge")).to.be.a.file().with.content("task1 0\n");
      expect(path.resolve(projectRootDir, `${for0.name}_1`, task0.name, "hoge")).to.be.a.file().with.content("task0 1\n");
      expect(path.resolve(projectRootDir, `${for0.name}_1`, task1.name, "hoge")).to.be.a.file().with.content("task1 1\n");
      expect(path.resolve(projectRootDir, `${for0.name}_2`, task0.name, "hoge")).to.be.a.file().with.content("task0 2\n");
      expect(path.resolve(projectRootDir, `${for0.name}_2`, task1.name, "hoge")).to.be.a.file().with.content("task1 1\n");

      for (const dir of ["for0_0", "for0_1"]) {
        expect(path.resolve(projectRootDir, dir, componentJsonFilename)).to.be.a.file().with.json.using.schema({
          required: ["state"],
          properties: {
            state: { enum: ["finished"] }
          }
        });
        expect(path.resolve(projectRootDir, dir, task0.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
          required: ["state"],
          properties: {
            state: { enum: ["finished"] }
          }
        });
        expect(path.resolve(projectRootDir, dir, task1.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
          required: ["state"],
          properties: {
            state: { enum: ["finished"] }
          }
        });
      }
      for (const dir of ["for0", "for0_2"]) {
        expect(path.resolve(projectRootDir, dir, componentJsonFilename)).to.be.a.file().with.json.using.schema({
          required: ["state"],
          properties: {
            state: { enum: ["finished"] }
          }
        });
        expect(path.resolve(projectRootDir, dir, task0.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
          required: ["state"],
          properties: {
            state: { enum: ["finished"] }
          }
        });
        expect(path.resolve(projectRootDir, dir, task1.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
          required: ["state"],
          properties: {
            state: { enum: ["not-started"] }
          }
        });
      }
    });
  });
  describe("Continue", ()=>{
    let for0;
    let task0;
    let task1;
    let continue0;
    beforeEach(async ()=>{
      for0 = await createNewComponent(projectRootDir, projectRootDir, "for", { x: 10, y: 10 });
      await updateComponent(projectRootDir, for0.ID, "start", 0);
      await updateComponent(projectRootDir, for0.ID, "end", 3);
      await updateComponent(projectRootDir, for0.ID, "step", 1);
      task0 = await createNewComponent(projectRootDir, path.join(projectRootDir, for0.name), "task", { x: 10, y: 10 });
      task1 = await createNewComponent(projectRootDir, path.join(projectRootDir, for0.name), "task", { x: 10, y: 10 });
      await updateComponent(projectRootDir, task0.ID, "script", scriptName);
      await updateComponent(projectRootDir, task1.ID, "script", scriptName);
      await fs.outputFile(path.join(projectRootDir, for0.name, task0.name, scriptName), "echo task0 ${WHEEL_CURRENT_INDEX} >hoge");
      await fs.outputFile(path.join(projectRootDir, for0.name, task1.name, scriptName), "echo task1 ${WHEEL_CURRENT_INDEX} >hoge");
      continue0 = await createNewComponent(projectRootDir, path.join(projectRootDir, for0.name), "continue", { x: 10, y: 10 });
      await updateComponent(projectRootDir, continue0.ID, "condition", "WHEEL_CURRENT_INDEX == 2");
      await addLink(projectRootDir, task0.ID, continue0.ID);
      await addLink(projectRootDir, continue0.ID, task1.ID);
    });
    it("should run from 0 to 3 but task1 should be skipped when index=2", async ()=>{
      await runProject(projectRootDir);
      expect(path.resolve(projectRootDir, `${for0.name}_0`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_1`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_2`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}_3`)).to.be.a.directory();
      expect(path.resolve(projectRootDir, `${for0.name}`, task0.name, "hoge")).to.be.a.file().with.content("task0 3\n");
      expect(path.resolve(projectRootDir, `${for0.name}`, task1.name, "hoge")).to.be.a.file().with.content("task1 3\n");
      expect(path.resolve(projectRootDir, `${for0.name}_0`, task0.name, "hoge")).to.be.a.file().with.content("task0 0\n");
      expect(path.resolve(projectRootDir, `${for0.name}_0`, task1.name, "hoge")).to.be.a.file().with.content("task1 0\n");
      expect(path.resolve(projectRootDir, `${for0.name}_1`, task0.name, "hoge")).to.be.a.file().with.content("task0 1\n");
      expect(path.resolve(projectRootDir, `${for0.name}_1`, task1.name, "hoge")).to.be.a.file().with.content("task1 1\n");
      expect(path.resolve(projectRootDir, `${for0.name}_2`, task0.name, "hoge")).to.be.a.file().with.content("task0 2\n");
      expect(path.resolve(projectRootDir, `${for0.name}_2`, task1.name, "hoge")).to.be.a.file().with.content("task1 1\n");
      expect(path.resolve(projectRootDir, `${for0.name}_3`, task0.name, "hoge")).to.be.a.file().with.content("task0 3\n");
      expect(path.resolve(projectRootDir, `${for0.name}_3`, task1.name, "hoge")).to.be.a.file().with.content("task1 3\n");

      for (const dir of ["for0", "for0_0", "for0_1", "for0_2", "for0_3"]) {
        expect(path.resolve(projectRootDir, dir, componentJsonFilename)).to.be.a.file().with.json.using.schema({
          required: ["state"],
          properties: {
            state: { enum: ["finished"] }
          }
        });
        expect(path.resolve(projectRootDir, dir, task0.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
          required: ["state"],
          properties: {
            state: { enum: ["finished"] }
          }
        });
      }
      for (const dir of ["for0", "for0_0", "for0_1", "for0_3"]) {
        expect(path.resolve(projectRootDir, dir, task1.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
          required: ["state"],
          properties: {
            state: { enum: ["finished"] }
          }
        });
      }
      expect(path.resolve(projectRootDir, "for0_2", task1.name, componentJsonFilename)).to.be.a.file().with.json.using.schema({
        required: ["state"],
        properties: {
          state: { enum: ["not-started"] }
        }
      });
    });
  });
});
