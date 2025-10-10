/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { promisify } from "util";
import fs from "fs-extra";
import path from "path";
import isPathInside from "is-path-inside";
import globCallback from "glob";
import { diff } from "just-diff";
import { diffApply } from "just-diff-apply";
import { getComponentDir, writeComponentJson, writeComponentJsonByID, readComponentJson, readComponentJsonByID } from "./componentJsonIO.js";
import { componentFactory, getComponentDefaultName, hasChild, isLocalComponent } from "./workflowComponent.js";
import { projectList, defaultCleanupRemoteRoot, projectJsonFilename, componentJsonFilename, jobManagerJsonFilename, suffix, remoteHost, defaultPSconfigFilename } from "../db/db.js";
import { getDateString, writeJsonWrapper, isValidName, isValidInputFilename, isValidOutputFilename } from "../lib/utility.js";
import { replacePathsep, convertPathSep } from "./pathUtils.js";
import { readJsonGreedy } from "./fileUtils.js";
import { gitInit, gitAdd, gitCommit, gitRm } from "./gitOperator2.js";
import { getLogger as actualGetLogger } from "../logSettings.js";
import { getSsh } from "./sshManager.js";
import { getChildren as getChildrenFromUtil } from "./workflowUtil.js";

const glob = promisify(globCallback);

