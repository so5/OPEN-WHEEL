/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";

const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const {
  hasEntry,
  addSsh,
  getSsh,
  getSshHostinfo,
  getSshPW,
  getSshPH,
  removeSsh,
  createSsh,
  _internal
} = require("../../../app/core/sshManager.js");


describe("#hasEntry", ()=>{
  let dbMock;

  beforeEach(()=>{
    dbMock = new Map();
    _internal.db = dbMock;
  });

  it("should return false if the projectRootDir is not in db", ()=>{
    const result = hasEntry("/path/to/projectA", "someID");
    expect(result).to.be.false;
  });

  it("should return false if db has the projectRootDir but does not have the id", ()=>{
    const projectDir = "/path/to/projectB";
    dbMock.set(projectDir, new Map()); //空のMap

    const result = hasEntry(projectDir, "missingID");
    expect(result).to.be.false;
  });

  it("should return true if db has the projectRootDir and the id", ()=>{
    const projectDir = "/path/to/projectC";
    const id = "existingID";

    const subMap = new Map();
    subMap.set(id, { ssh: "dummySshObject" });
    dbMock.set(projectDir, subMap);

    const result = hasEntry(projectDir, id);
    expect(result).to.be.true;
  });
});

describe("#addSsh", ()=>{
  let dbMock;

  beforeEach(()=>{
    dbMock = new Map();
    _internal.db = dbMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should create a new Map when the projectRootDir does not exist in db", ()=>{
    const projectRootDir = "/dummy/path";
    const hostinfo = { id: "host-123" };
    const ssh = { connect: ()=>{} };
    const pw = "dummyPw";
    const ph = "dummyPh";
    const isStorage = false;

    addSsh(projectRootDir, hostinfo, ssh, pw, ph, isStorage);

    expect(_internal.db.has(projectRootDir)).to.be.true;
    const subMap = _internal.db.get(projectRootDir);
    expect(subMap.get("host-123")).to.deep.equal({
      ssh,
      hostinfo,
      pw,
      ph,
      isStorage
    });
  });

  it("should reuse existing Map when the projectRootDir already exists in db", ()=>{
    const projectRootDir = "/exists/path";
    _internal.db.set(projectRootDir, new Map());

    const hostinfo = { id: "host-999" };
    const ssh = { connect: ()=>{} };
    const pw = "secretPw";
    const ph = "secretPh";
    const isStorage = true;

    addSsh(projectRootDir, hostinfo, ssh, pw, ph, isStorage);

    const subMap = _internal.db.get(projectRootDir);
    expect(subMap.get("host-999")).to.deep.equal({
      ssh,
      hostinfo,
      pw,
      ph,
      isStorage
    });
  });
});

describe("#getSsh", ()=>{
  let dbMock;

  beforeEach(()=>{
    dbMock = new Map();
    _internal.db = dbMock;
  });

  it("should throw an error if ssh instance is not registered for the project", ()=>{
    const projectRootDir = "/mock/project/root";
    const hostID = "someHostID";

    try {
      getSsh(projectRootDir, hostID);
      throw new Error("Expected getSsh to throw an error");
    } catch (err) {
      expect(err).to.be.an("Error");
      expect(err.message).to.equal("ssh instance is not registerd for the project");
      expect(err.projectRootDir).to.equal(projectRootDir);
      expect(err.id).to.equal(hostID);
    }
  });

  it("should return ssh instance when entry exists in db", ()=>{
    const projectRootDir = "/mock/project/root";
    const hostID = "existingHost";

    const sshInstanceMock = { dummy: "ssh" };
    const hostMap = new Map();
    hostMap.set(hostID, { ssh: sshInstanceMock });
    dbMock.set(projectRootDir, hostMap);

    const result = getSsh(projectRootDir, hostID);
    expect(result).to.equal(sshInstanceMock);
  });
});

describe("#getSshHostinfo", ()=>{
  let dbMock;

  beforeEach(()=>{
    dbMock = new Map();
    dbMock.set("mockProjectDir", new Map([
      ["mockHostID", { hostinfo: { host: "somehost" } }]
    ]));
    _internal.db = dbMock;
  });

  it("should throw an error if the hostinfo is not registered", ()=>{
    try {
      getSshHostinfo("mockProjectDir", "unregisteredID");
      throw new Error("Expected getSshHostinfo to throw an error");
    } catch (err) {
      expect(err.message).to.equal("hostinfo is not registerd for the project");
      expect(err.projectRootDir).to.equal("mockProjectDir");
      expect(err.id).to.equal("unregisteredID");
    }
  });

  it("should return hostinfo object if the entry exists", ()=>{
    const result = getSshHostinfo("mockProjectDir", "mockHostID");
    expect(result).to.deep.equal({ host: "somehost" });
  });
});

