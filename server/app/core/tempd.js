/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const path = require("path");
const actualFs = require("fs-extra");
const { createHash: actualCreateHash } = require("crypto");
const { getLogger: actualGetLogger } = require("../logSettings.js");

const _internal = {
  fs: actualFs,
  createHash: actualCreateHash,
  getLogger: actualGetLogger,
  tempdRoot: null,

  /**
   * determine tmp directory root
   * @returns {string} - absolute path of tmp directory root
   */
  getTempdRoot() {
    const fallback = path.dirname(__dirname);
    const candidates = [];
    if (typeof process.env.WHEEL_TEMPD === "string") {
      candidates.push(path.resolve(process.env.WHEEL_TEMPD));
    }
    candidates.push("/tmp/wheel");

    for (const candidate of candidates) {
      try {
        const rt = _internal.fs.ensureDirSync(candidate);
        if (typeof rt === "undefined" || rt === candidate) {
          return candidate;
        }
      } catch (e) {
        if (e.code === "EEXIST") {
          return candidate;
        }
        _internal.getLogger().debug(`create ${candidate} failed due to ${e}`);
      }
    }
    return fallback;
  },

  /**
   * create temporary directory
   * @param {string | null} projectRootDir - project's root path or null for untied temporary directory
   * @param {string} prefix - purpose for the temp dir (ex. viewer, download)
   * @returns {object} - dir: absolute path of temp dir, root: parent dir path of temp dir
   */
  async createTempd(projectRootDir, prefix) {
    const root = path.resolve(_internal.tempdRoot, prefix);
    const hash = _internal.createHash("sha256");
    const ID = hash.update(projectRootDir || "wheel_tmp").digest("hex");
    const dir = path.join(root, ID);
    await _internal.fs.emptyDir(dir);
    _internal.getLogger(projectRootDir).debug(`create temporary directory ${dir}`);
    return { dir, root };
  },

  /**
   * remote temporary directory
   * @param {string | null} projectRootDir - project's root path or null for untied temporary directory
   * @param {string} prefix - purpose for the temp dir (ex. viewer, download)
   * @returns {Promise} - resolved after directory is removed
   */
  async removeTempd(projectRootDir, prefix) {
    const hash = _internal.createHash("sha256");
    const ID = hash.update(projectRootDir || "wheel_tmp").digest("hex");
    const dir = path.resolve(_internal.tempdRoot, prefix, ID);
    _internal.getLogger(projectRootDir).debug(`remove temporary directory ${dir}`);
    return _internal.fs.remove(dir);
  },

  /**
   * re-calcurate existing temporaly directory path
   * @param {string | null} projectRootDir - project's root path or null for untied temporary directory
   * @param {string} prefix - purpose for the temp dir (ex. viewer, download)
   * @returns {string} - absolute path of temporary directory
   */
  async getTempd(projectRootDir, prefix) {
    const hash = _internal.createHash("sha256");
    const ID = hash.update(projectRootDir || "wheel_tmp").digest("hex");
    return path.resolve(_internal.tempdRoot, prefix, ID);
  }
};

_internal.tempdRoot = _internal.getTempdRoot(); //must be executed only when this file requred first time

module.exports = {
  tempdRoot: _internal.tempdRoot,
  createTempd: _internal.createTempd,
  removeTempd: _internal.removeTempd,
  getTempd: _internal.getTempd,
  getTempdRoot: _internal.getTempdRoot
};

if (process.env.NODE_ENV === "test") {
  module.exports._internal = _internal;
}