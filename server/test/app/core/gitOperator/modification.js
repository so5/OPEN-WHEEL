/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import sinon from "sinon";
import chai, { expect } from "chai";
import chaiFs from "chai-fs";
import chaiAsPromised from "chai-as-promised";
import { gitCommit, gitAdd, gitRm, gitResetHEAD, _internal } from "../../../../app/core/gitOperator2.js";

chai.use(chaiFs);
chai.use(chaiAsPromised);

describe("gitOperator2-modification", ()=>{
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
});