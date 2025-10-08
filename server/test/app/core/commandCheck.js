/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const path = require("path");
const fs = require("fs-extra");
const { expect } = require("chai");
const { describe, it, before, after, beforeEach, afterEach } = require("mocha");
const tmp = require("tmp-promise");

describe("commandCheck", ()=>{
  let checkAllCommands;
  let commands;
  const serverConfigDir = path.resolve(process.cwd(), "config");
  const appConfigDir = path.resolve(process.cwd(), "app/config");
  let originalNodeEnv;

  before(async ()=>{
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";

    // for logSettings.js
    await fs.mkdir(serverConfigDir, { recursive: true });
    await fs.writeJson(path.resolve(serverConfigDir, "log.json"), {
      appenders: {
        stdout: {
          type: "stdout"
        }
      },
      categories: {
        default: {
          appenders: ["stdout"],
          level: "off"
        }
      }
    });

    // for db.js
    await fs.mkdir(appConfigDir, { recursive: true });
    await fs.writeJson(path.resolve(appConfigDir, "remotehost.json"), []);
    await fs.writeJson(path.resolve(appConfigDir, "server.json"), {});
    await fs.writeJson(path.resolve(appConfigDir, "jobScheduler.json"), {});
    await fs.writeJson(path.resolve(appConfigDir, "jobScriptTemplate.json"), []);
    await fs.writeJson(path.resolve(appConfigDir, "projectList.json"), []);
    await fs.writeJson(path.resolve(appConfigDir, "credentials.json"), {});
    await fs.writeFile(path.resolve(appConfigDir, "server.key"), "dummy key");
    await fs.writeFile(path.resolve(appConfigDir, "server.crt"), "dummy crt");

    const checkAllCommandsModule = require("../../../app/core/commandCheck.js");
    checkAllCommands = checkAllCommandsModule;
    commands = checkAllCommandsModule._internal.commands;
  });

  after(async ()=>{
    process.env.NODE_ENV = originalNodeEnv;
    await fs.remove(serverConfigDir);
    await fs.remove(appConfigDir);
    delete require.cache[require.resolve("../../../app/core/commandCheck.js")];
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