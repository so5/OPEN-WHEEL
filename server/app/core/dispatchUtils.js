/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import path from "path";
import childProcess from "child_process";
import fs from "fs-extra";
import { addX, readJsonGreedy } from "./fileUtils.js";
import { getLogger } from "../logSettings.js";
import { replacePathsep } from "./pathUtils.js";
import { remoteHost, componentJsonFilename } from "../db/db.js";
import { getSshHostinfo } from "./sshManager.js";

const _internal = {
  path,
  childProcess,
  fs,
  addX,
  readJsonGreedy,
  getLogger,
  replacePathsep,
  remoteHost,
  componentJsonFilename,
  getSshHostinfo,

  /**
   * run script with options via child_process.spawn
   * @param {string} projectRootDir - project's root path
   * @param {string} script - script file name
   * @param {object} options - option object for child_process.spawn
   * @returns {Promise} - resolved with return value of script if normaly finished. rejected if abnormal termination occurred
   */
  async pspawn(projectRootDir, script, options) {
    return new Promise((resolve, reject)=>{
      const cp = _internal.childProcess.spawn(script, options, (err)=>{
        if (err) {
          reject(err);
        }
      });
      cp.on("error", reject);
      cp.on("close", (code)=>{
        _internal.getLogger(projectRootDir).debug("return value of conditional expression = ", code);
        resolve(code === 0);
      });
      cp.stdout.on("data", (data)=>{
        _internal.getLogger(projectRootDir).trace(data.toString());
      });
      cp.stderr.on("data", (data)=>{
        _internal.getLogger(projectRootDir).trace(data.toString());
      });
    });
  }
};

/**
 * evalute condition by executing external command or evalute JS expression
 * @param {string} projectRootDir - project's root path
 * @param {string | boolean} condition - command name or javascript expression
 * @param {string} cwd - task component's directory
 * @param {object} env - environment variables
 * @returns {Promise | boolean} -
 */
export async function evalCondition(projectRootDir, condition, cwd, env) {
  //condition is always string for now. but keep following just in case
  if (typeof condition === "boolean") {
    return condition;
  }
  if (typeof condition !== "string") {
    _internal.getLogger(projectRootDir).warn("condition must be string or boolean");
    return new Error(`illegal condition specified ${typeof condition} \n${condition}`);
  }
  const script = _internal.path.resolve(cwd, condition);
  if (await _internal.fs.pathExists(script)) {
    _internal.getLogger(projectRootDir).debug("execute ", script);
    await _internal.addX(script);
    const dir = _internal.path.dirname(script);
    const options = {
      env: Object.assign({}, process.env, env),
      cwd: dir,
      shell: "bash"
    };

    return _internal.pspawn(projectRootDir, script, options);
  }
  _internal.getLogger(projectRootDir).debug("evalute ", condition);
  let conditionExpression = "";

  for (const [key, value] of Object.entries(env)) {
    conditionExpression += `let ${key}="${value}";\n`;
  }
  conditionExpression += condition;
  return eval?.(conditionExpression);
}

/**
 * return top working directory on remotehost
 * @param {string} projectRootDir - project's root path
 * @param {string} projectStartTime - YYYYMMDD-HHSS style string which is used as top directory name on remotehost
 * @param {object} component - component object
 * @param {boolean} isSharedHost - return as sharedHost path or ordinary remote path
 */
export function getRemoteRootWorkingDir(projectRootDir, projectStartTime, component, isSharedHost) {
  const remotehostID = _internal.remoteHost.getID("name", component.host);
  if (typeof remotehostID === "undefined") {
    return null;
  }
  const hostinfo = _internal.getSshHostinfo(projectRootDir, remotehostID);
  let remoteRoot = isSharedHost ? hostinfo.sharedPath : hostinfo.path;
  if (typeof remoteRoot !== "string") {
    remoteRoot = "";
  }
  return _internal.replacePathsep(_internal.path.posix.join(remoteRoot, projectStartTime));
}

/**
 * return comoponent's working directory on remoteshot
 * @param {string} projectRootDir - project's root path
 * @param {string} projectStartTime - YYYYMMDD-HHSS style string which is used as top directory name on remotehost
 * @param {string} workingDir - component's working directory on localhost
 * @param {object} component - component object
 * @param {boolean} isSharedHost - return as sharedHost path or ordinary remote path
 */
export function getRemoteWorkingDir(projectRootDir, projectStartTime, workingDir, component, isSharedHost) {
  const remoteRootWorkingDir = getRemoteRootWorkingDir(projectRootDir, projectStartTime, component, isSharedHost);
  if (remoteRootWorkingDir === null) {
    return null;
  }
  const localWorkingDir = _internal.replacePathsep(_internal.path.relative(projectRootDir, workingDir));
  return _internal.replacePathsep(_internal.path.posix.join(remoteRootWorkingDir, localWorkingDir));
}

/**
 * check state is finished or not
 * @param {string} state - state string
 * @returns {boolean} is finished or not?
 */
export function isFinishedState(state) {
  return state === "finished" || state === "failed" || state === "unknown";
}

/**
 * check if given path is wheel generated component of not
 * @param {string} target - path to be investigated
 * @returns {Promise} true if give path is subComponent dir
 */
export async function isSubComponent(target) {
  try {
    const stats = await _internal.fs.stat(target);
    if (!stats.isDirectory()) {
      return false;
    }
  } catch (err) {
    //just in case, for race condition of reading and removing
    if (err.code === "ENOENT") {
      return false;
    }
    throw err;
  }

  let rt = false;
  try {
    const componentJson = await _internal.readJsonGreedy(_internal.path.resolve(target, _internal.componentJsonFilename));
    rt = componentJson.subComponent === true;
  } catch (e) {
    if (e.code === "ENOENT") {
      return false;
    }
    throw e;
  }
  return rt;
}

let internal;
if (process.env.NODE_ENV === "test") {
  _internal.evalCondition = evalCondition;
  _internal.getRemoteWorkingDir = getRemoteWorkingDir;
  _internal.getRemoteRootWorkingDir = getRemoteRootWorkingDir;
  _internal.isFinishedState = isFinishedState;
  _internal.isSubComponent = isSubComponent;
  internal = _internal;
}
export { internal as _internal };