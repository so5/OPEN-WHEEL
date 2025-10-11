/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#removeAllFileLink", ()=>{
  let getComponentDirStub;
  let readComponentJsonStub;
  let removeFileLinkToParentStub;
  let removeFileLinkBetweenSiblingsStub;

  beforeEach(()=>{
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
    readComponentJsonStub = sinon.stub(projectFilesOperator._internal, "readComponentJson");
    removeFileLinkToParentStub = sinon.stub(projectFilesOperator._internal, "removeFileLinkToParent");
    removeFileLinkBetweenSiblingsStub = sinon.stub(projectFilesOperator._internal, "removeFileLinkBetweenSiblings");
  });

  afterEach(()=>{
    sinon.restore();
  });

  describe("fromChildren = true", ()=>{
    it("should return an Error if outputFile is not found in parent's outputFiles", async ()=>{
      getComponentDirStub.resolves("/mock/dir");
      readComponentJsonStub.resolves({ outputFiles: [{ name: "someOtherFile", origin: [] }] });

      const result = await projectFilesOperator.removeAllFileLink("/projRoot", "compID", "missingFile", true);
      expect(result).to.be.instanceOf(Error);
      expect(result.message).to.equal("missingFile not found in parent's outputFiles");
      expect(removeFileLinkToParentStub.notCalled).to.be.true;
    });

    it("should return true if outputFile.origin is not an array", async ()=>{
      getComponentDirStub.resolves("/mock/dir");
      readComponentJsonStub.resolves({ outputFiles: [{ name: "myOutput", origin: null }] });

      const result = await projectFilesOperator.removeAllFileLink("/projRoot", "compID", "myOutput", true);
      expect(result).to.equal(true);
      expect(removeFileLinkToParentStub.notCalled).to.be.true;
    });

    it("should call removeFileLinkToParent for each origin entry", async ()=>{
      getComponentDirStub.resolves("/mock/dir");
      readComponentJsonStub.resolves({
        outputFiles: [{
          name: "myOutput",
          origin: [
            { srcNode: "node1", srcName: "file1" },
            { srcNode: "node2", srcName: "file2" }
          ]
        }]
      });
      removeFileLinkToParentStub.resolves("ok");

      const result = await projectFilesOperator.removeAllFileLink("/projRoot", "compID", "myOutput", true);
      expect(removeFileLinkToParentStub.callCount).to.equal(2);
      expect(removeFileLinkToParentStub.firstCall.args).to.deep.equal(["/projRoot", "node1", "file1", "myOutput"]);
      expect(removeFileLinkToParentStub.secondCall.args).to.deep.equal(["/projRoot", "node2", "file2", "myOutput"]);
      expect(result).to.deep.equal(["ok", "ok"]);
    });
  });

  describe("fromChildren = false", ()=>{
    it("should return an Error if inputFile is not found in inputFiles", async ()=>{
      getComponentDirStub.resolves("/mock/dir");
      readComponentJsonStub.resolves({ inputFiles: [{ name: "someInput", src: [] }] });

      const result = await projectFilesOperator.removeAllFileLink("/projRoot", "compID", "missingInput", false);
      expect(result).to.be.instanceOf(Error);
      expect(result.message).to.equal("missingInput not found in inputFiles");
      expect(removeFileLinkBetweenSiblingsStub.notCalled).to.be.true;
    });

    it("should call removeFileLinkBetweenSiblings for each src entry", async ()=>{
      getComponentDirStub.resolves("/mock/dir");
      readComponentJsonStub.resolves({
        inputFiles: [{
          name: "myInput",
          src: [
            { srcNode: "pnode1", srcName: "f1" },
            { srcNode: "pnode2", srcName: "f2" }
          ]
        }]
      });
      removeFileLinkBetweenSiblingsStub.resolves("done");

      const result = await projectFilesOperator.removeAllFileLink("/projRoot", "compID", "myInput", false);
      expect(removeFileLinkBetweenSiblingsStub.callCount).to.equal(2);
      expect(removeFileLinkBetweenSiblingsStub.firstCall.args).to.deep.equal(["/projRoot", "pnode1", "f1", "compID", "myInput"]);
      expect(removeFileLinkBetweenSiblingsStub.secondCall.args).to.deep.equal(["/projRoot", "pnode2", "f2", "compID", "myInput"]);
      expect(result).to.deep.equal(["done", "done"]);
    });
  });
});
