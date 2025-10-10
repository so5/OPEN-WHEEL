/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import path from "path";
import fs from "fs-extra";
import glob from "glob";
import { extract } from "tar";
import { createTempd } from "./tempd.js";
import { readJsonGreedy } from "./fileUtils.js";
import { projectList, projectJsonFilename, componentJsonFilename, suffix } from "../db/db.js";
import { gitSetup, gitClone, gitCommit, gitConfig, gitRemoveOrigin } from "./gitOperator2.js";
import { setComponentStateR, updateProjectROStatus, getHosts } from "./projectFilesOperator.js";
import { askHostMap } from "./askHostMap.js";
import { askRewindState } from "./askRewindState.js";
import { rewriteHosts } from "./rewriteHosts.js";

const _internal = {
  path,
  fs,
  glob,
  extract,
  createTempd,
  readJsonGreedy,
  projectList,
  projectJsonFilename,
  componentJsonFilename,
  suffix,
  gitSetup,
  gitClone,
  gitCommit,
  gitConfig,
  gitRemoveOrigin,
  setComponentStateR,
  updateProjectROStatus,
  getHosts,
  askHostMap,
  askRewindState,
  rewriteHosts,

  /**
   * determine specified directory is empty
   * @param {string} dir - dir path to be checked
   * @returns {Promise} - resolved true if direcrory is empty, false if one or more containts exist
   */
  async isEmptyDir(dir) {
    const containts = await _internal.fs.readdir(dir);
    return containts.length === 0;
  },

  /**
   * read archive meta data
   * @param {string} archiveFile - path to archive file
   * @returns {object} - project name, export date, exporter
   */
  async extractAndReadArchiveMetadata(archiveFile) {
    const { dir } = await _internal.createTempd(null, "importProject");
    const workDir = await _internal.fs.mkdtemp(`${dir}/`);
    await _internal.extract({ strict: true, file: archiveFile, cwd: workDir, strip: 1, preserveOwner: false, unlink: true });
    const projectJson = await _internal.readJsonGreedy(_internal.path.join(workDir, _internal.projectJsonFilename));
    return { name: projectJson.name, dir: workDir };
  },

  /**
   * copy project file from git repo and read meta data
   * @param {string} URL - git repo url which has WHEEL project
   * @returns {object} - project name, export date, exporter
   */
  async gitCloneAndReadArchiveMetadata(URL) {
    const { dir } = await _internal.createTempd(null, "importProject");
    const workDir = await _internal.fs.mkdtemp(`${dir}/`);
    await _internal.gitClone(workDir, 1, URL);
    const projectJson = await _internal.readJsonGreedy(_internal.path.join(workDir, _internal.projectJsonFilename));
    return { name: projectJson.name, dir: workDir };
  },

  /**
   * read project and component metadata under dir and report readonly or status is not "not-started"
   * @param {string} dir - search root path
   * @returns {object[]} - array of metadata paths and reasons
   */
  async checkProjectAndComponentStatus(dir) {
    const result = [];
    const { readOnly, state } = await _internal.readJsonGreedy(_internal.path.resolve(dir, _internal.projectJsonFilename));
    if (readOnly) {
      result.push({ path: "project", state: "read only", ID: "projectRO" });
    }
    if (state !== "not-started") {
      result.push({ path: "project", state, ID: "projectState" });
    }
    const componentJsonFiles = await _internal.glob(_internal.path.join(dir, "**", _internal.componentJsonFilename));
    const componentsToBeFixed = await Promise.all(componentJsonFiles
      .map(async (componentJsonFile)=>{
        const { state, ID } = await _internal.readJsonGreedy(componentJsonFile);
        if (state !== "not-started") {
          return { path: _internal.path.relative(dir, _internal.path.dirname(componentJsonFile)), state, ID };
        }
        return null;
      }));
    result.push(
      ...componentsToBeFixed.filter((e)=>{
        return e !== null;
      })
    );
    return result;
  },
  async ensureProjectRootDir(projectRootDir) {
    if (await _internal.fs.pathExists(projectRootDir)) {
      const stats = await _internal.fs.stat(projectRootDir);
      if (!stats.isDirectory() || !await _internal.isEmptyDir(projectRootDir)) {
        const err = new Error(`specified path is in use: ${projectRootDir}`);
        err.projectRootDir = projectRootDir;
        err.reason = "PathExists";
        throw err;
      }
    } else {
      await _internal.fs.ensureDir(projectRootDir);
    }
  },

  async checkAndFixProject(src, clientID) {
    //throw execption if user cancel importiong
    const toBeFixed = await _internal.checkProjectAndComponentStatus(src);

    if (toBeFixed.length > 0) {
      await _internal.askRewindState(clientID, toBeFixed);
      await _internal.setComponentStateR(src, src, "not-started");
      await _internal.updateProjectROStatus(src, false);
    }

    const hosts = await _internal.getHosts(src, null);
    if (hosts.length > 0) {
      //throw exception if user cancel or input invalid host map
      const hostMap = await _internal.askHostMap(clientID, hosts);
      await _internal.rewriteHosts(src, hostMap);
    }
    await _internal.gitConfig(src, "user.name", "wheel");
    await _internal.gitConfig(src, "user.email", "wheel@example.com");
    await _internal.gitCommit(src, "import project");
  },

  /**
   * import project archive file
   * @param {string} clientID - socket's ID
   * @param {string} archiveFile - path to archive file
   * @param {string} parentDir - path to be extracted archive file
   * @returns {Promise} - resolved when project archive is imported
   */
  async importProject(clientID, archiveFile, parentDir) {
    const { name: projectName, dir: src } = await _internal.extractAndReadArchiveMetadata(archiveFile);
    const projectRootDir = _internal.path.resolve(parentDir, projectName + _internal.suffix);
    try {
      await _internal.ensureProjectRootDir(projectRootDir);
      await _internal.checkAndFixProject(src, clientID);
      await _internal.gitClone(projectRootDir, 1, src);
      await _internal.gitRemoveOrigin(projectRootDir);
      await _internal.gitSetup(projectRootDir, "wheel", "wheel@example.com");
      _internal.projectList.unshift({ path: projectRootDir });
    } finally {
      await _internal.fs.remove(archiveFile);
      await _internal.fs.remove(src);
    }

    return projectRootDir;
  }
};

/**
 * import project from git repository
 * @param {string} clientID - socket's ID
 * @param {string} URL - repository's URL
 * @param {string} parentDir - path to be extracted archive file
 * @returns {Promise} - resolved when project archive is imported
 */
export async function importProjectFromGitRepository(clientID, URL, parentDir) {
  const { name: projectName, dir: src } = await _internal.gitCloneAndReadArchiveMetadata(URL);
  const projectRootDir = _internal.path.resolve(parentDir, projectName + _internal.suffix);
  try {
    await _internal.ensureProjectRootDir(projectRootDir);
    await _internal.checkAndFixProject(src, clientID);
    await _internal.gitClone(projectRootDir, 1, src);
    _internal.projectList.unshift({ path: projectRootDir });
  } finally {
    await _internal.fs.remove(src);
  }
  return projectRootDir;
}

export const importProject = _internal.importProject;

let internal;
if (process.env.NODE_ENV === "test") {
  internal = _internal;
}
export { internal as _internal };