describe("#getSshPW", ()=>{
  let dbMock;

  beforeEach(()=>{
    dbMock = new Map();
    _internal.db = dbMock;
  });

  it("should throw an error if hostinfo is not registered for the project", ()=>{
    expect(()=>{
      getSshPW("/path/to/project", "hostID");
    }).to.throw("hostinfo is not registerd for the project")
      .and.to.have.property("projectRootDir", "/path/to/project");
  });

  it("should return the password (string) if hasEntry is true", ()=>{
    dbMock.set("/path/to/project", new Map([
      ["hostID", { pw: "mySecretPassword" }]
    ]));
    const result = getSshPW("/path/to/project", "hostID");
    expect(result).to.equal("mySecretPassword");
  });

  it("should return the password (function) if pw is defined as a function", ()=>{
    const pwFunc = ()=>"secretFromFunction";
    dbMock.set("/path/to/project", new Map([
      ["hostID", { pw: pwFunc }]
    ]));
    const result = getSshPW("/path/to/project", "hostID");
    expect(result).to.be.a("function");
    expect(result()).to.equal("secretFromFunction");
  });
});

describe("#getSshPH", ()=>{
  let dbMock;

  beforeEach(()=>{
    dbMock = new Map();
    _internal.db = dbMock;
  });

  it("should throw an error if hostinfo is not registered for the project", ()=>{
    const projectRootDir = "/dummy/project";
    const hostID = "unregisteredHost";

    try {
      getSshPH(projectRootDir, hostID);
      expect.fail("Expected getSshPH to throw an error, but it did not");
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal("hostinfo is not registerd for the project");
      expect(err.projectRootDir).to.equal(projectRootDir);
      expect(err.id).to.equal(hostID);
    }
  });

  it("should return the passphrase if hostinfo is registered for the project", ()=>{
    const projectRootDir = "/dummy/project";
    const hostID = "registeredHost";
    const hostMap = new Map();
    hostMap.set(hostID, { ph: "mySecretPassphrase" });
    dbMock.set(projectRootDir, hostMap);
    const result = getSshPH(projectRootDir, hostID);
    expect(result).to.equal("mySecretPassphrase");
  });
});

describe("#removeSsh", ()=>{
  let dbMock;

  beforeEach(()=>{
    dbMock = new Map();
    _internal.db = dbMock;
  });

  it("should return immediately if db does not have projectRootDir", ()=>{
    removeSsh("notExistsDir");
    expect(dbMock.has("notExistsDir")).to.be.false;
  });

  it("should clear the map if it is empty and the projectRootDir is found", ()=>{
    const projectRootDir = "emptyDir";
    dbMock.set(projectRootDir, new Map());
    removeSsh(projectRootDir);
    expect(dbMock.get(projectRootDir).size).to.equal(0);
  });

  it("should disconnect all non-storage entries and clear db if no storage entries exist", ()=>{
    const projectRootDir = "noStorageDir";
    const disconnectMock = sinon.stub();
    const mapForDir = new Map();
    mapForDir.set("hostA", { isStorage: false, ssh: { disconnect: disconnectMock } });
    mapForDir.set("hostB", { isStorage: false, ssh: { disconnect: disconnectMock } });
    dbMock.set(projectRootDir, mapForDir);
    removeSsh(projectRootDir);
    expect(disconnectMock.callCount).to.equal(2);
    expect(dbMock.get(projectRootDir).size).to.equal(0);
  });

  it("should skip disconnect for storage entries and not clear the map if any storage is found", ()=>{
    const projectRootDir = "withStorageDir";
    const storageDisconnectMock = sinon.stub();
    const normalDisconnectMock = sinon.stub();
    const mapForDir = new Map();
    mapForDir.set("hostStorage", { isStorage: true, ssh: { disconnect: storageDisconnectMock } });
    mapForDir.set("hostNonStorage", { isStorage: false, ssh: { disconnect: normalDisconnectMock } });
    dbMock.set(projectRootDir, mapForDir);
    removeSsh(projectRootDir);
    expect(storageDisconnectMock.called).to.be.false;
    expect(normalDisconnectMock.calledOnce).to.be.true;
    expect(dbMock.get(projectRootDir).size).to.equal(2);
  });
});

