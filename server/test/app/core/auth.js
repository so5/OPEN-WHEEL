/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";

//testee
import {
  initialize,
  getHashedPassword,
  addUser,
  getUserData,
  isValidUser,
  listUser,
  delUser,
  _internal
} from "../../../app/core/auth.js";

describe("#initialize", ()=>{
  let dbMock;
  let openStub;
  beforeEach(()=>{
    dbMock = {
      exec: sinon.stub().resolves()
    };
    openStub = sinon.stub(_internal, "open").resolves(dbMock);
    sinon.replace(_internal, "initialized", false);
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should open the database, create the table, set initialized to true, and return db", async ()=>{
    const result = await initialize();
    expect(openStub.calledOnce).to.be.true;
    expect(dbMock.exec.calledWith(
      "CREATE TABLE IF NOT EXISTS users (     id INT PRIMARY KEY,     username TEXT UNIQUE,     hashed_password BLOB,     salt BLOB   )"
    )).to.be.true;
    expect(_internal.initialized).to.be.true;
    expect(result).to.equal(dbMock);
  });
});

describe("#getHashedPassword", ()=>{
  let pbkdf2Stub;
  beforeEach(()=>{
    pbkdf2Stub = sinon.stub(_internal.crypto, "pbkdf2");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return a Buffer with hashed password if pbkdf2 succeeds", async ()=>{
    pbkdf2Stub.yields(null, Buffer.from("fake hashed password"));
    const password = "testPassword";
    const salt = "testSalt";
    const result = await getHashedPassword(password, salt);
    expect(pbkdf2Stub.calledOnce).to.be.true;
    expect(result).to.be.instanceOf(Buffer);
    expect(result.toString()).to.equal("fake hashed password");
  });

  it("should throw an error if pbkdf2 fails", async ()=>{
    pbkdf2Stub.yields(new Error("pbkdf2 error"));
    const password = "testPassword";
    const salt = "testSalt";
    try {
      await getHashedPassword(password, salt);
      expect.fail("Expected getHashedPassword to throw an error, but it did not");
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal("pbkdf2 error");
    }
  });
});

describe("#addUser", ()=>{
  let initializeStub;
  let getUserDataStub;
  let randomUUIDStub;
  let randomBytesStub;
  let getHashedPasswordStub;
  let dbRunMock;

  beforeEach(()=>{
    initializeStub = sinon.stub(_internal, "initialize");
    getUserDataStub = sinon.stub(_internal, "getUserData");
    randomUUIDStub = sinon.stub(_internal.crypto, "randomUUID");
    randomBytesStub = sinon.stub(_internal.crypto, "randomBytes");
    getHashedPasswordStub = sinon.stub(_internal, "getHashedPassword");
    dbRunMock = sinon.stub();

    sinon.replace(_internal, "db", { run: dbRunMock });
  });

  afterEach(()=>{
    sinon.restore();
    _internal.db = null;
  });

  it("should initialize if not initialized, then insert user if the user does not exist", async ()=>{
    initializeStub.resolves();
    getUserDataStub.resolves(null);
    randomUUIDStub.returns("unique-id-123");
    randomBytesStub.returns(Buffer.from("salt123"));
    getHashedPasswordStub.resolves(Buffer.from("hashed123"));
    dbRunMock.resolves();
    await addUser("john", "secret");
    expect(initializeStub.calledOnce).to.be.true;
    expect(getUserDataStub.calledOnceWithExactly("john")).to.be.true;
    expect(randomUUIDStub.calledOnce).to.be.true;
    expect(randomBytesStub.calledOnceWithExactly(16)).to.be.true;
    expect(getHashedPasswordStub.calledOnceWithExactly("secret", Buffer.from("salt123"))).to.be.true;
    expect(dbRunMock.calledOnce).to.be.true;
    const [sql, id, username, hashedPw, salt] = dbRunMock.firstCall.args;
    expect(sql).to.include("INSERT OR IGNORE INTO users");
    expect(id).to.equal("unique-id-123");
    expect(username).to.equal("john");
    expect(hashedPw).to.deep.equal(Buffer.from("hashed123"));
    expect(salt).to.deep.equal(Buffer.from("salt123"));
  });

  it("should skip initialize if already initialized is true and user does not exist", async ()=>{
    sinon.replace(_internal, "initialized", true);
    initializeStub.resolves();
    getUserDataStub.resolves(null);
    randomUUIDStub.returns("unique-id-abc");
    randomBytesStub.returns(Buffer.from("saltABC"));
    getHashedPasswordStub.resolves(Buffer.from("hashedABC"));
    dbRunMock.resolves();
    await addUser("alice", "mypassword");
    expect(initializeStub.notCalled).to.be.true;
    expect(getUserDataStub.calledOnceWithExactly("alice")).to.be.true;
    expect(randomUUIDStub.calledOnce).to.be.true;
    expect(randomBytesStub.calledOnce).to.be.true;
    expect(getHashedPasswordStub.calledOnce).to.be.true;
    expect(dbRunMock.calledOnce).to.be.true;
  });

  it("should throw an error if user already exists", async ()=>{
    initializeStub.resolves();
    getUserDataStub.resolves({ username: "bob" });

    try {
      await addUser("bob", "secret2");
      expect.fail("Expected addUser to throw an error, but it did not");
    } catch (err) {
      expect(err.message).to.equal("user already exists");
      expect(err).to.have.property("username", "bob");
    }
    expect(initializeStub.calledOnce).to.be.true;
    expect(dbRunMock.notCalled).to.be.true;
  });
});

