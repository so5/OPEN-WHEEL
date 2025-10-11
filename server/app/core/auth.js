"use strict";
import path from "path";
import crypto from "crypto";
import { promisify } from "util";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { userDBFilename, userDBDir } from "../db/db.js";
import { getLogger } from "../logSettings.js";

const { Database } = sqlite3;

const _internal = {
  crypto,
  open,
  path,
  promisify,
  Database,
  userDBFilename,
  userDBDir,
  logger: getLogger(),
  db: null,
  initialized: false
};

/**
 * create hashed password from plain password and salt
 * @param {string} password - plain text password
 * @param {string} salt - salt string
 * @returns {string} - hashed password
 */
_internal.getHashedPassword = async function (password, salt) {
  return _internal.promisify(_internal.crypto.pbkdf2)(password, salt, 210000, 32, "sha512");
};

_internal.getUserData = async function (username) {
  const row = await _internal.db.get("SELECT * FROM users WHERE username = ?", username);
  if (!row) {
    return null;
  }
  return username === row.username ? row : null;
};

/**
 * open database and create table if not exists
 */
export async function initialize() {
  _internal.db = await _internal.open({
    filename: _internal.path.resolve(_internal.userDBDir, _internal.userDBFilename),
    driver: _internal.Database
  });
  await _internal.db.exec("CREATE TABLE IF NOT EXISTS users (     id INT PRIMARY KEY,     username TEXT UNIQUE,     hashed_password BLOB,     salt BLOB   )");
  _internal.initialized = true;
  return _internal.db;
}
_internal.initialize = initialize;

/**
 * add new user
 * @param {string} username - new user's name
 * @param {string} password - new user's password
 */
export async function addUser(username, password) {
  if (!_internal.initialized) {
    await _internal.initialize();
  }
  if (await _internal.getUserData(username) !== null) {
    const err = new Error("user already exists");
    err.username = username;
    throw err;
  }
  const id = _internal.crypto.randomUUID();
  const salt = _internal.crypto.randomBytes(16);
  const hashedPassword = await _internal.getHashedPassword(password, salt);
  await _internal.db.run("INSERT OR IGNORE INTO users (id, username, hashed_password, salt) VALUES (?, ?, ?, ?)", id, username, hashedPassword, salt);
}
_internal.addUser = addUser;

/**
 * check if specified user and password pair is valid
 * @param {string} username - user's name
 * @param {string} password - user's password in plain text
 * @returns {boolean | object} - return user data if valid pair, or false if invalid
 */
export async function isValidUser(username, password) {
  if (!_internal.initialized) {
    await _internal.initialize();
  }
  const row = await _internal.getUserData(username);
  if (row === null) {
    _internal.logger.trace(`user: ${username} not found`);
    return false;
  }
  const hashedPassword = await _internal.getHashedPassword(password, row.salt);

  if (!_internal.crypto.timingSafeEqual(row.hashed_password, hashedPassword)) {
    _internal.logger.trace("wrong password");
    return false;
  }
  return row;
}
_internal.isValidUser = isValidUser;

export async function listUser() {
  if (!_internal.initialized) {
    await _internal.initialize();
  }
  const tmp = await _internal.db.all("SELECT username FROM users");
  return tmp.map((e)=>{
    return e.username;
  });
}
_internal.listUser = listUser;

export async function delUser(username) {
  if (!_internal.initialized) {
    await _internal.initialize();
  }
  return _internal.db.run(`DELETE FROM users WHERE username = '${username}'`);
}
_internal.delUser = delUser;

export const getHashedPassword = _internal.getHashedPassword;
export const getUserData = _internal.getUserData;

let _internalTest;
if (process.env.NODE_ENV === "test") {
  _internalTest = _internal;
}
export { _internalTest as _internal };
