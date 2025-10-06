/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const path = require("path");
const fs = require("fs-extra");
const sinon = require("sinon");

//setup test framework
const chai = require("chai");
const expect = chai.expect;
chai.use(require("sinon-chai"));
chai.use(require("chai-fs"));
chai.use(require("chai-json-schema"));
chai.use(require("deep-equal-in-any-order"));
chai.use(require("chai-as-promised"));
const { createNewProject, createNewComponent } = require("../../../../app/core/projectFilesOperator");

//testee
const { validateKeepProp, validateForLoop, validateForeach, _internal } = require("../../../../app/core/validateComponents.js");


//test data
const testDirRoot = "WHEEL_TEST_TMP";

const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");
describe("validateLoop UT", function() {
  beforeEach(async function() {
    this.timeout(10000);
    await fs.remove(testDirRoot);
    sinon.stub(_internal.remoteHost, "query").callsFake((name, hostname) => {
      if (hostname === "OK") {
        return { name: "dummy" };
      }
      if (hostname === "jobOK") {
        return { name: "dummy", jobScheduler: "hoge" };
      }
      if (hostname === "stepjobNG") {
        return { name: "dummy", jobScheduler: "huga" };
      }
      if (hostname === "stepjobOK") {
        return { name: "dummy", jobScheduler: "huga", useStepjob: true };
      }
      if (hostname === "bulkjobNG") {
        return { name: "dummy", jobScheduler: "hige" };
      }
      if (hostname === "bulkjobOK") {
        return { name: "dummy", jobScheduler: "hige", useBulkjob: true };
      }
      return undefined;
    });

    sinon.stub(_internal, "jobScheduler").value({
      hoge: { queueOpt: "-q" },
      huga: { queueOpt: "-q", supportStepjob: true },
      hige: { queueOpt: "-q", supportBulkjob: true }
    });

    try {
      await createNewProject(projectRootDir, "test project", null, "test", "test@example.com");
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
  afterEach(() => {
    sinon.restore();
  });
  after(async () => {
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
  });
  describe("validateKeepProp", () => {
    let whileComponent;
    let forComponent;
    let foreachComponent;
    beforeEach(async () => {
      forComponent = await createNewComponent(projectRootDir, projectRootDir, "for", { x: 0, y: 0 });
      foreachComponent = await createNewComponent(projectRootDir, projectRootDir, "foreach", { x: 0, y: 0 });
      whileComponent = await createNewComponent(projectRootDir, projectRootDir, "while", { x: 0, y: 0 });
    });
    it("should be rejected if keep is non-empty string", () => {
      whileComponent.keep = "hoge";
      forComponent.keep = "hoge";
      foreachComponent.keep = "hoge";
      expect(validateKeepProp(whileComponent)).to.be.rejectedWith("keep must be positive integer");
      expect(validateKeepProp(forComponent)).to.be.rejectedWith("keep must be positive integer");
      return expect(validateKeepProp(foreachComponent)).to.be.rejectedWith("keep must be positive integer");
    });
    it("should be rejected if keep is a string that looks like a number", () => {
      whileComponent.keep = "5";
      forComponent.keep = "5";
      foreachComponent.keep = "5";
      expect(validateKeepProp(whileComponent)).to.be.rejectedWith("keep must be positive integer");
      expect(validateKeepProp(forComponent)).to.be.rejectedWith("keep must be positive integer");
      return expect(validateKeepProp(foreachComponent)).to.be.rejectedWith("keep must be positive integer");
    });
    it("should be rejected if keep is real number", () => {
      whileComponent.keep = 3.1;
      forComponent.keep = 3.1;
      foreachComponent.keep = 3.1;
      expect(validateKeepProp(whileComponent)).to.be.rejectedWith("keep must be positive integer");
      expect(validateKeepProp(forComponent)).to.be.rejectedWith("keep must be positive integer");
      return expect(validateKeepProp(foreachComponent)).to.be.rejectedWith("keep must be positive integer");
    });
    it("should be rejected if keep is negative integer", () => {
      whileComponent.keep = -1;
      forComponent.keep = -1;
      foreachComponent.keep = -1;
      expect(validateKeepProp(whileComponent)).to.be.rejectedWith("keep must be positive integer");
      expect(validateKeepProp(forComponent)).to.be.rejectedWith("keep must be positive integer");
      return expect(validateKeepProp(foreachComponent)).to.be.rejectedWith("keep must be positive integer");
    });
    it("should be rejected if keep is boolean", () => {
      whileComponent.keep = true;
      forComponent.keep = true;
      foreachComponent.keep = true;
      expect(validateKeepProp(whileComponent)).to.be.rejectedWith("keep must be positive integer");
      expect(validateKeepProp(forComponent)).to.be.rejectedWith("keep must be positive integer");
      return expect(validateKeepProp(foreachComponent)).to.be.rejectedWith("keep must be positive integer");
    });
    it("should be resolved with true if keep is empty string", async () => {
      whileComponent.keep = "";
      forComponent.keep = "";
      foreachComponent.keep = "";
      expect(await validateKeepProp(whileComponent)).to.be.true;
      expect(await validateKeepProp(forComponent)).to.be.true;
      expect(await validateKeepProp(foreachComponent)).to.be.true;
    });
    it("should be resolved with true if keep is null", async () => {
      whileComponent.keep = null;
      forComponent.keep = null;
      foreachComponent.keep = null;
      expect(await validateKeepProp(whileComponent)).to.be.true;
      expect(await validateKeepProp(forComponent)).to.be.true;
      expect(await validateKeepProp(foreachComponent)).to.be.true;
    });
    it("should be rejected if keep is undefined", () => {
      whileComponent.keep = undefined;
      forComponent.keep = undefined;
      foreachComponent.keep = undefined;
      expect(validateKeepProp(whileComponent)).to.be.rejectedWith("keep must be positive integer");
      expect(validateKeepProp(forComponent)).to.be.rejectedWith("keep must be positive integer");
      return expect(validateKeepProp(foreachComponent)).to.be.rejectedWith("keep must be positive integer");
    });
    it("should be resolved with true if keep is 0", async () => {
      whileComponent.keep = 0;
      forComponent.keep = 0;
      foreachComponent.keep = 0;
      expect(await validateKeepProp(whileComponent)).to.be.true;
      expect(await validateKeepProp(forComponent)).to.be.true;
      expect(await validateKeepProp(foreachComponent)).to.be.true;
    });
    it("should be resolved with true if keep is positive integer", async () => {
      whileComponent.keep = 5;
      forComponent.keep = 5;
      foreachComponent.keep = 5;
      expect(await validateKeepProp(whileComponent)).to.be.true;
      expect(await validateKeepProp(forComponent)).to.be.true;
      expect(await validateKeepProp(foreachComponent)).to.be.true;
    });
    it("should be resolved with true if keep is large positive integer", async () => {
      whileComponent.keep = 1000000;
      forComponent.keep = 1000000;
      foreachComponent.keep = 1000000;
      expect(await validateKeepProp(whileComponent)).to.be.true;
      expect(await validateKeepProp(forComponent)).to.be.true;
      expect(await validateKeepProp(foreachComponent)).to.be.true;
    });
  });
  describe("validateForLoop", () => {
    let forComponent;
    beforeEach(async () => {
      forComponent = await createNewComponent(projectRootDir, projectRootDir, "foreach", { x: 0, y: 0 });
    });
    it("should be rejected if start is not number", () => {
      forComponent.start = "hoge";
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("start must be number");
    });
    it("should be rejected if start is null", () => {
      forComponent.start = null;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("start must be number");
    });
    it("should be rejected if start is undefined", () => {
      forComponent.start = undefined;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("start must be number");
    });
    it("should be rejected if step is not number", () => {
      forComponent.start = 1;
      forComponent.step = "hoge";
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("step must be number");
    });
    it("should be rejected if step is null", () => {
      forComponent.start = 1;
      forComponent.step = null;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("step must be number");
    });
    it("should be rejected if step is undefined", () => {
      forComponent.start = 1;
      forComponent.step = undefined;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("step must be number");
    });
    it("should be rejected if end is not number", () => {
      forComponent.start = 1;
      forComponent.step = 2;
      forComponent.end = "hoge";
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("end must be number");
    });
    it("should be rejected if end is null", () => {
      forComponent.start = 1;
      forComponent.step = 2;
      forComponent.end = null;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("end must be number");
    });
    it("should be rejected if end is undefined", () => {
      forComponent.start = 1;
      forComponent.step = 2;
      forComponent.end = undefined;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("end must be number");
    });
    it("should be rejected if step is 0", () => {
      forComponent.start = 1;
      forComponent.step = 0;
      forComponent.end = 3;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("infinite loop");
    });
    it("should be rejected if step is wrong direction (positive step with start > end)", () => {
      forComponent.start = 5;
      forComponent.step = 1;
      forComponent.end = 3;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("infinite loop");
    });
    it("should be rejected if step is wrong direction (negative step with start < end)", () => {
      forComponent.start = 1;
      forComponent.step = -1;
      forComponent.end = 3;
      return expect(validateForLoop(forComponent)).to.be.rejectedWith("infinite loop");
    });
    it("should be resolved with true for positive step with start < end", async () => {
      forComponent.start = 1;
      forComponent.step = 2;
      forComponent.end = 10;
      expect(await validateForLoop(forComponent)).to.be.true;
    });
    it("should be resolved with true for negative step with start > end", async () => {
      forComponent.start = 10;
      forComponent.step = -2;
      forComponent.end = 1;
      expect(await validateForLoop(forComponent)).to.be.true;
    });
    it("should be resolved with true for decimal values", async () => {
      forComponent.start = 1.5;
      forComponent.step = 0.5;
      forComponent.end = 3.5;
      expect(await validateForLoop(forComponent)).to.be.true;
    });
    it("should be resolved with true for negative values", async () => {
      forComponent.start = -10;
      forComponent.step = 2;
      forComponent.end = -2;
      expect(await validateForLoop(forComponent)).to.be.true;
    });
    it("should be resolved with true if start and end are equal", async () => {
      forComponent.start = 5;
      forComponent.step = 1;
      forComponent.end = 5;
      expect(await validateForLoop(forComponent)).to.be.true;
    });
  });
  describe("validateForeach", () => {
    let foreachComponent;
    beforeEach(async () => {
      foreachComponent = await createNewComponent(projectRootDir, projectRootDir, "foreach", { x: 0, y: 0 });
    });
    it("should be rejected if indexList is not array", () => {
      foreachComponent.indexList = "hoge";
      return expect(validateForeach(foreachComponent)).to.be.rejectedWith("index list is broken");
    });
    it("should be rejected if indexList is null", () => {
      foreachComponent.indexList = null;
      return expect(validateForeach(foreachComponent)).to.be.rejectedWith("index list is broken");
    });
    it("should be rejected if indexList is undefined", () => {
      foreachComponent.indexList = undefined;
      return expect(validateForeach(foreachComponent)).to.be.rejectedWith("index list is broken");
    });
    it("should be rejected if indexList is empty array", () => {
      return expect(validateForeach(foreachComponent)).to.be.rejectedWith("index list is empty");
    });
    it("should be resolved with true if indexList has one string element", async () => {
      foreachComponent.indexList.push("hoge");
      expect(await validateForeach(foreachComponent)).to.be.true;
    });
    it("should be resolved with true if indexList has multiple string elements", async () => {
      foreachComponent.indexList.push("item1");
      foreachComponent.indexList.push("item2");
      foreachComponent.indexList.push("item3");
      expect(await validateForeach(foreachComponent)).to.be.true;
    });
    it("should be resolved with true if indexList has number elements", async () => {
      foreachComponent.indexList.push(1);
      foreachComponent.indexList.push(2);
      foreachComponent.indexList.push(3);
      expect(await validateForeach(foreachComponent)).to.be.true;
    });
    it("should be resolved with true if indexList has mixed type elements", async () => {
      foreachComponent.indexList.push("item1");
      foreachComponent.indexList.push(2);
      foreachComponent.indexList.push(true);
      expect(await validateForeach(foreachComponent)).to.be.true;
    });
    it("should be resolved with true if indexList has empty string", async () => {
      foreachComponent.indexList.push("");
      expect(await validateForeach(foreachComponent)).to.be.true;
    });
  });
});