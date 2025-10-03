/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const fs = require("fs-extra");
const path = require("path");
const Ajv = require("ajv");
const { getLogger } = require("../logSettings.js");
const { hasChild, isInitialComponent, isLocalComponent } = require("./workflowComponent.js");
const { getComponentFullName } = require("./projectFilesOperator.js");
const { jobScheduler } = require("../db/db");
const { readComponentJson, getComponentDir } = require("./componentJsonIO.js");
const { readJsonGreedy, readJson } = require("./fileUtils");
const { getChildren } = require("./workflowUtil.js");
const { isValidInputFilename, isValidOutputFilename } = require("../lib/utility");
const { remoteHost } = require("../db/db.js");
const getSchema = require("../db/jsonSchemas.js");

const _internal = {
  fs,
  Ajv,
  getLogger,
  hasChild,
  isInitialComponent,
  isLocalComponent,
  getComponentFullName,
  jobScheduler,
  readComponentJson,
  getComponentDir,
  readJson,
  readJsonGreedy,
  getChildren,
  remoteHost,
  getSchema,
  validate: null
};

const logger = _internal.getLogger();
const ajv = new _internal.Ajv({
  allErrors: true,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
  logger: {
    log: logger.debug.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.warn.bind(logger)
  }
});
const schema = _internal.getSchema("psSettingFile");
_internal.validate = ajv.compile(schema);

/**
 * check if script property has valid value
 * @param {string} projectRootDir - project's root path
 * @param {object} component - component which will be tested
 */
async function checkScript(projectRootDir, component) {
  if (typeof component.script !== "string") {
    return Promise.reject(new Error("script is not specified"));
  }
  const componentDir = await _internal.getComponentDir(projectRootDir, component.ID, true);
  const filename = path.resolve(componentDir, component.script);

  let stat;
  try {
    stat = await _internal.fs.stat(filename);
  } catch (e) {
    if (e.code !== "ENOENT") {
      throw e;
    }
    return Promise.reject(new Error(`script is not existing file ${filename}`));
  }
  if (!stat.isFile()) {
    return Promise.reject(new Error(`script is not file ${filename}`));
  }
  return true;
}

/**
 * check if parameterFile property has valid value
 * @param {string} projectRootDir - project's root path
 * @param {object} component - component which will be tested
 */
async function checkPSSettingFile(projectRootDir, component) {
  if (typeof component.parameterFile !== "string") {
    return Promise.reject(new Error("parameter setting file is not specified"));
  }
  const componentDir = await _internal.getComponentDir(projectRootDir, component.ID, true);
  const filename = path.resolve(componentDir, component.parameterFile);
  let stat;
  try {
    stat = await _internal.fs.stat(filename);
  } catch (e) {
    if (e.code !== "ENOENT") {
      throw e;
    }
    return Promise.reject(new Error(`parameter setting file is not existing ${filename}`));
  }
  if (!stat.isFile()) {
    return Promise.reject(new Error(`parameter setting file is not file ${filename}`));
  }
  try {
    const PSSetting = await _internal.readJson(filename);
    _internal.validate(PSSetting);
  } catch (e) {
    if (e instanceof SyntaxError) {
      return Promise.reject(new Error(`parameter setting file is not JSON file ${filename}`));
    }
    throw e;
  }
  if (_internal.validate !== null && Array.isArray(_internal.validate.errors)) {
    const err = new Error("parameter setting file does not have valid JSON data");
    logger.debug(`validation error for ${component.name} (${component.ID}) :\n`, _internal.validate.errors);
    err.errors = _internal.validate.errors;
    return Promise.reject(err);
  }
  return true;
}

const validateParameterStudy = checkPSSettingFile;

/**
 * check if condition property has valid value
 * @param {string} projectRootDir - project's root path
 * @param {object} component - component which will be tested
 */
