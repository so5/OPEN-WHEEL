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
import { gitStatus, gitClean, getUnsavedFiles, _internal } from "../../../../app/core/gitOperator2.js";

chai.use(chaiFs);
chai.use(chaiAsPromised);

describe("gitOperator2-status", ()=>{
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
});