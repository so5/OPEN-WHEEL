/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import Debug from "debug";
const debug = Debug("wheel");
export const baseURL = process.env.WHEEL_BASE_URL || "/";
export const parentDirs = new Map(); //workflow path which is displayed on graphview
export const eventEmitters = new Map(); //event emitter object which is used to communicate while running project
export const watchers = new Map(); //result file watcher
export const checkWritePermissions = new Map(); //remotehosts to be checked whthere user has write permission or not
let sio = null; //Singleton SocketIO instance

/**
 * store SocketIO instance
 * @param {object} io - SocketIO instance
 */
export function setSio(io) {
  if (sio !== null) {
    debug("SocketIO instance duplicated!!");
  }
  sio = io;
}

/**
 * get SocketIO instance
 * @returns {object} - stored SocketIO instance or null if not yet stored
 */
export function getSio() {
  return sio;
}