describe("#getUserData", ()=>{
  let dbMock;
  beforeEach(()=>{
    dbMock = {
      get: sinon.stub()
    };
    sinon.replace(_internal, "db", dbMock);
  });
  afterEach(()=>{
    sinon.restore();
    _internal.db = null;
  });

  it("should return null if user does not exist in DB", async ()=>{
    dbMock.get.resolves(undefined);
    const result = await getUserData("nonexistentUser");
    expect(result).to.be.null;
    expect(dbMock.get.calledOnceWithExactly(
      "SELECT * FROM users WHERE username = ?",
      "nonexistentUser"
    )).to.be.true;
  });

  it("should return null if DB row exists but row.username does not match", async ()=>{
    dbMock.get.resolves({
      username: "anotherUser",
      hashed_password: Buffer.from("someHash"),
      salt: Buffer.from("someSalt"),
      id: "userID999"
    });
    const result = await getUserData("testUser");
    expect(result).to.be.null;
  });

  it("should return the row if DB row exists and row.username matches", async ()=>{
    const fakeRow = {
      username: "testUser",
      hashed_password: Buffer.from("someHash"),
      salt: Buffer.from("someSalt"),
      id: "userID123"
    };
    dbMock.get.resolves(fakeRow);
    const result = await getUserData("testUser");
    expect(result).to.deep.equal(fakeRow);
  });
});

describe("#isValidUser", ()=>{
  let initializeStub;
  let getUserDataStub;
  let getHashedPasswordStub;
  let loggerTraceStub;
  let timingSafeEqualStub;

  beforeEach(()=>{
    initializeStub = sinon.stub(_internal, "initialize");
    getUserDataStub = sinon.stub(_internal, "getUserData");
    getHashedPasswordStub = sinon.stub(_internal, "getHashedPassword");
    loggerTraceStub = sinon.stub(_internal.logger, "trace");
    timingSafeEqualStub = sinon.stub(_internal.crypto, "timingSafeEqual");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should call initialize if not initialized", async ()=>{
    getUserDataStub.resolves(null);
    const result = await isValidUser("testUser", "testPassword");
    expect(initializeStub.calledOnce).to.be.true;
    expect(result).to.be.false;
    expect(loggerTraceStub.calledWith("user: testUser not found")).to.be.true;
  });

  it("should return false if user does not exist", async ()=>{
    sinon.replace(_internal, "initialized", true);
    getUserDataStub.resolves(null);
    const result = await isValidUser("notExisting", "somePassword");
    expect(result).to.be.false;
    expect(loggerTraceStub.calledWith("user: notExisting not found")).to.be.true;
  });

  it("should return false if password is wrong", async ()=>{
    sinon.replace(_internal, "initialized", true);
    getUserDataStub.resolves({
      username: "someUser",
      hashed_password: Buffer.from("correctHash"),
      salt: Buffer.from("saltValue")
    });
    getHashedPasswordStub.resolves(Buffer.from("wrongHash"));
    timingSafeEqualStub.returns(false);
    const result = await isValidUser("someUser", "badPassword");
    expect(getHashedPasswordStub.calledOnceWithExactly("badPassword", Buffer.from("saltValue"))).to.be.true;
    expect(timingSafeEqualStub.calledOnce).to.be.true;
    expect(result).to.be.false;
    expect(loggerTraceStub.calledWith("wrong password")).to.be.true;
  });

  it("should return the user row if password is correct", async ()=>{
    sinon.replace(_internal, "initialized", true);
    const userRow = {
      username: "someUser",
      hashed_password: Buffer.from("correctHash"),
      salt: Buffer.from("saltValue")
    };
    getUserDataStub.resolves(userRow);
    getHashedPasswordStub.resolves(Buffer.from("correctHash"));
    timingSafeEqualStub.returns(true);
    const result = await isValidUser("someUser", "correctPassword");
    expect(getHashedPasswordStub.calledOnceWithExactly("correctPassword", Buffer.from("saltValue"))).to.be.true;
    expect(timingSafeEqualStub.calledOnce).to.be.true;
    expect(result).to.equal(userRow);
    expect(loggerTraceStub.notCalled).to.be.true;
  });
});

