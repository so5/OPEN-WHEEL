/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import { promisify } from "node:util";
import { exec as execCB } from "node:child_process";
const exec = promisify(execCB);
import path from "node:path";
import fs from "fs-extra";

//setup test framework
import chai, { expect } from "chai";
import chaiFs from "chai-fs";
import chaiAsPromised from "chai-as-promised";

//helper
import { createNewComponent, createNewProject } from "../../../app/core/projectFilesOperator.js";
import { gitCommit } from "../../../app/core/gitOperator2.js";
import { projectJsonFilename, componentJsonFilename } from "../../../app/db/db.js";
import { getTempdRoot } from "../../../app/core/tempd.js";

//testee
import { exportProject } from "../../../app/core/exportProject.js";

chai.use(chaiFs);
chai.use(chaiAsPromised);

//test data
const testDirRoot = "WHEEL_TEST_TMP";
const projectRootDir = path.resolve(testDirRoot, "test_project.wheel");

describe("#export project", function () {
  this.timeout(10000);
  const projectName = "test_project";
  const tmpDir = getTempdRoot();

  const extractDir = path.resolve(testDirRoot, "tmp");
  let workflow0;
  beforeEach(async ()=>{
    await fs.ensureDir(tmpDir);
    await fs.remove(testDirRoot);
    await createNewProject(projectRootDir, projectName, null, "test", "test@example.com");
    await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
    await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
    await createNewComponent(projectRootDir, projectRootDir, "task", { x: 10, y: 10 });
    workflow0 = await createNewComponent(projectRootDir, projectRootDir, "workflow", { x: 10, y: 10 });
    await createNewComponent(projectRootDir, path.resolve(projectRootDir, workflow0.name), "task", { x: 10, y: 10 });
    await createNewComponent(projectRootDir, path.resolve(projectRootDir, workflow0.name), "task", { x: 10, y: 10 });
    await createNewComponent(projectRootDir, path.resolve(projectRootDir, workflow0.name), "task", { x: 10, y: 10 });
    await gitCommit(projectRootDir);
  });
  after(async ()=>{
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
  });
  it("should export project as tar.gz", async ()=>{
    const url = await exportProject(projectRootDir);
    expect(url).to.be.a("string").and.match(new RegExp(`WHEEL_project_${projectName}.tgz`));
    const archiveFilename = path.join(tmpDir, "exportProject", url);
    expect(archiveFilename).to.be.a.file();
  });
  it("should export project even if not-committed files exist and exclude them", async ()=>{
    await fs.outputFile(path.resolve(projectRootDir, workflow0.name, "hoge"), "hoge");
    const url = await exportProject(projectRootDir);
    expect(url).to.be.a("string").and.match(new RegExp(`/.*WHEEL_project_${projectName}.tgz$`));
    await fs.ensureDir(extractDir);
    const archiveFilename = path.join(tmpDir, "exportProject", url);
    await exec(`tar xfz ${archiveFilename} -C ${extractDir} --strip 1`);
    expect(path.join(extractDir, workflow0.name, "hoge")).to.not.be.a.path();
    expect(path.join(extractDir, projectJsonFilename)).to.be.a.file();
  });
  it("should export project and status changed to 'not-started'", async ()=>{
    const workflowJson = await fs.readJson(path.join(projectRootDir, workflow0.name, componentJsonFilename));
    workflowJson.state = "hoge";
    await fs.writeJson(path.join(projectRootDir, workflow0.name, componentJsonFilename), workflowJson);

    const projectJson = await fs.readJson(path.join(projectRootDir, projectJsonFilename));
    projectJson.state = "huga";
    await fs.writeJson(path.join(projectRootDir, projectJsonFilename), projectJson);
    await exec(`cd ${projectRootDir}&&git add -u&& git commit -m 'test'`);

    const url = await exportProject(projectRootDir);
    expect(url).to.be.a("string").and.match(new RegExp(`WHEEL_project_${projectName}.tgz`));
    await fs.ensureDir(extractDir);
    const archiveFilename = path.join(tmpDir, "exportProject", url);
    await exec(`tar xfz ${archiveFilename} -C ${extractDir} --strip 1`);

    const workflowJsonAfter = await fs.readJson(path.join(extractDir, workflow0.name, componentJsonFilename));
    expect(workflowJsonAfter.state).to.be.a("string").and.equal("not-started");
    const projectJsonAfter = await fs.readJson(path.join(extractDir, projectJsonFilename));
    expect(projectJsonAfter.state).to.be.a("string").and.equal("not-started");
  });
});