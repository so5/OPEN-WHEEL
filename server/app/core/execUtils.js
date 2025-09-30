/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const path = require("path");
const fs = require("fs-extra");
const { statusFilename } = require("../db/db");
const { replacePathsep } = require("./pathUtils");
const { isSameRemoteHost } = require("./projectFilesOperator.js");
const { writeComponentJson } = require("./componentJsonIO.js");
const { getLogger } = require("../logSettings");
const { eventEmitters } = require("./global.js");

const _internal = {
  path,
  fs,
  statusFilename,
  replacePathsep,
  isSameRemoteHost,
  writeComponentJson,
  getLogger,
  eventEmitters
};

/**
 * set task component's status and notice it's changed
 * @param {object} task - task component
 * @param {string} state - component's state string
 */
async function setTaskState(task, state) {
  task.state = state;
  _internal.getLogger(task.projectRootDir).trace(`TaskStateList: ${task.ID}'s state is changed to ${state}`);
  await _internal.writeComponentJson(task.projectRootDir, task.workingDir, task, true);
  const ee = _internal.eventEmitters.get(task.projectRootDir);
  ee.emit("taskStateChanged", task);
  ee.emit("componentStateChanged", task);
}

/**
 * determine if specified outputFile is needed to download
 * @param {string} projectRootDir - project's root path
 * @param {string} componentID - component's ID string
 * @param {object} outputFile - outputfile object to be checked
 * @returns {boolean} -
 */
async function needDownload(projectRootDir, componentID, outputFile) {
  const rt = await Promise.all(outputFile.dst.map(({ dstNode })=>{
    return _internal.isSameRemoteHost(projectRootDir, componentID, dstNode);
  }));
  return rt.some((isSame)=>{
    return !isSame;
  });
}

/**
 * format filepath on remotehost
 * @param {string} remoteWorkingDir - working directory path on remotehost
 * @param {string} filename - user specified filename
 * @returns {string} - single filepath or glob ended with '/*'
 */
function formatSrcFilename(remoteWorkingDir, filename) {
  if (filename.endsWith("/") || filename.endsWith("\\")) {
    const dirname = _internal.replacePathsep(filename);
    return _internal.path.posix.join(remoteWorkingDir, `${dirname}/*`);
  }
  return _internal.path.posix.join(remoteWorkingDir, filename);
}

/**
 * make download file recipe
 * @param {string} projectRootDir - project's root path
 * @param {string} filename - desired download file
 * @param {string} remoteWorkingDir - working directory path on remotehost
 * @param {string} workingDir - working directory path on localhost
 * @returns {object} - download recipe object which must have src and dst path
 */
function makeDownloadRecipe(projectRootDir, filename, remoteWorkingDir, workingDir) {
  const reRemoteWorkingDir = new RegExp(remoteWorkingDir);
  const src = formatSrcFilename(remoteWorkingDir, filename);
  if (filename.slice(0, -1).includes("/")) {
    const dst = src.replace(reRemoteWorkingDir, workingDir);
    _internal.getLogger(projectRootDir).trace(`${filename} will be downloaded to ${dst}`);
    return { src, dst };
  }
  _internal.getLogger(projectRootDir).trace(`${filename} will be downloaded to component root directory`);
  return { src, dst: workingDir };
}

/**
 * create task result file it may contains, status string, return value, and job status code
 * @param {object} task - task component
 */
async function createStatusFile(task) {
  const filename = _internal.path.resolve(task.workingDir, _internal.statusFilename);
  const statusFile = `${task.state}\n${task.rt}\n${task.jobStatus}`;
  return _internal.fs.writeFile(filename, statusFile);
}

/**
 * create builk job result file it may contains, status string, return value, and job status code
 * @param {object} task - task component
 * @param {string[]} rtList - array of return values from bulk job
 * @param {string[]} jobStatusList - array of job status codes from bulk job
 */
async function createBulkStatusFile(task, rtList, jobStatusList) {
  const filename = _internal.path.resolve(task.workingDir, `subjob_${_internal.statusFilename}`);
  let statusFile = "";
  for (let bulkNum = task.startBulkNumber; bulkNum <= task.endBulkNumber; bulkNum++) {
    statusFile += `RT_${bulkNum}=${rtList[bulkNum]}\nJOBSTATUS_${bulkNum}=${jobStatusList[bulkNum]}\n`;
  }
  return _internal.fs.writeFile(filename, statusFile);
}

module.exports = {
  setTaskState,
  needDownload,
  makeDownloadRecipe,
  createStatusFile,
  createBulkStatusFile,
  formatSrcFilename
};

if (process.env.NODE_ENV === "test") {
  module.exports._internal = _internal;
}