describe("#listUser", ()=>{
  let dbMock;
  let initializeStub;

  beforeEach(()=>{
    dbMock = {
      all: sinon.stub().resolves([])
    };
    initializeStub = sinon.stub(_internal, "initialize");
    sinon.replace(_internal, "db", dbMock);
  });

  afterEach(()=>{
    sinon.restore();
    _internal.db = null;
  });

  it("should call initialize if not yet initialized (db is not ready yet)", async ()=>{
    const result = await listUser();
    expect(initializeStub.calledOnce).to.be.true;
    expect(dbMock.all.calledOnce).to.be.true;
    expect(result).to.be.an("array").that.is.empty;
  });

  it("should not call initialize if already initialized", async ()=>{
    sinon.replace(_internal, "initialized", true);
    const result = await listUser();
    expect(initializeStub.notCalled).to.be.true;
    expect(dbMock.all.calledOnce).to.be.true;
    expect(result).to.be.an("array").that.is.empty;
  });

  it("should return empty array if db has no users", async ()=>{
    dbMock.all.resolves([]);
    const result = await listUser();
    expect(result).to.deep.equal([]);
  });

  it("should return array of usernames if db has data", async ()=>{
    dbMock.all.resolves([
      { username: "Alice" },
      { username: "Bob" }
    ]);
    const result = await listUser();
    expect(result).to.deep.equal(["Alice", "Bob"]);
  });
});

describe("#delUser", ()=>{
  let dbMock;
  let initializeStub;

  beforeEach(()=>{
    initializeStub = sinon.stub(_internal, "initialize");
    dbMock = {
      run: sinon.stub()
    };
    sinon.replace(_internal, "db", dbMock);
  });

  afterEach(()=>{
    sinon.restore();
    _internal.db = null;
  });

  it("should call initialize if not initialized", async ()=>{
    dbMock.run.resolves({ changes: 1 });
    await delUser("testUserA");
    expect(initializeStub.calledOnce).to.be.true;
    expect(dbMock.run.calledOnceWithExactly(
      "DELETE FROM users WHERE username = 'testUserA'"
    )).to.be.true;
  });

  it("should not call initialize if already initialized", async ()=>{
    sinon.replace(_internal, "initialized", true);
    dbMock.run.resolves({ changes: 1 });
    await delUser("testUserB");
    expect(initializeStub.notCalled).to.be.true;
    expect(dbMock.run.calledOnceWithExactly(
      "DELETE FROM users WHERE username = 'testUserB'"
    )).to.be.true;
  });

  it("should return statement object if user exists (changes=1)", async ()=>{
    sinon.replace(_internal, "initialized", true);
    const statement = { changes: 1 };
    dbMock.run.resolves(statement);
    const result = await delUser("existingUser");
    expect(result).to.equal(statement);
  });

  it("should return statement object if user does not exist (changes=0)", async ()=>{
    sinon.replace(_internal, "initialized", true);
    const statement = { changes: 0 };
    dbMock.run.resolves(statement);
    const result = await delUser("nonExistingUser");
    expect(result).to.equal(statement);
  });
});
