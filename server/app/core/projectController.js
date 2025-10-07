/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const path = require("path");
const { readJsonGreedy } = require("../core/fileUtils");
const { gitResetHEAD, gitClean } = require("../core/gitOperator2");
const { removeSsh } = require("./sshManager");
const { removeExecuters } = require("./executerManager.js");
const { removeTransferrers } = require("./transferManager.js");
const { defaultCleanupRemoteRoot, projectJsonFilename, componentJsonFilename } = require("../db/db");
const { setProjectState } = require("../core/projectFilesOperator");
const { writeComponentJson } = require("./componentJsonIO.js");
const Dispatcher = require("./dispatcher");
const { getDateString } = require("../lib/utility");
const { getLogger } = require("../logSettings.js");
const { eventEmitters } = require("./global.js");
const { EventEmitter } = require("events");

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
  rootDispatchers: new Map()
};


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
_internal.updateProjectState = async(projectRootDir, state, projectJson)=>{
  const updatedProjectJson = await _internal.setProjectState(projectRootDir, state, false, projectJson);
  if (updatedProjectJson) {
    const ee = _internal.eventEmitters.get(projectRootDir);
    if (ee) {
      ee.emit("projectStateChanged", updatedProjectJson);
    }
    return updatedProjectJson;
  }
  return projectJson;
};

/**
 * clean up project
 * @param {string} projectRootDir - project's root path
 * @param {string} targetDir - If this argument is specified, limit git clean operations to under this directory
 */
_internal.cleanProject = async(projectRootDir, targetDir)=>{
  await _internal.gitResetHEAD(projectRootDir, targetDir);
  await _internal.gitClean(projectRootDir, targetDir);
  //project state must be updated by onCleanProject()
  //temp dirs also removed by onCleanProject()
};

/**
 * stop project run
 * @param {string} projectRootDir - project's root path
 */
_internal.stopProject = async(projectRootDir)=>{
  const rootDispatcher = _internal.rootDispatchers.get(projectRootDir);
  if (rootDispatcher) {
    await rootDispatcher.remove();
    _internal.rootDispatchers.delete(projectRootDir);
  }
  _internal.removeExecuters(projectRootDir);
  _internal.removeTransferrers(projectRootDir);
  _internal.removeSsh(projectRootDir);
  //project state must be updated by onStopProject()
};

/**
 * run project
 * @param {string} projectRootDir - project's root path
 * @returns {string} - project status after run
 */
_internal.runProject = async(projectRootDir)=>{
  if (!_internal.eventEmitters.has(projectRootDir)) {
    _internal.eventEmitters.set(projectRootDir, new _internal.EventEmitter());
  }
  if (_internal.rootDispatchers.has(projectRootDir)) {
    return new Error(`project is already running ${projectRootDir}`);
  }

  const projectJson = await _internal.readJsonGreedy(_internal.path.resolve(projectRootDir, _internal.projectJsonFilename));
  const rootWF = await _internal.readJsonGreedy(_internal.path.resolve(projectRootDir, _internal.componentJsonFilename));

  const rootDispatcher = new _internal.Dispatcher(projectRootDir,
    rootWF.ID,
    projectRootDir,
    _internal.getDateString(),
    projectJson.componentPath,
    rootWF.env);
  if (rootWF.cleanupFlag === "2") {
    rootDispatcher.doCleanup = _internal.defaultCleanupRemoteRoot;
  }
  _internal.rootDispatchers.set(projectRootDir, rootDispatcher);

  const projectJsonRunning = await _internal.updateProjectState(projectRootDir, "running", projectJson);
  _internal.getLogger(projectRootDir).info("project start");
  rootWF.state = await rootDispatcher.start();
  _internal.getLogger(projectRootDir).info(`project ${rootWF.state}`);
  await _internal.updateProjectState(projectRootDir, rootWF.state, projectJsonRunning);
  await _internal.writeComponentJson(projectRootDir, projectRootDir, rootWF, true);
  _internal.rootDispatchers.delete(projectRootDir);
  _internal.removeExecuters(projectRootDir);
  _internal.removeTransferrers(projectRootDir);
  _internal.removeSsh(projectRootDir);
  return rootWF.state;
};

module.exports = {
  cleanProject: _internal.cleanProject,
  runProject: _internal.runProject,
  stopProject: _internal.stopProject,
  updateProjectState: _internal.updateProjectState
};

if (process.env.NODE_ENV === "test") {
  module.exports._internal = _internal;
}