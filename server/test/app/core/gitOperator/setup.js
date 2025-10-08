/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const sinon = require("sinon");
const fs = require("fs-extra");
const path = require("path");
const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-fs"));
chai.use(require("chai-as-promised"));
chai.use(require("sinon-chai"));
const { gitInit, _internal } = require("../../../../app/core/gitOperator2.js");
describe("gitOperator2-setup", ()=>{
  describe("#gitPromise", ()=>{
    let spawnStub;
    let traceStub;
    beforeEach(()=>{
      spawnStub = sinon.stub(_internal, "spawn");
      traceStub = sinon.stub();
      sinon.stub(_internal, "getLogger").returns({ trace: traceStub });
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should cal git command", async ()=>{
      const cwd = "/repo/src";
      const args = ["diff"];
      const rootDir = "/repo";
      const cp = { stdout: { on: (event, handler)=>{
        handler("stdout");
      } }, stderr: { on: (event, handler)=>{
        handler("stderr");
      } }, on: (event, handler)=>{
        if (event === "exit") {
          handler(0);
        }
      } };
      spawnStub.returns(cp);
      await _internal.gitPromise(cwd, args, rootDir);
      expect(spawnStub.calledOnce).to.be.true;
      expect(spawnStub.calledWith("git", args, sinon.match({ cwd: cwd, env: process.env, shell: true }))).to.be.true;
    });
    it("should log stdout and stderr", async ()=>{
      const cwd = "/repo/src";
      const args = ["diff"];
      const rootDir = "/repo";
      const cp = { stdout: { on: (event, handler)=>{
        handler("stdout");
      } }, stderr: { on: (event, handler)=>{
        handler("stderr");
      } }, on: (event, handler)=>{
        if (event === "exit") {
          handler(0);
        }
      } };
      spawnStub.returns(cp);
      await _internal.gitPromise(cwd, args, rootDir);
      expect(traceStub.calledWith("stdout")).to.be.true;
      expect(traceStub.calledWith("stderr")).to.be.true;
    });
    it("should reject with an error if spawn fails", async ()=>{
      const cwd = "/repo/src";
      const args = ["diff"];
      const rootDir = "/repo";
      const cp = { stdout: { on: (event, handler)=>{
        handler("stdout");
      } }, stderr: { on: (event, handler)=>{
        handler("stderr");
      } }, on: (event, handler)=>{
        if (event === "error") {
          handler("error");
        }
      } };
      spawnStub.returns(cp);
      const promise = _internal.gitPromise(cwd, args, rootDir);
      await promise.then(()=>{
        expect.fail();
      }).catch((err)=>{
        expect(err).to.be.an("error");
        expect(err.message).to.equal("error");
        expect(err.output).to.equal("stdoutstderr");
        expect(err.cwd).to.equal(cwd);
        expect(err.abs_cwd).to.equal(path.resolve(cwd));
        expect(err.args).to.deep.equal(args);
      });
    });
    it("should reject with an error if return code is not 0", async ()=>{
      const cwd = "/repo/src";
      const args = ["diff"];
      const rootDir = "/repo";
      const cp = { stdout: { on: (event, handler)=>{
        handler("stdout");
      } }, stderr: { on: (event, handler)=>{
        handler("stderr");
      } }, on: (event, handler)=>{
        if (event === "exit") {
          handler(1);
        }
      } };
      spawnStub.returns(cp);
      const promise = _internal.gitPromise(cwd, args, rootDir);
      await promise.then(()=>{
        expect.fail();
      }).catch((err)=>{
        expect(err).to.be.an("error");
        expect(err.message).to.equal("stdoutstderr");
        expect(err.cwd).to.equal(cwd);
        expect(err.abs_cwd).to.equal(path.resolve(cwd));
        expect(err.args).to.deep.equal(args);
      });
    });
    it("should resolve with output if return code is 0", async ()=>{
      const cwd = "/repo/src";
      const args = ["diff"];
      const rootDir = "/repo";
      const cp = { stdout: { on: (event, handler)=>{
        handler("stdout");
      } }, stderr: { on: (event, handler)=>{
        handler("stderr");
      } }, on: (event, handler)=>{
        if (event === "exit") {
          handler(0);
        }
      } };
      spawnStub.returns(cp);
      const result = await _internal.gitPromise(cwd, args, rootDir);
      expect(result).to.equal("stdoutstderr");
    });
  });
  describe("#gitSetup", ()=>{
    const rootDir = "/repo";
    const user = "testuser";
    const mail = "testuser@example.com";
    beforeEach(()=>{
      sinon.stub(fs, "outputFile").resolves();
      sinon.stub(fs, "appendFile").resolves();
      sinon.stub(_internal, "gitPromise");
      sinon.stub(_internal, "readFile");
      sinon.stub(_internal, "gitAdd");
      sinon.stub(_internal, "gitCommit");
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should set commiter name, email and setup lfs, create .gitignore", async ()=>{
      const err = new Error("dummy error object");
      err.rt = 1;
      err.code = "ENOENT";
      _internal.gitPromise.onCall(0).rejects(err);
      _internal.gitPromise.onCall(2).rejects(err);
      _internal.readFile.rejects(err);
      await _internal.gitSetup(rootDir, user, mail);
      expect(_internal.gitPromise).to.have.callCount(5);
      expect(_internal.gitPromise.getCall(0)).to.be.calledWithExactly(rootDir, ["config", "--get", "user.name"], rootDir);
      expect(_internal.gitPromise.getCall(1)).to.be.calledWithExactly(rootDir, ["config", "user.name", user], rootDir);
      expect(_internal.gitPromise.getCall(2)).to.be.calledWithExactly(rootDir, ["config", "--get", "user.email"], rootDir);
      expect(_internal.gitPromise.getCall(3)).to.be.calledWithExactly(rootDir, ["config", "user.email", mail], rootDir);
      expect(_internal.gitPromise.getCall(4)).to.be.calledWithExactly(rootDir, ["lfs", "install"], rootDir);
      expect(fs.outputFile).to.be.calledOnceWithExactly(path.join(rootDir, ".gitignore"), "\nwheel.log\n");
      expect(fs.appendFile).not.to.be.called;
      expect(_internal.gitAdd).calledOnceWithExactly(rootDir, ".gitignore");
      expect(_internal.gitCommit).calledOnceWithExactly(rootDir, "initial commit");
    });
    it("should setup lfs and create .gitignore", async ()=>{
      const err = new Error("dummy error object");
      err.code = "ENOENT";
      _internal.readFile.rejects(err);
      await _internal.gitSetup(rootDir, user, mail);
      expect(_internal.gitPromise).to.have.callCount(3);
      expect(_internal.gitPromise.getCall(0)).to.be.calledWithExactly(rootDir, ["config", "--get", "user.name"], rootDir);
      expect(_internal.gitPromise.getCall(1)).to.be.calledWithExactly(rootDir, ["config", "--get", "user.email"], rootDir);
      expect(_internal.gitPromise.getCall(2)).to.be.calledWithExactly(rootDir, ["lfs", "install"], rootDir);
      expect(fs.outputFile).to.be.calledOnceWithExactly(path.join(rootDir, ".gitignore"), "\nwheel.log\n");
      expect(fs.appendFile).not.to.be.called;
      expect(_internal.gitAdd).calledOnceWithExactly(rootDir, ".gitignore");
      expect(_internal.gitCommit).calledOnceWithExactly(rootDir, "initial commit");
    });
    it("should use appendFile if .gitignore already exists and do not have .wheel", async ()=>{
      _internal.readFile.resolves("hoge");
      await _internal.gitSetup(rootDir, user, mail);
      expect(_internal.gitPromise).to.have.callCount(3);
      expect(_internal.gitPromise.getCall(0)).to.be.calledWithExactly(rootDir, ["config", "--get", "user.name"], rootDir);
      expect(_internal.gitPromise.getCall(1)).to.be.calledWithExactly(rootDir, ["config", "--get", "user.email"], rootDir);
      expect(_internal.gitPromise.getCall(2)).to.be.calledWithExactly(rootDir, ["lfs", "install"], rootDir);
      expect(fs.appendFile).to.be.calledOnceWithExactly(path.join(rootDir, ".gitignore"), "\nwheel.log\n");
      expect(fs.outputFile).not.to.be.called;
      expect(_internal.gitAdd).calledOnceWithExactly(rootDir, ".gitignore");
      expect(_internal.gitCommit).calledOnceWithExactly(rootDir, "initial commit");
    });
    it("should not commit if the repo is already set up", async ()=>{
      _internal.readFile.resolves("wheel.log");
      await _internal.gitSetup(rootDir, user, mail);
      expect(_internal.gitPromise).to.have.callCount(3);
      expect(_internal.gitPromise.getCall(0)).to.be.calledWithExactly(rootDir, ["config", "--get", "user.name"], rootDir);
      expect(_internal.gitPromise.getCall(1)).to.be.calledWithExactly(rootDir, ["config", "--get", "user.email"], rootDir);
      expect(_internal.gitPromise.getCall(2)).to.be.calledWithExactly(rootDir, ["lfs", "install"], rootDir);
      expect(fs.appendFile).not.to.be.called;
      expect(fs.outputFile).not.to.be.called;
      expect(_internal.gitAdd).not.to.be.called;
      expect(_internal.gitCommit).not.to.be.called;
    });
  });
  describe("#gitInit", ()=>{
    const rootDir = "/repo";
    const user = "testuser";
    const mail = "testuser@example.com";
    beforeEach(()=>{
      sinon.stub(_internal, "gitPromise");
      sinon.stub(_internal, "gitSetup");
      sinon.stub(fs, "ensureDir").resolves();
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should return an error if user is not a string", async ()=>{
      const result = await gitInit(rootDir, 123, mail);
      expect(result).to.be.an("error");
      expect(result.user).to.equal(123);
      expect(result.type).to.equal("number");
      expect(result.message).to.equal("user must be a string");
    });
    it("should return an error if mail is not a string", async ()=>{
      const result = await gitInit(rootDir, user, 123);
      expect(result).to.be.an("error");
      expect(result.mail).to.equal(123);
      expect(result.type).to.equal("number");
      expect(result.message).to.equal("mail must be a string");
    });
    it("should initialize git repository and set user config", async ()=>{
      _internal.gitPromise.resolves();
      await gitInit(rootDir, user, mail);
      sinon.assert.calledWith(
        _internal.gitPromise,
        sinon.match.string,
        ["init", "--", sinon.match.string],
        rootDir
      );
      expect(_internal.gitSetup).to.be.calledWith(rootDir, user, mail);
    });
  });
});
