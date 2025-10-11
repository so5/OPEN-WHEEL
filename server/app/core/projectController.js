/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import path from "path";
import { EventEmitter } from "events";
import { readJsonGreedy } from "../core/fileUtils.js";
import { gitResetHEAD, gitClean } from "../core/gitOperator2.js";
import { removeSsh } from "./sshManager.js";
import { removeExecuters } from "./executerManager.js";
import { removeTransferrers } from "./transferManager.js";
import { defaultCleanupRemoteRoot, projectJsonFilename, componentJsonFilename } from "../db/db.js";
import { setProjectState } from "../core/projectFilesOperator.js";
import { writeComponentJson } from "./componentJsonIO.js";
import Dispatcher from "./dispatcher.js";
import { getDateString } from "../lib/utility.js";
import { getLogger } from "../logSettings.js";
import { eventEmitters } from "./global.js";

const rootDispatchers = new Map();

/**
 * @event projectStateChanged
 * @type {object} - updated projectJson
 * @event taskStateChanged
 * @type {object} - updated task object
 * @event componentStateChanged
 * @type {object} - updated component Json
 * @event resultFilesReady
 * @type {object[]} - array of result file's url
 * @property {string} componentID - component.ID
 * @property {string} filename    - relative path from projectRoot
 * @property {string} url         - URL to view result file
 */

/**
 * update project status
 * @param {string} projectRootDir - project's root path
 * @param {string} state - status
 */
export async function updateProjectState(projectRootDir, state, projectJson) {
  const updatedProjectJson = await setProjectState(projectRootDir, state, false, projectJson);
  if (updatedProjectJson) {
    const ee = eventEmitters.get(projectRootDir);
    if (ee) {
      ee.emit("projectStateChanged", updatedProjectJson);
    }
    return updatedProjectJson;
  }
  return projectJson;
}

/**
 * clean up project
 * @param {string} projectRootDir - project's root path
 * @param {string} targetDir - If this argument is specified, limit git clean operations to under this directory
 */
export async function cleanProject(projectRootDir, targetDir) {
  await gitResetHEAD(projectRootDir, targetDir);
  await gitClean(projectRootDir, targetDir);
  //project state must be updated by onCleanProject()
  //temp dirs also removed by onCleanProject()
}

/**
 * stop project run
 * @param {string} projectRootDir - project's root path
 */
export async function stopProject(projectRootDir) {
  const rootDispatcher = rootDispatchers.get(projectRootDir);
  if (rootDispatcher) {
    await rootDispatcher.remove();
    rootDispatchers.delete(projectRootDir);
  }
  removeExecuters(projectRootDir);
  removeTransferrers(projectRootDir);
  removeSsh(projectRootDir);
  //project state must be updated by onStopProject()
}

/**
 * run project
 * @param {string} projectRootDir - project's root path
 * @returns {string} - project status after run
 */
export async function runProject(projectRootDir) {
  if (!eventEmitters.has(projectRootDir)) {
    eventEmitters.set(projectRootDir, new EventEmitter());
  }
  if (rootDispatchers.has(projectRootDir)) {
    return new Error(`project is already running ${projectRootDir}`);
  }

  const projectJson = await readJsonGreedy(path.resolve(projectRootDir, projectJsonFilename));
  const rootWF = await readJsonGreedy(path.resolve(projectRootDir, componentJsonFilename));

  const rootDispatcher = new Dispatcher(projectRootDir,
    rootWF.ID,
    projectRootDir,
    getDateString(),
    projectJson.componentPath,
    rootWF.env);
  if (rootWF.cleanupFlag === "2") {
    rootDispatcher.doCleanup = defaultCleanupRemoteRoot;
  }
  rootDispatchers.set(projectRootDir, rootDispatcher);

  const projectJsonRunning = await updateProjectState(projectRootDir, "running", projectJson);
  getLogger(projectRootDir).info("project start");
  rootWF.state = await rootDispatcher.start();
  getLogger(projectRootDir).info(`project ${rootWF.state}`);
  await updateProjectState(projectRootDir, rootWF.state, projectJsonRunning);
  await writeComponentJson(projectRootDir, projectRootDir, rootWF, true);
  rootDispatchers.delete(projectRootDir);
  removeExecuters(projectRootDir);
  removeTransferrers(projectRootDir);
  removeSsh(projectRootDir);
  return rootWF.state;
}

const _internal = {
  path,
  EventEmitter,
  readJsonGreedy,
  gitResetHEAD,
  gitClean,
  removeSsh,
  removeExecuters,
  removeTransferrers,
  defaultCleanupRemoteRoot,
  projectJsonFilename,
  componentJsonFilename,
  setProjectState,
  writeComponentJson,
  Dispatcher,
  getDateString,
  getLogger,
  eventEmitters,
  rootDispatchers,
  updateProjectState,
  cleanProject,
  stopProject,
  runProject
};

let internal;
if (process.env.NODE_ENV === "test") {
  internal = _internal;
}
export { internal as _internal };
