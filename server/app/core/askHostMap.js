/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { emitAll } = require("../handlers/commUtils.js");
const { remoteHost } = require("../db/db.js");
const { getLogger } = require("../logSettings");

const _internal = {
  emitAll,
  remoteHost,
  getLogger
};

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

/**
 * ask how to map host settings to user
 * @param {string} clientID - socket's ID
 * @param {string[]} hosts - array of remotehost label
 * @returns {Promise} - resolve with hostMap. reject if user cancelled
 */
async function askHostMap(clientID, hosts) {
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

module.exports = {
  askHostMap,
  isValidHostMap: _internal.isValidHostMap
};

if (process.env.NODE_ENV === "test") {
  module.exports._internal = _internal;
}