async function validateConditionalCheck(projectRootDir, component) {
  if (typeof component.condition !== "string") {
    return Promise.reject(new Error(`condition is not specified`));
  }
  const componentDir = await _internal.getComponentDir(projectRootDir, component.ID, true);
  let stat;
  try {
    const filename = path.resolve(componentDir, component.condition);
    stat = await _internal.fs.stat(filename);
  } catch (e) {
    if (e.code !== "ENOENT") {
      throw e;
    }
  }
  if (!stat.isFile()) {
    const filename = path.resolve(componentDir, component.condition);
    return Promise.reject(new Error(`condition is exist but it is not file ${filename}`));
  }
  //if the file which name is component.condition does not exists
  //component.condition will be eval as expression of javascript
  //so, we can not test the value any more here

  return true;
}

/**
 * check if task component has valid values
 * @param {string} projectRootDir - project's root path
 * @param {object} component - component which will be tested
 */
async function validateTask(projectRootDir, component) {
  if (component.name === null) {
    return Promise.reject(new Error(`illegal path`));
  }
  //if (typeof component.host === "string" && component.host !== "localhost") {
  if (!_internal.isLocalComponent(component)) {
    const hostinfo = _internal.remoteHost.query("name", component.host);
    if (typeof hostinfo === "undefined") {
      //local job is not implemented
      return Promise.reject(new Error(`remote host setting for ${component.host} not found`));
    }
    if (component.useJobScheduler) {
      if (!Object.keys(_internal.jobScheduler).includes(hostinfo.jobScheduler)) {
        return Promise.reject(new Error(`job scheduler for ${hostinfo.name} (${hostinfo.jobScheduler}) is not supported`));
      }
      if (component.submitOption) {
        const optList = String(_internal.jobScheduler[hostinfo.jobScheduler].queueOpt).split(" ");
        if (optList.map((opt)=>{
          return component.submitOption.indexOf(opt);
        }).every((i)=>{
          return i >= 0;
        })) {
          return Promise.reject(new Error(`submit option duplicate queue option : ${_internal.jobScheduler[hostinfo.jobScheduler].queueOpt}`));
        }
      }
    }
  }
  return checkScript(projectRootDir, component);
}

/**
 * check if stepjobTask component has valid values
 * @param {string} projectRootDir - project's root path
 * @param {object} component - component which will be tested
 */
async function validateStepjobTask(projectRootDir, component) {
  const isInitial = await _internal.isInitialComponent(projectRootDir, component);
  if (component.name === null) {
    return Promise.reject(new Error(`illegal path`));
  }
  if (component.useDependency && isInitial) {
    return Promise.reject(new Error("initial stepjobTask cannot specified the Dependency form"));
  }
  return checkScript(projectRootDir, component);
}

/**
 * check if stepjob component has valid values
 * @param {string} projectRootDir - project's root path
 * @param {object} component - component which will be tested
 */
async function validateStepjob(projectRootDir, component) {
  if (!component.useJobScheduler) {
    return Promise.reject(new Error(`useJobScheduler must be set`));
  }
  if (_internal.isLocalComponent(component)) {
    return Promise.reject(new Error("stepjob is only supported on remotehost"));
  }

  const hostinfo = _internal.remoteHost.query("name", component.host);
  if (typeof hostinfo === "undefined") {
    //local job is not implemented
    return Promise.reject(new Error(`remote host setting for ${component.host} not found`));
  }
  if (!Object.keys(_internal.jobScheduler).includes(hostinfo.jobScheduler)) {
    return Promise.reject(new Error(`job scheduler for ${hostinfo.name} (${hostinfo.jobScheduler}) is not supported`));
  }
  const setJobScheduler = _internal.jobScheduler[hostinfo.jobScheduler];
  if (!setJobScheduler.supportStepjob) {
    return Promise.reject(new Error(`job scheduler (${hostinfo.jobScheduler}) does not support stepjob`));
  }
  if (!hostinfo.useStepjob) {
    return Promise.reject(new Error(`${hostinfo.name} does not set to use stepjob`));
  }
  return true;
}

