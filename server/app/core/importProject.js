/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { promisify } = require("util");
const path = require("path");
const fs = require("fs-extra");
const glob = require("glob");
const { extract } = require("tar");
const { createTempd } = require("./tempd.js");
const { readJsonGreedy } = require("./fileUtils.js");
const { projectList, projectJsonFilename, componentJsonFilename, suffix } = require("../db/db.js");
const { gitSetup, gitClone, gitCommit, gitConfig, gitRemoveOrigin } = require("./gitOperator2.js");
const { setComponentStateR, updateProjectROStatus, getHosts } = require("./projectFilesOperator.js");
const { askHostMap } = require("./askHostMap.js");
const { askRewindState } = require("./askRewindState.js");
const { rewriteHosts } = require("./rewriteHosts.js");

const _internal = {
  promisify,
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
  rewriteHosts
};

/**
 * determine specified directory is empty
 * @param {string} dir - dir path to be checked
 * @returns {Promise} - resolved true if direcrory is empty, false if one or more containts exist
 */
async function isEmptyDir(dir) {
  const containts = await _internal.fs.readdir(dir);
  return containts.length === 0;
}

/**
 * read archive meta data
 * @param {string} archiveFile - path to archive file
 * @returns {object} - project name, export date, exporter
 */
async function extractAndReadArchiveMetadata(archiveFile) {
  const { dir } = await _internal.createTempd(null, "importProject");
  const workDir = await _internal.fs.mkdtemp(`${dir}/`);
  await _internal.extract({ strict: true, file: archiveFile, cwd: workDir, strip: 1, preserveOwner: false, unlink: true });
  const projectJson = await _internal.readJsonGreedy(_internal.path.join(workDir, _internal.projectJsonFilename));
  return { name: projectJson.name, dir: workDir };
}

/**
 * copy project file from git repo and read meta data
 * @param {string} URL - git repo url which has WHEEL project
 * @returns {object} - project name, export date, exporter
 */
async function gitCloneAndReadArchiveMetadata(URL) {
  const { dir } = await _internal.createTempd(null, "importProject");
  const workDir = await _internal.fs.mkdtemp(`${dir}/`);
  await _internal.gitClone(workDir, 1, URL);
  const projectJson = await _internal.readJsonGreedy(_internal.path.join(workDir, _internal.projectJsonFilename));
  return { name: projectJson.name, dir: workDir };
}

/**
 * read project and component metadata under dir and report readonly or status is not "not-started"
 * @param {string} dir - search root path
 * @returns {object[]} - array of metadata paths and reasons
 */
async function checkProjectAndComponentStatus(dir) {
  const result = [];
  const { readOnly, state } = await _internal.readJsonGreedy(_internal.path.resolve(dir, _internal.projectJsonFilename));
  if (readOnly) {
    result.push({ path: "project", state: "read only", ID: "projectRO" });
  }
  if (state !== "not-started") {
    result.push({ path: "project", state, ID: "projectState" });
  }
  const componentJsonFiles = await _internal.promisify(_internal.glob)(_internal.path.join(dir, "**", _internal.componentJsonFilename));
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
}

async function ensureProjectRootDir(projectRootDir) {
  if (await _internal.fs.pathExists(projectRootDir)) {
    const stats = await _internal.fs.stat(projectRootDir);
    if (!stats.isDirectory() || !await isEmptyDir(projectRootDir)) {
      const err = new Error(`specified path is in use: ${projectRootDir}`);
      err.projectRootDir = projectRootDir;
      err.reason = "PathExists";
      throw err;
    }
  } else {
    await _internal.fs.ensureDir(projectRootDir);
  }
}

async function checkAndFixProject(src, clientID) {
  //throw execption if user cancel importiong
  const toBeFixed = await checkProjectAndComponentStatus(src);

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
}

/**
 * import project archive file
 * @param {string} clientID - socket's ID
 * @param {string} archiveFile - path to archive file
 * @param {string} parentDir - path to be extracted archive file
 * @returns {Promise} - resolved when project archive is imported
 */
async function importProject(clientID, archiveFile, parentDir) {
  const { name: projectName, dir: src } = await extractAndReadArchiveMetadata(archiveFile);
  const projectRootDir = _internal.path.resolve(parentDir, projectName + _internal.suffix);
  try {
    await ensureProjectRootDir(projectRootDir);
    await checkAndFixProject(src, clientID);
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

/**
 * import project from git repository
 * @param {string} clientID - socket's ID
 * @param {string} URL - repository's URL
 * @param {string} parentDir - path to be extracted archive file
 * @returns {Promise} - resolved when project archive is imported
 */
async function importProjectFromGitRepository(clientID, URL, parentDir) {
  const { name: projectName, dir: src } = await gitCloneAndReadArchiveMetadata(URL);
  const projectRootDir = _internal.path.resolve(parentDir, projectName + _internal.suffix);
  try {
    await ensureProjectRootDir(projectRootDir);
    await checkAndFixProject(src, clientID);
    await _internal.gitClone(projectRootDir, 1, src);
    _internal.projectList.unshift({ path: projectRootDir });
  } finally {
    await _internal.fs.remove(src);
  }
  return projectRootDir;
}

_internal.isEmptyDir = isEmptyDir;
_internal.extractAndReadArchiveMetadata = extractAndReadArchiveMetadata;
_internal.importProject = importProject;

module.exports = {
  importProject,
  importProjectFromGitRepository
};

if (process.env.NODE_ENV === "test") {
  module.exports._internal = _internal;
}