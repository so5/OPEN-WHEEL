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
import { writeComponentJson } from "../../../../app/core/componentJsonIO.js";
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
  describe("updateComponent() test on source component", ()=>{
    let source;
    beforeEach(async ()=>{
      source = await createNewComponent(projectRootDir, projectRootDir, "source", { x: 0, y: 0 });
    });
    it("should set uploadOnDemand true and add outputFiles if not exists", async ()=>{
      const updated = structuredClone(source);
      updated.uploadOnDemand = true;

      try {
        await updateComponent(projectRootDir, source.ID, updated);
      } catch (e) {
        console.log("updateComponent throw error", e);
        throw e;
      }
      const readFromFile = await fs.readJson(path.join(projectRootDir, source.name, componentJsonFilename));
      expect(readFromFile).not.to.equal(source);
      expect(readFromFile).not.to.equal(updated);
      expect(readFromFile.uploadOnDemand).to.be.true;
      expect(readFromFile.outputFiles).to.have.lengthOf(1);
      expect(readFromFile.outputFiles[0].name).to.be.equal("UPLOAD_ONDEMAND");
    });
    it("should set uploadOnDemand false and change outputFiles", async ()=>{
      const updated = structuredClone(source);
      updated.uploadOnDemand = false;

      try {
        await updateComponent(projectRootDir, source.ID, updated);
      } catch (e) {
        console.log("updateComponent throw error", e);
        throw e;
      }
      const readFromFile = await fs.readJson(path.join(projectRootDir, source.name, componentJsonFilename));
      expect(readFromFile).not.to.equal(source);
      expect(readFromFile).not.to.equal(updated);
      expect(readFromFile.uploadOnDemand).to.be.false;
      expect(readFromFile.outputFiles).to.have.lengthOf(1);
      expect(readFromFile.outputFiles[0].name).to.be.equal("");
    });
    it("should set outputFiles name and set uploadOnDemand to false", async ()=>{
      const updated = structuredClone(source);
      updated.outputFiles[0].name = "hoge";
      source.uploadOnDemand = true;
      await writeComponentJson(projectRootDir, path.join(projectRootDir, source.name), source);

      try {
        await updateComponent(projectRootDir, source.ID, updated);
      } catch (e) {
        console.log("updateComponent throw error", e);
        throw e;
      }
      const readFromFile = await fs.readJson(path.join(projectRootDir, source.name, componentJsonFilename));
      expect(readFromFile).not.to.equal(source);
      expect(readFromFile).not.to.equal(updated);
      expect(readFromFile.uploadOnDemand).to.be.false;
      expect(readFromFile.outputFiles).to.have.lengthOf(1);
      expect(readFromFile.outputFiles[0].name).to.be.equal("hoge");
    });
  });
});
