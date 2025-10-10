/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import path from "path";
import { promisify } from "util";
import globCallback from "glob";
import { readJsonGreedy } from "./fileUtils.js";
import { componentJsonFilename } from "../db/db.js";
import { getComponentDir, readComponentJson } from "./componentJsonIO.js";
import { hasChild } from "./workflowComponent.js";

const glob = promisify(globCallback);

/**
 * get array of child components
 * @param {string} projectRootDir - project's root path
 * @param {string} parentID - parent component's ID
 * @param {boolean} isParentDir - treat parentID as parent component dir path
 * @returns {object[]} - array of components
 */
export async function getChildren(projectRootDir, parentID, isParentDir) {
  const dir = isParentDir ? parentID : parentID === null ? projectRootDir : await getComponentDir(projectRootDir, parentID, true);
  if (!dir) {
    return [];
  }

  const children = await glob(path.join(dir, "*", componentJsonFilename));
  if (children.length === 0) {
    return [];
  }

  const rt = await Promise.all(children.map((e)=>{
    return readJsonGreedy(e);
  }));

  return rt.filter((e)=>{
    return !e.subComponent;
  });
}


/**
 * return component,  its children, and grandsons
 * @param {string} projectRootDir - project's root path
 * @param {string} rootComponentDir - path of component to be obrained
 * @returns {object} - nested component JSON object
 */
export async function getThreeGenerationFamily(projectRootDir, rootComponentDir) {
  const wf = await readComponentJson(rootComponentDir);
  const rt = { ...wf };
  rt.descendants = await getChildren(projectRootDir, wf.ID);

  for (const child of rt.descendants) {
    if (child.handler) {
      delete child.handler;
    }
    if (hasChild(child)) {
      const grandson = await getChildren(projectRootDir, child.ID);
      child.descendants = grandson.map((e)=>{
        if (e.type === "task") {
          return { type: e.type, pos: e.pos, host: e.host, useJobScheduler: e.useJobScheduler };
        }
        return { type: e.type, pos: e.pos };
      });
    }
  }
  return rt;
}

const _internal = {
  path,
  promisify,
  glob,
  readJsonGreedy,
  componentJsonFilename,
  getComponentDir,
  readComponentJson,
  hasChild,
  getChildren
};

let internal;
if (process.env.NODE_ENV === "test") {
  internal = _internal;
}
export { internal as _internal };