/**
 * check if bulkjobTask component has valid values
 * @param {string} projectRootDir - project's root path
 * @param {object} component - component which will be tested
 */
async function validateBulkjobTask(projectRootDir, component) {
  if (component.name === null) {
    return Promise.reject(new Error(`illegal path`));
  }
  if (!component.useJobScheduler) {
    return Promise.reject(new Error(`useJobScheduler must be set`));
  }
  if (_internal.isLocalComponent(component)) {
    return Promise.reject(new Error("bulkjobTask is only supported on remotehost"));
  }
  const hostinfo = _internal.remoteHost.query("name", component.host);
  if (typeof hostinfo === "undefined") {
    //local job is not implemented
    return Promise.reject(new Error(`remote host setting for ${component.host} not found`));
  }
  if (!Object.keys(_internal.jobScheduler).includes(hostinfo.jobScheduler)) {
    return Promise.reject(new Error(`job scheduler for ${hostinfo.name} (${hostinfo.jobScheduler}) is not supported`));
  }
  const setJobScheduler = _internal.jobScheduler[hostinfo.jobScheduler];
  if (!setJobScheduler.supportBulkjob) {
    return Promise.reject(new Error(`job scheduler (${hostinfo.jobScheduler}) does not support bulkjob`));
  }
  if (!hostinfo.useBulkjob) {
    return Promise.reject(new Error(`${hostinfo.name} does not set to use bulkjob`));
  }

  if (component.usePSSettingFile === true) {
    if (typeof component.parameterFile !== "string") {
      return Promise.reject(new Error(`usePSSettingFile is set but parameter setting file is not specified`));
    }
  } else {
    if (typeof component.startBulkNumber !== "number") {
      return Promise.reject(new Error(`startBulkNumber must be specified`));
    }
    if (!(Number.isInteger(component.startBulkNumber) && component.startBulkNumber >= 0)) {
      return Promise.reject(new Error(`startBulkNumber must be integer and 0 or more`));
    }

    if (typeof component.endBulkNumber !== "number") {
      return Promise.reject(new Error(`endBulkNumber must be specified`));
    }
    if (!(Number.isInteger(component.endBulkNumber) && component.endBulkNumber > component.startBulkNumber)) {
      return Promise.reject(new Error(`endBulkNumber must be integer and greater than startBulkNumber`));
    }
  }

  if (component.manualFinishCondition) {
    await validateConditionalCheck(projectRootDir, component);
  }
  return checkScript(projectRootDir, component);
}

/**
 * check if keep property has valid value
 * @param {object} component - component which will be tested
 */
async function validateKeepProp(component) {
  if (Object.prototype.hasOwnProperty.call(component, "keep")) {
    if (component.keep === null || component.keep === "") {
      return true;
    }
    if (!(Number.isInteger(component.keep) && component.keep >= 0)) {
      return Promise.reject(new Error(`keep must be positive integer`));
    }
  }
  return true;
}

/**
 * check if for component has valid values
 * @param {object} component - component which will be tested
 */
async function validateForLoop(component) {
  if (typeof component.start !== "number") {
    return Promise.reject(new Error(`start must be number`));
  }
  if (typeof component.step !== "number") {
    return Promise.reject(new Error(`step must be number`));
  }
  if (typeof component.end !== "number") {
    return Promise.reject(new Error(`end must be number`));
  }
  if (component.step === 0 || (component.end - component.start) * component.step < 0) {
    return Promise.reject(new Error(`infinite loop`));
  }
  return true;
}

/**
 * check if foreach component has valid values
 * @param {object} component - component which will be tested
 */
async function validateForeach(component) {
  if (!Array.isArray(component.indexList)) {
    return Promise.reject(new Error(`index list is broken`));
  }
  if (component.indexList.length <= 0) {
    return Promise.reject(new Error(`index list is empty`));
  }
  return true;
}

/**
 * check if storage component has valid values
 * @param {object} component - component which will be tested
 */
