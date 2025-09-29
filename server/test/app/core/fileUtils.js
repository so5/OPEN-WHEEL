/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const fs = require("fs-extra");
const path = require("path");
const promiseRetry = require("promise-retry");
const gitOperator2 = require("../../../app/core/gitOperator2.js");
const logSettings = require("../../../app/logSettings.js");

// NOTE:
// fileUtils.js is loaded before executing each test case.
// so, you can NOT stub modules which is required from fileUtils.js in each test case.
// you must stub modules before loading fileUtils.js.
//
// e.g.
// const fs = require("fs-extra");
// sinon.stub(fs,"readFile").resolves("foo");
// const fileUtils = require("../../../app/core/fileUtils.js"); //readfile is already stubbed
//
// FYI https://github.com/sinonjs/sinon/issues/562


describe("#readJsonGreedy", ()=>{
  let fileUtils;
  let promiseRetryStub;
  beforeEach(()=>{
    delete require.cache[require.resolve("../../../app/core/fileUtils.js")];
    promiseRetryStub = sinon.stub();
    require.cache[require.resolve("promise-retry")] = {
      exports: promiseRetryStub
    };
    sinon.stub(fs, "readFile");
    fileUtils = require("../../../app/core/fileUtils.js");

    promiseRetryStub.callsFake(async (retryFn, options)=>{
      let lastError;
      for (let i = 0; i <= (options.retries || 0); i++) {
        try {
          const result = await retryFn((err)=>{
            throw err;
          });
          return result;
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError;
    });
  });
  afterEach(()=>{
    sinon.restore();
    delete require.cache[require.resolve("promise-retry")];
  });
  it("should return parsed JSON when readFile succeeds on first try", async ()=>{
    fs.readFile.resolves(Buffer.from("{\"hello\":\"world\"}", "utf8"));
    const result = await fileUtils.readJsonGreedy("/path/to/file.json", 1);
    expect(result).to.deep.equal({ hello: "world" });
  });
  it("should retry on ENOENT and succeed on second try", async ()=>{
    fs.readFile
      .onCall(0).rejects(Object.assign(new Error("File not found"), { code: "ENOENT" }))
      .onCall(1)
      .resolves(Buffer.from("{\"retry\":\"success\"}", "utf8"));
    const result = await fileUtils.readJsonGreedy("/path/to/missing.json", 2);
    expect(fs.readFile.callCount).to.equal(2);
    expect(result).to.deep.equal({ retry: "success" });
  });
  it("should throw error if readFile fails with non-ENOENT error", async ()=>{
    fs.readFile.rejects(Object.assign(new Error("Permission denied"), { code: "EACCES" }));
    try {
      await fileUtils.readJsonGreedy("/path/to/noaccess.json", 1);
      expect.fail("Expected to throw error");
    } catch (err) {
      expect(err.message).to.equal("Permission denied");
    }
  });
  it("should retry when file content is empty", async ()=>{
    fs.readFile
      .onCall(0).resolves(Buffer.from("", "utf8"))
      .onCall(1)
      .resolves(Buffer.from("{\"ok\":\"done\"}", "utf8"));
    const result = await fileUtils.readJsonGreedy("/path/to/empty.json", 2);
    expect(fs.readFile.callCount).to.equal(2);
    expect(result).to.deep.equal({ ok: "done" });
  });
  it("should retry on SyntaxError when parsing JSON", async ()=>{
    fs.readFile
      .onCall(0).resolves(Buffer.from("{invalid JSON...", "utf8"))
      .onCall(1)
      .resolves(Buffer.from("{\"valid\":true}", "utf8"));
    const result = await fileUtils.readJsonGreedy("/path/to/syntaxerror.json", 2);
    expect(fs.readFile.callCount).to.equal(2);
    expect(result).to.deep.equal({ valid: true });
  });
  it("should throw error if parse fails with non-SyntaxError", async ()=>{
    const customError = new Error("Unknown parse error");
    const parseStub = sinon.stub(JSON, "parse").throws(customError);
    fs.readFile.resolves(Buffer.from("{\"dummy\":\"data\"}", "utf8"));
    try {
      await fileUtils.readJsonGreedy("/path/to/unknownerror.json", 1);
      expect.fail("Expected to throw custom error");
    } catch (err) {
      expect(err).to.equal(customError);
    } finally {
      parseStub.restore();
    }
  });
  it("should use default retries (10) if second argument is not a number", async ()=>{
    fs.readFile.resolves(Buffer.from("{\"default\":\"retry\"}"));
    await fileUtils.readJsonGreedy("/dummy/path.json");
    const args = promiseRetryStub.getCall(0).args[1];
    expect(args.retries).to.equal(10);
    expect(args.minTimeout).to.equal(500);
    expect(args.factor).to.equal(1);
  });
});

describe("#addX", ()=>{
  let fileUtils;
  beforeEach(()=>{
    delete require.cache[require.resolve("../../../app/core/fileUtils.js")];
    sinon.stub(fs, "stat");
    sinon.stub(fs, "chmod");
    fileUtils = require("../../../app/core/fileUtils.js");
  });
  afterEach(()=>{
    sinon.restore();
  });
  it("should set '444' if no read/write bits are set (owner/group/others)", async ()=>{
    fs.stat.resolves({ mode: 0o000 });
    fs.chmod.resolves();
    const filePath = "/dummy/path";
    await fileUtils.addX(filePath);
    expect(fs.chmod.calledOnceWithExactly(filePath, "444")).to.be.true;
  });

  it("should set '555' if only read bits are set for owner/group/others", async ()=>{
    fs.stat.resolves({ mode: 0o444 });
    fs.chmod.resolves();
    const filePath = "/dummy/path";
    await fileUtils.addX(filePath);
    expect(fs.chmod.calledOnceWithExactly(filePath, "555")).to.be.true;
  });

  it("should set '666' if only write bits are set for owner/group/others", async ()=>{
    fs.stat.resolves({ mode: 0o222 });
    fs.chmod.resolves();
    const filePath = "/dummy/path";
    await fileUtils.addX(filePath);
    expect(fs.chmod.calledOnceWithExactly(filePath, "666")).to.be.true;
  });

  it("should set '777' if read and write bits are set for owner/group/others", async ()=>{
    fs.stat.resolves({ mode: 0o666 });
    fs.chmod.resolves();
    const filePath = "/dummy/path";
    await fileUtils.addX(filePath);
    expect(fs.chmod.calledOnceWithExactly(filePath, "777")).to.be.true;
  });

  it("should set mixed bits correctly if only owner has read/write, group has read only, others none", async ()=>{
    fs.stat.resolves({ mode: 0o640 });
    fs.chmod.resolves();
    const filePath = "/dummy/path";
    await fileUtils.addX(filePath);
    expect(fs.chmod.calledOnceWithExactly(filePath, "754")).to.be.true;
  });

  it("should reject if fs.stat fails", async ()=>{
    const statError = new Error("stat error");
    fs.stat.rejects(statError);
    try {
      await fileUtils.addX("/some/path");
      expect.fail("Expected addX to reject, but it resolved");
    } catch (err) {
      expect(err).to.equal(statError);
    }
    expect(fs.chmod.called).to.be.false;
  });

  it("should reject if fs.chmod fails", async ()=>{
    fs.stat.resolves({ mode: 0o000 });
    const chmodError = new Error("chmod error");
    fs.chmod.rejects(chmodError);
    try {
      await fileUtils.addX("/some/path");
      expect.fail("Expected addX to reject, but it resolved");
    } catch (err) {
      expect(err).to.equal(chmodError);
    }
  });
});

describe("#openFile", ()=>{
  let fileUtils;
  const dummyProjectRoot = "/dummy/projectRoot";
  let loggerMock;
  beforeEach(()=>{
    delete require.cache[require.resolve("../../../app/core/fileUtils.js")];
    sinon.stub(fs, "readFile");
    sinon.stub(fs, "ensureFile");
    loggerMock = { warn: sinon.stub() };
    sinon.stub(logSettings, "getLogger").returns(loggerMock);
    fileUtils = require("../../../app/core/fileUtils.js");
  });
  afterEach(()=>{
    sinon.restore();
  });
  it("should create an empty file and return empty content object if file does not exist (ENOENT)", async ()=>{
    fs.readFile.rejects({ code: "ENOENT" });
    fs.ensureFile.resolves();
    const result = await fileUtils.openFile(dummyProjectRoot, "notExist.txt");
    expect(fs.ensureFile.calledOnce).to.be.true;
    expect(result).to.have.lengthOf(1);
    expect(result[0].content).to.equal("");
    expect(result[0].filename).to.equal("notExist.txt");
  });

  it("should throw an error if fs.readFile fails with non-ENOENT error", async ()=>{
    fs.readFile.rejects(new Error("Unknown error"));
    try {
      await fileUtils.openFile(dummyProjectRoot, "someFile.txt");
      expect.fail("Expected openFile to throw but it did not");
    } catch (err) {
      expect(err).to.be.an("Error");
      expect(err.message).to.equal("Unknown error");
    }
  });

  it("should return single object if forceNormal = true", async ()=>{
    fs.readFile.resolves(Buffer.from("normal content"));
    const result = await fileUtils.openFile(dummyProjectRoot, "normalFile.txt", true);
    expect(result).to.have.lengthOf(1);
    expect(result[0]).to.deep.include({
      content: "normal content",
      filename: "normalFile.txt"
    });
  });

  it("should return single object if JSON.parse fails (not a parameter file)", async ()=>{
    fs.readFile.resolves(Buffer.from("{ invalid JSON"));
    const result = await fileUtils.openFile(dummyProjectRoot, "invalid.json");
    expect(result).to.have.lengthOf(1);
    expect(result[0]).to.deep.include({
      filename: "invalid.json",
      content: "{ invalid JSON"
    });
  });

  it("should return single object if parsed JSON does not have targetFiles property", async ()=>{
    fs.readFile.resolves(Buffer.from("{\"someKey\": 123}"));
    const result = await fileUtils.openFile(dummyProjectRoot, "noTargetFiles.json");
    expect(result).to.have.lengthOf(1);
    expect(result[0].filename).to.equal("noTargetFiles.json");
    expect(result[0].content).to.equal("{\"someKey\": 123}");
  });

  it("should return single object if targetFiles is not an array", async ()=>{
    fs.readFile.resolves(Buffer.from("{\"targetFiles\": \"not array\"}"));
    const result = await fileUtils.openFile(dummyProjectRoot, "notArray.json");
    expect(result).to.have.lengthOf(1);
    expect(result[0].content).to.equal("{\"targetFiles\": \"not array\"}");
  });

  it("should read multiple target files if parameter setting file has array of string targetFiles", async ()=>{
    const paramFilepath = path.resolve("param.json");
    const projectJsonPath = path.resolve(dummyProjectRoot, "project.json");
    const sub1Path = path.resolve("sub1.txt");
    const sub2Path = path.resolve("sub2.txt");

    fs.readFile.withArgs(paramFilepath).resolves(Buffer.from(JSON.stringify({
      targetFiles: ["sub1.txt", "sub2.txt"]
    })));
    fs.readFile.withArgs(projectJsonPath).resolves(Buffer.from(JSON.stringify({ componentPath: {} })));
    fs.readFile.withArgs(sub1Path).resolves(Buffer.from("content sub1"));
    fs.readFile.withArgs(sub2Path).resolves(Buffer.from("content sub2"));
    const result = await fileUtils.openFile(dummyProjectRoot, "param.json");
    expect(result).to.have.lengthOf(3);
    expect(result[0]).to.include({
      filename: "param.json",
      isParameterSettingFile: true
    });
    expect(result[1]).to.include({
      content: "content sub1",
      filename: "sub1.txt"
    });
    expect(result[2]).to.include({
      content: "content sub2",
      filename: "sub2.txt"
    });
  });

  it("should handle target files which are object with only targetName (no targetNode)", async ()=>{
    const paramFilepath = path.resolve("paramObj.json");
    const projectJsonPath = path.resolve(dummyProjectRoot, "project.json");
    const helloPath = path.resolve("hello.txt");
    fs.readFile.withArgs(paramFilepath).resolves(Buffer.from(JSON.stringify({
      targetFiles: [
        { targetName: "hello.txt" }
      ]
    })));
    fs.readFile.withArgs(projectJsonPath).resolves(Buffer.from(JSON.stringify({ componentPath: {} })));
    fs.readFile.withArgs(helloPath).resolves(Buffer.from("hello content"));
    const result = await fileUtils.openFile(dummyProjectRoot, "paramObj.json");
    expect(result).to.have.lengthOf(2);
    expect(result[0]).to.have.property("isParameterSettingFile", true);
    expect(result[1]).to.include({
      filename: "hello.txt",
      content: "hello content"
    });
  });
});

describe("#saveFile", ()=>{
  let fileUtils;
  beforeEach(()=>{
    delete require.cache[require.resolve("../../../app/core/fileUtils.js")];
    sinon.stub(fs, "writeFile").resolves();
    sinon.stub(fs, "pathExists");
    sinon.stub(path, "resolve");
    sinon.stub(path, "parse");
    sinon.stub(path, "dirname");
    sinon.stub(path, "join");
    sinon.stub(gitOperator2, "gitAdd").resolves();
    fileUtils = require("../../../app/core/fileUtils.js");
  });
  afterEach(()=>{
    sinon.restore();
  });
  it("should save file and add to git when .git directory is found at the same level", async ()=>{
    path.resolve.returns("/home/user/project/file.txt");
    path.parse.returns({
      root: "/home",
      dir: "/home/user/project",
      base: "file.txt",
      name: "file",
      ext: ".txt"
    });
    path.dirname.onCall(0).returns("/home/user/project");
    path.join.callsFake((dir, file)=>`${dir}/${file}`);
    fs.pathExists.resolves(true);
    await fileUtils.saveFile("file.txt", "Hello, world!");
    expect(fs.writeFile.calledOnceWithExactly(
      "/home/user/project/file.txt",
      "Hello, world!"
    )).to.be.true;
    expect(fs.pathExists.calledOnceWithExactly("/home/user/project/.git")).to.be.true;
    expect(gitOperator2.gitAdd.calledOnceWithExactly(
      "/home/user/project",
      "/home/user/project/file.txt"
    )).to.be.true;
  });

  it("should climb up directories until .git is found", async ()=>{
    path.resolve.returns("/home/user/project/subdir/file.txt");
    path.parse.returns({
      root: "/home",
      dir: "/home/user/project/subdir",
      base: "file.txt",
      name: "file",
      ext: ".txt"
    });
    path.dirname.onCall(0).returns("/home/user/project/subdir");
    path.dirname.onCall(1).returns("/home/user/project");
    path.dirname.onCall(2).returns("/home/user");
    path.join.callsFake((dir, file)=>`${dir}/${file}`);
    fs.pathExists.onCall(0).resolves(false);
    fs.pathExists.onCall(1).resolves(true);
    await fileUtils.saveFile("/someRelativePath/file.txt", "Some content");
    expect(fs.writeFile.calledOnceWithExactly(
      "/home/user/project/subdir/file.txt",
      "Some content"
    )).to.be.true;
    expect(fs.pathExists.getCall(0).args[0]).to.equal("/home/user/project/subdir/.git");
    expect(fs.pathExists.getCall(1).args[0]).to.equal("/home/user/project/.git");
    expect(gitOperator2.gitAdd.calledOnceWithExactly(
      "/home/user/project",
      "/home/user/project/subdir/file.txt"
    )).to.be.true;
  });

  it("should throw an error if no .git repository is found up to root directory", async ()=>{
    path.resolve.returns("/home/user/project/file.txt");
    path.parse.returns({
      root: "/home",
      dir: "/home/user/project",
      base: "file.txt",
      name: "file",
      ext: ".txt"
    });
    path.dirname.onCall(0).returns("/home/user/project");
    path.dirname.onCall(1).returns("/home/user");
    path.dirname.onCall(2).returns("/home");
    fs.pathExists.resolves(false);
    try {
      await fileUtils.saveFile("file.txt", "No .git anywhere");
      expect.fail("Expected an error but none was thrown");
    } catch (err) {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal("git repository not found");
      expect(err.filename).to.equal("file.txt");
      expect(err.absFilename).to.equal("/home/user/project/file.txt");
    }
    expect(gitOperator2.gitAdd.notCalled).to.be.true;
  });

  it("should throw an error if fs.writeFile fails", async ()=>{
    path.resolve.returns("/home/user/project/file.txt");
    path.parse.returns({
      root: "/home",
      dir: "/home/user/project",
      base: "file.txt",
      name: "file",
      ext: ".txt"
    });
    path.dirname.returns("/home/user/project");
    path.join.returns("/home/user/project/.git");
    const writeError = new Error("Write operation failed");
    fs.writeFile.rejects(writeError);
    fs.pathExists.resolves(true);
    try {
      await fileUtils.saveFile("file.txt", "some content");
      expect.fail("Expected an error due to fs.writeFile, but none was thrown");
    } catch (err) {
      expect(err).to.equal(writeError);
    }
    expect(gitOperator2.gitAdd.notCalled).to.be.true;
  });
});

describe("#getUnusedPath", ()=>{
  let fileUtils;
  beforeEach(()=>{
    delete require.cache[require.resolve("../../../app/core/fileUtils.js")];
    sinon.stub(fs, "pathExists");
    fileUtils = require("../../../app/core/fileUtils.js");
  });
  afterEach(()=>{
    sinon.restore();
  });
  it("should return the desired path if it does not exist", async ()=>{
    fs.pathExists.resolves(false);
    const parent = "/mock/parent/dir";
    const name = "testFile.txt";
    const result = await fileUtils.getUnusedPath(parent, name);
    expect(fs.pathExists.calledOnceWithExactly("/mock/parent/dir/testFile.txt")).to.be.true;
    expect(result).to.equal("/mock/parent/dir/testFile.txt");
  });
  it("should return a suffixed path if the desired path already exists", async ()=>{
    fs.pathExists
      .onFirstCall().resolves(true)
      .onSecondCall()
      .resolves(true)
      .onThirdCall()
      .resolves(false);
    const parent = "/mock/parent/dir";
    const name = "testFile.txt";
    const result = await fileUtils.getUnusedPath(parent, name);
    expect(fs.pathExists.callCount).to.equal(3);
    expect(fs.pathExists.getCall(0).args[0]).to.equal("/mock/parent/dir/testFile.txt");
    expect(fs.pathExists.getCall(1).args[0]).to.equal("/mock/parent/dir/testFile.txt.1");
    expect(fs.pathExists.getCall(2).args[0]).to.equal("/mock/parent/dir/testFile.txt.2");
    expect(result).to.equal("/mock/parent/dir/testFile.txt.2");
  });
});

describe("#replaceCRLF", ()=>{
  let fileUtils;
  beforeEach(()=>{
    delete require.cache[require.resolve("../../../app/core/fileUtils.js")];
    sinon.stub(fs, "readFile");
    sinon.stub(fs, "writeFile");
    fileUtils = require("../../../app/core/fileUtils.js");
  });
  afterEach(()=>{
    sinon.restore();
  });
  it("should replace CRLF with LF and write the file back", async ()=>{
    fs.readFile.resolves(Buffer.from("line1\r\nline2\r\n"));
    fs.writeFile.resolves();
    await fileUtils.replaceCRLF("/path/to/windowsfile.txt");
    expect(fs.readFile.calledOnceWithExactly("/path/to/windowsfile.txt")).to.be.true;
    expect(fs.writeFile.calledOnce).to.be.true;
    const writeArgs = fs.writeFile.getCall(0).args;
    expect(writeArgs[0]).to.equal("/path/to/windowsfile.txt");
    expect(writeArgs[1]).to.equal("line1\nline2\n");
  });
  it("should keep LF as is if there is no CRLF", async ()=>{
    fs.readFile.resolves(Buffer.from("line1\nline2\n"));
    fs.writeFile.resolves();
    await fileUtils.replaceCRLF("/path/to/unixfile.txt");
    expect(fs.readFile.calledOnceWithExactly("/path/to/unixfile.txt")).to.be.true;
    expect(fs.writeFile.calledOnce).to.be.true;
    const writeArgs = fs.writeFile.getCall(0).args;
    expect(writeArgs[0]).to.equal("/path/to/unixfile.txt");
    expect(writeArgs[1]).to.equal("line1\nline2\n");
  });
  it("should reject if readFile fails", async ()=>{
    fs.readFile.rejects(new Error("readFile error"));
    try {
      await fileUtils.replaceCRLF("/path/to/errorfile.txt");
      expect.fail("Expected an error but none was thrown");
    } catch (err) {
      expect(err.message).to.equal("readFile error");
    }
    expect(fs.writeFile.called).to.be.false;
  });
  it("should reject if writeFile fails", async ()=>{
    fs.readFile.resolves(Buffer.from("line1\r\nline2\r\n"));
    fs.writeFile.rejects(new Error("writeFile error"));
    try {
      await fileUtils.replaceCRLF("/path/to/errorfile2.txt");
      expect.fail("Expected an error but none was thrown");
    } catch (err) {
      expect(err.message).to.equal("writeFile error");
    }
  });
});