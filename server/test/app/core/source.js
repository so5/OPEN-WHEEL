/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import path from "path";
import fs from "fs-extra";

//setup test framework
import chai, { expect } from "chai";
import sinonChai from "sinon-chai";
import chaiFs from "chai-fs";
import chaiJsonSchema from "chai-json-schema";

//testee
import { runProject } from "../../../app/core/projectController.js";

//test data
const testDirRoot = "WHEEL_TEST_TMP";
const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");

//helper functions
import { projectJsonFilename, componentJsonFilename } from "../../../app/db/db.js";
import { createNewProject, updateComponent, createNewComponent, addInputFile, addFileLink, renameOutputFile } from "../../../app/core/projectFilesOperator.js";

import testScript from "../../testScript.js";

const { scriptName, pwdCmd, scriptHeader } = testScript;
const scriptPwd = `${scriptHeader}\n${pwdCmd}`;

chai.use(sinonChai);
chai.use(chaiFs);
chai.use(chaiJsonSchema);

describe("UT for source component", function () {
  this.timeout(0);
  beforeEach(async ()=>{
    await fs.remove(testDirRoot);
    await createNewProject(projectRootDir, "test project", null, "test", "test@example.com");
    const source0 = await createNewComponent(projectRootDir, projectRootDir, "source", { x: 11, y: 11 });
    await fs.outputFile(path.join(projectRootDir, "source0", "foo"), "foo");
    await renameOutputFile(projectRootDir, source0.ID, 0, "foo");
    const task0 = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
    await updateComponent(projectRootDir, task0.ID, "script", scriptName);
    await addInputFile(projectRootDir, task0.ID, "bar");
    await fs.outputFile(path.join(projectRootDir, "task0", scriptName), scriptPwd);
    await addFileLink(projectRootDir, source0.ID, "foo", task0.ID, "bar");
  });
  after(async ()=>{
    //await fs.remove(testDirRoot);
  });
  describe("#runProject", ()=>{
    it("should copy foo to task0/bar", async ()=>{
      const state = await runProject(projectRootDir);
      expect(state).to.equal("finished");
      expect(path.resolve(projectRootDir, "task0", "bar")).to.be.a.file().with.contents("foo");
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
    });
  });
});