function isSurrounded(token) {
  return token.startsWith("{") && token.endsWith("}");
}
function trimSurrounded(token) {
  if (!isSurrounded(token)) {
    return token;
  }
  const rt = /{+(.*)}+/.exec(token);
  return (Array.isArray(rt) && typeof rt[1] === "string") ? rt[1] : token;
}
function glob2Array(token) {
  return trimSurrounded(token).split(",");
}
function removeTrailingPathSep(filename) {
  if (filename.endsWith(path.sep)) {
    return removeTrailingPathSep(filename.slice(0, -1));
  }
  return filename;
}
async function getProjectJson(projectRootDir) {
  return readJsonGreedy(path.resolve(projectRootDir, projectJsonFilename));
}
async function writeProjectJson(projectRootDir, projectJson) {
  const filename = path.resolve(projectRootDir, projectJsonFilename);
  await writeJsonWrapper(filename, projectJson);
  return gitAdd(projectRootDir, filename);
}
async function getDescendantsIDs(projectRootDir, ID) {
  const filename = path.resolve(projectRootDir, projectJsonFilename);
  const projectJson = await readJsonGreedy(filename);
  const poi = await getComponentDir(projectRootDir, ID, true);
  const rt = [ID];
  for (const [id, componentPath] of Object.entries(projectJson.componentPath)) {
    if (isPathInside(path.resolve(projectRootDir, componentPath), poi)) {
      rt.push(id);
    }
  }
  return rt;
}
async function getAllComponentIDs(projectRootDir) {
  const filename = path.resolve(projectRootDir, projectJsonFilename);
  const projectJson = await readJsonGreedy(filename);
  return Object.keys(projectJson.componentPath);
}
function getSuffixNumberFromProjectName(projectName) {
  const reResult = /.*?(\d+)$/.exec(projectName);
  return reResult === null ? 0 : reResult[1];
}
async function getUnusedProjectDir(projectRootDir, projectName) {
  if (!await fs.pathExists(projectRootDir)) {
    return projectRootDir;
  }
  const dirname = path.dirname(projectRootDir);
  let projectRootDirCandidate = path.resolve(dirname, `${projectName}${suffix}`);
  if (!await fs.pathExists(projectRootDirCandidate)) {
    return projectRootDirCandidate;
  }
  let suffixNumber = getSuffixNumberFromProjectName(projectName);
  projectRootDirCandidate = path.resolve(dirname, `${projectName}${suffixNumber}${suffix}`);

  while (await fs.pathExists(projectRootDirCandidate)) {
    ++suffixNumber;
    projectRootDirCandidate = path.resolve(dirname, `${projectName}${suffixNumber}${suffix}`);
  }
  return projectRootDirCandidate;
}
export async function createNewProject(argProjectRootDir, name, argDescription, user, mail) {
  const description = argDescription != null ? argDescription : "This is new project.";
  const projectRootDir = await getUnusedProjectDir(argProjectRootDir, name);
  await fs.ensureDir(projectRootDir);
  await gitInit(projectRootDir, user, mail);
  const rootWorkflow = componentFactory("workflow");
  rootWorkflow.name = path.basename(projectRootDir.slice(0, -suffix.length));
  rootWorkflow.cleanupFlag = defaultCleanupRemoteRoot ? 0 : 1;
  actualGetLogger().debug(rootWorkflow);
  await writeComponentJson(projectRootDir, projectRootDir, rootWorkflow);
  const timestamp = getDateString(true);
  const projectJson = {
    version: 2,
    name: rootWorkflow.name,
    description,
    state: "not-started",
    root: projectRootDir,
    ctime: timestamp,
    mtime: timestamp,
    componentPath: {}
  };
  projectJson.componentPath[rootWorkflow.ID] = "./";
  const projectJsonFileFullpath = path.resolve(projectRootDir, projectJsonFilename);
  actualGetLogger().debug(projectJson);
  await writeJsonWrapper(projectJsonFileFullpath, projectJson);
  await gitAdd(projectRootDir, "./");
  await gitCommit(projectRootDir, "create new project");
  return projectRootDir;
}
async function removeComponentPath(projectRootDir, IDs, force = false) {
  const filename = path.resolve(projectRootDir, projectJsonFilename);
  const projectJson = await readJsonGreedy(filename);
  for (const [id, componentPath] of Object.entries(projectJson.componentPath)) {
    if (IDs.includes(id)) {
      if (force || !await fs.pathExists(path.join(projectRootDir, componentPath))) {
        delete projectJson.componentPath[id];
      }
    }
  }
  await writeJsonWrapper(filename, projectJson);
  return gitAdd(projectRootDir, filename);
}
export async function updateComponentPath(projectRootDir, ID, absPath) {
  const filename = path.resolve(projectRootDir, projectJsonFilename);
  const projectJson = await readJsonGreedy(filename);
  let newRelativePath = replacePathsep(path.relative(projectRootDir, absPath));
  if (!newRelativePath.startsWith(".")) {
    newRelativePath = `./${newRelativePath}`;
  }
  const oldRelativePath = projectJson.componentPath[ID];
  if (typeof oldRelativePath !== "undefined") {
    for (const [k, v] of Object.entries(projectJson.componentPath)) {
      if (isPathInside(convertPathSep(v), convertPathSep(oldRelativePath)) || v === oldRelativePath) {
        projectJson.componentPath[k] = v.replace(oldRelativePath, newRelativePath);
      }
    }
  }
  projectJson.componentPath[ID] = newRelativePath;
  await writeJsonWrapper(filename, projectJson);
  await gitAdd(projectRootDir, filename);
  return projectJson.componentPath;
}
export async function setProjectState(projectRootDir, state, force, projectJson) {
  const filename = path.resolve(projectRootDir, projectJsonFilename);
  const projectJsonForUpdate = projectJson || await readJsonGreedy(filename);

  if (force || projectJsonForUpdate.state !== state) {
    projectJsonForUpdate.state = state;
    const timestamp = getDateString(true);
    projectJsonForUpdate.mtime = timestamp;
    await writeJsonWrapper(filename, projectJsonForUpdate);
    await gitAdd(projectRootDir, filename);
    return projectJsonForUpdate;
  }
  return false;
}
export async function getComponentFullName(projectRootDir, ID) {
  const relativePath = await getComponentDir(projectRootDir, ID);
  if (relativePath === null) {
    return relativePath;
  }
  return relativePath.replace(/^\./, "");
}
export async function getProjectState(projectRootDir) {
  const projectJson = await readJsonGreedy(path.resolve(projectRootDir, projectJsonFilename));
  return projectJson.state;
}
export async function checkRunningJobs(projectRootDir) {
  const tasks = [];
  const jmFiles = [];
  const candidates = await glob(`*.${jobManagerJsonFilename}`, { cwd: projectRootDir });
  for (const jmFile of candidates) {
    try {
      const taskInJmFile = await fs.readJson(path.resolve(projectRootDir, jmFile));
      if (Array.isArray(taskInJmFile) && taskInJmFile.length > 0) {
        jmFiles.push(jmFile);
        tasks.push(...taskInJmFile);
      }
    } catch (e) {
      actualGetLogger(projectRootDir).warn("read job manager file failed", e);
    }
  }
  return { tasks, jmFiles };
}
async function rewriteIncludeExclude(projectRootDir, filename, changed) {
  let needToWrite = false;
  const componentJson = await readJsonGreedy(filename);
  if (typeof componentJson.include === "string" && !Array.isArray(componentJson.include)) {
    actualGetLogger().info("convert include property", filename);
    componentJson.include = glob2Array(componentJson.include).map((e)=>{
      return { name: e };
    });
    needToWrite = true;
  }
  if (componentJson.include === null) {
    componentJson.include = [];
    needToWrite = true;
  }
  if (typeof componentJson.exclude === "string" && !Array.isArray(componentJson.exclude)) {
    actualGetLogger().info("convert exclude property", filename);
    componentJson.exclude = glob2Array(componentJson.exclude).map((e)=>{
      return { name: e };
    });
    needToWrite = true;
  }
  if (componentJson.exclude === null) {
    componentJson.exclude = [];
    needToWrite = true;
  }
  if (needToWrite) {
    await writeComponentJson(projectRootDir, path.dirname(filename), componentJson);
    changed.push(filename);
  }
}
async function rewriteAllIncludeExcludeProperty(projectRootDir, changed) {
  const files = await glob(`./**/${componentJsonFilename}`, { cwd: projectRootDir });
  await Promise.all(files.map((filename)=>{
    return rewriteIncludeExclude(projectRootDir, path.resolve(projectRootDir, filename), changed);
  }));
}
export async function readProject(projectRootDir) {
  const toBeCommited = [];
  const projectJson = await getProjectJson(projectRootDir);
  const isVersionOld = projectJson.version <= 2;
  if (isVersionOld) {
    await rewriteAllIncludeExcludeProperty(projectRootDir, toBeCommited);
    projectJson.version = 2.1;
  }
  if (projectList.query("path", projectRootDir)) {
    return projectRootDir;
  }
  const projectBasename = path.basename(projectRootDir);
  const isNameMismatched = projectBasename !== `${projectJson.name}${suffix}`;
  if (isNameMismatched) {
    projectJson.name = projectBasename.replace(suffix, "");
  }
  if (isVersionOld || isNameMismatched) {
    await writeProjectJson(projectRootDir, projectJson);
    toBeCommited.push(projectJsonFilename);
  }
  if (!await fs.pathExists(path.resolve(projectRootDir, ".git"))) {
    try {
      await gitInit(projectRootDir, "wheel", "wheel@example.com");
      await setProjectState(projectRootDir, "not-started", true);
      await setComponentStateR(projectRootDir, projectRootDir, "not-started");
      await gitAdd(projectRootDir, "./");
      await gitCommit(projectRootDir, "import project");
    } catch (e) {
      actualGetLogger().error("can not access to git repository", e);
      return null;
    }
  } else {
    const ignoreFile = path.join(projectRootDir, ".gitignore");
    if (!await fs.pathExists(ignoreFile)) {
      await fs.outputFile(ignoreFile, "wheel.log");
      await gitAdd(projectRootDir, ".gitignore");
    }
    await Promise.all(toBeCommited.map((name)=>{
      return gitAdd(projectRootDir, name);
    }));
    await gitCommit(projectRootDir, "import project", ["--", ".gitignore", ...toBeCommited]);
  }
  projectList.unshift({ path: projectRootDir });
  return projectRootDir;
}
export async function setComponentStateR(projectRootDir, dir, state, doNotAdd = false, ignoreStates = []) {
  const globbed = await glob(path.join(dir, "**", componentJsonFilename));
  const filenames = Array.isArray(globbed) ? globbed : [];
  filenames.push(path.join(dir, componentJsonFilename));
  if (!ignoreStates.includes(state)) {
    ignoreStates.push(state);
  }
  const p = filenames.map((filename)=>{
    return readJsonGreedy(filename)
      .then((component)=>{
        if (ignoreStates.includes(component.state)) {
          return true;
        }
        component.state = state;
        const componentDir = path.dirname(filename);
        return writeComponentJson(projectRootDir, componentDir, component, doNotAdd);
      });
  });
  return Promise.all(p);
}
export async function updateProjectROStatus(projectRootDir, isRO) {
  const filename = path.resolve(projectRootDir, projectJsonFilename);
  const projectJson = await readJsonGreedy(filename);
  projectJson.readOnly = isRO;
  await writeJsonWrapper(filename, projectJson);
}
export async function updateProjectDescription(projectRootDir, description) {
  const filename = path.resolve(projectRootDir, projectJsonFilename);
  const projectJson = await readJsonGreedy(filename);
  projectJson.description = description;
  await writeJsonWrapper(filename, projectJson);
  await gitAdd(projectRootDir, filename);
}
export async function addProject(projectDir, description) {
  let projectRootDir = path.resolve(removeTrailingPathSep(convertPathSep(projectDir)));
  if (!projectRootDir.endsWith(suffix)) {
    projectRootDir += suffix;
  }
  projectRootDir = path.resolve(projectRootDir);
  if (await fs.pathExists(projectRootDir)) {
    const err = new Error("specified project dir is already exists");
    err.projectRootDir = projectRootDir;
    throw err;
  }
  if (await fs.pathExists(projectRootDir)) {
    const err = new Error("specified project dir is already used");
    err.projectRootDir = projectRootDir;
    throw err;
  }
  const projectName = path.basename(projectRootDir.slice(0, -suffix.length));
  if (!isValidName(projectName)) {
    actualGetLogger().error(projectName, "is not allowed for project name");
    throw (new Error("illegal project name"));
  }
  projectRootDir = await createNewProject(projectRootDir, projectName, description, "wheel", "wheel@example.com");
  projectList.unshift({ path: projectRootDir });
}
export async function renameProject(id, argNewName, oldDir) {
  const newName = argNewName.endsWith(suffix) ? argNewName.slice(0, -suffix.length) : argNewName;
  if (!isValidName(newName)) {
    actualGetLogger().error(newName, "is not allowed for project name");
    throw (new Error("illegal project name"));
  }
  const newDir = path.resolve(path.dirname(oldDir), `${newName}${suffix}`);
  if (await fs.pathExists(newDir)) {
    actualGetLogger().error(newName, "directory is already exists");
    throw (new Error("already exists"));
  }
  await fs.move(oldDir, newDir);
  const projectJson = await readJsonGreedy(path.resolve(newDir, projectJsonFilename));
  projectJson.name = newName;
  projectJson.root = newDir;
  projectJson.mtime = getDateString(true);
  await writeProjectJson(newDir, projectJson);
  const rootWorkflow = await readJsonGreedy(path.resolve(newDir, componentJsonFilename));
  rootWorkflow.name = newName;
  await writeComponentJson(newDir, newDir, rootWorkflow);
  await gitCommit(newDir);
  const target = projectList.get(id);
  target.path = newDir;
  await projectList.update(target);
}
function isDefaultPort(port) {
  return typeof port === "undefined" || port === 22 || port === "22" || port === "";
}
export function isLocal(component) {
  return typeof component.host === "undefined" || component.host === "localhost";
}
export async function isSameRemoteHost(projectRootDir, src, dst) {
  if (src === dst) {
    return null;
  }
  const srcComponent = await readComponentJsonByID(projectRootDir, src);
  const dstComponent = await readComponentJsonByID(projectRootDir, dst);
  if (isLocalComponent(srcComponent) || isLocalComponent(dstComponent)) {
    return false;
  }
  if (srcComponent.host === dstComponent.host) {
    return true;
  }
  const srcHostInfo = remoteHost.query("name", srcComponent.host);
  const dstHostInfo = remoteHost.query("name", dstComponent.host);
  if (dstHostInfo.sharedHost === srcHostInfo.name) {
    return true;
  }
  if (srcHostInfo.host !== dstHostInfo.host || srcHostInfo.user !== dstHostInfo.user) {
    return false;
  }
  const srcHostPort = isDefaultPort(srcHostInfo.port) ? 22 : srcHostInfo.port;
  const dstHostPort = isDefaultPort(dstHostInfo.port) ? 22 : dstHostInfo.port;
  return srcHostPort === dstHostPort;
}
async function isParent(projectRootDir, parentID, childID) {
  if (parentID === "parent") {
    return true;
  }
  if (childID === "parent") {
    return false;
  }
  const childJson = await readComponentJsonByID(projectRootDir, childID);
  if (childJson === null || typeof childID !== "string") {
    return false;
  }
  return childJson.parent === parentID;
}
async function removeAllLinkFromComponent(projectRootDir, ID) {
  const counterparts = new Map();
  const component = await readComponentJsonByID(projectRootDir, ID);
  if (Object.prototype.hasOwnProperty.call(component, "previous")) {
    for (const previousComponent of component.previous) {
      const counterpart = counterparts.get(previousComponent) || await readComponentJsonByID(projectRootDir, previousComponent);
      counterpart.next = counterpart.next.filter((e)=>{
        return e !== component.ID;
      });
      if (counterpart.else) {
        counterpart.else = counterpart.else.filter((e)=>{
          return e !== component.ID;
        });
      }
      counterparts.set(counterpart.ID, counterpart);
    }
  }
  if (Object.prototype.hasOwnProperty.call(component, "next")) {
    for (const nextComponent of component.next) {
      const counterpart = counterparts.get(nextComponent) || await readComponentJsonByID(projectRootDir, nextComponent);
      counterpart.previous = counterpart.previous.filter((e)=>{
        return e !== component.ID;
      });
      counterparts.set(counterpart.ID, counterpart);
    }
  }
  if (Object.prototype.hasOwnProperty.call(component, "else")) {
    for (const elseComponent of component.else) {
      const counterpart = counterparts.get(elseComponent) || await readComponentJsonByID(projectRootDir, elseComponent);
      counterpart.previous = counterpart.previous.filter((e)=>{
        return e !== component.ID;
      });
      counterparts.set(counterpart.ID, counterpart);
    }
  }
  if (Object.prototype.hasOwnProperty.call(component, "inputFiles")) {
    for (const inputFile of component.inputFiles) {
      for (const src of inputFile.src) {
        const srcComponent = src.srcNode;
        const counterpart = counterparts.get(srcComponent) || await readComponentJsonByID(projectRootDir, srcComponent);
        for (const outputFile of counterpart.outputFiles) {
          outputFile.dst = outputFile.dst.filter((e)=>{
            return e.dstNode !== component.ID;
          });
        }
        counterparts.set(counterpart.ID, counterpart);
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(component, "outputFiles")) {
    for (const outputFile of component.outputFiles) {
      for (const dst of outputFile.dst) {
        const dstComponent = dst.dstNode;
        const counterpart = counterparts.get(dstComponent) || await readComponentJsonByID(projectRootDir, dstComponent);
        for (const inputFile of counterpart.inputFiles) {
          inputFile.src = inputFile.src.filter((e)=>{
            return e.srcNode !== component.ID;
          });
        }
        counterparts.set(counterpart.ID, counterpart);
      }
    }
  }
  for (const [counterPartID, counterpart] of counterparts) {
    await writeComponentJsonByID(projectRootDir, counterPartID, counterpart);
  }
}
async function addFileLinkToParent(projectRootDir, srcNode, srcName, dstName) {
  const srcDir = await getComponentDir(projectRootDir, srcNode, true);
  const srcJson = await readComponentJson(srcDir);
  const parentDir = path.dirname(srcDir);
  const parentJson = await readComponentJson(parentDir);
  const parentID = parentJson.ID;
  const srcOutputFile = srcJson.outputFiles.find((e)=>{
    return e.name === srcName;
  });
  if (!srcOutputFile.dst.some((e)=>{ return e.dstNode === parentID && e.dstName === dstName; })) {
    srcOutputFile.dst.push({ dstNode: parentID, dstName });
  }
  const p = writeComponentJson(projectRootDir, srcDir, srcJson);
  const parentOutputFile = parentJson.outputFiles.find((e)=>{
    return e.name === dstName;
  });
  if (!Object.prototype.hasOwnProperty.call(parentOutputFile, "origin")) {
    parentOutputFile.origin = [];
  }
  if (!parentOutputFile.origin.some((e)=>{ return e.srcNode === srcNode && e.srcName === srcName; })) {
    parentOutputFile.origin.push({ srcNode, srcName });
  }
  await p;
  return writeComponentJson(projectRootDir, parentDir, parentJson);
}
async function addFileLinkFromParent(projectRootDir, srcName, dstNode, dstName) {
  const dstDir = await getComponentDir(projectRootDir, dstNode, true);
  const dstJson = await readComponentJson(dstDir);
  const parentDir = path.dirname(dstDir);
  const parentJson = await readComponentJson(parentDir);
  const parentID = parentJson.ID;

  if (!Object.prototype.hasOwnProperty.call(parentJson, "inputFiles")) {
    parentJson.inputFiles = [];
  }
  let parentInputFile = parentJson.inputFiles.find((e)=>{
    return e.name === srcName;
  });
  if (typeof parentInputFile === "undefined") {
    parentInputFile = { name: srcName, forwardTo: [] };
    parentJson.inputFiles.push(parentInputFile);
  }

  if (!Object.prototype.hasOwnProperty.call(parentInputFile, "forwardTo")) {
    parentInputFile.forwardTo = [];
  }
  if (!parentInputFile.forwardTo.some((e)=>{ return e.dstNode === dstNode && e.dstName === dstName; })) {
    parentInputFile.forwardTo.push({ dstNode, dstName });
  }
  const p = writeComponentJson(projectRootDir, parentDir, parentJson);
  const dstInputFile = dstJson.inputFiles.find((e)=>{
    return e.name === dstName;
  });
  if (typeof dstInputFile === "undefined") {
    dstJson.inputFiles.push({ name: dstName, src: [{ srcNode: parentID, srcName }] });
  } else if (!dstInputFile.src.some((e)=>{ return e.srcNode === parentID && e.srcName === srcName; })) {
    dstInputFile.src.push({ srcNode: parentID, srcName });
  }
  await p;
  return writeComponentJson(projectRootDir, dstDir, dstJson);
}
async function addFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName) {
  const srcDir = await getComponentDir(projectRootDir, srcNode, true);
  const srcJson = await readComponentJson(srcDir);
  const srcOutputFile = srcJson.outputFiles.find((e)=>{
    return e.name === srcName;
  });
  srcOutputFile.dst.push({ dstNode, dstName });
  const p1 = writeComponentJson(projectRootDir, srcDir, srcJson);
  const dstDir = await getComponentDir(projectRootDir, dstNode, true);
  const dstJson = await readComponentJson(dstDir);
  const dstInputFile = dstJson.inputFiles.find((e)=>{
    return e.name === dstName;
  });
  if (typeof dstInputFile === "undefined") {
    dstJson.inputFiles.push({ name: dstName, src: [{ srcNode, srcName }] });
  } else {
    dstInputFile.src.push({ srcNode, srcName });
  }
  await p1;
  return writeComponentJson(projectRootDir, dstDir, dstJson);
}
async function removeFileLinkToParent(projectRootDir, srcNode, srcName, dstName) {
  const srcDir = await getComponentDir(projectRootDir, srcNode, true);
  const srcJson = await readComponentJson(srcDir);
  const parentDir = path.dirname(srcDir);
  const parentJson = await readComponentJson(parentDir);
  const srcOutputFile = srcJson.outputFiles.find((e)=>{
    return e.name === srcName;
  });
  srcOutputFile.dst = srcOutputFile.dst.filter((e)=>{
    return e.dstNode !== parentJson.ID || e.dstName !== dstName;
  });
  const p = writeComponentJson(projectRootDir, srcDir, srcJson);
  const parentOutputFile = parentJson.outputFiles.find((e)=>{
    return e.name === dstName;
  });
  if (Object.prototype.hasOwnProperty.call(parentOutputFile, "origin")) {
    parentOutputFile.origin = parentOutputFile.origin.filter((e)=>{
      return e.srcNode !== srcNode || e.srcName !== srcName;
    });
  }
  await p;
  return writeComponentJson(projectRootDir, parentDir, parentJson);
}
async function removeFileLinkFromParent(projectRootDir, srcName, dstNode, dstName) {
  const dstDir = await getComponentDir(projectRootDir, dstNode, true);
  const dstJson = await readComponentJson(dstDir);
  const parentDir = path.dirname(dstDir);
  const parentJson = await readComponentJson(parentDir);
  const parentID = parentJson.ID;
  const parentInputFile = parentJson.inputFiles.find((e)=>{
    return e.name === srcName;
  });
  if (Object.prototype.hasOwnProperty.call(parentInputFile, "forwardTo")) {
    parentInputFile.forwardTo = parentInputFile.forwardTo.filter((e)=>{
      return e.dstNode !== dstNode || e.dstName !== dstName;
    });
  }
  const p = writeComponentJson(projectRootDir, parentDir, parentJson);
  const dstInputFile = dstJson.inputFiles.find((e)=>{
    return e.name === dstName;
  });
  dstInputFile.src = dstInputFile.src.filter((e)=>{
    return e.srcNode !== parentID || e.srcName !== srcName;
  });
  await p;
  return writeComponentJson(projectRootDir, dstDir, dstJson);
}
async function removeFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName) {
  const srcDir = await getComponentDir(projectRootDir, srcNode, true);
  const srcJson = await readComponentJson(srcDir);
  const srcOutputFile = srcJson.outputFiles.find((e)=>{
    return e.name === srcName;
  });
  srcOutputFile.dst = srcOutputFile.dst.filter((e)=>{
    return !(e.dstNode === dstNode && e.dstName === dstName);
  });
  const p = writeComponentJson(projectRootDir, srcDir, srcJson);
  const dstDir = await getComponentDir(projectRootDir, dstNode, true);
  const dstJson = await readComponentJson(dstDir);
  const dstInputFile = dstJson.inputFiles.find((e)=>{
    return e.name === dstName;
  });
  dstInputFile.src = dstInputFile.src.filter((e)=>{
    return !(e.srcNode === srcNode && e.srcName === srcName);
  });
  await p;
  return writeComponentJson(projectRootDir, dstDir, dstJson);
}
async function makeDir(basename, argSuffix) {
  let suffix = argSuffix;
  while (await fs.pathExists(basename + suffix)) {
    ++suffix;
  }
  const dirname = basename + suffix;
  await fs.mkdir(dirname);
  return dirname;
}
export async function checkRemoteStoragePathWritePermission(projectRootDir, { host, storagePath }) {
  const remotehostID = remoteHost.getID("name", host);
  const ssh = getSsh(projectRootDir, remotehostID);
  const rt = ssh.exec(`test -w ${storagePath}`);
  if (rt !== 0) {
    const err = new Error("bad permission");
    err.host = host;
    err.storagePath = storagePath;
    err.reason = "invalidRemoteStorage";
    throw err;
  }
  return Promise.resolve();
}
async function recursiveGetHosts(projectRootDir, parentID, hosts, storageHosts, gfarmHosts) {
  const promises = [];
  const children = await getChildrenFromUtil(projectRootDir, parentID);
  for (const component of children) {
    if (component.disable) {
      continue;
    }
    if (component.host === "localhost") {
      continue;
    }
    if (["task", "stepjob", "bulkjobTask"].includes(component.type)) {
      hosts.push({ hostname: component.host });
    } else if (["hpciss", "hpcisstar"].includes(component.type)) {
      gfarmHosts.push({ hostname: component.host, isGfarm: true });
    } else if (component.type === "storage") {
      storageHosts.push({ hostname: component.host, isStorage: true });
    }
    if (hasChild(component)) {
      promises.push(recursiveGetHosts(projectRootDir, component.ID, hosts, storageHosts, gfarmHosts));
    }
  }
  return Promise.all(promises);
}
export async function getHosts(projectRootDir, rootID) {
  const hosts = [];
  const storageHosts = [];
  const gfarmHosts = [];
  await recursiveGetHosts(projectRootDir, rootID, hosts, storageHosts, gfarmHosts);
  const storageHosts2 = [...new Map(storageHosts.map((item)=>{ return [item.hostname, item]; })).values()];
  const gfarmHosts2 = [...new Map(gfarmHosts.map((item)=>{ return [item.hostname, item]; })).values()];
  const keepHosts = storageHosts2.concat(gfarmHosts2);
  const hosts2 = [...new Map(hosts.map((item)=>{ return [item.hostname, item]; })).values()]
    .filter((host)=>{
      return !keepHosts.some((e)=>{
        return e.hostname === host.hostname;
      });
    });
  return [...keepHosts, ...hosts2];
}
export async function createNewComponent(projectRootDir, parentDir, type, pos) {
  const parentJson = await readJsonGreedy(path.resolve(parentDir, componentJsonFilename));
  const parentID = parentJson.ID;
  const componentBasename = getComponentDefaultName(type);
  const absDirName = await makeDir(path.resolve(parentDir, componentBasename), 0);
  const newComponent = componentFactory(type, pos, parentID);
  newComponent.name = path.basename(absDirName);
  await writeComponentJson(projectRootDir, absDirName, newComponent);
  await updateComponentPath(projectRootDir, newComponent.ID, absDirName);
  if (type === "PS") {
    const PSConfigFilename = path.resolve(absDirName, defaultPSconfigFilename);
    await writeJsonWrapper(PSConfigFilename, { version: 2, targetFiles: [], params: [], scatter: [], gather: [] });
    await gitAdd(projectRootDir, PSConfigFilename);
  }
  return newComponent;
}
async function renameComponentDir(projectRootDir, ID, newName) {
  if (!isValidName(newName)) {
    return Promise.reject(new Error(`${newName} is not valid component name`));
  }
  const oldDir = await getComponentDir(projectRootDir, ID, true);
  if (oldDir === projectRootDir) {
    return Promise.reject(new Error("updateNode can not rename root workflow"));
  }
  if (path.basename(oldDir) === newName) {
    return true;
  }
  const newDir = path.resolve(path.dirname(oldDir), newName);
  await gitRm(projectRootDir, oldDir);
  await fs.move(oldDir, newDir);
  await gitAdd(projectRootDir, newDir);
  return updateComponentPath(projectRootDir, ID, newDir);
}
export async function replaceEnv(projectRootDir, ID, newEnv) {
  const componentJson = await readComponentJsonByID(projectRootDir, ID);
  const env = componentJson.env || {};
  const patch = diff(env, newEnv);
  diffApply(env, patch);
  componentJson.env = env;
  await writeComponentJsonByID(projectRootDir, ID, componentJson);
  return componentJson;
}
export async function replaceWebhook(projectRootDir, newWebhook) {
  const projectJson = await getProjectJson(projectRootDir);
  const { webhook } = projectJson;
  if (typeof webhook === "undefined") {
    projectJson.webhook = newWebhook;
  } else {
    const patch = diff(webhook, newWebhook);
    diffApply(webhook, patch);
  }
  await writeProjectJson(projectRootDir, projectJson);
  return webhook;
}
export async function getEnv(projectRootDir, ID) {
  const componentJson = await readComponentJsonByID(projectRootDir, ID);
  const env = componentJson.env || {};
  return env;
}
export async function updateComponent(projectRootDir, ID, prop, value) {
  if (prop === "path") {
    return Promise.reject(new Error("path property is deprecated. please use 'name' instead."));
  }
  if (prop === "inputFiles" || prop === "outputFiles") {
    return Promise.reject(new Error(`updateNode does not support ${prop}. please use renameInputFile or renameOutputFile`));
  }
  if (prop === "env") {
    return Promise.reject(new Error("updateNode does not support env. please use updateEnv"));
  }
  if (prop === "uploadOnDemand" && value === true) {
    await setUploadOndemandOutputFile(projectRootDir, ID);
  }
  if (prop === "name") {
    await renameComponentDir(projectRootDir, ID, value);
  }
  const componentJson = await readComponentJsonByID(projectRootDir, ID);
  componentJson[prop] = value;
  await writeComponentJsonByID(projectRootDir, ID, componentJson);
  return componentJson;
}
async function updateStepNumber(projectRootDir) {
  const componentIDs = await getAllComponentIDs(projectRootDir);
  const stepjobTaskComponentJson = [];
  const stepjobComponentIDs = [];
  const stepjobGroup = [];
  for (const id of componentIDs) {
    const componentDir = await getComponentDir(projectRootDir, id, true);
    const componentJson = await readComponentJson(componentDir);
    if (componentJson.type === "stepjobTask") {
      stepjobTaskComponentJson.push(componentJson);
    }
    if (componentJson.type === "stepjob") {
      stepjobComponentIDs.push(componentJson.ID);
    }
  }
  for (const id of stepjobComponentIDs) {
    const stepjobTaskIDs = stepjobTaskComponentJson.filter((component)=>{
      return component.parent === id;
    });
    stepjobGroup.push(stepjobTaskIDs);
  }
  const arrangedComponents = await arrangeComponent(stepjobGroup);
  let stepnum = 0;
  const prop = "stepnum";
  const p = [];
  for (const componentJson of arrangedComponents) {
    componentJson[prop] = stepnum;
    const componentDir = await getComponentDir(projectRootDir, componentJson.ID, true);
    p.push(writeComponentJson(projectRootDir, componentDir, componentJson));
    stepnum++;
  }
  return Promise.all(p);
}
async function arrangeComponent(stepjobGroupArray) {
  const arrangedArray = [];
  for (const stepjobTaskComponents of stepjobGroupArray) {
    let arrangeArraytemp = [];
    let notConnectTasks = [];
    for (let i = 0; i < stepjobTaskComponents.length; i++) {
      if (i === 0) {
        arrangeArraytemp = stepjobTaskComponents.filter((stepjobTask)=>{
          return stepjobTask.previous.length === 0 && stepjobTask.next.length !== 0;
        });
        if (arrangeArraytemp.length === 0) {
          arrangeArraytemp = stepjobTaskComponents;
          break;
        }
        continue;
      }
      let nextComponent = [];
      nextComponent = stepjobTaskComponents.filter((stepjobTask)=>{
        return stepjobTask.ID === arrangeArraytemp[i - 1].next[0];
      });
      if (nextComponent.length !== 0) {
        arrangeArraytemp.push(nextComponent[0]);
      }
      notConnectTasks = stepjobTaskComponents.filter((stepjobTask)=>{
        return stepjobTask.previous.length === 0 && stepjobTask.next.length === 0;
      });
    }
    for (const stepJobTask of notConnectTasks) {
      arrangeArraytemp.push(stepJobTask);
    }
    arrangedArray.push(arrangeArraytemp);
  }
  const arrayList = [];
  for (const stepJobList of arrangedArray) {
    for (const stepJobTask of stepJobList) {
      arrayList.push(stepJobTask);
    }
  }
  return arrayList;
}
export async function addInputFile(projectRootDir, ID, name) {
  if (!isValidInputFilename(name)) {
    return Promise.reject(new Error(`${name} is not valid inputFile name`));
  }
  const componentDir = await getComponentDir(projectRootDir, ID, true);
  const componentJson = await readComponentJson(componentDir);
  if (!Object.prototype.hasOwnProperty.call(componentJson, "inputFiles")) {
    const err = new Error(`${componentJson.name} does not have inputFiles`);
    err.component = componentJson;
    return Promise.reject(err);
  }
  componentJson.inputFiles.push({ name, src: [] });
  return writeComponentJson(projectRootDir, componentDir, componentJson);
}
export async function addOutputFile(projectRootDir, ID, name) {
  if (!isValidOutputFilename(name)) {
    return Promise.reject(new Error(`${name} is not valid outputFile name`));
  }
  const componentDir = await getComponentDir(projectRootDir, ID, true);
  const componentJson = await readComponentJson(componentDir);
  if (!Object.prototype.hasOwnProperty.call(componentJson, "outputFiles")) {
    const err = new Error(`${componentJson.name} does not have outputFiles`);
    err.component = componentJson;
    return Promise.reject(err);
  }
  if (componentJson.outputFiles.find((outputFile)=>{
    return outputFile.name === name;
  })) {
    return Promise.reject(new Error(`${name} is already exists`));
  }
  componentJson.outputFiles.push({ name, dst: [] });
  return writeComponentJson(projectRootDir, componentDir, componentJson);
}
async function setUploadOndemandOutputFile(projectRootDir, ID) {
  const componentDir = await getComponentDir(projectRootDir, ID, true);
  const componentJson = await readComponentJson(componentDir);
  if (!Object.prototype.hasOwnProperty.call(componentJson, "outputFiles")) {
    const err = new Error(`${componentJson.name} does not have outputFiles`);
    err.component = componentJson;
    return Promise.reject(err);
  }
  if (componentJson.outputFiles.length === 0) {
    return addOutputFile(projectRootDir, ID, "UPLOAD_ONDEMAND");
  }
  if (componentJson.outputFiles.length > 1) {
    const p = [];
    for (let i = 1; i < componentJson.outputFiles.length; i++) {
      const counterparts = new Set();
      for (const dst of componentJson.outputFiles[i].dst) {
        counterparts.add(dst);
      }
      for (const counterPart of counterparts) {
        p.push(removeFileLink(projectRootDir, ID, componentJson.outputFiles[i].name, counterPart.dstNode, counterPart.dstName));
      }
    }
    await Promise.all(p);
    componentJson.outputFiles.splice(1, componentJson.outputFiles.length - 1);
  }
  return renameOutputFile(projectRootDir, ID, 0, "UPLOAD_ONDEMAND");
}
export async function removeInputFile(projectRootDir, ID, name) {
  const counterparts = new Set();
  const componentDir = await getComponentDir(projectRootDir, ID, true);
  const componentJson = await readComponentJson(componentDir);
  componentJson.inputFiles.forEach((inputFile)=>{
    if (name === inputFile.name) {
      for (const src of inputFile.src) {
        counterparts.add(src);
      }
    }
  });

  for (const counterPart of counterparts) {
    await removeFileLink(projectRootDir, counterPart.srcNode, counterPart.srcName, ID, name);
  }
  componentJson.inputFiles = componentJson.inputFiles.filter((inputFile)=>{
    return name !== inputFile.name;
  });
  return writeComponentJson(projectRootDir, componentDir, componentJson);
}
export async function removeOutputFile(projectRootDir, ID, name) {
  const counterparts = new Set();
  const componentDir = await getComponentDir(projectRootDir, ID, true);
  const componentJson = await readComponentJson(componentDir);
  componentJson.outputFiles = componentJson.outputFiles.filter((outputFile)=>{
    if (name !== outputFile.name) {
      return true;
    }
    for (const dst of outputFile.dst) {
      counterparts.add(dst);
    }
    return false;
  });

  for (const counterPart of counterparts) {
    await removeFileLink(projectRootDir, ID, name, counterPart.dstNode, counterPart.dstName);
  }
  return writeComponentJson(projectRootDir, componentDir, componentJson);
}
export async function renameInputFile(projectRootDir, ID, index, newName) {
  if (!isValidInputFilename(newName)) {
    return Promise.reject(new Error(`${newName} is not valid inputFile name`));
  }
  const componentDir = await getComponentDir(projectRootDir, ID, true);
  const componentJson = await readComponentJson(componentDir);
  if (index < 0 || componentJson.inputFiles.length - 1 < index) {
    return Promise.reject(new Error(`invalid index ${index}`));
  }
  const counterparts = new Set();
  const oldName = componentJson.inputFiles[index].name;
  componentJson.inputFiles[index].name = newName;
  componentJson.inputFiles[index].src.forEach((e)=>{
    counterparts.add(e.srcNode);
  });
  await writeComponentJson(projectRootDir, componentDir, componentJson);
  const p = [];
  for (const counterPartID of counterparts) {
    const counterpartDir = await getComponentDir(projectRootDir, counterPartID, true);
    const counterpartJson = await readComponentJson(counterpartDir);
    for (const outputFile of counterpartJson.outputFiles) {
      for (const dst of outputFile.dst) {
        if (dst.dstNode === ID && dst.dstName === oldName) {
          dst.dstName = newName;
        }
      }
    }
    if (Array.isArray(counterpartJson.inputFiles)) {
      for (const inputFile of counterpartJson.inputFiles) {
        if (Object.prototype.hasOwnProperty.call(inputFile, "forwardTo")) {
          for (const dst of inputFile.forwardTo) {
            if (dst.dstNode === ID && dst.dstName === oldName) {
              dst.dstName = newName;
            }
          }
        }
      }
    }
    p.push(writeComponentJson(projectRootDir, counterpartDir, counterpartJson));
  }
  return Promise.all(p);
}
export async function renameOutputFile(projectRootDir, ID, index, newName) {
  if (!isValidOutputFilename(newName)) {
    return Promise.reject(new Error(`${newName} is not valid outputFile name`));
  }
  const componentDir = await getComponentDir(projectRootDir, ID, true);
  const componentJson = await readComponentJson(componentDir);
  if (index < 0 || componentJson.outputFiles.length - 1 < index) {
    return Promise.reject(new Error(`invalid index ${index}`));
  }
  const counterparts = new Set();
  const oldName = componentJson.outputFiles[index].name;
  componentJson.outputFiles[index].name = newName;
  componentJson.outputFiles[index].dst.forEach((e)=>{
    counterparts.add(e.dstNode);
  });
  await writeComponentJson(projectRootDir, componentDir, componentJson);
  const promises = [];
  for (const counterPartID of counterparts) {
    const counterpartDir = await getComponentDir(projectRootDir, counterPartID, true);
    const counterpartJson = await readComponentJson(counterpartDir);
    for (const inputFile of counterpartJson.inputFiles) {
      for (const src of inputFile.src) {
        if (src.srcNode === ID && src.srcName === oldName) {
          src.srcName = newName;
        }
      }
    }
    if (Array.isArray(counterpartJson.outputFiles)) {
      for (const outputFile of counterpartJson.outputFiles) {
        if (Object.prototype.hasOwnProperty.call(outputFile, "origin")) {
          for (const src of outputFile.origin) {
            if (src.srcNode === ID && src.srcName === oldName) {
              src.srcName = newName;
            }
          }
        }
      }
    }
    promises.push(writeComponentJson(projectRootDir, counterpartDir, counterpartJson));
  }
  return Promise.all(promises);
}
export async function addLink(projectRootDir, src, dst, isElse = false) {
  if (src === dst) {
    return Promise.reject(new Error("cyclic link is not allowed"));
  }
  const srcDir = await getComponentDir(projectRootDir, src, true);
  const srcJson = await readComponentJson(srcDir);
  const dstDir = await getComponentDir(projectRootDir, dst, true);
  const dstJson = await readComponentJson(dstDir);
  for (const type of ["viewer", "source"]) {
    if (srcJson.type !== type && dstJson.type !== type) {
      continue;
    }
    const err = new Error(`${type} can not have link`);
    err.src = src;
    err.srcName = srcJson.name;
    err.dst = dst;
    err.dstName = dstJson.name;
    err.isElse = isElse;
    err.code = "ELINK";
    return Promise.reject(err);
  }
  if (isElse && !srcJson.else.includes(dst)) {
    srcJson.else.push(dst);
  } else if (!srcJson.next.includes(dst)) {
    srcJson.next.push(dst);
  }
  await writeComponentJson(projectRootDir, srcDir, srcJson);
  if (!dstJson.previous.includes(src)) {
    dstJson.previous.push(src);
  }
  await writeComponentJson(projectRootDir, dstDir, dstJson);
  if (srcJson.type === "stepjobTask" && dstJson.type === "stepjobTask") {
    await updateStepNumber(projectRootDir);
  }
}
export async function removeLink(projectRootDir, src, dst, isElse) {
  const srcDir = await getComponentDir(projectRootDir, src, true);
  const srcJson = await readComponentJson(srcDir);
  if (isElse) {
    srcJson.else = srcJson.else.filter((e)=>{
      return e !== dst;
    });
  } else {
    srcJson.next = srcJson.next.filter((e)=>{
      return e !== dst;
    });
  }
  await writeComponentJson(projectRootDir, srcDir, srcJson);
  const dstDir = await getComponentDir(projectRootDir, dst, true);
  const dstJson = await readComponentJson(dstDir);
  dstJson.previous = dstJson.previous.filter((e)=>{
    return e !== src;
  });
  await writeComponentJson(projectRootDir, dstDir, dstJson);
}
export async function removeAllLink(projectRootDir, componentID) {
  const dstDir = await getComponentDir(projectRootDir, componentID, true);
  const dstJson = await readComponentJson(dstDir);
  const srcComponents = dstJson.previous;
  const p = [];
  for (const src of srcComponents) {
    const srcDir = await getComponentDir(projectRootDir, src, true);
    const srcJson = await readComponentJson(srcDir);
    if (Array.isArray(srcJson.next)) {
      srcJson.next = srcJson.next.filter((e)=>{
        return e !== componentID;
      });
    }
    if (Array.isArray(srcJson.else)) {
      srcJson.else = srcJson.else.filter((e)=>{
        return e !== componentID;
      });
    }
    p.push(writeComponentJson(projectRootDir, srcDir, srcJson));
  }
  dstJson.previous = [];
  p.push(writeComponentJson(projectRootDir, dstDir, dstJson));
  return Promise.all(p);
}
export async function addFileLink(projectRootDir, srcNode, srcName, dstNode, dstName) {
  if (srcNode === dstNode) {
    return Promise.reject(new Error("cyclic link is not allowed"));
  }
  if (await isParent(projectRootDir, dstNode, srcNode)) {
    return addFileLinkToParent(projectRootDir, srcNode, srcName, dstName);
  }
  if (await isParent(projectRootDir, srcNode, dstNode)) {
    return addFileLinkFromParent(projectRootDir, srcName, dstNode, dstName);
  }
  return addFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName);
}
export async function removeFileLink(projectRootDir, srcNode, srcName, dstNode, dstName) {
  if (await isParent(projectRootDir, dstNode, srcNode)) {
    return removeFileLinkToParent(projectRootDir, srcNode, srcName, dstName);
  }
  if (await isParent(projectRootDir, srcNode, dstNode)) {
    return removeFileLinkFromParent(projectRootDir, srcName, dstNode, dstName);
  }
  return removeFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, dstNode, dstName);
}
export async function removeAllFileLink(projectRootDir, componentID, inputFilename, fromChildren) {
  const targetDir = await getComponentDir(projectRootDir, componentID, true);
  const componentJson = await readComponentJson(targetDir);
  const p = [];
  if (fromChildren) {
    const outputFile = componentJson.outputFiles.find((e)=>{
      return e.name === inputFilename;
    });
    if (!outputFile) {
      return new Error(`${inputFilename} not found in parent's outputFiles`);
    }
    if (!Array.isArray(outputFile.origin)) {
      return true;
    }
    for (const { srcNode, srcName } of outputFile.origin) {
      p.push(removeFileLinkToParent(projectRootDir, srcNode, srcName, inputFilename));
    }
  } else {
    const inputFile = componentJson.inputFiles.find((e)=>{
      return e.name === inputFilename;
    });
    if (!inputFile) {
      return new Error(`${inputFilename} not found in inputFiles`);
    }
    for (const { srcNode, srcName } of inputFile.src) {
      p.push(removeFileLinkBetweenSiblings(projectRootDir, srcNode, srcName, componentID, inputFilename));
    }
  }
  return Promise.all(p);
}
export async function removeComponent(projectRootDir, ID) {
  const targetDir = await getComponentDir(projectRootDir, ID, true);
  const descendantsIDs = await getDescendantsIDs(projectRootDir, ID);
  for (const descendantID of descendantsIDs) {
    await removeAllLinkFromComponent(projectRootDir, descendantID);
  }
  await gitRm(projectRootDir, targetDir);
  await fs.remove(targetDir);
  return removeComponentPath(projectRootDir, descendantsIDs);
}
export async function getSourceComponents(projectRootDir) {
  const componentJsonFiles = await glob(path.join(projectRootDir, "**", componentJsonFilename));
  const components = await Promise.all(componentJsonFiles
    .map((componentJsonFile)=>{
      return readJsonGreedy(componentJsonFile);
    }));
  return components.filter((componentJson)=>{
    return componentJson.type === "source" && !componentJson.subComponent && !componentJson.disable;
  });
}
export async function isComponentDir(target) {
  const stats = await fs.lstat(path.resolve(target));
  if (!stats.isDirectory()) {
    return false;
  }
  return fs.pathExists(path.resolve(target, componentJsonFilename));
}
export async function getComponentTree(projectRootDir, rootDir) {
  const projectJson = await readJsonGreedy(path.resolve(projectRootDir, projectJsonFilename));
  const start = path.isAbsolute(rootDir) ? path.relative(projectRootDir, rootDir) || "./" : rootDir;
  const componentJsonFileList = Object.values(projectJson.componentPath)
    .filter((dirname)=>{
      return isPathInside(dirname, start) || path.normalize(dirname) === path.normalize(start);
    })
    .map((dirname)=>{
      return path.join(dirname, componentJsonFilename);
    });
  const componentJsonList = await Promise.all(componentJsonFileList.map((target)=>{
    return readJsonGreedy(path.resolve(projectRootDir, target));
  }));
  const startStriped = start.endsWith("/") ? start.slice(0, -1) : start;
  const rootIndex = componentJsonFileList.findIndex((e)=>{
    return path.dirname(e) === startStriped;
  });
  if (rootIndex === -1) {
    throw Promise.reject(new Error("root component not found"));
  }
  const root = componentJsonList.splice(rootIndex, 1)[0];
  for (const target of componentJsonList) {
    const parentComponent = componentJsonList.find((e)=>{
      return e.ID === target.parent;
    }) || root;
    if (Array.isArray(parentComponent.children)) {
      parentComponent.children.push(target);
    } else {
      parentComponent.children = [target];
    }
  }
  return root;
}
export const getChildren = getChildrenFromUtil;

