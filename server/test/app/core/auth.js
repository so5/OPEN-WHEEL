/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";

const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const auth = require("../../../app/core/auth.js");

describe("auth.js", ()=>{
  //restore all stubs
  afterEach(()=>{
    sinon.restore();
  });

  describe("#initialize", ()=>{
    let dbMock;
    beforeEach(()=>{
      dbMock = {
        exec: sinon.stub().resolves()
      };
      sinon.stub(auth._internal, "open").resolves(dbMock);
      auth._internal.setInitialized(false);
    });
    it("should open the database, create the table, set initialized to true, and return db", async ()=>{
      const result = await auth.initialize();
      expect(auth._internal.open.calledOnce).to.be.true;
      expect(dbMock.exec.calledWith("CREATE TABLE IF NOT EXISTS users ( \
    id INT PRIMARY KEY, \
    username TEXT UNIQUE, \
    hashed_password BLOB, \
    salt BLOB \
  )")).to.be.true;
      expect(auth._internal.isInitialized()).to.be.true;
      expect(result).to.equal(dbMock);
    });
  });

  describe("#_internal.getHashedPassword", ()=>{
    let pbkdf2Stub;
    beforeEach(()=>{
      pbkdf2Stub = sinon.stub(auth._internal.crypto, "pbkdf2");
    });

    it("should return a Buffer with hashed password if pbkdf2 succeeds", async ()=>{
      pbkdf2Stub.callsFake((password, salt, iterations, keylen, digest, callback)=>{
        callback(null, Buffer.from("fake hashed password"));
      });

      const password = "testPassword";
      const salt = "testSalt";

      const result = await auth._internal.getHashedPassword(password, salt);
      expect(pbkdf2Stub.calledOnce).to.be.true;
      expect(result).to.be.instanceOf(Buffer);
      expect(result.toString()).to.equal("fake hashed password");
    });

    it("should throw an error if pbkdf2 fails", async ()=>{
      pbkdf2Stub.callsFake((password, salt, iterations, keylen, digest, callback)=>{
        callback(new Error("pbkdf2 error"));
      });
      const password = "testPassword";
      const salt = "testSalt";

      try {
        await auth._internal.getHashedPassword(password, salt);
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
    let getHashedPasswordStub;
    let dbRunStub;
    let randomUUIDStub;
    let randomBytesStub;

    beforeEach(()=>{
      initializeStub = sinon.stub(auth, "initialize");
      getUserDataStub = sinon.stub(auth._internal, "getUserData");
      getHashedPasswordStub = sinon.stub(auth._internal, "getHashedPassword");
      dbRunStub = sinon.stub();
      auth._internal.setDB({ run: dbRunStub });
      randomUUIDStub = sinon.stub(auth._internal.crypto, "randomUUID");
      randomBytesStub = sinon.stub(auth._internal.crypto, "randomBytes");
    });

    it("should initialize if not initialized, then insert user if the user does not exist", async ()=>{
      auth._internal.setInitialized(false);
      initializeStub.resolves();
      getUserDataStub.resolves(null);
      randomUUIDStub.returns("unique-id-123");
      randomBytesStub.returns(Buffer.from("salt123"));
      getHashedPasswordStub.resolves(Buffer.from("hashed123"));
      dbRunStub.resolves();
      await auth.addUser("john", "secret");

      expect(initializeStub.calledOnce).to.be.true;
      expect(getUserDataStub.calledOnceWithExactly("john")).to.be.true;
      expect(randomUUIDStub.calledOnce).to.be.true;
      expect(randomBytesStub.calledOnceWithExactly(16)).to.be.true;
      expect(getHashedPasswordStub.calledOnceWithExactly("secret", Buffer.from("salt123"))).to.be.true;
      expect(dbRunStub.calledOnce).to.be.true;

      const [sql, id, username, hashedPw, salt] = dbRunStub.firstCall.args;
      expect(sql).to.include("INSERT OR IGNORE INTO users");
      expect(id).to.equal("unique-id-123");
      expect(username).to.equal("john");
      expect(hashedPw).to.deep.equal(Buffer.from("hashed123"));
      expect(salt).to.deep.equal(Buffer.from("salt123"));
    });

    it("should skip initialize if already initialized is true and user does not exist", async ()=>{
      auth._internal.setInitialized(true);
      initializeStub.resolves(); //not called
      getUserDataStub.resolves(null);
      randomUUIDStub.returns("unique-id-abc");
      randomBytesStub.returns(Buffer.from("saltABC"));
      getHashedPasswordStub.resolves(Buffer.from("hashedABC"));
      dbRunStub.resolves();
      await auth.addUser("alice", "mypassword");
      expect(initializeStub.notCalled).to.be.true;
      expect(getUserDataStub.calledOnceWithExactly("alice")).to.be.true;
      expect(randomUUIDStub.calledOnce).to.be.true;
      expect(randomBytesStub.calledOnce).to.be.true;
      expect(getHashedPasswordStub.calledOnce).to.be.true;
      expect(dbRunStub.calledOnce).to.be.true;
    });

    it("should throw an error if user already exists", async ()=>{
      auth._internal.setInitialized(false);
      initializeStub.resolves();
      getUserDataStub.resolves({ username: "bob" });

      try {
        await auth.addUser("bob", "secret2");
        expect.fail("Expected addUser to throw an error, but it did not");
      } catch (err) {
        expect(err.message).to.equal("user already exists");
        expect(err).to.have.property("username", "bob");
      }

      expect(initializeStub.calledOnce).to.be.true;
      expect(dbRunStub.notCalled).to.be.true;
    });
  });

  describe("#_internal.getUserData", ()=>{
    let dbGetStub;
    beforeEach(()=>{
      dbGetStub = sinon.stub();
      auth._internal.setDB({ get: dbGetStub });
    });

    it("should return null if user does not exist in DB", async ()=>{
      dbGetStub.resolves(undefined);

      const result = await auth._internal.getUserData("nonexistentUser");
      expect(result).to.be.null;
      expect(dbGetStub.calledOnceWithExactly(
        "SELECT * FROM users WHERE username = ?",
        "nonexistentUser"
      )).to.be.true;
    });

    it("should return null if DB row exists but row.username does not match", async ()=>{
      dbGetStub.resolves({
        username: "anotherUser",
        hashed_password: Buffer.from("someHash"),
        salt: Buffer.from("someSalt"),
        id: "userID999"
      });
      const result = await auth._internal.getUserData("testUser");
      expect(result).to.be.null;
    });

    it("should return the row if DB row exists and row.username matches", async ()=>{
      const fakeRow = {
        username: "testUser",
        hashed_password: Buffer.from("someHash"),
        salt: Buffer.from("someSalt"),
        id: "userID123"
      };
      dbGetStub.resolves(fakeRow);
      const result = await auth._internal.getUserData("testUser");
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
      initializeStub = sinon.stub(auth, "initialize");
      getUserDataStub = sinon.stub(auth._internal, "getUserData");
      getHashedPasswordStub = sinon.stub(auth._internal, "getHashedPassword");
      loggerTraceStub = sinon.stub(auth._internal.logger, "trace");
      timingSafeEqualStub = sinon.stub(auth._internal.crypto, "timingSafeEqual");
    });

    it("should call initialize if not initialized", async ()=>{
      auth._internal.setInitialized(false);
      getUserDataStub.resolves(null);
      const result = await auth.isValidUser("testUser", "testPassword");
      expect(initializeStub.calledOnce).to.be.true;
      expect(result).to.be.false;
      expect(loggerTraceStub.calledWith("user: testUser not found")).to.be.true;
    });

    it("should return false if user does not exist", async ()=>{
      auth._internal.setInitialized(true);
      getUserDataStub.resolves(null);
      const result = await auth.isValidUser("notExisting", "somePassword");
      expect(result).to.be.false;
      expect(loggerTraceStub.calledWith("user: notExisting not found")).to.be.true;
    });

    it("should return false if password is wrong", async ()=>{
      auth._internal.setInitialized(true);
      getUserDataStub.resolves({
        username: "someUser",
        hashed_password: Buffer.from("correctHash"),
        salt: Buffer.from("saltValue")
      });
      getHashedPasswordStub.resolves(Buffer.from("wrongHash"));
      timingSafeEqualStub.returns(false);
      const result = await auth.isValidUser("someUser", "badPassword");
      expect(getHashedPasswordStub.calledOnceWithExactly("badPassword", Buffer.from("saltValue"))).to.be.true;
      expect(timingSafeEqualStub.calledOnce).to.be.true;
      expect(result).to.be.false;
      expect(loggerTraceStub.calledWith("wrong password")).to.be.true;
    });

    it("should return the user row if password is correct", async ()=>{
      auth._internal.setInitialized(true);
      const userRow = {
        username: "someUser",
        hashed_password: Buffer.from("correctHash"),
        salt: Buffer.from("saltValue")
      };
      getUserDataStub.resolves(userRow);
      getHashedPasswordStub.resolves(Buffer.from("correctHash"));
      timingSafeEqualStub.returns(true);
      const result = await auth.isValidUser("someUser", "correctPassword");
      expect(getHashedPasswordStub.calledOnceWithExactly("correctPassword", Buffer.from("saltValue"))).to.be.true;
      expect(timingSafeEqualStub.calledOnce).to.be.true;
      expect(result).to.equal(userRow);
      expect(loggerTraceStub.notCalled).to.be.true;
    });
  });

  describe("#listUser", ()=>{
    let dbAllStub;
    let initializeStub;
    beforeEach(()=>{
      dbAllStub = sinon.stub().resolves([]);
      auth._internal.setDB({ all: dbAllStub });
      initializeStub = sinon.stub(auth, "initialize").resolves();
    });

    it("should call initialize if not yet initialized (db is not ready yet)", async ()=>{
      auth._internal.setInitialized(false);
      const result = await auth.listUser();
      expect(initializeStub.calledOnce).to.be.true;
      expect(dbAllStub.calledOnce).to.be.true;
      expect(result).to.be.an("array").that.is.empty;
    });

    it("should not call initialize if already initialized", async ()=>{
      auth._internal.setInitialized(true);
      const result = await auth.listUser();
      expect(initializeStub.notCalled).to.be.true;
      expect(dbAllStub.calledOnce).to.be.true;
      expect(result).to.be.an("array").that.is.empty;
    });

    it("should return empty array if db has no users", async ()=>{
      auth._internal.setInitialized(true);
      dbAllStub.resolves([]);
      const result = await auth.listUser();
      expect(result).to.deep.equal([]);
    });

    it("should return array of usernames if db has data", async ()=>{
      auth._internal.setInitialized(true);
      dbAllStub.resolves([
        { username: "Alice" },
        { username: "Bob" }
      ]);
      const result = await auth.listUser();
      expect(result).to.deep.equal(["Alice", "Bob"]);
    });
  });

  describe("#delUser", ()=>{
    let dbRunStub;
    let initializeStub;
    beforeEach(()=>{
      dbRunStub = sinon.stub();
      auth._internal.setDB({ run: dbRunStub });
      initializeStub = sinon.stub(auth, "initialize").resolves();
      auth._internal.setInitialized(true);
    });

    it("should call initialize if not initialized", async ()=>{
      auth._internal.setInitialized(false);
      dbRunStub.resolves({ changes: 1 });
      await auth.delUser("testUserA");
      expect(initializeStub.calledOnce).to.be.true;
      expect(dbRunStub.calledOnceWithExactly(
        "DELETE FROM users WHERE username = 'testUserA'"
      )).to.be.true;
    });

    it("should not call initialize if already initialized", async ()=>{
      auth._internal.setInitialized(true);
      dbRunStub.resolves({ changes: 1 });
      await auth.delUser("testUserB");
      expect(initializeStub.notCalled).to.be.true;
      expect(dbRunStub.calledOnceWithExactly(
        "DELETE FROM users WHERE username = 'testUserB'"
      )).to.be.true;
    });

    it("should return statement object if user exists (changes=1)", async ()=>{
      const statement = { changes: 1 };
      dbRunStub.resolves(statement);
      const result = await auth.delUser("existingUser");
      expect(result).to.equal(statement);
    });

    it("should return statement object if user does not exist (changes=0)", async ()=>{
      const statement = { changes: 0 };
      dbRunStub.resolves(statement);
      const result = await auth.delUser("nonExistingUser");
      expect(result).to.equal(statement);
    });
  });
});