async function validateStorage(component) {
  if (typeof component.storagePath !== "string") {
    return Promise.reject(new Error("storagePath is not set"));
  }
  if (_internal.isLocalComponent(component)) {
    try {
      const stats = await _internal.fs.stat(component.storagePath);
      if (!stats.isDirectory()) {
        return Promise.reject(new Error("specified path is not directory"));
      }
    } catch (e) {
      if (e.code === "ENOENT") {
        return Promise.reject(new Error("specified path does not exist on localhost"));
      }
    }
  } else {
    const hostinfo = _internal.remoteHost.query("name", component.host);
    if (typeof hostinfo === "undefined") {
      //local job is not implemented
      return Promise.reject(new Error(`remote host setting for ${component.host} not found`));
    }
  }
  return true;
}

/**
 * validate inputFiles
 * @param {object} component - any component object which has inputFiles prop
 * @returns {true|Error} - inputFile is valid or not
 */
async function validateInputFiles(component) {
  for (const inputFile of component.inputFiles) {
    const filename = inputFile.name;
    if (!isValidInputFilename(filename)) {
      return Promise.reject(new Error(`'${filename}' is not allowed as input file.`));
    }
    if (inputFile.src.length > 1 && !(filename[filename.length - 1] === "/" || filename[filename.length - 1] === "\\")) {
      return Promise.reject(new Error(`inputFile '${inputFile.name}' data type is 'file' but it has two or more outputFiles.`));
    }
  }
  return true;
}

/**
 * validate outputFiles
 * @param {object} component - any component object which has putFiles prop
 * @returns {true|Error} - outputFile is valid or not
 */
async function validateOutputFiles(component) {
  for (const outputFile of component.outputFiles) {
    const filename = outputFile.name;
    if (!isValidOutputFilename(filename)) {
      return Promise.reject(new Error(`'${filename}' is not allowed as output filename.`));
    }
  }
  return true;
}

/**
 * validate component which can be run or not
 * @param {string} projectRootDir - project's root path
 * @param {object} component - target component
 * @returns {null|string} - return null if component is valid, or error messages
 *
 * please note, all functions which is called from validateComponent, must return Promise.reject
 * if validation error detected. Do NOT throw exception if error is not unexpected one.
 */
async function validateComponent(projectRootDir, component) {
  const errorMessages = [];

  if (component.type === "task") {
    await validateTask(projectRootDir, component)
      .catch((err)=>{ errorMessages.push(err.message); });
  } else if (component.type === "stepjobTask") {
    await validateStepjobTask(projectRootDir, component)
      .catch((err)=>{ errorMessages.push(err.message); });
  } else if (component.type === "stepjob") {
    await validateStepjob(projectRootDir, component)
      .catch((err)=>{ errorMessages.push(err.message); });
  } else if (component.type === "bulkjobTask") {
    await validateBulkjobTask(projectRootDir, component)
      .catch((err)=>{ errorMessages.push(err.message); });
  } else if (component.type === "if") {
    await validateConditionalCheck(projectRootDir, component)
      .catch((err)=>{ errorMessages.push(err.message); });
  } else if (component.type === "while") {
    await validateConditionalCheck(projectRootDir, component)
      .catch((err)=>{ errorMessages.push(err.message); });
    await validateKeepProp(component)
      .catch((err)=>{ errorMessages.push(err.message); });
  } else if (component.type === "for") {
    await validateForLoop(component)
      .catch((err)=>{ errorMessages.push(err.message); });
    await validateKeepProp(component)
      .catch((err)=>{ errorMessages.push(err.message); });
  } else if (component.type === "parameterStudy") {
    await validateParameterStudy(projectRootDir, component)
      .catch((err)=>{ errorMessages.push(err.message); });
  } else if (component.type === "foreach") {
    await validateForeach(component)
      .catch((err)=>{ errorMessages.push(err.message); });
    await validateKeepProp(component)
      .catch((err)=>{ errorMessages.push(err.message); });
  } else if (component.type === "storage") {
    await validateStorage(component)
      .catch((err)=>{ errorMessages.push(err.message); });
  }
  //additional test for input and output files
  if (Object.prototype.hasOwnProperty.call(component, "inputFiles")) {
    await validateInputFiles(component)
      .catch((err)=>{ errorMessages.push(err.message); });
  }
  if (Object.prototype.hasOwnProperty.call(component, "outputFiles")) {
    await validateOutputFiles(component)
      .catch((err)=>{ errorMessages.push(err.message); });
  }

  return errorMessages.length === 0 ? null : errorMessages.join("\n");
}

