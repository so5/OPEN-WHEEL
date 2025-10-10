/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import sinon from "sinon";
import path from "path";

import chai, { expect } from "chai";
import chaiFs from "chai-fs";
import chaiAsPromised from "chai-as-promised";

import { isLFS, gitLFSTrack, gitLFSUntrack, _internal } from "../../../../app/core/gitOperator2.js";

chai.use(chaiFs);
chai.use(chaiAsPromised);

describe("gitOperator2-lfs", ()=>{
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
