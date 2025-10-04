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

const gitOperator2 = require("../../../app/core/gitOperator2.js");
const { gitCommit, gitAdd, gitStatus, _internal, gitPromise, gitInit, gitRm, gitResetHEAD, gitClean, getUnsavedFiles, isLFS, gitLFSTrack, gitLFSUntrack } = gitOperator2;

describe("gitOperator2", ()=>{
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

  describe("#gitCommit", ()=>{
    const rootDir = "/repo";
    const defaultMessage = "save project";

    beforeEach(()=>{
      sinon.stub(_internal, "gitPromise");
    });

    afterEach(()=>{
      sinon.restore();
    });

    it("should call gitPromise with correct arguments when message and additionalOption are provided", async ()=>{
      _internal.gitPromise.resolves();
      const message = "Initial commit";
      const additionalOption = ["--signoff"];

      await gitCommit(rootDir, message, additionalOption);

      sinon.assert.calledWith(
        _internal.gitPromise,
        rootDir,
        ["commit", "-m", `"${message}"`, "--signoff"],
        rootDir
      );
    });

    it("should call gitPromise with default message when no message is provided", async ()=>{
      _internal.gitPromise.resolves();

      await gitCommit(rootDir);

      sinon.assert.calledWith(
        _internal.gitPromise,
        rootDir,
        ["commit", "-m", `"${defaultMessage}"`],
        rootDir
      );
    });

    it("should handle 'no changes to commit' error and not throw", async ()=>{
      const error = new Error("nothing to commit, working tree clean");
      _internal.gitPromise.rejects(error);

      await expect(gitCommit(rootDir)).to.be.fulfilled;
    });

    it("should throw error if gitPromise fails with another error", async ()=>{
      const errorMessage = "some other error";
      _internal.gitPromise.rejects(new Error(errorMessage));

      await expect(gitCommit(rootDir)).to.be.rejectedWith(Error, errorMessage);
    });

    it("should handle 'no changes added to commit' error and not throw", async ()=>{
      const error = new Error("no changes added to commit");
      _internal.gitPromise.rejects(error);

      await expect(gitCommit(rootDir)).to.be.fulfilled;
    });

    it("should handle 'nothing to commit' error and not throw", async ()=>{
      const error = new Error("nothing to commit");
      _internal.gitPromise.rejects(error);

      await expect(gitCommit(rootDir)).to.be.fulfilled;
    });
  });

  describe("#gitAdd", ()=>{
    const rootDir = "/repo";
    const filename = "file.txt";

    beforeEach(()=>{
      sinon.stub(_internal, "gitPromise");
      sinon.stub(_internal, "promisifiedGit");
    });

    afterEach(()=>{
      sinon.restore();
    });

    it("should call gitPromise with correct arguments (without -u)", async ()=>{
      _internal.gitPromise.resolves();

      await gitAdd(rootDir, filename, false);

      sinon.assert.calledWith(
        _internal.gitPromise,
        rootDir,
        ["add", "--", filename],
        rootDir
      );
    });

    it("should call gitPromise with correct arguments (with -u)", async ()=>{
      _internal.gitPromise.resolves();

      await gitAdd(rootDir, filename, true);

      sinon.assert.calledWith(
        _internal.gitPromise,
        rootDir,
        ["add", "-u", "--", filename],
        rootDir
      );
    });

    it("should handle index.lock error and not throw", async function () {
      _internal.gitPromise.restore();
      this.timeout(5000);
      const error = new Error(
        "fatal: Unable to create '/repo/.git/index.lock': File exists"
      );
      _internal.promisifiedGit.onCall(0).rejects(error);
      _internal.promisifiedGit.onCall(1).rejects(error);
      _internal.promisifiedGit.onCall(2).rejects(error);
      _internal.promisifiedGit.onCall(3).rejects(error);
      _internal.promisifiedGit.onCall(4).rejects(error);
      _internal.promisifiedGit.onCall(5).resolves(undefined);

      await expect(gitAdd(rootDir, filename, false)).to.be.fulfilled;
    });
    it("should handle index.lock error but throw after 6th fail", async function () {
      _internal.gitPromise.restore();
      this.timeout(5000);
      const error = new Error(
        "fatal: Unable to create '/repo/.git/index.lock': File exists"
      );
      _internal.promisifiedGit.onCall(0).rejects(error);
      _internal.promisifiedGit.onCall(1).rejects(error);
      _internal.promisifiedGit.onCall(2).rejects(error);
      _internal.promisifiedGit.onCall(3).rejects(error);
      _internal.promisifiedGit.onCall(4).rejects(error);
      _internal.promisifiedGit.onCall(5).rejects(error);
      _internal.promisifiedGit.onCall(6).rejects(error);

      return expect(gitAdd(rootDir, filename, false)).to.be.rejected;
    });

    it("should throw error if gitPromise fails with another error", async ()=>{
      const error = new Error("some other error");
      _internal.gitPromise.rejects(error);

      await expect(gitAdd(rootDir, filename, false)).to.be.rejectedWith(
        Error,
        "some other error"
      );
    });
  });

  describe("#gitRm", ()=>{
    const rootDir = "/repo";
    const filename = "file.txt";

    beforeEach(()=>{
      sinon.stub(_internal, "gitPromise");
    });

    afterEach(()=>{
      sinon.restore();
    });

    it("should call gitPromise with correct arguments", async ()=>{
      _internal.gitPromise.resolves();
      await gitRm(rootDir, filename);

      sinon.assert.calledWith(
        _internal.gitPromise,
        rootDir,
        ["rm", "-r", "--cached", "--", filename],
        rootDir
      );
    });

    it("should not throw error if gitPromise fails with fatal error related to pathspec", async ()=>{
      const error = new Error(
        "fatal: pathspec 'file.txt' did not match any files"
      );
      _internal.gitPromise.rejects(error);

      await expect(gitRm(rootDir, filename)).to.be.fulfilled;
    });

    it("should throw error if gitPromise fails with another error", async ()=>{
      const error = new Error("some other error");
      _internal.gitPromise.rejects(error);

      await expect(gitRm(rootDir, filename)).to.be.rejectedWith(
        Error,
        "some other error"
      );
    });
  });

  describe("#gitResetHEAD", ()=>{
    const rootDir = "/repo";

    beforeEach(()=>{
      sinon.stub(_internal, "gitPromise");
    });

    afterEach(()=>{
      sinon.restore();
    });

    it("should call gitPromise with reset HEAD --hard when filePatterns is empty", async ()=>{
      _internal.gitPromise.resolves();

      await gitResetHEAD(rootDir, "");

      sinon.assert.calledWith(
        _internal.gitPromise,
        rootDir,
        ["reset", "HEAD", "--hard"],
        rootDir
      );
    });

    it("should call gitPromise with reset HEAD -- <filePatterns> and then checkout HEAD -- <filePatterns>", async ()=>{
      _internal.gitPromise.resolves();
      const filePatterns = "test.txt";

      await gitResetHEAD(rootDir, filePatterns);

      sinon.assert.calledWith(
        _internal.gitPromise,
        rootDir,
        ["reset", "HEAD", "--", filePatterns],
        rootDir
      );
      sinon.assert.calledWith(
        _internal.gitPromise,
        rootDir,
        ["checkout", "HEAD", "--", filePatterns],
        rootDir
      );
    });

    it("should throw an error if gitPromise fails", async ()=>{
      const errorMessage = "reset error";
      _internal.gitPromise.rejects(new Error(errorMessage));

      await expect(gitResetHEAD(rootDir, "test.txt")).to.be.rejectedWith(
        Error,
        errorMessage
      );
    });
  });

  describe("#gitStatus", ()=>{
    const rootDir = "/repo";

    beforeEach(()=>{
      sinon.stub(_internal, "gitPromise");
    });

    afterEach(()=>{
      sinon.restore();
    });

    it("should call gitStatus with correct arguments without pathspec", async ()=>{
      _internal.gitPromise.resolves("");
      await gitStatus(rootDir);

      sinon.assert.calledWith(
        _internal.gitPromise,
        rootDir,
        ["status", "--short"],
        rootDir
      );
    });
    it("should call gitStatus with correct arguments with pathspec", async ()=>{
      _internal.gitPromise.resolves("");
      await gitStatus(rootDir, "/tmp");

      sinon.assert.calledWith(
        _internal.gitPromise,
        rootDir,
        ["status", "--short", "/tmp"],
        rootDir
      );
    });

    it("should correctly parse added files", async function () {
      _internal.gitPromise.resolves("A  addedFile.txt");
      const result = await gitStatus(rootDir);
      expect(result.added).to.deep.equal(["addedFile.txt"]);
    });

    it("should correctly parse modified files", async function () {
      _internal.gitPromise.resolves("M  modifiedFile.txt");
      const result = await gitStatus(rootDir);
      expect(result.modified).to.deep.equal(["modifiedFile.txt"]);
    });

    it("should correctly parse deleted files", async function () {
      _internal.gitPromise.resolves("D  deletedFile.txt");
      const result = await gitStatus(rootDir);
      expect(result.deleted).to.deep.equal(["deletedFile.txt"]);
    });

    it("should correctly parse renamed files", async function () {
      _internal.gitPromise.resolves("R  oldName.txt -> newName.txt");
      const result = await gitStatus(rootDir);
      expect(result.renamed).to.deep.equal(["newName.txt"]);
    });

    it("should correctly parse untracked files", async function () {
      _internal.gitPromise.resolves("?? untrackedFile.txt");
      const result = await gitStatus(rootDir);
      expect(result.untracked).to.deep.equal(["untrackedFile.txt"]);
    });

    it("should return empty arrays for clean status", async function () {
      _internal.gitPromise.resolves("");
      const result = await gitStatus(rootDir);
      expect(result).to.deep.equal({
        added: [],
        modified: [],
        deleted: [],
        renamed: [],
        untracked: []
      });
    });

    it("should throw an error for unknown git status output", async function () {
      _internal.gitPromise.resolves("X  unknownFile.txt");
      await expect(gitStatus(rootDir)).to.be.rejectedWith(
        "unkonw output from git status --short"
      );
    });
  });

  describe("#gitClean", ()=>{
    const rootDir = "/repo";

    beforeEach(()=>{
      sinon.stub(_internal, "gitPromise");
    });

    afterEach(()=>{
      sinon.restore();
    });

    it("should call gitPromise with correct arguments when filePatterns is provided", async ()=>{
      _internal.gitPromise.resolves();
      const filePatterns = "*.log";

      await gitClean(rootDir, filePatterns);

      sinon.assert.calledWith(
        _internal.gitPromise,
        rootDir,
        ["clean", "-df", "-e wheel.log", "--", filePatterns],
        rootDir
      );
    });

    it("should call gitPromise with correct arguments when filePatterns is empty", async ()=>{
      _internal.gitPromise.resolves();

      await gitClean(rootDir);

      sinon.assert.calledWith(
        _internal.gitPromise,
        rootDir,
        ["clean", "-df", "-e wheel.log"],
        rootDir
      );
    });

    it("should throw an error if gitPromise fails", async ()=>{
      const errorMessage = "git clean failed";
      _internal.gitPromise.rejects(new Error(errorMessage));

      await expect(gitClean(rootDir)).to.be.rejectedWith(Error, errorMessage);
    });
  });

  describe("#getRelativeFilename", ()=>{
    const rootDir = "/repo";

    it("should return the relative path of a file inside the repo", ()=>{
      const filename = "src/index.js";
      const result = _internal.getRelativeFilename(rootDir, filename);
      expect(result).to.equal("src/index.js");
    });

    it("should resolve an absolute path to a relative path", ()=>{
      const filename = "/repo/src/index.js";
      const result = _internal.getRelativeFilename(rootDir, filename);
      expect(result).to.equal("src/index.js");
    });

    it("should return an empty string if the file is at repository root", ()=>{
      const filename = "/repo";
      const result = _internal.getRelativeFilename(rootDir, filename);
      expect(result).to.equal("");
    });

    it("should handle files outside of the repo", ()=>{
      const filename = "/other_dir/file.js";
      const result = _internal.getRelativeFilename(rootDir, filename);
      expect(result).to.equal(path.join("..", "other_dir", "file.js"));
    });
  });

  describe("#getUnsavedFiles", ()=>{
    const rootDir = "/repo";

    beforeEach(()=>{
      sinon.stub(_internal, "gitStatus");
    });

    afterEach(()=>{
      sinon.restore();
    });

    it("should return unsaved files correctly", async function () {
      _internal.gitStatus.resolves({
        added: ["newFile.txt"],
        modified: ["modifiedFile.txt"],
        deleted: ["deletedFile.txt"],
        renamed: ["renamedFile.txt"],
        untracked: []
      });
      const result = await getUnsavedFiles(rootDir);
      expect(result).to.deep.equal([
        { status: "new", name: "newFile.txt" },
        { status: "modified", name: "modifiedFile.txt" },
        { status: "deleted", name: "deletedFile.txt" },
        { status: "renamed", name: "renamedFile.txt" }
      ]);
    });

    it("should return an empty array when no unsaved files exist", async function () {
      _internal.gitStatus.resolves({
        added: [],
        modified: [],
        deleted: [],
        renamed: [],
        untracked: []
      });
      const result = await getUnsavedFiles(rootDir);
      expect(result).to.deep.equal([]);
    });

    it("should call gitStatus with correct arguments", async ()=>{
      _internal.gitStatus.resolves({
        added: [],
        modified: [],
        deleted: [],
        renamed: [],
        untracked: []
      });

      await getUnsavedFiles(rootDir);

      sinon.assert.calledWith(_internal.gitStatus, rootDir);
    });
  });

  describe("#makeLFSPattern", ()=>{
    const rootDir = "/repo";

    beforeEach(()=>{
      sinon.stub(_internal, "getRelativeFilename");
    });

    afterEach(()=>{
      sinon.restore();
    });

    it("should return a valid LFS pattern for a given file", ()=>{
      const filename = "src/index.js";
      _internal.getRelativeFilename.withArgs(rootDir, filename).returns("src/index.js");

      const result = _internal.makeLFSPattern(rootDir, filename);
      expect(result).to.equal("/src/index.js");
    });

    it("should return a valid LFS pattern for a file at the root", ()=>{
      const filename = "index.js";
      _internal.getRelativeFilename.withArgs(rootDir, filename).returns("index.js");

      const result = _internal.makeLFSPattern(rootDir, filename);
      expect(result).to.equal("/index.js");
    });

    it("should return a valid LFS pattern for a file outside the repo", ()=>{
      const filename = "/other_dir/file.js";
      _internal.getRelativeFilename
        .withArgs(rootDir, filename)
        .returns("../other_dir/file.js");

      const result = _internal.makeLFSPattern(rootDir, filename);
      expect(result).to.equal("/../other_dir/file.js");
    });
  });

  describe("#isLFS", ()=>{
    const rootDir = "/repo";

    beforeEach(()=>{
      sinon.stub(_internal, "getRelativeFilename");
      sinon.stub(_internal, "gitPromise");
    });

    afterEach(()=>{
      sinon.restore();
    });

    it("should return true if the file is tracked by LFS", async ()=>{
      const filename = "src/image.png";
      _internal.getRelativeFilename
        .withArgs(rootDir, filename)
        .returns("src/image.png");
      _internal.gitPromise.resolves(
        "Listing tracked patterns\nsrc/image.png (.gitattributes)\nListing excluded patterns"
      );

      const result = await isLFS(rootDir, filename);
      expect(result).to.be.true;
    });

    it("should return false if the file is not tracked by LFS", async ()=>{
      const filename = "src/text.txt";
      _internal.getRelativeFilename.withArgs(rootDir, filename).returns("src/text.txt");
      _internal.gitPromise.resolves("*.png (filter=lfs diff=lfs merge=lfs -text)");

      const result = await isLFS(rootDir, filename);
      expect(result).to.be.false;
    });

    it("should handle an empty LFS track list and return false", async ()=>{
      const filename = "src/unknown.dat";
      _internal.getRelativeFilename
        .withArgs(rootDir, filename)
        .returns("src/unknown.dat");
      _internal.gitPromise.resolves("");

      const result = await isLFS(rootDir, filename);
      expect(result).to.be.false;
    });

    it("should throw an error if gitPromise fails", async ()=>{
      const filename = "src/error.png";
      _internal.getRelativeFilename
        .withArgs(rootDir, filename)
        .returns("src/error.png");
      _internal.gitPromise.rejects(new Error("Git command failed"));

      await expect(isLFS(rootDir, filename)).to.be.rejectedWith(
        "Git command failed"
      );
    });
  });

  describe("#gitLFSTrack", ()=>{
    let traceStub;

    const rootDir = "/repo";
    const filename = "src/image.png";

    beforeEach(()=>{
      traceStub = sinon.stub();
      sinon.stub(_internal, "gitPromise");
      sinon.stub(_internal, "getLogger").returns({ trace: traceStub });
      sinon.stub(_internal, "gitAdd");
      sinon.stub(_internal, "makeLFSPattern").callsFake((rootDir, filename)=>{ return `/${filename}`; });
    });

    afterEach(()=>{
      sinon.restore();
    });

    it("should track a file from LFS and log the action", async ()=>{
      _internal.gitPromise.resolves();

      await gitLFSTrack(rootDir, filename);

      sinon.assert.calledWith(
        _internal.gitPromise,
        rootDir,
        ["lfs", "track", "--", "/src/image.png"],
        rootDir
      );
      sinon.assert.calledWith(
        traceStub,
        "src/image.png is treated as large file"
      );
    });

    it("should add .gitattributes to git", async ()=>{
      _internal.gitPromise.resolves();

      await gitLFSTrack(rootDir, filename);

      sinon.assert.calledWith(_internal.gitAdd, rootDir, ".gitattributes");
    });
  });

  describe("#gitLFSUntrack", ()=>{
    let traceStub;

    const rootDir = "/repo";
    const filename = "src/image.png";

    beforeEach(()=>{
      traceStub = sinon.stub();
      sinon.stub(_internal, "gitPromise");
      sinon.stub(_internal, "getLogger").returns({ trace: traceStub });
      sinon.stub(_internal.fs, "pathExists");
      sinon.stub(_internal, "gitAdd");
      sinon.stub(_internal, "makeLFSPattern").callsFake((rootDir, filename)=>{ return `/${filename}`; });
    });

    afterEach(()=>{
      sinon.restore();
    });

    it("should untrack a file from LFS and log the action", async ()=>{
      _internal.fs.pathExists.resolves(false);
      _internal.gitPromise.resolves();

      await gitLFSUntrack(rootDir, filename);

      sinon.assert.calledWith(
        _internal.gitPromise,
        rootDir,
        ["lfs", "untrack", "--", "/src/image.png"],
        rootDir
      );
      sinon.assert.calledWith(
        traceStub,
        "src/image.png never treated as large file"
      );
    });

    it("should add .gitattributes to git if it exists", async ()=>{
      _internal.fs.pathExists.resolves(true);
      _internal.gitPromise.resolves();

      await gitLFSUntrack(rootDir, filename);

      sinon.assert.calledWith(_internal.gitAdd, rootDir, ".gitattributes");
    });
  });
});