/**
 * extract node in cycle graph from search path aquired from getCycleGraph
 * @param {string[]} graphPath - array of component IDs in search path
 * @returns {string[]} - component IDs in cycle graph
 */
function getComponentIDsInCycle(graphPath) {
  if (graphPath.length === 0) {
    return [];
  }
  const lastID = graphPath.pop();
  const rt = [];
  for (let i = graphPath.length - 1; i >= 0; i--) {
    rt.push(graphPath[i]);
    if (graphPath[i] === lastID) {
      break;
    }
  }
  return rt;
}

/**
 * return dependent component
 * @param {object[]} components - sibling components
 * @param {object} component - target component
 * @returns {object[]} - components which depends on specified component
 */
function getNextComponents(components, component) {
  const nextComponentIDs = [];
  if (component.next) {
    nextComponentIDs.push(...component.next);
  }
  if (component.else) {
    nextComponentIDs.push(...component.else);
  }
  if (Array.isArray(component.outputFiles)) {
    component.outputFiles.forEach((outputFile)=>{
      const tmp = outputFile.dst.map((e)=>{
        if (Object.prototype.hasOwnProperty.call(e, "origin")) {
          return null;
        }
        if (e.dstNode !== component.parent) {
          return e.dstNode;
        }
        return null;
      }).filter((e)=>{
        return e !== null;
      });
      nextComponentIDs.push(...tmp);
    });
  }
  const removeDuplicated = Array.from(new Set(nextComponentIDs));
  const nextComponents = components.filter((component)=>{
    return removeDuplicated.includes(component.ID);
  });
  return nextComponents;
}
_internal.getNextComponents = getNextComponents;

/**
 * DFS to detect cycle
 * @param {string} projectRootDir - project's root path
 * @param {object[]} components - array of components
 * @param {object} startComponent - start point of traverse
 * @param {object} results - cycle graph detection result
 * @param {object} cyclePath - graph traverse path
 * @returns {boolean} - found circuler path or not
 */
function isCycleGraph(projectRootDir, components, startComponent, results, cyclePath) {
  const nextComponents = _internal.getNextComponents(components, startComponent);
  results[startComponent.ID] = "gray";
  cyclePath.push(startComponent.ID);
  if (nextComponents === null) {
    results[startComponent.ID] = "black";
    return false;
  }
  for (const component of nextComponents) {
    if (results[component.ID] === "black") {
      continue;
    }
    if (results[component.ID] === "gray") {
      cyclePath.push(component.ID);
      _internal.getLogger(projectRootDir).debug("cycle graph found!!", component.name, cyclePath);
      return true;
    }
    const found = isCycleGraph(projectRootDir, components, component, results, cyclePath);
    if (found) {
      return true;
    }
  }
  results[startComponent.ID] = "black";
  cyclePath.pop();
  return false;
}

/**
 * get components which are in circuler sub graph
 * @param {string} projectRootDir - project's root path
 * @param {object[]} components - array of components
 * @returns {object[]} - components which are in cierculer sub graph
 */
function getCycleGraph(projectRootDir, components) {
  const results = {};
  components.forEach((e)=>{
    results[e.ID] = "white";
  });
  const cycleComponentIDs = [];

  for (const component of components) {
    const cyclePath = [];
    if (results[component.ID] === "white") {
      isCycleGraph(projectRootDir, components, component, results, cyclePath);
    }
    cycleComponentIDs.push(...getComponentIDsInCycle(cyclePath));
  }

  return cycleComponentIDs;
}

