/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import fs from "fs-extra";
import path from "path";
import { getLogger } from "../logSettings.js";
import { rsyncExcludeOptionOfWheelSystemFiles } from "../db/db.js";
import { getSsh, getSshHostinfo } from "./sshManager.js";
import { gfpcopy, gfptarExtract } from "./gfarmOperator.js";

const _internal = {
  fs,
  path,
  getLogger,
  rsyncExcludeOptionOfWheelSystemFiles,
  getSsh,
  getSshHostinfo,
  gfpcopy,
  gfptarExtract
};

/**
 * deliver src to dst
 * @param {string} src - absolute path of src path
 * @param {string} dst - absolute path of dst path
 * @param {boolean} forceCopy - use copy instead of symlink
 */
export async function deliverFile(src, dst, forceCopy = false) {
  const stats = await _internal.fs.lstat(src);
  const type = stats.isDirectory() ? "dir" : "file";
  try {
    if (forceCopy) {
      await _internal.fs.copy(src, dst, { overwrite: true });
      return { type: "copy", src, dst };
    }
    await _internal.fs.remove(dst);
    await _internal.fs.ensureSymlink(src, dst, type);

    return { type: `link-${type}`, src, dst };
  } catch (e) {
    if (e.code === "EPERM") {
      await _internal.fs.copy(src, dst, { overwrite: false });
      return { type: "copy", src, dst };
    }
    return Promise.reject(e);
  }
}

/**
 * execut ln -s or cp -r command on remotehost to make shallow symlink
 * @param {object} recipe - deliver recipe which has src, dstination and more information
 * @returns {object} - result object
 */
export async function deliverFilesOnRemote(recipe) {
  const logger = _internal.getLogger(recipe.projectRootDir);
  if (!recipe.onSameRemote) {
    logger.warn("deliverFilesOnRemote must be called with onSameRemote flag");
    return null;
  }
  if (recipe.dstName.endsWith("/")) {
    recipe.dstRoot = _internal.path.join(recipe.dstRoot, recipe.dstName);
    recipe.dstName = "./";
  }
  const ssh = _internal.getSsh(recipe.projectRootDir, recipe.srcRemotehostID);
  const cmd = recipe.forceCopy ? "cp -r " : "ln -sf";
  const sshCmd = `bash -O failglob -c 'mkdir -p ${recipe.dstRoot} 2>/dev/null; (cd ${recipe.dstRoot} && for i in ${_internal.path.join(recipe.srcRoot, recipe.srcName)}; do ${cmd} \${i} ${recipe.dstName} ;done)'`;
  logger.debug("execute on remote", sshCmd);
  const rt = await ssh.exec(sshCmd, 0, logger.debug.bind(logger));
  if (rt !== 0) {
    logger.warn("deliver file on remote failed", rt);
    const err = new Error("deliver file on remote failed");
    err.rt = rt;
    return Promise.reject(err);
  }
  return { type: "copy", src: _internal.path.join(recipe.srcRoot, recipe.srcName), dst: _internal.path.join(recipe.dstRoot, recipe.dstName) };
}

/**
 * deliver file from remotehost to localhost
 * @param {object} recipe - deliver recipe which has src, dstination and more information
 * @returns {object} - result object
 */
export async function deliverFilesFromRemote(recipe) {
  const logger = _internal.getLogger(recipe.projectRootDir);
  if (!recipe.remoteToLocal) {
    logger.warn("deliverFilesFromRemote must be called with remoteToLocal flag");
    return null;
  }
  const ssh = _internal.getSsh(recipe.projectRootDir, recipe.srcRemotehostID);

  await ssh.recv([`${recipe.srcRoot}/${recipe.srcName}`], `${recipe.dstRoot}/${recipe.dstName}`, ["-vv", ..._internal.rsyncExcludeOptionOfWheelSystemFiles]);
  return { type: "copy", src: `${recipe.srcRoot}/${recipe.srcName}`, dst: `${recipe.dstRoot}/${recipe.dstName}` };
}

/**
 * deliver file from gfarm to the other component's dir
 * @param {object} recipe - deliver recipe which has src, dstination and more information
 * @returns {object} - result object
 */
export async function deliverFilesFromHPCISS(recipe) {
  const withTar = recipe.fromHPCISStar;
  const ssh = _internal.getSsh(recipe.projectRootDir, recipe.srcRemotehostID);
  const hostinfo = _internal.getSshHostinfo(recipe.projectRootDir, recipe.srcRemotehostID);

  const prefix = hostinfo.path ? `-p ${hostinfo.path}` : "";
  const { output, rt } = await ssh.execAndGetOutput(`mktemp -d ${prefix} WHEEL_TMP_XXXXXXXX`);
  if (rt !== 0) {
    throw new Error("create temporary directory on CSGW failed");
  }
  const remoteTempDir = output[0];

  const orgSrcRoot = recipe.srcRoot;
  if (withTar) {
    const extractTargetName = _internal.path.join(remoteTempDir, "WHEEL_EXTRACT_DIR");
    const target = recipe.srcRoot;
    await _internal.gfptarExtract(recipe.projectRootDir, recipe.srcRemotehostID, target, extractTargetName);
    recipe.srcRoot = extractTargetName;
  } else {
    await _internal.gfpcopy(recipe.projectRootDir, recipe.srcRemotehostID, recipe.srcRoot, remoteTempDir);
    recipe.srcRoot = _internal.path.join(remoteTempDir, _internal.path.basename(orgSrcRoot));
  }
  recipe.remoteToLocal = !recipe.onSameRemote;

  const result = recipe.onSameRemote ? await deliverFilesOnRemote(recipe) : await deliverFilesFromRemote(recipe);
  result.src = `${orgSrcRoot}/${recipe.srcName}`;
  _internal.getLogger(recipe.projectRootDir).debug(`remove remote temp dir ${remoteTempDir}`);
  await ssh.exec(`rm -fr ${remoteTempDir}`);
  return result;
}

let internal;
if (process.env.NODE_ENV === "test") {
  _internal.deliverFilesOnRemote = deliverFilesOnRemote;
  _internal.deliverFilesFromRemote = deliverFilesFromRemote;
  internal = _internal;
}
export { internal as _internal };
