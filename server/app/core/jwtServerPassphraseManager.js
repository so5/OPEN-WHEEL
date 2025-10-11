/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { getSsh, getSshHostinfo } from "./sshManager.js";
import { emitAll } from "../handlers/commUtils.js";

const _internal = {
  getSsh,
  getSshHostinfo,
  emitAll,
  passphrase: new Map()
};

_internal.askPassphrase = (clientID, JWTServerURL)=>{
  return new Promise((resolve, reject)=>{
    _internal.emitAll(clientID, "askPassword", JWTServerURL, "passphrase", JWTServerURL, (data)=>{
      if (data === null) {
        reject(new Error("user canceled passphrase prompt"));
      }
      resolve(data);
    });
  });
};

export async function getJWTServerPassphrase(projectRootDir, hostID, clientID) {
  const hostinfo = _internal.getSshHostinfo(projectRootDir, hostID);
  const { JWTServerURL } = hostinfo;
  if (!JWTServerURL) {
    throw new Error("JWT server is not available for this host");
  }

  if (_internal.passphrase.has(JWTServerURL)) {
    return _internal.passphrase.get(JWTServerURL);
  }
  const passphrase = await _internal.askPassphrase(clientID, JWTServerURL);
  _internal.passphrase.set(JWTServerURL, passphrase);
  return passphrase;
}
export function clearPassphrase(url) {
  if (url) {
    _internal.passphrase.delete(url);
  } else {
    _internal.passphrase.clear();
  }
}

let internal;
if (process.env.NODE_ENV === "test") {
  internal = _internal;
}
export { internal as _internal };
