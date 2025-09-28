"use strict";
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const { Database } = require("sqlite3");
const { open } = require("sqlite");
const { userDBFilename, userDBDir } = require("../db/db.js");
const { getLogger } = require("../logSettings");

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

_internal.getHashedPassword = async function(password, salt) {
  return _internal.promisify(_internal.crypto.pbkdf2)(password, salt, 210000, 32, "sha512");
};

_internal.getUserData = async function(username) {
  const row = await _internal.db.get("SELECT * FROM users WHERE username = ?", username);
  if (!row) {
    return null;
  }
  return username === row.username ? row : null;
};

_internal.initialize = async function() {
  _internal.db = await _internal.open({
    filename: _internal.path.resolve(_internal.userDBDir, _internal.userDBFilename),
    driver: _internal.Database
  });
  await _internal.db.exec("CREATE TABLE IF NOT EXISTS users ( \
    id INT PRIMARY KEY, \
    username TEXT UNIQUE, \
    hashed_password BLOB, \
    salt BLOB \
  )");
  _internal.initialized = true;
  return _internal.db;
};

async function addUser(username, password) {
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

async function isValidUser(username, password) {
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

async function listUser() {
  if (!_internal.initialized) {
    await _internal.initialize();
  }
  const tmp = await _internal.db.all("SELECT username FROM users");
  return tmp.map((e)=>{
    return e.username;
  });
}

async function delUser(username) {
  if (!_internal.initialized) {
    await _internal.initialize();
  }
  return _internal.db.run(`DELETE FROM users WHERE username = '${username}'`);
}

module.exports = {
  initialize: _internal.initialize,
  addUser,
  isValidUser,
  listUser,
  delUser,
  getHashedPassword: _internal.getHashedPassword,
  getUserData: _internal.getUserData,
  _internal
};