describe("#askPassword", ()=>{
  let emitAllStub;

  beforeEach(()=>{
    emitAllStub = sinon.stub(_internal, "emitAll");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should resolve with data if the user provides a non-null password", async ()=>{
    emitAllStub.callsFake((clientID, event, hostname, mode, JWTServerURL, callback)=>{
      callback("secretPW");
    });
    const result = await _internal.askPassword("dummyClientID", "Please enter your password");
    expect(result).to.equal("secretPW");
    expect(emitAllStub.calledOnce).to.be.true;
  });

  it("should reject with an error if the user cancels the password input (data === null)", async ()=>{
    emitAllStub.callsFake((clientID, event, hostname, mode, JWTServerURL, callback)=>{
      callback(null);
    });

    try {
      await _internal.askPassword("dummyClientID", "Please enter your password");
      expect.fail("Expected askPassword to reject, but it resolved");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("user canceled ssh password prompt");
      expect(err.reason).to.equal("CANCELED");
    }
    expect(emitAllStub.calledOnce).to.be.true;
  });
});

describe("#createSsh", ()=>{
  let askPasswordStub;
  let canConnectStub;
  let SshClientWrapperStub;
  let originalWheelVerboseSsh;

  beforeEach(()=>{
    canConnectStub = sinon.stub();
    askPasswordStub = sinon.stub(_internal, "askPassword");
    SshClientWrapperStub = sinon.stub(_internal, "SshClientWrapper").callsFake(function() {
      return {
        canConnect: canConnectStub
      };
    });
    _internal.db.clear();

    originalWheelVerboseSsh = process.env.WHEEL_VERBOSE_SSH;
    delete process.env.WHEEL_VERBOSE_SSH;
  });

  afterEach(()=>{
    sinon.restore();
    if (originalWheelVerboseSsh !== undefined) {
      process.env.WHEEL_VERBOSE_SSH = originalWheelVerboseSsh;
    } else {
      delete process.env.WHEEL_VERBOSE_SSH;
    }
  });

  it("should return an existing ssh instance if hasEntry is true", async ()=>{
    const projectRootDir = "/test/project";
    const hostinfo = { id: "host-abc" };
    const dummySshInstance = { dummy: "sshInstance" };
    addSsh(projectRootDir, hostinfo, dummySshInstance);

    const result = await createSsh(projectRootDir, "remoteHostTest", hostinfo, "clientXYZ", false);
    expect(result).to.deep.equal(dummySshInstance);
    expect(SshClientWrapperStub.notCalled).to.be.true;
  });

  it("should handle string password and skip askPassword", async ()=>{
    const projectRootDir = "/test/project";
    const remoteHostName = "testHost";
    const hostinfo = {
      id: "host-xyz",
      password: "mySecretPassword"
    };
    canConnectStub.resolves(true);

    const sshInstance = await createSsh(projectRootDir, remoteHostName, hostinfo, "cid-0001", false);
    expect(askPasswordStub.notCalled).to.be.true;
    expect(SshClientWrapperStub.calledOnce).to.be.true;
    expect(canConnectStub.calledOnce).to.be.true;
    expect(getSsh(projectRootDir, hostinfo.id)).to.be.ok;
    expect(sshInstance).to.be.ok;
  });

  it("should set hostinfo.password as an async function that calls askPassword if not a string", async ()=>{
    const projectRootDir = "/test/project";
    const remoteHostName = "sampleHost";
    const hostinfo = {
      id: "host-pswdFunc"
    };
    canConnectStub.resolves(true);
    askPasswordStub.resolves("p@ssw0rd!");

    const result = await createSsh(projectRootDir, remoteHostName, hostinfo, "client-pswdTest", false);
    expect(typeof hostinfo.password).to.equal("function");
    expect(askPasswordStub.callCount).to.equal(0);
    expect(result).to.be.ok;

    const pw = await hostinfo.password();
    expect(pw).to.equal("p@ssw0rd!");
    expect(askPasswordStub.calledOnce).to.be.true;
  });

  it("should set passphrase async function and call askPassword if needed", async ()=>{
    canConnectStub.resolves(true);
    askPasswordStub.resolves("passphraseTest");

    const hostinfo = {
      id: "host-pp",
      password: "alreadyStringPassword"
    };

    await createSsh("/test/project", "sampleHost2", hostinfo, "client-pp", false);

    expect(typeof hostinfo.passphrase).to.equal("function");
    const ph = await hostinfo.passphrase();
    expect(ph).to.equal("passphraseTest");
    expect(askPasswordStub.calledOnce).to.be.true;
  });

  it("should set ControlPersist if renewInterval is provided", async ()=>{
    canConnectStub.resolves(true);
    const hostinfo = {
      id: "renewTest",
      renewInterval: 10
    };
    await createSsh("/test/project", "renewHost", hostinfo, "cid999", false);
    expect(hostinfo).to.have.property("ControlPersist", 600);
    expect(getSsh("/test/project", hostinfo.id)).to.be.ok;
  });

  it("should set ConnectTimeout if readyTimeout is provided", async ()=>{
    canConnectStub.resolves(true);
    const hostinfo = {
      id: "rtTest",
      readyTimeout: 25000
    };
    await createSsh("/projRc", "hostRc", hostinfo, "cidRc", false);
    expect(hostinfo).to.have.property("ConnectTimeout", 25);
    expect(getSsh("/projRc", hostinfo.id)).to.be.ok;
  });

  it("should set sshOpt=['-vvv'] if WHEEL_VERBOSE_SSH is truthy", async ()=>{
    process.env.WHEEL_VERBOSE_SSH = "true";
    canConnectStub.resolves(true);
    const hostinfo = { id: "verboseTest" };
    await createSsh("/vProj", "vHost", hostinfo, "cl-v", false);
    expect(hostinfo).to.have.property("sshOpt");
    expect(hostinfo.sshOpt).to.deep.equal(["-vvv"]);
    expect(getSsh("/vProj", hostinfo.id)).to.be.ok;
  });

  it("should copy username to user and remove username if exist", async ()=>{
    canConnectStub.resolves(true);
    const hostinfo = {
      id: "renameUser",
      username: "testUser"
    };
    await createSsh("/projUser", "hostUser", hostinfo, "cidUser", false);
    expect(hostinfo).to.not.have.property("username");
    expect(hostinfo).to.have.property("user", "testUser");
    expect(getSsh("/projUser", hostinfo.id)).to.be.ok;
  });

  it("should set rcfile to /etc/profile if not present", async ()=>{
    canConnectStub.resolves(true);
    const hostinfo = { id: "rcTest" };
    await createSsh("/projRc", "hostRc", hostinfo, "cidRc", false);
    expect(hostinfo).to.have.property("rcfile", "/etc/profile");
    expect(getSsh("/projRc", hostinfo.id)).to.be.ok;
  });

  it("should addSsh only if ssh.canConnect succeeds", async ()=>{
    canConnectStub.resolves(true);
    const hostinfoTrue = { id: "trueCase" };
    await createSsh("/testTrue", "trueHost", hostinfoTrue, "cidTrue", false);
    expect(hasEntry("/testTrue", hostinfoTrue.id)).to.be.true;

    canConnectStub.resolves(false);
    const hostinfoFalse = { id: "falseCase" };
    await createSsh("/testFalse", "falseHost", hostinfoFalse, "cidFalse", false);
    expect(hasEntry("/testFalse", hostinfoFalse.id)).to.be.false;
  });

  it("should throw error with appended message if 'Control socket creation failed'", async ()=>{
    const hostinfo = { id: "failCase" };
    const error = new Error("Control socket creation failed");
    canConnectStub.rejects(error);

    try {
      await createSsh("/failProj", "failHost", hostinfo, "cidFail", false);
      throw new Error("Expected createSsh to throw, but it did not");
    } catch (err) {
      expect(err.message).to.include("Control socket creation failed");
      expect(err.message).to.include("you can avoid this error by using SSH_CONTROL_PERSIST_DIR");
    }
  });

  it("should throw generic error if unknown error happens during canConnect", async ()=>{
    const hostinfo = { id: "failUnknown" };
    canConnectStub.rejects(new Error("Some random error"));

    try {
      await createSsh("/unknownProj", "unknownHost", hostinfo, "cidUnknown", false);
      throw new Error("Expected error but none thrown");
    } catch (err) {
      expect(err.message).to.equal("ssh connection failed due to unknown reason");
    }
  });
});