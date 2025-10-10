/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License.txt in the project root for the license information.
 */
"use strict";
import { exec } from "child_process";
import { getLogger } from "../logSettings.js";

const commands = ["ssh", "rsync", "git", "git-lfs", "tar", "gzip"];

/**
 * check if specified command is executable
 * @param {string} command - command name which will be checked
 * @returns {Promise} -
 */
function checkCommand(command) {
  return new Promise((resolve)=>{
    exec(`command -v ${command}`, (err)=>{
      if (err) {
        resolve(false);
      }
      resolve(true);
    });
  });
}

/**
 * check if all commands in commands array are available
 * @returns {boolean} - true if all commands are available
 */
async function checkAllCommands() {
  const logger = getLogger();
  const results = await Promise.all(commands.map((cmd)=>{
    return checkCommand(cmd);
  }));
  const failedCommands = commands.filter((cmd, i)=>{
    return !results[i];
  });

  if (failedCommands.length > 0) {
    const errorMsg = `following command(s) not found or not executable:\n- ${failedCommands.join("\n- ")}`;
    logger.error(errorMsg);
    return false;
  }
  logger.info("all commands are available");
  return true;
}

export default checkAllCommands;

let _internal;

if (process.env.NODE_ENV === "test") {
  _internal = {
    commands,
    checkAllCommands
  };
}

export { _internal };
