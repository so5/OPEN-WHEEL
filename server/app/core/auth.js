/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const { Database } = require("sqlite3");
const { open } = require("sqlite");
const { getLogger } = require("../logSettings");

let db;
let initialized = false;

const _internal = {

  /**
   * create hashed password from plain password and salt
   * @param {string} password - plain text password
   * @param {string} salt - salt string
   * @returns {string} - hashed password
   */
  async getHashedPassword(password, salt) {
    return promisify(crypto.pbkdf2)(password, salt, 210000, 32, "sha512");
  },

  /**
   * get single user data from DB
   * @param {string} username - username to be queried
   * @returns {object} - userdata which inclueds id, username, hashed_passowrd, salt
   */
  async getUserData(username) {
    const row = await db.get("SELECT * FROM users WHERE username = ?", username);
    if (!row) {
      return null;
    }
    return username === row.username ? row : null;
  },
  crypto,
  open,
  Database,
  logger: getLogger(),
  userDBFilename: "user.db",
  userDBDir: ""
};

const toExport = {};

/**
 * open database and create table if not exists
 */
toExport.initialize = async function initialize() {
  if (process.env.NODE_ENV !== "test") {
    const { userDBFilename, userDBDir } = require("../db/db.js");
    _internal.userDBFilename = userDBFilename;
    _internal.userDBDir = userDBDir;
  }
  //open the database
  db = await _internal.open({
    filename: path.resolve(_internal.userDBDir, _internal.userDBFilename),
    driver: _internal.Database
  });
  await db.exec("CREATE TABLE IF NOT EXISTS users ( \
    id INT PRIMARY KEY, \
    username TEXT UNIQUE, \
    hashed_password BLOB, \
    salt BLOB \
  )");
  initialized = true;
  return db;
};

/**
 * add new user
 * @param {string} username - new user's name
 * @param {string} password - new user's password
 */
toExport.addUser = async function addUser(username, password) {
  if (!initialized) {
    await toExport.initialize();
  }
  if (await _internal.getUserData(username) !== null) {
    const err = new Error("user already exists");
    err.username = username;
    throw err;
  }
  const id = _internal.crypto.randomUUID();
  const salt = _internal.crypto.randomBytes(16);
  const hashedPassword = await _internal.getHashedPassword(password, salt);
  await db.run("INSERT OR IGNORE INTO users (id, username, hashed_password, salt) VALUES (?, ?, ?, ?)", id, username, hashedPassword, salt);
};

/**
 * check if specified user and password pair is valid
 * @param {string} username - user's name
 * @param {string} password - user's password in plain text
 * @returns {boolean | object} - return user data if valid pair, or false if invalid
 */
toExport.isValidUser = async function isValidUser(username, password) {
  if (!initialized) {
    await toExport.initialize();
  }
  //check valid user
  const row = await _internal.getUserData(username);
  if (row === null) {
    _internal.logger.trace(`user: ${username} not found`);
    return false;
  }
  const hashedPassword = await _internal.getHashedPassword(password, row.salt);

  //password verification
  if (!_internal.crypto.timingSafeEqual(row.hashed_password, hashedPassword)) {
    _internal.logger.trace("wrong password");
    return false;
  }
  return row;
};

/**
 * list all user in DB
 * @returns {string[]} - array of usernames
 */
toExport.listUser = async function listUser() {
  if (!initialized) {
    await toExport.initialize();
  }
  const tmp = await db.all("SELECT username FROM users");
  return tmp.map((e)=>{
    return e.username;
  });
};

/**
 * delete user from DB
 * @param {string} username - user's name
 * @returns {boolean} - false if user does not exist in DB
 */
toExport.delUser = async function delUser(username) {
  if (!initialized) {
    await toExport.initialize();
  }
  return db.run(`DELETE FROM users WHERE username = '${username}'`);
};

if (process.env.NODE_ENV === "test") {
  toExport._internal = _internal;
  toExport._internal.getDB = ()=>{
    return db;
  };
  toExport._internal.setDB = (newDB)=>{
    db = newDB;
  };
  toExport._internal.isInitialized = ()=>{
    return initialized;
  };
  toExport._internal.setInitialized = (newInitialized)=>{
    initialized = newInitialized;
  };
}

module.exports = toExport;
