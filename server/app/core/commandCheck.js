/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import { exec } from "child_process";
import { getLogger } from "../logSettings.js";

const logger = getLogger();
const commands = ["ssh", "rsync", "git", "git-lfs", "tar", "gzip"];

async function checkCommand(command) {
  return new Promise((resolve)=>{
    exec(`command -v ${command}`, (err)=>{
      if (err) {
        logger.error(`${command} is not available`);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function checkAllCommands() {
  const results = await Promise.all(
    commands.map((command)=>{
      return checkCommand(command);
    })
  );
  return results.every((result)=>result);
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