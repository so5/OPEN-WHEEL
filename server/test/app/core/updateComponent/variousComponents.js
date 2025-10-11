/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import path from "path";
import fs from "fs-extra";
import { componentJsonFilename } from "../../../../app/db/db.js";
import chai from "chai";
import sinonChai from "sinon-chai";
import chaiFs from "chai-fs";
import chaiJsonSchema from "chai-json-schema";
import deepEqualInAnyOrder from "deep-equal-in-any-order";
import chaiAsPromised from "chai-as-promised";
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiFs);
chai.use(chaiJsonSchema);
chai.use(deepEqualInAnyOrder);
chai.use(chaiAsPromised);
import sinon from "sinon";
import { createNewProject, createNewComponent } from "../../../../app/core/projectFilesOperator.js";
import * as gitOperator2 from "../../../../app/core/gitOperator2.js";
import { updateComponent } from "../../../../app/core/updateComponent.js";
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
