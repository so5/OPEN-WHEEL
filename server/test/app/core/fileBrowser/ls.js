/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import { describe, it, beforeEach, afterEach } from "mocha";
import chai, { expect } from "chai";
import chaiFs from "chai-fs";
import sinon from "sinon";
import { ls, _internal } from "../../../../app/core/fileBrowser.js";

chai.use(chaiFs);

describe("#ls", ()=>{
  let readdirStub;
  let lstatStub;
  let statStub;
  let isComponentDirStub;

  beforeEach(()=>{
    readdirStub = sinon.stub(_internal.fs, "readdir");
    lstatStub = sinon.stub(_internal.fs, "lstat");
    statStub = sinon.stub(_internal.fs, "stat");
    isComponentDirStub = sinon.stub(_internal, "isComponentDir");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return empty array if the directory is empty", async ()=>{
    readdirStub.resolves([]);
    const result = await ls("/dummy/dir");
    expect(result).to.be.an("array").that.is.empty;
  });

  it("should filter out entries if allFilter does not match", async ()=>{
    readdirStub.resolves(["keepThis", "skipThis"]);
    lstatStub.resolves({ isDirectory: ()=>{ return true; }, isFile: ()=>{ return false; }, isSymbolicLink: ()=>{ return false; } });
    isComponentDirStub.resolves(false);

    const options = {
      filter: {
        all: /keep/
      }
    };
    const result = await ls("/some/dir", options);
    expect(result).to.have.lengthOf(1);
    expect(result[0]).to.include({ name: "keepThis", type: "dir" });
  });

  it("should skip lstat error entries", async ()=>{
    readdirStub.resolves(["okDir", "badEntry", "okFile"]);

    lstatStub.callsFake(async (pathName)=>{
      if (pathName.endsWith("okDir")) {
        return { isDirectory: ()=>{ return true; }, isFile: ()=>{ return false; }, isSymbolicLink: ()=>{ return false; } };
      }
      if (pathName.endsWith("badEntry")) {
        throw new Error("some lstat error");
      }
      return { isDirectory: ()=>{ return false; }, isFile: ()=>{ return true; }, isSymbolicLink: ()=>{ return false; } };
    });
    isComponentDirStub.resolves(false);

    const result = await ls("/dummy/path");
    expect(result).to.have.lengthOf(2);
    expect(result.some((e)=>{ return e.name === "okDir" && e.type === "dir"; })).to.be.true;
    expect(result.some((e)=>{ return e.name === "okFile" && e.type === "file"; })).to.be.true;
  });

  it("should skip directories if sendDirname=false, skip files if sendFilename=false", async ()=>{
    readdirStub.resolves(["someDir", "someFile"]);
    lstatStub.callsFake(async (pathName)=>{
      if (pathName.endsWith("someDir")) {
        return { isDirectory: ()=>{ return true; }, isFile: ()=>{ return false; }, isSymbolicLink: ()=>{ return false; } };
      }
      return { isDirectory: ()=>{ return false; }, isFile: ()=>{ return true; }, isSymbolicLink: ()=>{ return false; } };
    });
    isComponentDirStub.resolves(false);

    const opts1 = { sendDirname: false, sendFilename: true };
    const result1 = await ls("/test/path1", opts1);
    expect(result1).to.have.lengthOf(1);
    expect(result1[0].type).to.equal("file");

    const opts2 = { sendDirname: true, sendFilename: false };
    const result2 = await ls("/test/path2", opts2);
    expect(result2).to.have.lengthOf(1);
    expect(result2[0].type).to.equal("dir");
  });

  it("should apply dirFilter and fileFilter", async ()=>{
    readdirStub.resolves(["dirA", "dirB", "file1.txt", "file2.log"]);
    lstatStub.callsFake(async (pathName)=>{
      if (pathName.endsWith("dirA") || pathName.endsWith("dirB")) {
        return { isDirectory: ()=>{ return true; }, isFile: ()=>{ return false; }, isSymbolicLink: ()=>{ return false; } };
      }
      return { isDirectory: ()=>{ return false; }, isFile: ()=>{ return true; }, isSymbolicLink: ()=>{ return false; } };
    });
    isComponentDirStub.resolves(false);

    const options = {
      filter: {
        dir: /dirA/,
        file: /\.txt$/
      }
    };
    const result = await ls("/some/dirFilterTest", options);
    expect(result).to.have.lengthOf(2);
    expect(result.some((e)=>{ return e.name === "dirA"; })).to.be.true;
    expect(result.some((e)=>{ return e.name === "file1.txt"; })).to.be.true;
  });

  it("should correctly handle symbolic links to directories/files and push them to the list", async ()=>{
    readdirStub.resolves(["linkToDir", "linkToFile"]);
    lstatStub.resolves({
      isDirectory: ()=>{ return false; },
      isFile: ()=>{ return false; },
      isSymbolicLink: ()=>{ return true; }
    });

    statStub.callsFake(async (pathName)=>{
      if (pathName.endsWith("linkToDir")) {
        return { isDirectory: ()=>{ return true; }, isFile: ()=>{ return false; } };
      }
      return { isDirectory: ()=>{ return false; }, isFile: ()=>{ return true; } };
    });

    isComponentDirStub.resolves(true);

    const result = await ls("/some/symlinkDir");
    expect(result).to.have.lengthOf(2);

    const dirLink = result.find((e)=>{ return e.name === "linkToDir"; });
    expect(dirLink.type).to.equal("dir");
    expect(dirLink.islink).to.be.true;
    expect(dirLink.isComponentDir).to.be.true;

    const fileLink = result.find((e)=>{ return e.name === "linkToFile"; });
    expect(fileLink.type).to.equal("file");
    expect(fileLink.islink).to.be.true;
  });

  it("should handle broken symbolic link (ENOENT) as deadlink", async ()=>{
    readdirStub.resolves(["brokenLink"]);
    lstatStub.resolves({
      isDirectory: ()=>{ return false; },
      isFile: ()=>{ return false; },
      isSymbolicLink: ()=>{ return true; }
    });
    statStub.rejects({ code: "ENOENT" });

    const result = await ls("/broken/linktest");
    expect(result).to.have.lengthOf(1);
    expect(result[0]).to.include({
      name: "brokenLink",
      type: "deadlink",
      islink: true
    });
  });

  it("should throw an error if symbolic link stat error is not ENOENT", async ()=>{
    readdirStub.resolves(["someLink"]);
    lstatStub.resolves({
      isDirectory: ()=>{ return false; },
      isFile: ()=>{ return false; },
      isSymbolicLink: ()=>{ return true; }
    });
    statStub.rejects({ code: "EACCES", message: "permission denied" });

    try {
      await ls("/error/link");
      expect.fail("Expected ls to throw an error, but it did not");
    } catch (err) {
      expect(err.message).to.equal("permission denied");
    }
  });

  it("should add ../ entry if withParentDir=true", async ()=>{
    readdirStub.resolves([]);
    const options = { withParentDir: true };
    const result = await ls("/parent/dir", options);
    expect(result).to.have.lengthOf(1);
    expect(result[0]).to.include({ name: "../", type: "dir", islink: false });
  });

  it("should bundle serial-numbered files if SND=true", async ()=>{
    readdirStub.resolves(["file_001.txt", "file_002.txt", "file_003.log", "normal.txt"]);
    lstatStub.resolves({
      isDirectory: ()=>{ return false; },
      isFile: ()=>{ return true; },
      isSymbolicLink: ()=>{ return false; }
    });
    isComponentDirStub.resolves(false);

    const options = { SND: true };
    const result = await ls("/some/serial", options);
    expect(result).to.have.lengthOf(3);
    const sndItem = result.find((e)=>{ return e.type === "snd"; });
    expect(sndItem.name).to.equal("file_*.txt");
    const file003 = result.find((e)=>{ return e.name === "file_003.log"; });
    expect(file003.type).to.equal("file");
    const normalFile = result.find((e)=>{ return e.name === "normal.txt"; });
    expect(normalFile.type).to.equal("file");
  });

  it("should return sorted dirList then fileList if SND=false", async ()=>{
    readdirStub.resolves(["zzzFile", "aaaDir", "midFile"]);
    lstatStub.callsFake(async (p)=>{
      if (p.endsWith("zzzFile") || p.endsWith("midFile")) {
        return { isDirectory: ()=>{ return false; }, isFile: ()=>{ return true; }, isSymbolicLink: ()=>{ return false; } };
      }
      return { isDirectory: ()=>{ return true; }, isFile: ()=>{ return false; }, isSymbolicLink: ()=>{ return false; } };
    });
    isComponentDirStub.resolves(false);

    const result = await ls("/sort/test", { SND: false });
    expect(result).to.have.lengthOf(3);
    expect(result[0].name).to.equal("aaaDir");
    expect(result[1].name).to.equal("midFile");
    expect(result[2].name).to.equal("zzzFile");
  });

  it("should skip symbolic link to a directory if dirFilter doesn't match", async ()=>{
    readdirStub.resolves(["linkDir"]);
    lstatStub.resolves({
      isDirectory: ()=>{ return false; },
      isFile: ()=>{ return false; },
      isSymbolicLink: ()=>{ return true; }
    });
    statStub.resolves({ isDirectory: ()=>{ return true; }, isFile: ()=>{ return false; } });
    const options = {
      sendDirname: true,
      filter: {
        dir: /SHOULD_NOT_MATCH/
      }
    };
    const result = await ls("/test/symlinkDir", options);
    expect(result).to.have.lengthOf(0);
  });

  it("should skip symbolic link to a file if fileFilter doesn't match", async ()=>{
    readdirStub.resolves(["linkFile"]);
    lstatStub.resolves({
      isDirectory: ()=>{ return false; },
      isFile: ()=>{ return false; },
      isSymbolicLink: ()=>{ return true; }
    });
    statStub.resolves({ isDirectory: ()=>{ return false; }, isFile: ()=>{ return true; } });
    const options = {
      sendFilename: true,
      filter: {
        file: /\.txt$/
      }
    };
    const result = await ls("/test/symlinkFile", options);
    expect(result).to.have.lengthOf(0);
  });
});