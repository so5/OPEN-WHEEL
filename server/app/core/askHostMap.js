/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import { emitAll } from "../handlers/commUtils.js";
import { remoteHost } from "../db/db.js";
import { getLogger } from "../logSettings.js";

const _internal = {
  emitAll,
  remoteHost,
  getLogger
};

/**
 * determine hostMap is valid
 * @param {object} hostMap - old and new remotehost label map
 * @param {string[]} hosts - array of old remoteshot labels
 * @returns {boolean} -
 */
_internal.isValidHostMap = (hostMap, hosts)=>{
  const remotehostLabels = _internal.remoteHost.getAll().map((host)=>{
    return host.name;
  });
  remotehostLabels.push("localhost");
  const oldRemotehostLabels = hosts.map((host)=>{
    return host.hostname;
  });
  return Object.entries(hostMap).some(([oldHost, newHost])=>{
    if (typeof newHost !== "string") {
      _internal.getLogger().error("newHost must be string", newHost);
      return false;
    }
    if (!oldRemotehostLabels.includes(oldHost)) {
      _internal.getLogger().error("invaild oldHost", oldHost);
      return false;
    }
    if (!remotehostLabels.includes(newHost)) {
      _internal.getLogger().error("invaild newHost", newHost);
      return false;
    }
    return true;
  });
};

export const isValidHostMap = _internal.isValidHostMap;

/**
 * ask how to map host settings to user
 * @param {string} clientID - socket's ID
 * @param {string[]} hosts - array of remotehost label
 * @returns {Promise} - resolve with hostMap. reject if user cancelled
 */
export async function askHostMap(clientID, hosts) {
  return new Promise((resolve, reject)=>{
    _internal.emitAll(clientID, "askHostMap", hosts, (hostMap)=>{
      if (hostMap === null) {
        const err = new Error("user canceled host map input");
        err.reason = "CANCELED";
        reject(err);
        return;
      }
      if (!_internal.isValidHostMap(hostMap, hosts)) {
        const err = new Error("invalid host map");
        err.reason = "INVALID";
        reject(err);
        return;
      }
      //hostMap is flat object. which keys are old host label, value is new host label
      resolve(hostMap);
    });
  });
}

let _internalTest;
if (process.env.NODE_ENV === "test") {
  _internalTest = _internal;
}
export { _internalTest as _internal };
