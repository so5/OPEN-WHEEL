/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import path from "path";
import fs from "fs-extra";
import { expect } from "chai";
import { describe, it, before, after, beforeEach, afterEach } from "mocha";
import tmp from "tmp-promise";
import checkAllCommands, { _internal } from "../../../app/core/commandCheck.js";

describe("commandCheck", ()=>{
  let commands;
  let originalNodeEnv;

  before(()=>{
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    commands = _internal.commands;
  });

  after(()=>{
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("checkAllCommands", ()=>{
    let orgPath;
    let tmpdir;

    beforeEach(async ()=>{
      tmpdir = await tmp.dir({ unsafeCleanup: true });
      orgPath = process.env.PATH;
      process.env.PATH = tmpdir.path;
    });

    afterEach(async ()=>{
      process.env.PATH = orgPath;
      await tmpdir.cleanup();
    });

    it("should be true if all commands are available", async ()=>{
      await Promise.all(
        commands.map(async (command)=>{
          const dummyCommand = path.resolve(tmpdir.path, command);
          await fs.writeFile(dummyCommand, "#!/bin/sh\nexit 0");
          await fs.chmod(dummyCommand, "755");
        })
      );
      const result = await checkAllCommands();
      expect(result).to.be.true;
    });

    it("should be false if some command is not available", async ()=>{
      const partialCommands = commands.slice(0, 2);
      await Promise.all(
        partialCommands.map(async (command)=>{
          const dummyCommand = path.resolve(tmpdir.path, command);
          await fs.writeFile(dummyCommand, "#!/bin/sh\nexit 0");
          await fs.chmod(dummyCommand, "755");
        })
      );
      const result = await checkAllCommands();
      expect(result).to.be.false;
    });
  });
});