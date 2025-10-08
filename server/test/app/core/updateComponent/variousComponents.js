/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const path = require("path");
const fs = require("fs-extra");
const { componentJsonFilename } = require("../../../../app/db/db.js");
const chai = require("chai");
const expect = chai.expect;
chai.use(require("sinon-chai"));
chai.use(require("chai-fs"));
chai.use(require("chai-json-schema"));
chai.use(require("deep-equal-in-any-order"));
chai.use(require("chai-as-promised"));
const sinon = require("sinon");
const { createNewProject, createNewComponent } = require("../../../../app/core/projectFilesOperator.js");
const gitOperator2 = require("../../../../app/core/gitOperator2.js");
const { updateComponent } = require("../../../../app/core/updateComponent.js");
const testDirRoot = "WHEEL_TEST_TMP";
describe("updateComponent UT", function () {
  const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");
  let gitPromise;
  beforeEach(async function () {
    this.timeout(5000);
    await fs.remove(testDirRoot);
    gitPromise = sinon.stub(gitOperator2, "gitPromise").resolves();

    try {
      await createNewProject(projectRootDir, "test project", null, "test", "test@example.com");
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
  afterEach(()=>{
    gitPromise.restore();
  });
  after(async ()=>{
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
  });
  describe("updateComponent() test on various component", ()=>{
    let targetComponent;
    ["task", "workflow", "PS", "if", "for", "while", "foreach", "storage", "source", "viewer", "stepjob", "stepjobTask", "bulkjobTask"]
      .forEach((type)=>{
        it(`should do nothing if file and specified ${type} component is not differ`, async ()=>{
          targetComponent = await createNewComponent(projectRootDir, projectRootDir, type, { x: 0, y: 0 });
          const updated = structuredClone(targetComponent);
          try {
            await updateComponent(projectRootDir, targetComponent.ID, updated);
          } catch (e) {
            console.log("updateComponent throw error", type, e);
            throw e;
          }
          const readFromFile = await fs.readJson(path.join(projectRootDir, targetComponent.name, componentJsonFilename));
          expect(readFromFile).to.deep.equal(targetComponent);
        });
        it(`should change description of ${type} component`, async ()=>{
          targetComponent = await createNewComponent(projectRootDir, projectRootDir, type, { x: 0, y: 0 });
          const updated = structuredClone(targetComponent);
          updated.description = "hoge";

          try {
            await updateComponent(projectRootDir, targetComponent.ID, updated);
          } catch (e) {
            console.log("updateComponent throw error", type, e);
            throw e;
          }
          const readFromFile = await fs.readJson(path.join(projectRootDir, targetComponent.name, componentJsonFilename));
          expect(readFromFile).not.to.equal(targetComponent);
          expect(readFromFile).to.deep.equal(updated);
          expect(readFromFile.description).to.equal("hoge");
        });
      });
  });
});
