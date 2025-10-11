/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const { readFile } = require("node:fs/promises");
const { getLogger } = require("../logSettings");
const { escapeRegExp } = require("../lib/utility");
const promiseRetry = require("promise-retry");

const _internal = {
  spawn,
  path,
  fs,
  readFile,
  getLogger,
  escapeRegExp,
  promiseRetry
};

_internal.promisifiedGit = async function (cwd, args, rootDir) {
  return new Promise((resolve, reject)=>{
    const cp = _internal.spawn("git", args, { cwd: _internal.path.resolve(cwd), env: process.env, shell: true });
    _internal.getLogger(rootDir).trace(`git ${args.join(" ")} called at ${cwd}`);
    let output = "";
    cp.stdout.on("data", (data)=>{
      _internal.getLogger(rootDir).trace(data.toString());
      output += data.toString();
    });
    cp.stderr.on("data", (data)=>{
      _internal.getLogger(rootDir).trace(data.toString());
      output += data.toString();
    });
    cp.on("error", (e)=>{
      const err = typeof e === "string" ? new Error(e) : e;
      err.output = output;
      err.cwd = cwd;
      err.abs_cwd = _internal.path.resolve(cwd);
      err.args = args;
      _internal.getLogger(rootDir).trace("git command failed", err);
      reject(err);
    });
    cp.on("exit", (rt)=>{
      if (rt !== 0) {
        const err = new Error(output);
        err.rt = rt;
        err.cwd = cwd;
        err.abs_cwd = _internal.path.resolve(cwd);
        err.args = args;
        reject(err);
      }
      resolve(output);
    });
  });
};

/**
 * asynchronous git call with retry
 * @param {string} cwd - working directory
 * @param {string[]} args - argument list including git's sub command eg. add,commit,init... etc.
 * @param {string} rootDir - repo's root dir
 */
_internal.gitPromise = async function (cwd, args, rootDir) {
  return _internal.promiseRetry(async (retry)=>{
    return _internal.promisifiedGit(cwd, args, rootDir).catch((err)=>{
      _internal.getLogger(rootDir).trace(`RETRYING git ${args.join(" ")} at cwd`);
      if (!/fatal: Unable to create '.*index.lock': File exists/.test(err.message)
        && !/error: could not lock .*: File exists/.test(err.message)) {
        throw err;
      }
      return retry(err);
    });
  }, {
    retries: 5,
    minTimeout: 300,
    maxTimeout: 2000,
    randomize: true,
    factor: 1.2
  });
};

/**
 * check and setup wheel specific git repo setting
 * @param {string} rootDir - repo's root dir
 * @param {string} user - committer's user name only for the project
 * @param {string} mail - committer's user email address only for the project
 */