const _internal = {
  promisify,
  fs,
  path,
  isPathInside,
  glob,
  diff,
  diffApply,
  getComponentDir,
  writeComponentJson,
  writeComponentJsonByID,
  readComponentJson,
  readComponentJsonByID,
  componentFactory,
  getComponentDefaultName,
  hasChild,
  isLocalComponent,
  projectList,
  defaultCleanupRemoteRoot,
  projectJsonFilename,
  componentJsonFilename,
  jobManagerJsonFilename,
  suffix,
  remoteHost,
  defaultPSconfigFilename,
  getDateString,
  writeJsonWrapper,
  isValidName,
  isValidInputFilename,
  isValidOutputFilename,
  replacePathsep,
  convertPathSep,
  readJsonGreedy,
  gitInit,
  gitAdd,
  gitCommit,
  gitRm,
  getLogger: actualGetLogger,
  getSsh,
  isSurrounded,
  trimSurrounded,
  glob2Array,
  removeTrailingPathSep,
  getProjectJson,
  writeProjectJson,
  getDescendantsIDs,
  getAllComponentIDs,
  getSuffixNumberFromProjectName,
  getUnusedProjectDir,
  createNewProject,
  removeComponentPath,
  updateComponentPath,
  setProjectState,
  getComponentFullName,
  getProjectState,
  checkRunningJobs,
  rewriteIncludeExclude,
  rewriteAllIncludeExcludeProperty,
  readProject,
  setComponentStateR,
  updateProjectROStatus,
  updateProjectDescription,
  addProject,
  renameProject,
  isDefaultPort,
  isLocal,
  isSameRemoteHost,
  isParent,
  removeAllLinkFromComponent,
  addFileLinkToParent,
  addFileLinkFromParent,
  addFileLinkBetweenSiblings,
  removeFileLinkToParent,
  removeFileLinkFromParent,
  removeFileLinkBetweenSiblings,
  makeDir,
  checkRemoteStoragePathWritePermission,
  recursiveGetHosts,
  getHosts,
  createNewComponent,
  renameComponentDir,
  replaceEnv,
  replaceWebhook,
  getEnv,
  updateComponent,
  updateStepNumber,
  arrangeComponent,
  addInputFile,
  addOutputFile,
  setUploadOndemandOutputFile,
  removeInputFile,
  removeOutputFile,
  renameInputFile,
  renameOutputFile,
  addLink,
  removeLink,
  removeAllLink,
  addFileLink,
  removeFileLink,
  removeAllFileLink,
  removeComponent,
  getSourceComponents,
  isComponentDir,
  getComponentTree,
  getChildren: getChildrenFromUtil
};

let internal;
if (process.env.NODE_ENV === "test") {
  internal = _internal;
}
export { internal as _internal };