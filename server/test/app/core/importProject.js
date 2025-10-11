/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */

"use strict";
//setup test framework
import chai, { expect } from "chai";
import chaiFs from "chai-fs";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import sinonChai from "sinon-chai";

import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { exec as execCB } from "node:child_process";
const exec = promisify(execCB);
import fs from "fs-extra";

//testee
import { importProject, _internal } from "../../../app/core/importProject.js";

chai.use(chaiFs);
chai.use(chaiAsPromised);
chai.use(sinonChai);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dummyProjectList = [];

//test data
const testDirRoot = "WHEEL_TEST_TMP";
const testArchiveFile = path.resolve(__dirname, "../../testFiles/WHEEL_project_test_project.tgz");

describe("import project UT", function () {
  this.timeout(10000);
  beforeEach(async ()=>{
    await fs.remove(testDirRoot);
  });
  after(async ()=>{
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
  });
  describe("#isEmptyDir", ()=>{
    beforeEach(async ()=>{
      await fs.ensureDir(path.resolve(testDirRoot, "empty"));
      await fs.ensureDir(path.resolve(testDirRoot, "withDot"));
      await fs.outputFile(path.resolve(testDirRoot, "withDot", ".hoge"), "hoge");
      await fs.ensureDir(path.resolve(testDirRoot, "withFile"));
      await fs.outputFile(path.resolve(testDirRoot, "withFile", "hoge"), "hoge");
    });
    it("should be return true for empty dir", async ()=>{
      expect(await _internal.isEmptyDir(path.resolve(testDirRoot, "empty"))).to.be.true;
    });
    it("should be return false if directory contains file", async ()=>{
      expect(await _internal.isEmptyDir(path.resolve(testDirRoot, "withFile"))).to.be.false;
    });
    it("should be return false if directory contains dot file", async ()=>{
      expect(await _internal.isEmptyDir(path.resolve(testDirRoot, "withDot"))).to.be.false;
    });
  });
  describe("#extractAndReadArchiveMetadata", ()=>{
    it("should read projectJson metadata in archive", async ()=>{
      const result = await _internal.extractAndReadArchiveMetadata(testArchiveFile);
      expect(result.name).to.equal("new_project");
    });
  });
  describe("#importProject", ()=>{
    let getHosts;
    let askHostMap;
    let rewriteHosts;
    beforeEach(async ()=>{
      getHosts = sinon.stub(_internal, "getHosts");
      askHostMap = sinon.stub(_internal, "askHostMap");
      rewriteHosts = sinon.stub(_internal, "rewriteHosts");
      _internal.projectList = dummyProjectList;
      await exec(`cp ${testArchiveFile} ${testArchiveFile}.bak`);
    });
    afterEach(async ()=>{
      sinon.restore();
      await exec(`mv ${testArchiveFile}.bak ${testArchiveFile}`);
    });
    it("should import project and add it to projectList", async ()=>{
      getHosts.onCall(0).returns([]);
      expect(await importProject("dummyClientID", testArchiveFile, testDirRoot)).to.be.a("string");
      expect(getHosts).to.be.calledOnce;
      expect(askHostMap).not.to.be.called;
      expect(rewriteHosts).not.to.be.called;
      expect(dummyProjectList[0].path).to.equal(path.resolve(testDirRoot, "new_project.wheel"));
    });
    it("should import project and add it to projectList with host modification", async ()=>{
      const hosts = ["hoge"];
      const hostMap = { hoge: "huga" };
      getHosts.onCall(0).returns(hosts);
      askHostMap.onCall(0).returns(hostMap);
      expect(await importProject("dummyClientID", testArchiveFile, testDirRoot)).to.be.a("string");
      expect(getHosts).to.be.calledOnce;
      expect(askHostMap).to.be.calledWith("dummyClientID", hosts);
      expect(rewriteHosts).to.be.calledOnce;
      expect(rewriteHosts.getCall(0).args[1]).to.deep.equal(hostMap);
      expect(dummyProjectList[0].path).to.equal(path.resolve(testDirRoot, "new_project.wheel"));
    });
  });
});