_internal.gitSetup = async function (rootDir, user, mail) {
  let needCommit = false;

  try {
    await _internal.gitPromise(rootDir, ["config", "--get", "user.name"], rootDir);
  } catch (err) {
    if (typeof err.rt === "undefined") {
      throw err;
    }
    await _internal.gitPromise(rootDir, ["config", "user.name", user], rootDir);
    needCommit = true;
  }

  try {
    await _internal.gitPromise(rootDir, ["config", "--get", "user.email"], rootDir);
  } catch (err) {
    if (typeof err.rt === "undefined") {
      throw err;
    }
    await _internal.gitPromise(rootDir, ["config", "user.email", mail], rootDir);
    needCommit = true;
  }

  //git lfs install does not affect if already installed
  await _internal.gitPromise(rootDir, ["lfs", "install"], rootDir);

  const ignoreFile = _internal.path.join(rootDir, ".gitignore");

  try {
    const ignore = await _internal.readFile(ignoreFile, { encoding: "utf8" });
    if (!ignore.includes("wheel.log")) {
      await _internal.fs.appendFile(_internal.path.join(rootDir, ".gitignore"), "\nwheel.log\n");
      await _internal.gitAdd(rootDir, ".gitignore");
      needCommit = true;
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
    await _internal.fs.outputFile(_internal.path.join(rootDir, ".gitignore"), "\nwheel.log\n");
    await _internal.gitAdd(rootDir, ".gitignore");
    needCommit = true;
  }

  return needCommit ? _internal.gitCommit(rootDir, "initial commit") : false;
};

/**
 * initialize repository with git-lfs support
 * @param {string} rootDir - repo's root dir
 * @param {string} user - committer's user name only for the project
 * @param {string} mail - committer's user email address only for the project
 * @returns {Promise} - settled when git commit command issued
 */
async function gitInit(rootDir, user, mail) {
  if (typeof user !== "string") {
    const err = new Error("user must be a string");
    err.user = user;
    err.type = typeof user;
    return err;
  }
  if (typeof mail !== "string") {
    const err = new Error("mail must be a string");
    err.mail = mail;
    err.type = typeof mail;
    return err;
  }
  const { dir, base } = _internal.path.parse(_internal.path.resolve(rootDir));
  await _internal.fs.ensureDir(dir);
  await _internal.gitPromise(dir, ["init", "--", base], rootDir);
  return _internal.gitSetup(rootDir, user, mail);
}

/**
 * commit already staged(indexed) files
 * @param {string} rootDir - repo's root dir
 * @param {string} message - commmit message
 * @param {string[]} additionalOption - additional option for git commit
 */
_internal.gitCommit = async function (rootDir, message = "save project", additionalOption = []) {
  return _internal.gitPromise(rootDir, ["commit", "-m", `"${message}"`, ...additionalOption], rootDir)
    .catch((err)=>{
      if (!/(no changes|nothing)( added | )to commit/m.test(err.message)) {
        throw err;
      }
    });
};

/**
 * performe git add
 * @param {string} rootDir - repo's root dir
 * @param {string} filename - filename which should be add to repo.
 * @param {boolean} updateOnly - add -u option to git add
 * filename should be absolute path or relative path from rootDir.
 */
_internal.gitAdd = async function (rootDir, filename, updateOnly) {
  const args = ["add"];
  if (updateOnly) {
    args.push("-u");
  }
  args.push("--");
  args.push(filename);
  return _internal.gitPromise(rootDir, args, rootDir);
};

/**
 * performe git rm recursively
 * @param {string} rootDir - repo's root dir
 * @param {string} filename - filename which should be add to repo.
 * filename should be absolute path or relative path from rootDir.
 */
async function gitRm(rootDir, filename) {
  return _internal.gitPromise(rootDir, ["rm", "-r", "--cached", "--", filename], rootDir)
    .catch((err)=>{
      if (!/fatal: pathspec '.*' did not match any files/.test(err.message)) {
        throw err;
      }
    });
}

/**
 * performe git reset HEAD
 * @param {string} rootDir - repo's root dir
 * @param {string} pathspec - files to be reset
 */
async function gitResetHEAD(rootDir, pathspec) {
  if (!pathspec || typeof pathspec !== "string") {
    return _internal.gitPromise(rootDir, ["reset", "HEAD", "--hard"], rootDir);
  }
  await _internal.gitPromise(rootDir, ["reset", "HEAD", "--", pathspec], rootDir);
  return _internal.gitPromise(rootDir, ["checkout", "HEAD", "--", pathspec], rootDir);
}

/**
 * get repo's status
 * @param {string} rootDir - repo's root dir
 * @param {string} pathspec - file pattern to limit status command
 */
_internal.gitStatus = async function (rootDir, pathspec) {
  const opt = ["status", "--short"];
  if (typeof pathspec === "string") {
    opt.push(pathspec);
  }
  const output = await _internal.gitPromise(rootDir, opt, rootDir);
  const rt = { added: [], modified: [], deleted: [], renamed: [], untracked: [] };
  //parse output from git
  for (const token of output.split(/\n/)) {
    const splitedToken = token.split(" ");
    const filename = splitedToken[splitedToken.length - 1];
    if (typeof splitedToken[0][0] === "undefined") {
      continue;
    }
    switch (splitedToken[0][0]) {
      case "A":
        rt.added.push(filename);
        break;
      case "M":
        rt.modified.push(filename);
        break;
      case "D":
        rt.deleted.push(filename);
        break;
      case "R":
        rt.renamed.push(filename);
        break;
      case "?":
        rt.untracked.push(filename);
        break;
      default:
        throw new Error("unkonw output from git status --short");
    }
  }
  return rt;
};

/**
 * performe git clean -df
 * @param {string} rootDir - repo's root dir
 * @param {string} pathspec - files to be reset
 * @returns {Promise} - resolved when git clean done
 */
async function gitClean(rootDir, pathspec) {
  const opt = ["clean", "-df", "-e wheel.log"];
  if (typeof pathspec === "string") {
    opt.push("--");
    opt.push(pathspec);
  }
  return _internal.gitPromise(rootDir, opt, rootDir);
}

/**
/**
 * remove origin url
 * @param {string} rootDir - repo's root dir
 * @param {string} name - remote name
 * @returns {Promise} - resolved when git clone done
 */
async function gitRemoveOrigin(rootDir, name = "origin") {
  const opt = ["remote", "remove", name];
  return _internal.gitPromise(rootDir, opt, rootDir);
}

/**
 * clone rootDir to cwd
 * @param {string} cwd - working directory
 * @param {number} depth - clone depth for shallow clone
 * @param {string} rootDir - repo's root dir
 * @returns {Promise} - resolved when git clone done
 */
async function gitClone(cwd, depth, rootDir) {
  const opt = ["clone"];
  if (Number.isInteger(depth)) {
    opt.push(`--depth=${depth}`);
  }
  opt.push("--single-branch");
  opt.push(rootDir);
  opt.push(".");
  return _internal.gitPromise(cwd, opt, rootDir);
}

/**
 * make archive from git repo
 * @param {string} rootDir - repo's root dir
 * @param {string} filename - arcchive filename
 * @returns {Promise} - resolved when git archive done
 */
async function gitArchive(rootDir, filename) {
  const opt = ["archive", "-o", filename, "HEAD"];
  return _internal.gitPromise(rootDir, opt, rootDir);
}

/**
 * add local config
 * @param {string} rootDir - repo's root dir
 * @param {string} key - config key name
 * @param {string} value - config value
 * @param {boolean} keep - keep value if already set
 * @returns {Promise} - resolved when git archive done
 */
async function gitConfig(rootDir, key, value, keep = false) {
  const opt = ["config", "--local", key, value];
  if (keep) {
    try {
      await _internal.gitPromise(rootDir, ["config", "--get", key], rootDir);
      return;
    } catch (e) {
      //do nothing
    }
  }
  return _internal.gitPromise(rootDir, opt, rootDir);
}

/**
 * return relative filename from repository's root directry
 * @param {string} rootDir - repo's root dir
 * @param {string} filename - filename
 * @returns {string} - relative path of file from repo's root directory
 */
_internal.getRelativeFilename = function (rootDir, filename) {
  const absFilename = _internal.path.isAbsolute(filename) ? filename : _internal.path.resolve(rootDir, filename);
  return _internal.path.relative(rootDir, absFilename);
};

/**
 * make file pattern string for lfs track/untrack command
 * @param {string} rootDir - repo's root dir
 * @param {string} filename - filename
 * @returns {string} -
 */
_internal.makeLFSPattern = function (rootDir, filename) {
  return `/${_internal.getRelativeFilename(rootDir, filename)}`;
};

/**
 * determine if specified filename is LFS target
 * @param {string} rootDir - repo's root dir
 * @param {string} filename - filename
 * @returns {boolean} -
 */
async function isLFS(rootDir, filename) {
  const lfsPattern = _internal.getRelativeFilename(rootDir, filename);
  const lfsTrackResult = await _internal.gitPromise(rootDir, ["lfs", "track"], rootDir);
  const re = new RegExp(_internal.escapeRegExp(lfsPattern), "m");
  return re.test(lfsTrackResult);
}

/**
 * performe git lfs track
 * @param {string} rootDir - repo's root dir
 * @param {string} filename - files to be track
 * @returns {Promise} - resolved when LFS track setting is done
 */
async function gitLFSTrack(rootDir, filename) {
  await _internal.gitPromise(rootDir, ["lfs", "track", "--", _internal.makeLFSPattern(rootDir, filename)], rootDir);
  _internal.getLogger(rootDir).trace(`${filename} is treated as large file`);
  return _internal.gitAdd(rootDir, ".gitattributes");
}

/**
 * performe git lfs untrack
 * @param {string} rootDir - repo's root dir
 * @param {string} filename - files to be untracked
 */
async function gitLFSUntrack(rootDir, filename) {
  await _internal.gitPromise(rootDir, ["lfs", "untrack", "--", _internal.makeLFSPattern(rootDir, filename)], rootDir);
  _internal.getLogger(rootDir).trace(`${filename} never treated as large file`);
  if (await _internal.fs.pathExists(_internal.path.resolve(rootDir, ".gitattributes"))) {
    await _internal.gitAdd(rootDir, ".gitattributes");
  }
}

/**
 * @typedef {object} unsavedFile
 * @property {string} status - unsaved file's status which is one of ["new", "modified", "deleted',"renamed"]
 * @property {string} name - unsaved file's name
 */
/**
 * get unsavedFiles
 * @param {string} rootDir - repo's root dir
 * @returns {unsavedFile[]} - unsaved files
 */
async function getUnsavedFiles(rootDir, pathspec) {
  const { added, modified, deleted, renamed } = await _internal.gitStatus(rootDir, pathspec);
  const unsavedFiles = [];
  for (const e of added) {
    unsavedFiles.push({ status: "new", name: e });
  }
  for (const e of modified) {
    unsavedFiles.push({ status: "modified", name: e });
  }
  for (const e of deleted) {
    unsavedFiles.push({ status: "deleted", name: e });
  }
  for (const e of renamed) {
    unsavedFiles.push({ status: "renamed", name: e });
  }
  return unsavedFiles;
}

module.exports = {
  gitSetup: _internal.gitSetup,
  gitInit,
  gitCommit: _internal.gitCommit,
  gitAdd: _internal.gitAdd,
  gitRm,
  gitResetHEAD,
  gitStatus: _internal.gitStatus,
  gitClean,
  gitRemoveOrigin,
  gitClone,
  gitArchive,
  gitConfig,
  gitLFSTrack,
  gitLFSUntrack,
  isLFS,
  getUnsavedFiles,
  promisifiedGit: _internal.promisifiedGit,
  gitPromise: _internal.gitPromise,
  getRelativeFilename: _internal.getRelativeFilename,
  makeLFSPattern: _internal.makeLFSPattern
};

if (process.env.NODE_ENV === "test") {
  module.exports._internal = _internal;
}
