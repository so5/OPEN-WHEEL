/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import path from "path";
import fs from "fs-extra";
import sinon from "sinon";

//setup test framework
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
import { createNewProject } from "../../../../app/core/projectFilesOperator.js";
import {
  ok,
  notConnected,
  previousNext,
  inputOutput,
  both,
  withTail,
  branched,
  double,
  noComponents
} from "../../../testFiles/cycleTestData.js";

//testee
import {
  validateComponents,
  getCycleGraph,
  isCycleGraph,
  getNextComponents,
  getComponentIDsInCycle,
  checkComponentDependency,
  _internal
} from "../../../../app/core/validateComponents.js";

const testDirRoot = "WHEEL_TEST_TMP";
const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");

describe("graph validation UT", function () {
  beforeEach(async function () {
    this.timeout(10000);
    await fs.remove(testDirRoot);
    await createNewProject(projectRootDir, "test project", null, "test", "test@example.com");
  });
  afterEach(()=>{
    sinon.restore();
  });
  after(async ()=>{
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
  });

  describe("checkComponentDependency", ()=>{
    it("should return empty array when no dependencies exist", async function () {
      sinon.stub(_internal, "getChildren").resolves([
        { ID: "comp1", name: "comp1", parent: "root", next: [] },
        { ID: "comp2", name: "comp2", parent: "root", next: [] }
      ]);
      const result = await checkComponentDependency(projectRootDir, "root");
      expect(result).to.be.an("array").that.is.empty;
    });

    it("should return empty array for valid dependencies", async function () {
      sinon.stub(_internal, "getChildren").resolves([
        { ID: "comp1", name: "comp1", parent: "root", next: ["comp2"] },
        { ID: "comp2", name: "comp2", parent: "root", next: ["comp3"] },
        { ID: "comp3", name: "comp3", parent: "root", next: [] }
      ]);
      const result = await checkComponentDependency(projectRootDir, "root");
      expect(result).to.be.an("array").that.is.empty;
    });

    it("should detect cycle dependencies", async function () {
      sinon.stub(_internal, "getChildren").resolves([
        { ID: "comp1", name: "comp1", parent: "root", next: ["comp2"] },
        { ID: "comp2", name: "comp2", parent: "root", next: ["comp3"] },
        { ID: "comp3", name: "comp3", parent: "root", next: ["comp1"] }
      ]);
      const result = await checkComponentDependency(projectRootDir, "root");
      expect(result).to.be.an("array").that.is.not.empty;
      expect(result).to.include("comp1");
      expect(result).to.include("comp2");
      expect(result).to.include("comp3");
    });

    it("should handle complex dependencies", async function () {
      sinon.stub(_internal, "getChildren").resolves([
        { ID: "comp1", name: "comp1", parent: "root", next: ["comp2", "comp3"] },
        { ID: "comp2", name: "comp2", parent: "root", next: ["comp4"] },
        { ID: "comp3", name: "comp3", parent: "root", next: ["comp5"] },
        { ID: "comp4", name: "comp4", parent: "root", next: [] },
        { ID: "comp5", name: "comp5", parent: "root", next: [] }
      ]);
      const result = await checkComponentDependency(projectRootDir, "root");
      expect(result).to.be.an("array").that.is.empty;
    });

    it("should detect cycle in complex dependencies", async function () {
      sinon.stub(_internal, "getChildren").resolves([
        { ID: "comp1", name: "comp1", parent: "root", next: ["comp2", "comp3"] },
        { ID: "comp2", name: "comp2", parent: "root", next: ["comp4"] },
        { ID: "comp3", name: "comp3", parent: "root", next: ["comp5"] },
        { ID: "comp4", name: "comp4", parent: "root", next: ["comp6"] },
        { ID: "comp5", name: "comp5", parent: "root", next: [] },
        { ID: "comp6", name: "comp6", parent: "root", next: ["comp2"] }
      ]);
      const result = await checkComponentDependency(projectRootDir, "root");
      expect(result).to.be.an("array").that.is.not.empty;
      expect(result).to.include("comp2");
      expect(result).to.include("comp4");
      expect(result).to.include("comp6");
    });
  });

  describe("isCycleGraph", function () {
    it("should return false when no cycle exists", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: ["comp2"] },
        { ID: "comp2", name: "comp2", parent: "root", next: ["comp3"] },
        { ID: "comp3", name: "comp3", parent: "root", next: [] }
      ];
      const startComponent = components[0];
      const results = {};
      components.forEach((e)=>{
        results[e.ID] = "white";
      });
      const cyclePath = [];
      const result = isCycleGraph("dummy", components, startComponent, results, cyclePath);
      expect(result).to.be.false;
    });
    it("should return true when cycle exists", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: ["comp2"] },
        { ID: "comp2", name: "comp2", parent: "root", next: ["comp3"] },
        { ID: "comp3", name: "comp3", parent: "root", next: ["comp1"] }
      ];
      const startComponent = components[0];
      const results = {};
      components.forEach((e)=>{
        results[e.ID] = "white";
      });
      const cyclePath = [];
      const result = isCycleGraph("dummy", components, startComponent, results, cyclePath);
      expect(result).to.be.true;
      expect(cyclePath).to.include("comp1");
      expect(cyclePath).to.include("comp2");
      expect(cyclePath).to.include("comp3");
    });
    it("should return true for self-referencing component", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: ["comp1"] }
      ];
      const startComponent = components[0];
      const results = {};
      components.forEach((e)=>{
        results[e.ID] = "white";
      });
      const cyclePath = [];
      const result = isCycleGraph("dummy", components, startComponent, results, cyclePath);
      expect(result).to.be.true;
      expect(cyclePath).to.include("comp1");
    });
    it("should return true for complex cycle dependencies", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: ["comp2", "comp3"] },
        { ID: "comp2", name: "comp2", parent: "root", next: ["comp4"] },
        { ID: "comp3", name: "comp3", parent: "root", next: ["comp5"] },
        { ID: "comp4", name: "comp4", parent: "root", next: ["comp6"] },
        { ID: "comp5", name: "comp5", parent: "root", next: [] },
        { ID: "comp6", name: "comp6", parent: "root", next: ["comp2"] }
      ];
      const startComponent = components[0];
      const results = {};
      components.forEach((e)=>{
        results[e.ID] = "white";
      });
      const cyclePath = [];
      const result = isCycleGraph("dummy", components, startComponent, results, cyclePath);
      expect(result).to.be.true;
      expect(cyclePath).to.include("comp2");
      expect(cyclePath).to.include("comp4");
      expect(cyclePath).to.include("comp6");
    });
    it("should handle outputFiles connections", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: [], outputFiles: [{ name: "output1.txt", dst: [{ dstNode: "comp2" }] }] },
        { ID: "comp2", name: "comp2", parent: "root", next: [], outputFiles: [{ name: "output2.txt", dst: [{ dstNode: "comp1" }] }] }
      ];
      const startComponent = components[0];
      const results = {};
      components.forEach((e)=>{
        results[e.ID] = "white";
      });
      const cyclePath = [];
      const result = isCycleGraph("dummy", components, startComponent, results, cyclePath);
      expect(result).to.be.true;
      expect(cyclePath).to.include("comp1");
      expect(cyclePath).to.include("comp2");
    });
    it("should handle null nextComponents in isCycleGraph", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: [] }
      ];
      const startComponent = components[0];
      const results = {};
      components.forEach((e)=>{
        results[e.ID] = "white";
      });
      const cyclePath = [];
      sinon.stub(_internal, "getNextComponents").returns(null);
      const result = isCycleGraph("dummy", components, startComponent, results, cyclePath);
      expect(result).to.be.false;
    });
    it("should skip already explored components in isCycleGraph", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: ["comp2"] },
        { ID: "comp2", name: "comp2", parent: "root", next: ["comp3"] },
        { ID: "comp3", name: "comp3", parent: "root", next: [] }
      ];
      const startComponent = components[0];
      const results = {
        comp1: "white",
        comp2: "white",
        comp3: "black"
      };
      const cyclePath = [];
      const result = isCycleGraph("dummy", components, startComponent, results, cyclePath);
      expect(result).to.be.false;
      expect(cyclePath).to.not.include("comp3");
    });
  });

  describe("getNextComponents", function () {
    it("should return components referenced in next array", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: ["comp2", "comp3"] },
        { ID: "comp2", name: "comp2", parent: "root", next: [] },
        { ID: "comp3", name: "comp3", parent: "root", next: [] }
      ];
      const result = getNextComponents(components, components[0]);
      expect(result).to.be.an("array").with.lengthOf(2);
      expect(result[0]).to.deep.include({ ID: "comp2" });
      expect(result[1]).to.deep.include({ ID: "comp3" });
    });

    it("should return components referenced in outputFiles", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: [], outputFiles: [{ name: "output1.txt", dst: [{ dstNode: "comp2" }] }, { name: "output2.txt", dst: [{ dstNode: "comp3" }] }] },
        { ID: "comp2", name: "comp2", parent: "root", next: [] },
        { ID: "comp3", name: "comp3", parent: "root", next: [] }
      ];
      const result = getNextComponents(components, components[0]);
      expect(result).to.be.an("array").with.lengthOf(2);
      expect(result[0]).to.deep.include({ ID: "comp2" });
      expect(result[1]).to.deep.include({ ID: "comp3" });
    });

    it("should return components referenced in both next and outputFiles without duplicates", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: ["comp2", "comp3"], outputFiles: [{ name: "output1.txt", dst: [{ dstNode: "comp2" }] }, { name: "output2.txt", dst: [{ dstNode: "comp4" }] }] },
        { ID: "comp2", name: "comp2", parent: "root", next: [] },
        { ID: "comp3", name: "comp3", parent: "root", next: [] },
        { ID: "comp4", name: "comp4", parent: "root", next: [] }
      ];
      const result = getNextComponents(components, components[0]);
      expect(result).to.be.an("array").with.lengthOf(3);
      const sortedResult = result.sort((a, b)=>{
        return a.ID.localeCompare(b.ID);
      });
      expect(sortedResult[0]).to.deep.include({ ID: "comp2" });
      expect(sortedResult[1]).to.deep.include({ ID: "comp3" });
      expect(sortedResult[2]).to.deep.include({ ID: "comp4" });
    });

    it("should return empty array when no dependencies exist", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: [] },
        { ID: "comp2", name: "comp2", parent: "root", next: [] }
      ];
      const result = getNextComponents(components, components[0]);
      expect(result).to.be.an("array").that.is.empty;
    });

    it("should handle non-existent component references", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: ["comp2", "nonexistent"] },
        { ID: "comp2", name: "comp2", parent: "root", next: [] }
      ];
      const result = getNextComponents(components, components[0]);
      expect(result).to.be.an("array").with.lengthOf(1);
      expect(result[0]).to.deep.include({ ID: "comp2" });
    });

    it("should handle multiple output file destinations", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: [], outputFiles: [{ name: "output1.txt", dst: [{ dstNode: "comp2" }, { dstNode: "comp3" }] }] },
        { ID: "comp2", name: "comp2", parent: "root", next: [] },
        { ID: "comp3", name: "comp3", parent: "root", next: [] }
      ];
      const result = getNextComponents(components, components[0]);
      expect(result).to.be.an("array").with.lengthOf(2);
      expect(result[0]).to.deep.include({ ID: "comp2" });
      expect(result[1]).to.deep.include({ ID: "comp3" });
    });
    it("should handle outputFiles with origin property", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: [], outputFiles: [{ name: "output1.txt", dst: [{ dstNode: "comp2" }, { origin: "some-origin", dstNode: "comp3" }] }] },
        { ID: "comp2", name: "comp2", parent: "root", next: [] },
        { ID: "comp3", name: "comp3", parent: "root", next: [] }
      ];
      const result = getNextComponents(components, components[0]);
      expect(result).to.be.an("array").with.lengthOf(1);
      expect(result[0]).to.deep.include({ ID: "comp2" });
    });
  });

  describe("getComponentIDsInCycle", function () {
    it("should return components in cycle", function () {
      const graphPath = ["comp1", "comp2", "comp1"];
      const result = getComponentIDsInCycle(graphPath);
      expect(result).to.be.an("array").that.is.not.empty;
      expect(result).to.deep.equal(["comp2", "comp1"]);
    });
    it("should handle self-referencing component", function () {
      const graphPath = ["comp1", "comp1"];
      const result = getComponentIDsInCycle(graphPath);
      expect(result).to.be.an("array").that.is.not.empty;
      expect(result).to.deep.equal(["comp1"]);
    });
    it("should handle complex dependencies", function () {
      const graphPath = ["comp1", "comp2", "comp4", "comp6", "comp2"];
      const result = getComponentIDsInCycle(graphPath);
      expect(result).to.be.an("array").that.is.not.empty;
      expect(result).to.deep.equal(["comp6", "comp4", "comp2"]);
    });
    it("should return empty array for empty components array", function () {
      const result = getComponentIDsInCycle([]);
      expect(result).to.be.an("array").that.is.empty;
    });
  });

  describe("getCycleGraph", function () {
    it("should explore white components", function () {
      const components = [
        { ID: "comp1", name: "comp1", parent: "root", next: ["comp2"] },
        { ID: "comp2", name: "comp2", parent: "root", next: [] }
      ];
      const originalIsCycleGraph = validateComponents.__get__("isCycleGraph");
      let isCycleGraphCalled = false;
      validateComponents.__set__("isCycleGraph", ()=>{
        isCycleGraphCalled = true;
        return false;
      });

      const result = getCycleGraph("dummy", components);

      expect(isCycleGraphCalled).to.be.true;
      expect(result).to.be.an("array").that.is.empty;

      validateComponents.__set__("isCycleGraph", originalIsCycleGraph);
    });
  });

  describe("test cycle graph checker", ()=>{
    it("should return empty array if no cycle graph detected", async ()=>{
      expect(await getCycleGraph("dummy", ok)).to.be.empty;
    });
    it("should return empty array if no cycle graph detected (not-connected)", async ()=>{
      expect(await getCycleGraph("dummy", notConnected)).to.be.empty;
    });
    it("should return array of component IDs in cycle graph (previous-next)", async ()=>{
      expect(await getCycleGraph("dummy", previousNext)).to.be.deep.equalInAnyOrder([
        "4fa023a0-239c-11ef-8cf7-6705d44703e7",
        "50a389e0-239c-11ef-8cf7-6705d44703e7",
        "5558ad80-239c-11ef-8cf7-6705d44703e7"
      ]);
    });
    it("should return array of component IDs in cycle graph (inputFile-outputFile)", async ()=>{
      expect(await getCycleGraph("dummy", inputOutput)).to.be.deep.equalInAnyOrder([
        "d8f85b40-239c-11ef-8cf7-6705d44703e7",
        "c0b173a0-239c-11ef-8cf7-6705d44703e7",
        "c1fc6a30-239c-11ef-8cf7-6705d44703e7"
      ]);
    });
    it("should return array of component IDs in cycle graph (both)", async ()=>{
      expect(await getCycleGraph("dummy", both)).to.be.deep.equalInAnyOrder([
        "264ca6d0-239d-11ef-8cf7-6705d44703e7",
        "2b0c2ab0-239d-11ef-8cf7-6705d44703e7",
        "2928ebc0-239d-11ef-8cf7-6705d44703e7",
        "27316180-239d-11ef-8cf7-6705d44703e7"
      ]);
    });
    it("should return array of component IDs in cycle graph (withTail)", async ()=>{
      expect(await getCycleGraph("dummy", withTail)).to.be.deep.equalInAnyOrder([
        "759cf950-26e6-11ef-8b70-5bf5636e4460",
        "7414f9c0-26e6-11ef-8b70-5bf5636e4460",
        "72a1bab0-26e6-11ef-8b70-5bf5636e4460"
      ]);
    });
    it("should return array of component IDs in cycle graph (branched)", async ()=>{
      expect(await getCycleGraph("dummy", branched)).to.be.deep.equalInAnyOrder([
        "a2093120-2790-11ef-a6ac-2f44b3871473",
        "a0b8e360-2790-11ef-a6ac-2f44b3871473",
        "9f7da440-2790-11ef-a6ac-2f44b3871473"
      ]);
    });
    it("should return array of component IDs in cycle graph (double)", async ()=>{
      expect(await getCycleGraph("dummy", double)).to.be.deep.equalInAnyOrder([
        "e70f86b0-26e7-11ef-8c4b-f7f88efdd21e",
        "e859e100-26e7-11ef-8c4b-f7f88efdd21e",
        "e97c40f0-26e7-11ef-8c4b-f7f88efdd21e",
        "f5f0baf0-26e7-11ef-8c4b-f7f88efdd21e",
        "f772ee20-26e7-11ef-8c4b-f7f88efdd21e"
      ]);
    });
    it("should return empty array if no components are given", async ()=>{
      expect(await getCycleGraph("dummy", noComponents)).to.be.empty;
    });
  });
});
