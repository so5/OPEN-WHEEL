/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it } = require("mocha");
const sinon = require("sinon");
const path = require("path");
const { promisify } = require("util");
const projectFilesOperator = require("../../../app/core/projectFilesOperator.js");


describe.skip("#removeAllFileLink", ()=>{
  let rewireProjectFilesOperator;
  let removeAllFileLink;
  let getComponentDirMock;
  let readComponentJsonMock;
  let removeFileLinkToParentMock;
  let removeFileLinkBetweenSiblingsMock;

  beforeEach(()=>{
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    removeAllFileLink = rewireProjectFilesOperator.__get__("removeAllFileLink");

    getComponentDirMock = sinon.stub();
    readComponentJsonMock = sinon.stub();
    removeFileLinkToParentMock = sinon.stub();
    removeFileLinkBetweenSiblingsMock = sinon.stub();

    rewireProjectFilesOperator.__set__({
      getComponentDir: getComponentDirMock,
      readComponentJson: readComponentJsonMock,
      removeFileLinkToParent: removeFileLinkToParentMock,
      removeFileLinkBetweenSiblings: removeFileLinkBetweenSiblingsMock
    });
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return an Error if outputFile is not found in parent's outputFiles (fromChildren = true)", async ()=>{
    getComponentDirMock.resolves("/mock/dir");
    readComponentJsonMock.resolves({
      outputFiles: [{ name: "someOtherFile", origin: [] }]
    });

    const result = await removeAllFileLink("/projRoot", "compID", "missingFile", true);
    expect(result).to.be.instanceOf(Error);
    expect(result.message).to.equal("missingFile not found in parent's outputFiles");

    //removeFileLinkToParentが呼ばれないこと
    expect(removeFileLinkToParentMock.notCalled).to.be.true;
  });

  it("should return true if outputFile.origin is not an array (fromChildren = true)", async ()=>{
    getComponentDirMock.resolves("/mock/dir");
    readComponentJsonMock.resolves({
      outputFiles: [{ name: "myOutput", origin: null }]
    });

    const result = await removeAllFileLink("/projRoot", "compID", "myOutput", true);
    expect(result).to.equal(true);

    expect(removeFileLinkToParentMock.notCalled).to.be.true;
  });

  it("should call removeFileLinkToParent for each origin entry (fromChildren = true)", async ()=>{
    getComponentDirMock.resolves("/mock/dir");
    readComponentJsonMock.resolves({
      outputFiles: [{
        name: "myOutput",
        origin: [
          { srcNode: "node1", srcName: "file1" },
          { srcNode: "node2", srcName: "file2" }
        ]
      }]
    });
    removeFileLinkToParentMock.resolves("ok");

    const result = await removeAllFileLink("/projRoot", "compID", "myOutput", true);
    expect(removeFileLinkToParentMock.callCount).to.equal(2);
    expect(removeFileLinkToParentMock.firstCall.args).to.deep.equal(["/projRoot", "node1", "file1", "myOutput"]);
    expect(removeFileLinkToParentMock.secondCall.args).to.deep.equal(["/projRoot", "node2", "file2", "myOutput"]);

    //Promise.all()が返すため、配列になる想定
    expect(result).to.deep.equal(["ok", "ok"]);
  });

  it("should return an Error if inputFile is not found in inputFiles (fromChildren = false)", async ()=>{
    getComponentDirMock.resolves("/mock/dir");
    readComponentJsonMock.resolves({
      inputFiles: [{ name: "someInput", src: [] }]
    });

    const result = await removeAllFileLink("/projRoot", "compID", "missingInput", false);
    expect(result).to.be.instanceOf(Error);
    expect(result.message).to.equal("missingInput not found in inputFiles");

    //removeFileLinkBetweenSiblingsが呼ばれないこと
    expect(removeFileLinkBetweenSiblingsMock.notCalled).to.be.true;
  });

  it("should call removeFileLinkBetweenSiblings for each src entry (fromChildren = false)", async ()=>{
    getComponentDirMock.resolves("/mock/dir");
    readComponentJsonMock.resolves({
      inputFiles: [{
        name: "myInput",
        src: [
          { srcNode: "pnode1", srcName: "f1" },
          { srcNode: "pnode2", srcName: "f2" }
        ]
      }]
    });
    removeFileLinkBetweenSiblingsMock.resolves("done");

    const result = await removeAllFileLink("/projRoot", "compID", "myInput", false);
    expect(removeFileLinkBetweenSiblingsMock.callCount).to.equal(2);
    expect(removeFileLinkBetweenSiblingsMock.firstCall.args).to.deep.equal(["/projRoot", "pnode1", "f1", "compID", "myInput"]);
    expect(removeFileLinkBetweenSiblingsMock.secondCall.args).to.deep.equal(["/projRoot", "pnode2", "f2", "compID", "myInput"]);

    //Promise.all()で返るため、配列になる想定
    expect(result).to.deep.equal(["done", "done"]);
  });
});
