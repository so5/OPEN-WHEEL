/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";

//setup test framework
import { expect } from "chai";
import path from "path";
import fs from "fs-extra";
import sinon from "sinon";
import { createHash } from "crypto";
import { fileURLToPath } from "url";

//testee
import { getTempd, removeTempd, createTempd, _internal } from "../../../app/core/tempd.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("UT for tempd class", function () {
  describe("#getTempd", ()=>{
    const projectRootDir = "/test/project";
    const prefix = "viewer";
    const tempdRoot = process.env.WHEEL_TEMPD || path.dirname(__dirname);
    beforeEach(()=>{
      sinon.replace(_internal, "tempdRoot", tempdRoot);
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should return the correct temporary directory path", async ()=>{
      //ハッシュを計算して期待されるパスを作成
      const hash = createHash("sha256");
      const ID = hash.update(projectRootDir).digest("hex");
      const expectedPath = path.resolve(tempdRoot, prefix, ID);
      const result = await getTempd(projectRootDir, prefix);
      expect(result).to.equal(expectedPath);
    });
    it("should generate different paths for different project directories", async ()=>{
      const anotherProjectRoot = "/test/another_project";
      const hash1 = createHash("sha256").update(projectRootDir)
        .digest("hex");
      const hash2 = createHash("sha256").update(anotherProjectRoot)
        .digest("hex");
      const expectedPath1 = path.resolve(tempdRoot, prefix, hash1);
      const expectedPath2 = path.resolve(tempdRoot, prefix, hash2);
      const result1 = await getTempd(projectRootDir, prefix);
      const result2 = await getTempd(anotherProjectRoot, prefix);
      expect(result1).to.equal(expectedPath1);
      expect(result2).to.equal(expectedPath2);
      expect(result1).to.not.equal(result2);
    });
    it("should generate different paths for different prefixes", async ()=>{
      const anotherPrefix = "download";
      const hash = createHash("sha256").update(projectRootDir)
        .digest("hex");
      const expectedPath1 = path.resolve(tempdRoot, prefix, hash);
      const expectedPath2 = path.resolve(tempdRoot, anotherPrefix, hash);
      const result1 = await getTempd(projectRootDir, prefix);
      const result2 = await getTempd(projectRootDir, anotherPrefix);
      expect(result1).to.equal(expectedPath1);
      expect(result2).to.equal(expectedPath2);
      expect(result1).to.not.equal(result2);
    });
  });
  describe("#removeTempd", ()=>{
    const projectRootDir = "/test/project";
    const prefix = "viewer";
    const tempdRoot = process.env.WHEEL_TEMPD || path.dirname(__dirname);
    let tempDirPath;
    beforeEach(()=>{
      sinon.replace(_internal, "tempdRoot", tempdRoot);
      //ハッシュを計算して削除対象のディレクトリを決定
      const hash = createHash("sha256")
        .update(projectRootDir)
        .digest("hex");
      tempDirPath = path.resolve(tempdRoot, prefix, hash);
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should remove the temporary directory", async ()=>{
      const removeStub = sinon.stub(_internal.fs, "remove").resolves();
      sinon.stub(_internal, "getLogger").returns({ debug: sinon.stub() });
      await removeTempd(projectRootDir, prefix);
      expect(removeStub.calledOnceWithExactly(tempDirPath)).to.be.true;
    });
    it("should log the removal of the temporary directory", async ()=>{
      const logStub = {
        debug: sinon.stub()
      };
      sinon.stub(_internal, "getLogger").returns(logStub);
      sinon.stub(_internal.fs, "remove").resolves();
      await removeTempd(projectRootDir, prefix);
      expect(logStub.debug.calledOnceWithExactly(`remove temporary directory ${tempDirPath}`)).to.be.true;
    });
    it("should handle errors gracefully", async ()=>{
      const error = new Error("Failed to remove directory");
      const removeStub = sinon.stub(_internal.fs, "remove").rejects(error);
      sinon.stub(_internal, "getLogger").returns({ debug: sinon.stub() });

      try {
        await removeTempd(projectRootDir, prefix);
      } catch (err) {
        expect(err).to.equal(error);
      }
      expect(removeStub.calledOnceWithExactly(tempDirPath)).to.be.true;
    });
  });
  describe("#createTempd", ()=>{
    const projectRootDir = "/test/project";
    const prefix = "viewer";
    let tempDirPath, rootPath;
    const tempdRoot = process.env.WHEEL_TEMPD || path.dirname(__dirname);

    beforeEach(()=>{
      //ハッシュを計算してディレクトリパスを決定
      const hash = createHash("sha256")
        .update(projectRootDir)
        .digest("hex");
      sinon.replace(_internal, "tempdRoot", tempdRoot);
      rootPath = path.resolve(tempdRoot, prefix);
      tempDirPath = path.resolve(rootPath, hash);
    });

    afterEach(()=>{
      sinon.restore();
    });

    it("should create the temporary directory and return its path", async ()=>{
      sinon.stub(_internal.fs, "emptyDir").resolves();
      sinon.stub(_internal, "getLogger").returns({ debug: sinon.stub() });
      const result = await createTempd(projectRootDir, prefix);
      expect(result).to.deep.equal({ dir: tempDirPath, root: rootPath });
    });

    it("should handle errors gracefully", async ()=>{
      const error = new Error("Failed to create directory");
      sinon.stub(_internal.fs, "emptyDir").rejects(error);
      sinon.stub(_internal, "getLogger").returns({ debug: sinon.stub() });

      try {
        await createTempd(projectRootDir, prefix);
      } catch (err) {
        expect(err).to.equal(error);
      }
    });
  });
});
