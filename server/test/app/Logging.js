/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

//setup test framework
import chai, { expect } from "chai";
import chaiFs from "chai-fs";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { logFilename } from "../../app/db/db.js";
import * as commUtils from "../../app/handlers/commUtils.js";

//testee
import { getLogger, log4js, logSettings } from "../../app/logSettings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

chai.use(chaiFs);
chai.use(sinonChai);
chai.use((_chai, _)=>{
  _chai.Assertion.addMethod("withMessage", function (msg) {
    _.flag(this, "message", msg);
  });
});
const projectRootDir = path.resolve("hoge");


describe("Unit test for log4js's helper functions", ()=>{
  let logger;
  const settings = logSettings;
  before(async ()=>{
    settings.appenders.log2client.level = "debug";
    settings.appenders.filterdFile.level = "trace";
    log4js.configure(settings);
  });
  after(async ()=>{
    settings.appenders.log2client.level = process.env.WHEEL_LOGLEVEL;
    settings.appenders.filterdFile.level = process.env.WHEEL_LOGLEVEL;
    log4js.configure(settings);
  });
  describe("#getLogger", ()=>{
    it("return log4js instance with default projectRootDir", ()=>{
      logger = getLogger();
      expect(logger.context.projectRootDir).to.equal(path.join(path.dirname(logFilename)));
    });
    it("return log4js instance with projectRootDir", ()=>{
      logger = getLogger(projectRootDir);
      expect(logger.context.projectRootDir).to.equal(projectRootDir);
    });
  });
  describe("#log", ()=>{
    let emitAll;
    beforeEach(async ()=>{
      await fs.remove(projectRootDir);
      await fs.mkdir(projectRootDir);
      emitAll = sinon.stub();
      sinon.stub(commUtils, "emitAll").callsFake(emitAll);
    });
    afterEach(async ()=>{
      sinon.restore();
      if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
        await fs.remove(path.resolve(__dirname, path.basename(logFilename)));
        await fs.remove(projectRootDir);
      }
      log4js.configure(settings);
    });
    it("should send info, warn and error log to client", ()=>{
      logger = getLogger(projectRootDir);
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");
      expect(emitAll.callCount).to.eql(2);
      const calls = emitAll.getCalls();
      expect(calls[0].args[0]).to.eql(projectRootDir);
      expect(calls[0].args[1]).to.eql("logINFO");
      expect(calls[0].args[2]).to.match(/info$/);
      expect(calls[1].args[0]).to.eql(projectRootDir);
      expect(calls[1].args[1]).to.eql("logERR");
      expect(calls[1].args[2]).to.match(/error$/);
    });
    it("should write all logs except trace to file", async ()=>{
      logger = getLogger(projectRootDir);
      logger.trace("trace");
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");
      logger.fatal("fatal");
      await logger.shutdown();

      const filename = path.resolve(projectRootDir, path.basename(logFilename));
      expect(filename).to.be.a.file();
      const log = await fs.readFile(filename).then((data)=>{
        return data.toString();
      });
      expect(log).to.match(/trace/);
      expect(log).to.match(/debug/);
      expect(log).to.match(/info/);
      expect(log).to.match(/warn/);
      expect(log).to.match(/error/);
      expect(log).to.match(/fatal/);
    });
  });
});