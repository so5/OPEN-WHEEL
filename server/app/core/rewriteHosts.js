/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import path from "path";
import { glob } from "glob";
import { readJsonGreedy } from "./fileUtils.js";
import { componentJsonFilename } from "../db/db.js";
import { writeComponentJson } from "./componentJsonIO.js";

/**
 * rewrite all component's host property
 * @param {string} projectRootDir - project's root path
 * @param {object} hostMap - old and new remotehost label map
 * @returns {Promise} - resolved when all component metat data is rewritten
 */
async function rewriteHosts(projectRootDir, hostMap) {
  const componentJsonFiles = await glob(`**/${componentJsonFilename}`, { cwd: projectRootDir });
  const oldRemotehostLabels = Object.keys(hostMap);

  return Promise.all(componentJsonFiles.map(async (filename)=>{
    const targetName = path.resolve(projectRootDir, filename);
    const componentJson = await readJsonGreedy(targetName);
    if (typeof componentJson.host !== "string") {
      return;
    }
    if (componentJson.host === hostMap[componentJson.host]) {
      return;
    }
    if (oldRemotehostLabels.includes(componentJson.host)) {
      componentJson.host = hostMap[componentJson.host];
      return writeComponentJson(projectRootDir, path.dirname(targetName), componentJson);
    }
  }));
}

export {
  rewriteHosts
};
