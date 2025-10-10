/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { emitAll } from "../handlers/commUtils.js";

/**
 * ask user to fix project and component state
 * @param {string} clientID - socket's ID
 * @param {object[]} targets - array of metadata file to be fixed
 */
export async function askRewindState(clientID, targets) {
  return new Promise((resolve, reject)=>{
    emitAll(clientID, "askRewindState", targets, (answer)=>{
      if (answer === null) {
        const err = new Error("user canceled rewrite state");
        err.reason = "CANCELED";
        reject(err);
      }
      resolve();
    });
  });
}