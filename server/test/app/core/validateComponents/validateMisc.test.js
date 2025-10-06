/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const path = require("path");
const fs = require("fs-extra");
const sinon = require("sinon");

//setup test framework
const chai = require("chai");
const expect = chai.expect;
chai.use(require("sinon-chai"));
chai.use(require("chai-fs"));
chai.use(require("chai-json-schema"));
chai.use(require("deep-equal-in-any-order"));
chai.use(require("chai-as-promised"));
const { createNewProject, createNewComponent } = require("../../../../app/core/projectFilesOperator");

//testee
const {
  checkScript,
  validateConditionalCheck,
  validateParameterStudy,
  validateStorage,
  validateInputFiles,
  validateOutputFiles,
  _internal
} = require("../../../../app/core/validateComponents.js");


//test data
const testDirRoot = "WHEEL_TEST_TMP";

const projectRootDir = path.resolve(testDirRoot, "testProject.wheel");
describe("validateMisc UT", function() {
  beforeEach(async function() {
    this.timeout(10000);
    await fs.remove(testDirRoot);
    sinon.stub(_internal.remoteHost, "query").callsFake((name, hostname) => {
      if (hostname === "OK") {
        return { name: "dummy" };
      }
      if (hostname === "jobOK") {
        return { name: "dummy", jobScheduler: "hoge" };
      }
      if (hostname === "stepjobNG") {
        return { name: "dummy", jobScheduler: "huga" };
      }
      if (hostname === "stepjobOK") {
        return { name: "dummy", jobScheduler: "huga", useStepjob: true };
      }
      if (hostname === "bulkjobNG") {
        return { name: "dummy", jobScheduler: "hige" };
      }
      if (hostname === "bulkjobOK") {
        return { name: "dummy", jobScheduler: "hige", useBulkjob: true };
      }
      return undefined;
    });

    sinon.stub(_internal, "jobScheduler").value({
      hoge: { queueOpt: "-q" },
      huga: { queueOpt: "-q", supportStepjob: true },
      hige: { queueOpt: "-q", supportBulkjob: true }
    });

    try {
      await createNewProject(projectRootDir, "test project", null, "test", "test@example.com");
    } catch (e) {
      console.log(e);
      throw e;
    }
  });
  afterEach(() => {
    sinon.restore();
  });
  after(async () => {
    if (!process.env.WHEEL_KEEP_FILES_AFTER_LAST_TEST) {
      await fs.remove(testDirRoot);
    }
  });
  describe("checkScript", () => {
    //各テストケースで独自にコンポーネントを作成する

    it("should be rejected if script is not specified", async () => {
      //コンポーネントを作成
      const component = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //scriptプロパティが指定されていない場合
      await expect(checkScript(projectRootDir, component)).to.be.rejectedWith("script is not specified");
    });

    it("should be rejected if script is empty string", async () => {
      //コンポーネントを作成
      const component = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //scriptプロパティが空文字列の場合
      component.script = "";
      await expect(checkScript(projectRootDir, component)).to.be.rejectedWith(/script is not file/);
    });

    it("should be rejected if script file does not exist", async () => {
      //コンポーネントを作成
      const component = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //スクリプトファイルが存在しない場合
      component.script = "nonexistent_script.sh";
      await expect(checkScript(projectRootDir, component)).to.be.rejectedWith("script is not existing file");
    });

    it("should be rejected if script is a directory", async () => {
      //コンポーネントを作成
      const component = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //スクリプトがディレクトリの場合
      component.script = "script_dir";
      fs.mkdirSync(path.resolve(projectRootDir, component.name, "script_dir"));
      await expect(checkScript(projectRootDir, component)).to.be.rejectedWith("script is not file");
    });

    it("should be resolved with true if script is a valid file", async () => {
      //コンポーネントを作成
      const component = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //スクリプトが有効なファイルの場合
      component.script = "valid_script.sh";
      fs.writeFileSync(path.resolve(projectRootDir, component.name, "valid_script.sh"), "#!/bin/bash\necho 'Hello'");
      const result = await checkScript(projectRootDir, component);
      expect(result).to.be.true;
    });

    it("should handle fs.stat errors other than ENOENT", async () => {
      //コンポーネントを作成
      const component = await createNewComponent(projectRootDir, projectRootDir, "task", { x: 0, y: 0 });

      //fs.statがENOENT以外のエラーを投げる場合
      component.script = "error_script.sh";
      fs.writeFileSync(path.resolve(projectRootDir, component.name, "error_script.sh"), "#!/bin/bash\necho 'Hello'");

      //fs.statをモック化してエラーを投げるようにする
      sinon.stub(fs, "stat").rejects(Object.assign(new Error("Permission denied"), { code: "EACCES" }));

      //エラーが伝播することを確認
      await expect(checkScript(projectRootDir, component)).to.be.rejectedWith("Permission denied");
    });
  });
  describe("validateConditionalCheck", () => {
    let ifComponent;
    let whileComponent;
    beforeEach(async () => {
      ifComponent = await createNewComponent(projectRootDir, projectRootDir, "if", { x: 0, y: 0 });
      whileComponent = await createNewComponent(projectRootDir, projectRootDir, "while", { x: 0, y: 0 });
    });
    it("should reject if condition is not specified", () => {
      expect(validateConditionalCheck(projectRootDir, ifComponent)).to.be.rejectedWith("condition is not specified");
      return expect(validateConditionalCheck(projectRootDir, whileComponent)).to.be.rejectedWith("condition is not specified");
    });
    it("should reject if condition exists but it is not file", () => {
      ifComponent.condition = "hoge";
      fs.mkdirSync(path.resolve(projectRootDir, ifComponent.name, "hoge"));
      whileComponent.condition = "hoge";
      fs.mkdirSync(path.resolve(projectRootDir, whileComponent.name, "hoge"));
      expect(validateConditionalCheck(projectRootDir, ifComponent)).to.be.rejectedWith(/condition is exist but it is not file .*/);
      return expect(validateConditionalCheck(projectRootDir, whileComponent)).to.be.rejectedWith(/condition is exist but it is not file .*/);
    });

    it("should be resolved with true if condition is a valid file", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testIfComponent = await createNewComponent(projectRootDir, projectRootDir, "if", { x: 0, y: 0 });
      const testWhileComponent = await createNewComponent(projectRootDir, projectRootDir, "while", { x: 0, y: 0 });

      //条件ファイルを作成
      testIfComponent.condition = "valid_condition.js";
      testWhileComponent.condition = "valid_condition.js";

      const ifConditionPath = path.resolve(projectRootDir, testIfComponent.name, "valid_condition.js");
      const whileConditionPath = path.resolve(projectRootDir, testWhileComponent.name, "valid_condition.js");

      await fs.writeFile(ifConditionPath, "module.exports = function() { return true; }");
      await fs.writeFile(whileConditionPath, "module.exports = function() { return true; }");

      //テスト実行
      expect(await validateConditionalCheck(projectRootDir, testIfComponent)).to.be.true;
      expect(await validateConditionalCheck(projectRootDir, testWhileComponent)).to.be.true;
    });

    it("should be resolved with true if condition is a JavaScript expression", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testIfComponent = await createNewComponent(projectRootDir, projectRootDir, "if", { x: 0, y: 0 });
      const testWhileComponent = await createNewComponent(projectRootDir, projectRootDir, "while", { x: 0, y: 0 });

      //JavaScriptの式として評価される条件を設定
      testIfComponent.condition = "js_expression.js";
      testWhileComponent.condition = "js_expression.js";

      //条件ファイルを作成（中身はJavaScriptの式）
      const ifConditionPath = path.resolve(projectRootDir, testIfComponent.name, "js_expression.js");
      const whileConditionPath = path.resolve(projectRootDir, testWhileComponent.name, "js_expression.js");

      await fs.writeFile(ifConditionPath, "module.exports = function() { return true; }");
      await fs.writeFile(whileConditionPath, "module.exports = function() { return 1 < 2; }");

      //テスト実行
      expect(await validateConditionalCheck(projectRootDir, testIfComponent)).to.be.true;
      expect(await validateConditionalCheck(projectRootDir, testWhileComponent)).to.be.true;
    });
  });
  describe("validateParameterStudy", () => {
    let ps;
    beforeEach(async () => {
      ps = await createNewComponent(projectRootDir, projectRootDir, "PS", { x: 0, y: 0 });
    });
    it("should be rejected if parameterFile is not set", () => {
      ps.parameterFile = null;
      return expect(validateParameterStudy(projectRootDir, ps)).to.be.rejectedWith("parameter setting file is not specified");
    });
    it("should be rejected if parameterFile is not file", () => {
      ps.parameterFile = "hoge";
      fs.mkdirSync(path.resolve(projectRootDir, ps.name, "hoge"));
      return expect(validateParameterStudy(projectRootDir, ps)).to.be.rejectedWith("parameter setting file is not file");
    });
    it("should be rejected if parameterFile is not valid JSON file", () => {
      ps.parameterFile = "hoge";
      fs.writeFileSync(path.resolve(projectRootDir, ps.name, "hoge"), "hoge");
      return expect(validateParameterStudy(projectRootDir, ps)).to.be.rejectedWith("parameter setting file is not JSON file");
    });
    it("should be resolved with true if required prop is set", async () => {
      ps.parameterFile = "hoge";
      const params = {
        version: 2,
        targetFiles: [
          { targetName: "foo" }
        ],
        params: [
          { keyword: "foo", type: "min-max-step", min: 0, max: 4, step: 1 }
        ]
      };

      fs.writeJsonSync(path.resolve(projectRootDir, ps.name, "hoge"), params);
      expect(await validateParameterStudy(projectRootDir, ps)).to.be.true;
    });

    it("should be rejected if parameter file is missing required properties", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testPS = await createNewComponent(projectRootDir, projectRootDir, "PS", { x: 0, y: 0 });

      //パラメータファイルを設定
      testPS.parameterFile = "invalid_params.json";

      //必要なプロパティが欠けているJSONファイルを作成
      const invalidParams = {
        version: 2,
        //targetFilesが欠けている
        params: [
          { keyword: "foo", type: "min-max-step", min: 0, max: 4, step: 1 }
        ]
      };

      fs.writeJsonSync(path.resolve(projectRootDir, testPS.name, "invalid_params.json"), invalidParams);

      const validate = sinon.stub().returns(false);
      validate.errors = [{ message: "should have required property 'targetFiles'" }];
      sinon.stub(_internal, "validate").value(validate);

      //テスト実行
      await expect(validateParameterStudy(projectRootDir, testPS)).to.be.rejectedWith("parameter setting file does not have valid JSON data");
    });

    it("should be rejected if parameter file has incorrect property types", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testPS = await createNewComponent(projectRootDir, projectRootDir, "PS", { x: 0, y: 0 });

      //パラメータファイルを設定
      testPS.parameterFile = "wrong_types.json";

      //プロパティの型が正しくないJSONファイルを作成
      const wrongTypeParams = {
        version: "2", //数値ではなく文字列
        targetFiles: [
          { targetName: "foo" }
        ],
        params: [
          { keyword: "foo", type: "min-max-step", min: "0", max: "4", step: "1" } //数値ではなく文字列
        ]
      };

      fs.writeJsonSync(path.resolve(projectRootDir, testPS.name, "wrong_types.json"), wrongTypeParams);

      const validate = sinon.stub().returns(false);
      validate.errors = [{ message: "should be number" }];
      sinon.stub(_internal, "validate").value(validate);

      //テスト実行
      await expect(validateParameterStudy(projectRootDir, testPS)).to.be.rejectedWith("parameter setting file does not have valid JSON data");
    });

    it("should be rejected if parameter file has incorrect version", async function() {
      //各テストケースで新しいコンポーネントを作成
      const testPS = await createNewComponent(projectRootDir, projectRootDir, "PS", { x: 0, y: 0 });

      //パラメータファイルを設定
      testPS.parameterFile = "wrong_version.json";

      //バージョンが正しくないJSONファイルを作成
      const wrongVersionParams = {
        version: 1, //バージョン1は無効
        targetFiles: [
          { targetName: "foo" }
        ],
        params: [
          { keyword: "foo", type: "min-max-step", min: 0, max: 4, step: 1 }
        ]
      };

      fs.writeJsonSync(path.resolve(projectRootDir, testPS.name, "wrong_version.json"), wrongVersionParams);
      const validate = sinon.stub().returns(false);
      validate.errors = [{ message: "should be equal to constant" }];
      sinon.stub(_internal, "validate").value(validate);

      //テスト実行
      await expect(validateParameterStudy(projectRootDir, testPS)).to.be.rejectedWith("parameter setting file does not have valid JSON data");
    });
  });
  describe("validateStorage", () => {
    let storage;
    beforeEach(async () => {
      storage = await createNewComponent(projectRootDir, projectRootDir, "storage", { x: 0, y: 0 });
    });
    it("should be rejected if storagePath is not set", () => {
      storage.storagePath = null;
      return expect(validateStorage(storage)).to.be.rejectedWith("storagePath is not set");
    });
    it("should be rejected if storagePath is empty string", () => {
      storage.storagePath = "";
      return expect(validateStorage(storage)).to.be.rejectedWith("specified path does not exist on localhost");
    });
    it("should be rejected if storagePath is blank", () => {
      storage.storagePath = "   ";
      return expect(validateStorage(storage)).to.be.rejectedWith("specified path does not exist on localhost");
    });
    it("should be rejected if storagePath is not existing path", () => {
      storage.storagePath = path.resolve(projectRootDir, "hoge");
      return expect(validateStorage(storage)).to.be.rejectedWith("specified path does not exist on localhost");
    });
    it("should be rejected if storagePath is existing file", () => {
      fs.writeFileSync(path.resolve(projectRootDir, "hoge"), "hoge");
      storage.storagePath = path.resolve(projectRootDir, "hoge");
      return expect(validateStorage(storage)).to.be.rejectedWith("specified path is not directory");
    });
    it("should be rejected if invalid host is set", () => {
      storage.host = "hoge";
      storage.storagePath = "hoge";
      return expect(validateStorage(storage)).to.be.rejectedWith(/remote host setting for .* not found/);
    });
    it("should be resolved with true if storagePath is not existing path but host is set", async () => {
      storage.storagePath = path.resolve(projectRootDir, "hoge");
      storage.host = "OK";
      expect(await validateStorage(storage)).to.be.true;
    });
    it("should be resolved with true if storagePath is existing file but host is set", async () => {
      fs.writeFileSync(path.resolve(projectRootDir, "hoge"), "hoge");
      storage.storagePath = path.resolve(projectRootDir, "hoge");
      storage.host = "OK";
      expect(await validateStorage(storage)).to.be.true;
    });
    it("should be resolved with true if storagePath is existing directory", async () => {
      //projectRootDirは既に存在するディレクトリ
      storage.storagePath = projectRootDir;
      expect(await validateStorage(storage)).to.be.true;
    });
    it("should be resolved with true if storagePath is existing directory and host is set", async () => {
      storage.storagePath = projectRootDir;
      storage.host = "OK";
      expect(await validateStorage(storage)).to.be.true;
    });
    it("should be resolved with true if storagePath is relative path and host is set", async () => {
      storage.storagePath = "./relative/path";
      storage.host = "OK";
      expect(await validateStorage(storage)).to.be.true;
    });
    it("should be resolved with true if storagePath is absolute path and host is set", async () => {
      storage.storagePath = "/absolute/path";
      storage.host = "OK";
      expect(await validateStorage(storage)).to.be.true;
    });
  });
  describe("validateInputFiles", () => {
    let component;
    beforeEach(() => {
      component = { inputFiles: [] };
    });
    it("should be rejected if one of input filename is invalid", () => {
      component.inputFiles.push({ name: "hoge", src: [] });
      component.inputFiles.push({ name: "h*ge", src: [] });
      return expect(validateInputFiles(component)).to.be.rejectedWith(/.* is not allowed as input file./);
    });
    it("should be rejected if input filename is null", () => {
      component.inputFiles.push({ name: null, src: [] });
      return expect(validateInputFiles(component)).to.be.rejectedWith(/.* is not allowed as input file./);
    });
    it("should be rejected if input filename is empty string", () => {
      component.inputFiles.push({ name: "", src: [] });
      return expect(validateInputFiles(component)).to.be.rejectedWith(/.* is not allowed as input file./);
    });
    it("should be rejected if input filename is blank", () => {
      component.inputFiles.push({ name: "   ", src: [] });
      return expect(validateInputFiles(component)).to.be.rejectedWith(/.* is not allowed as input file./);
    });
    it("should be rejected if inputFile is file and has 2 or more connection", () => {
      component.inputFiles.push({ name: "hoge", src: [{}, {}] });
      return expect(validateInputFiles(component)).to.be.rejectedWith(/inputFile .* data type is 'file' but it has two or more outputFiles./);
    });
    it("should be resolved with true if inputFile is file and is not connected", async () => {
      component.inputFiles.push({ name: "hoge", src: [] });
      expect(await validateInputFiles(component)).to.be.true;
    });
    it("should be resolved with true if inputFile is file and has only 1 connection", async () => {
      component.inputFiles.push({ name: "hoge", src: [{}] });
      expect(await validateInputFiles(component)).to.be.true;
    });
    it("should be resolved with true if inputFile is directory and has 2 or more connection", async () => {
      component.inputFiles.push({ name: "hoge/", src: [{}, {}] });
      expect(await validateInputFiles(component)).to.be.true;
    });
    it("should be resolved with true if multiple valid inputFiles", async () => {
      component.inputFiles.push({ name: "file1.txt", src: [] });
      component.inputFiles.push({ name: "file2.txt", src: [] });
      component.inputFiles.push({ name: "directory/", src: [] });
      expect(await validateInputFiles(component)).to.be.true;
    });
    it("should be resolved with true if no inputFiles", async () => {
      //inputFilesは空の配列のまま
      expect(await validateInputFiles(component)).to.be.true;
    });
    it("should be resolved with true if inputFile has valid path format", async () => {
      component.inputFiles.push({ name: "path/to/file.txt", src: [] });
      expect(await validateInputFiles(component)).to.be.true;
    });
  });
  describe("validateOutputFiles", () => {
    let component;
    beforeEach(() => {
      component = { outputFiles: [] };
    });
    it("should be rejected if output filename is blank", () => {
      component.outputFiles.push({ name: "   ", dst: [] });
      return expect(validateOutputFiles(component)).to.be.rejectedWith(/.* is not allowed as output filename./);
    });
    it("should be resolved with true if output filename contains special characters", async () => {
      component.outputFiles.push({ name: "file*name", dst: [] });
      expect(await validateOutputFiles(component)).to.be.true;
    });
    it("should be rejected if output filename is null", () => {
      component.outputFiles.push({ name: null, dst: [] });
      return expect(validateOutputFiles(component)).to.be.rejectedWith(/.* is not allowed as output filename./);
    });
    it("should be rejected if output filename is empty string", () => {
      component.outputFiles.push({ name: "", dst: [] });
      return expect(validateOutputFiles(component)).to.be.rejectedWith(/.* is not allowed as output filename./);
    });
    it("should be resolved with true if output filename is valid", async () => {
      component.outputFiles.push({ name: "validfile.txt", dst: [] });
      expect(await validateOutputFiles(component)).to.be.true;
    });
    it("should be resolved with true if multiple output files with valid names", async () => {
      component.outputFiles.push({ name: "file1.txt", dst: [] });
      component.outputFiles.push({ name: "file2.txt", dst: [] });
      component.outputFiles.push({ name: "file3.txt", dst: [] });
      expect(await validateOutputFiles(component)).to.be.true;
    });
    it("should be resolved with true if no output files", async () => {
      //outputFilesは空の配列のまま
      expect(await validateOutputFiles(component)).to.be.true;
    });
    it("should be resolved with true if output filename is a directory path", async () => {
      component.outputFiles.push({ name: "directory/", dst: [] });
      expect(await validateOutputFiles(component)).to.be.true;
    });
  });
});