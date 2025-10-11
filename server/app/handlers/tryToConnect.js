/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import SshClientWrapper from "ssh-client-wrapper";
import { getLogger } from "../logSettings.js";
import { remoteHost } from "../db/db.js";
import { askPassword } from "../core/sshManager.js";

const logger = getLogger();

/**
 * try to connect remote host via ssh
 * @param {string} clientID - socketIO client's ID string
 * @param {object} hostInfo - target host's information
 * @param {Function} cb - call back function called with string "success" or "error"
 */
export async function onTryToConnect(clientID, hostInfo, cb) {
  hostInfo.password = askPassword.bind(null, clientID, hostInfo.name, "password", null);
  hostInfo.passphrase = askPassword.bind(null, clientID, hostInfo.name, "passphrase", null);
  if (process.env.WHEEL_VERBOSE_SSH) {
    hostInfo.sshOpt = ["-vvv"];
  }
  const ssh = new SshClientWrapper(hostInfo);
  logger.debug(`try to connect ${hostInfo.user}@${hostInfo.host}:${hostInfo.port}`);

  try {
    await ssh.canConnect(120);
  } catch (err) {
    if (err.reason === "CANCELED") {
      logger.info("tryToConnect canceled by user");
      return cb("canceled");
    }
    logger.error("tryToConnect failed with", err);
    return cb(err);
  }
  ssh.disconnect();
  return cb("success");
}
export async function onTryToConnectById(clientID, id, cb) {
  const hostInfo = remoteHost.get(id);
  await onTryToConnect(clientID, hostInfo, cb);
}