/**
 * check specified component's children has circuler dependency or not
 * @param {string} projectRootDir - project's root path
 * @param {object} parentComponentID - target component's ID
 * @returns {object[]} - array of components in cycle graph
 */
async function checkComponentDependency(projectRootDir, parentComponentID) {
  const children = await _internal.getChildren(projectRootDir, parentComponentID);
  const rt = getCycleGraph(projectRootDir, children);
  if (rt.length > 0) {
    const cycleComponents = await Promise.all(rt.map(_internal.getComponentFullName.bind(null, projectRootDir)));
    _internal.getLogger(projectRootDir).debug("cycle graph found \n", cycleComponents);
  }
  return rt;
}

/**
 * validate components under specified component
 * @param {string} projectRootDir - project's root path
 * @param {string} parentID - parent component's ID string
 * @param {object[]} report - to be stored invalid component IDs
 * @returns {string []} - array of invalid component's ID
 */
async function recursiveValidateComponents(projectRootDir, parentID, report) {
  const children = await _internal.getChildren(projectRootDir, parentID);
  if (children.length === 0) {
    return;
  }
  const promises = [];
  for (const component of children) {
    if (component.disable) {
      continue;
    }
    const error = await validateComponent(projectRootDir, component);
    if (error !== null) {
      const name = await _internal.getComponentFullName(projectRootDir, component.ID);
      report.push({ ID: component.ID, name, error });
    }
    if (_internal.hasChild(component)) {
      promises.push(recursiveValidateComponents(projectRootDir, component.ID, report));
    }
  }

  let hasInitialNode = false;
  for (const component of children) {
    const rt = await _internal.isInitialComponent(projectRootDir, component);
    if (rt) {
      hasInitialNode = true;
      break;
    }
  }

  if (!hasInitialNode) {
    const name = await _internal.getComponentFullName(projectRootDir, parentID);
    report.push({ ID: parentID, name, error: "no initial component in children" });
  }
  const invalidComponentIDs = await checkComponentDependency(projectRootDir, parentID);

  if (invalidComponentIDs.length > 0) {
    const tmp = await Promise.all(
      invalidComponentIDs.map(async (ID)=>{
        const name = await _internal.getComponentFullName(projectRootDir, ID);
        return { ID, name, error: "cycle graph detected" };
      })
    );
    report.push(...tmp);
  }

  return Promise.all(promises);
}

/**
 * validate components under start component
 * @param {string} projectRootDir - project's root path
 * @param {string} startComponentID - ID of start component for recursive search point
 * @returns {object[]} - invalid component's ID, name and error message
 */
async function validateComponents(projectRootDir, startComponentID) {
  let parentID;
  if (typeof startComponentID !== "string") {
    const rootWF = await _internal.readComponentJson(projectRootDir);
    parentID = rootWF.ID;
  } else {
    parentID = startComponentID;
  }

  const report = [];
  await recursiveValidateComponents(projectRootDir, parentID, report);
  if (report.length > 0) {
    _internal.getLogger(projectRootDir).info("validation error detected\n", report);
  }
  return report;
}

module.exports = {
  validateComponents,
  checkScript,
  checkPSSettingFile,
  validateParameterStudy,
  validateConditionalCheck,
  validateTask,
  validateStepjobTask,
  validateStepjob,
  validateBulkjobTask,
  validateKeepProp,
  validateForLoop,
  validateForeach,
  validateStorage,
  validateInputFiles,
  validateOutputFiles,
  validateComponent,
  getComponentIDsInCycle,
  getNextComponents,
  isCycleGraph,
  getCycleGraph,
  checkComponentDependency,
  recursiveValidateComponents
};

if (process.env.NODE_ENV === "test") {
  module.exports._internal = _internal;
}
