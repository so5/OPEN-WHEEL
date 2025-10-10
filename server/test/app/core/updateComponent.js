/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import chai, { expect } from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import chaiFs from "chai-fs";
import chaiJsonSchema from "chai-json-schema";
import deepEqualInAnyOrder from "deep-equal-in-any-order";
import chaiAsPromised from "chai-as-promised";

import { _internal } from "../../../../app/core/updateComponent.js";

chai.use(sinonChai);
chai.use(chaiFs);
chai.use(chaiJsonSchema);
chai.use(deepEqualInAnyOrder);
chai.use(chaiAsPromised);

describe("updateComponent", ()=>{
  describe("#removeInputFileLinkFromParent", ()=>{
    let removeInputFileLinkFromParent;
    let getComponentDirStub;
    let readComponentJsonStub;
    let writeComponentJsonStub;
    beforeEach(()=>{
      removeInputFileLinkFromParent = _internal.removeInputFileLinkFromParent;
      getComponentDirStub = sinon.stub(_internal, "getComponentDir");
      readComponentJsonStub = sinon.stub(_internal, "readComponentJson");
      writeComponentJsonStub = sinon.stub(_internal, "writeComponentJson");
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should remove input file link from parent component", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "dstNode", true).returns("/projectRootDir/dstNode");
      const parentJson = {
        inputFiles: [{
          name: "srcName",
          forwardTo: [{
            dstNode: "otherDstNode",
            dstName: "otherDstName"
          }]
        }]
      };
      readComponentJsonStub.withArgs("/projectRootDir").resolves(parentJson);
      await removeInputFileLinkFromParent("/projectRootDir", "srcName", "dstNode", "dstName");
      expect(writeComponentJsonStub.calledWith("/projectRootDir", "/projectRootDir", sinon.match(parentJson))).to.be.true;
    });
    it("should filter parentInputFiles", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "dstNode", true).returns("/projectRootDir/dstNode");
      const otherInputFile = {
        name: "otherSrcName",
        forwardTo: [{
          dstNode: "dstNode",
          dstName: "dstName"
        }]
      };
      const parentJson = {
        inputFiles: [otherInputFile, {
          name: "srcName",
          forwardTo: [{
            dstNode: "otherDstNode",
            dstName: "otherDstName"
          }]
        }]
      };
      readComponentJsonStub.withArgs("/projectRootDir").resolves(parentJson);
      await removeInputFileLinkFromParent("/projectRootDir", "srcName", "dstNode", "dstName");
      expect(otherInputFile.forwardTo).to.have.lengthOf(1);
    });
    it("should filter forwardTo", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "dstNode", true).returns("/projectRootDir/dstNode");
      const parentJson = {
        inputFiles: [{
          name: "srcName",
          forwardTo: [{
            dstNode: "otherDstNode",
            dstName: "otherDstName"
          }, {
            dstNode: "dstNode",
            dstName: "dstName"
          }]
        }]
      };
      readComponentJsonStub.withArgs("/projectRootDir").resolves(parentJson);
      await removeInputFileLinkFromParent("/projectRootDir", "srcName", "dstNode", "dstName");
      expect(parentJson.inputFiles[0].forwardTo).to.have.lengthOf(1);
    });
  });
  describe("#removeOutputFileLinkFromParent", ()=>{
    let removeOutputFileLinkToParent;
    let getComponentDirStub;
    let readComponentJsonStub;
    let writeComponentJsonStub;
    beforeEach(()=>{
      removeOutputFileLinkToParent = _internal.removeOutputFileLinkToParent;
      getComponentDirStub = sinon.stub(_internal, "getComponentDir");
      readComponentJsonStub = sinon.stub(_internal, "readComponentJson");
      writeComponentJsonStub = sinon.stub(_internal, "writeComponentJson");
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should remove output file link from parent component", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "srcNode", true).returns("/projectRootDir/srcNode");
      const parentJson = {
        outputFiles: [{
          name: "dstName",
          origin: [{
            srcNode: "otherSrcNode",
            srcName: "otherSrcName"
          }]
        }]
      };
      readComponentJsonStub.withArgs("/projectRootDir").resolves(parentJson);
      await removeOutputFileLinkToParent("/projectRootDir", "srcNode", "srcName", "dstName");
      expect(writeComponentJsonStub.calledWith("/projectRootDir", "/projectRootDir", sinon.match(parentJson))).to.be.true;
    });
    it("should filter parentOutputFiles", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "srcNode", true).returns("/projectRootDir/srcNode");
      const otherOutputFile = {
        name: "otherDstName",
        origin: [{
          srcNode: "srcNode",
          srcName: "srcName"
        }]
      };
      const parentJson = {
        outputFiles: [otherOutputFile, {
          name: "dstName",
          origin: [{
            srcNode: "otherSrcNode",
            srcName: "otherSrcName"
          }]
        }]
      };
      readComponentJsonStub.withArgs("/projectRootDir").resolves(parentJson);
      await removeOutputFileLinkToParent("/projectRootDir", "srcNode", "srcName", "dstName");
      expect(otherOutputFile.origin).to.have.lengthOf(1);
    });
    it("should filter origin", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "srcNode", true).returns("/projectRootDir/srcNode");
      const parentJson = {
        outputFiles: [{
          name: "dstName",
          origin: [{
            srcNode: "otherSrcNode",
            srcName: "otherSrcName"
          }, {
            srcNode: "srcNode",
            srcName: "srcName"
          }]
        }]
      };
      readComponentJsonStub.withArgs("/projectRootDir").resolves(parentJson);
      await removeOutputFileLinkToParent("/projectRootDir", "srcNode", "srcName", "dstName");
      expect(parentJson.outputFiles[0].origin).to.have.lengthOf(1);
    });
  });
  describe("#removeInputFileLinkFromSiblings", ()=>{
    let removeInputFileLinkFromSiblings;
    let getComponentDirStub;
    let readComponentJsonStub;
    let writeComponentJsonStub;
    beforeEach(()=>{
      removeInputFileLinkFromSiblings = _internal.removeInputFileLinkFromSiblings;
      getComponentDirStub = sinon.stub(_internal, "getComponentDir");
      readComponentJsonStub = sinon.stub(_internal, "readComponentJson");
      writeComponentJsonStub = sinon.stub(_internal, "writeComponentJson");
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should remove input file link from siblings", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "srcNode", true).returns("/projectRootDir/srcNode");
      const srcJson = {
        outputFiles: [{
          name: "srcName",
          dst: [{
            dstNode: "dstNode",
            dstName: "dstName"
          }]
        }]
      };
      readComponentJsonStub.withArgs("/projectRootDir/srcNode").resolves(srcJson);
      await removeInputFileLinkFromSiblings("/projectRootDir", "srcNode", "srcName", "dstNode", "dstName");
      expect(writeComponentJsonStub.calledWith("/projectRootDir", "/projectRootDir/srcNode", sinon.match(srcJson))).to.be.true;
    });
    it("should filter outputFiles", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "srcNode", true).returns("/projectRootDir/srcNode");
      const otherOutputFile = {
        name: "otherSrcNode",
        dst: [{
          dstNode: "dstNode",
          dstName: "dstName"
        }]
      };
      const srcJson = {
        outputFiles: [otherOutputFile, {
          name: "srcName",
          dst: [{
            dstNode: "otherDstNode",
            dstName: "otherDstName"
          }]
        }]
      };
      readComponentJsonStub.withArgs("/projectRootDir/srcNode").resolves(srcJson);
      await removeInputFileLinkFromSiblings("/projectRootDir", "srcNode", "srcName", "dstNode", "dstName");
      expect(otherOutputFile.dst).to.have.lengthOf(1);
    });
    it("should filter dst", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "srcNode", true).returns("/projectRootDir/srcNode");
      const dstJson = {
        outputFiles: [{
          name: "srcName",
          dst: [{
            dstNode: "otherDstNode",
            dstName: "otherDstName"
          }, {
            dstNode: "dstNode",
            dstName: "dstName"
          }]
        }]
      };
      readComponentJsonStub.withArgs("/projectRootDir/srcNode").resolves(dstJson);
      await removeInputFileLinkFromSiblings("/projectRootDir", "srcNode", "srcName", "dstNode", "dstName");
      expect(dstJson.outputFiles[0].dst).to.have.lengthOf(1);
    });
  });
  describe("#removeOutputFileLinkToSiblings", ()=>{
    let removeOutputFileLinkToSiblings;
    let getComponentDirStub;
    let readComponentJsonStub;
    let writeComponentJsonStub;
    beforeEach(()=>{
      removeOutputFileLinkToSiblings = _internal.removeOutputFileLinkToSiblings;
      getComponentDirStub = sinon.stub(_internal, "getComponentDir");
      readComponentJsonStub = sinon.stub(_internal, "readComponentJson");
      writeComponentJsonStub = sinon.stub(_internal, "writeComponentJson");
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should remove output file link to siblings", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "dstNode", true).returns("/projectRootDir/dstNode");
      const dstJson = {
        inputFiles: [{
          name: "dstName",
          src: [{
            srcNode: "srcNode",
            srcName: "srcName"
          }]
        }]
      };
      readComponentJsonStub.withArgs("/projectRootDir/dstNode").resolves(dstJson);
      await removeOutputFileLinkToSiblings("/projectRootDir", "srcNode", "srcName", "dstNode", "dstName");
      expect(writeComponentJsonStub.calledWith("/projectRootDir", "/projectRootDir/dstNode", sinon.match(dstJson))).to.be.true;
    });
    it("should filter inputFiles", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "dstNode", true).returns("/projectRootDir/dstNode");
      const otherInputFile = {
        name: "otherDstName",
        src: [{
          srcNode: "srcNode",
          srcName: "srcName"
        }]
      };
      const dstJson = {
        inputFiles: [otherInputFile, {
          name: "dstName",
          src: [{
            srcNode: "otherSrcNode",
            srcName: "otherSrcName"
          }]
        }]
      };
      readComponentJsonStub.withArgs("/projectRootDir/dstNode").resolves(dstJson);
      await removeOutputFileLinkToSiblings("/projectRootDir", "srcNode", "srcName", "dstNode", "dstName");
      expect(otherInputFile.src).to.have.lengthOf(1);
    });
    it("should filter src", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "dstNode", true).returns("/projectRootDir/dstNode");
      const dstJson = {
        inputFiles: [{
          name: "dstName",
          src: [{
            srcNode: "otherSrcNode",
            srcName: "otherSrcName"
          }, {
            srcNode: "srcNode",
            srcName: "srcName"
          }]
        }]
      };
      readComponentJsonStub.withArgs("/projectRootDir/dstNode").resolves(dstJson);
      await removeOutputFileLinkToSiblings("/projectRootDir", "srcNode", "srcName", "dstNode", "dstName");
      expect(dstJson.inputFiles[0].src).to.have.lengthOf(1);
    });
  });
  describe("#removeInputFileCounterpart", ()=>{
    let removeInputFileCounterpart;
    let removeInputFileLinkFromParentStub;
    let removeInputFileLinkFromSiblingsStub;
    beforeEach(()=>{
      removeInputFileCounterpart = _internal.removeInputFileCounterpart;
      removeInputFileLinkFromParentStub = sinon.stub(_internal, "removeInputFileLinkFromParent");
      removeInputFileLinkFromSiblingsStub = sinon.stub(_internal, "removeInputFileLinkFromSiblings");
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should remove input file link from counterpart", async ()=>{
      const componentJson = {
        ID: "id",
        parent: "parentName",
        inputFiles: [{}, {
          name: "srcName",
          src: [{
            srcNode: "parent",
            srcName: "srcName1"
          }, {
            srcNode: "parentName",
            srcName: "srcName2"
          }, {
            srcNode: "siblings",
            srcName: "srcName3"
          }]
        }]
      };
      await removeInputFileCounterpart("/projectRootDir", componentJson, 1);
      expect(removeInputFileLinkFromParentStub.calledTwice).to.be.true;
      expect(removeInputFileLinkFromParentStub.calledWith("/projectRootDir", "srcName1", "id", "srcName")).to.be.true;
      expect(removeInputFileLinkFromParentStub.calledWith("/projectRootDir", "srcName2", "id", "srcName")).to.be.true;
      expect(removeInputFileLinkFromSiblingsStub.calledOnce).to.be.true;
      expect(removeInputFileLinkFromSiblingsStub.calledWith("/projectRootDir", "siblings", "srcName3", "id", "srcName")).to.be.true;
    });
    it("should resolve if the all removing operation is successful", async ()=>{
      removeInputFileLinkFromParentStub.resolves();
      removeInputFileLinkFromSiblingsStub.resolves();
      const componentJson = {
        ID: "id",
        parent: "parentName",
        inputFiles: [{}, {
          name: "srcName",
          src: [{
            srcNode: "parent",
            srcName: "srcName1"
          }, {
            srcNode: "siblings",
            srcName: "srcName3"
          }]
        }]
      };
      const ret = removeInputFileCounterpart("/projectRootDir", componentJson, 1);
      await expect(ret).to.be.fulfilled;
    });
    it("should reject if one or more delete operations is failed", async ()=>{
      removeInputFileLinkFromParentStub.resolves();
      removeInputFileLinkFromSiblingsStub.rejects();
      const componentJson = {
        ID: "id",
        parent: "parentName",
        inputFiles: [{}, {
          name: "srcName",
          src: [{
            srcNode: "parent",
            srcName: "srcName1"
          }, {
            srcNode: "siblings",
            srcName: "srcName3"
          }]
        }]
      };
      const ret = removeInputFileCounterpart("/projectRootDir", componentJson, 1);
      await expect(ret).to.be.rejected;
    });
    it("should resolve if there is no counterpart", async ()=>{
      const componentJson = {
        ID: "id",
        parent: "parentName",
        inputFiles: [{}, {
          name: "srcName",
          src: []
        }]
      };
      const ret = removeInputFileCounterpart("/projectRootDir", componentJson, 1);
      await expect(ret).to.be.fulfilled;
    });
  });
  describe("#removeOutputFileCounterpart", ()=>{
    let removeOutputFileCounterpart;
    let removeOutputFileLinkToParentStub;
    let removeOutputFileLinkToSiblingsStub;
    beforeEach(()=>{
      removeOutputFileCounterpart = _internal.removeOutputFileCounterpart;
      removeOutputFileLinkToParentStub = sinon.stub(_internal, "removeOutputFileLinkToParent");
      removeOutputFileLinkToSiblingsStub = sinon.stub(_internal, "removeOutputFileLinkToSiblings");
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should remove output file link from counterpart", async ()=>{
      const componentJson = {
        ID: "id",
        parent: "parentName",
        outputFiles: [{}, {
          name: "dstName",
          dst: [{
            dstNode: "parent",
            dstName: "dstName1"
          }, {
            dstNode: "parentName",
            dstName: "dstName2"
          }, {
            dstNode: "siblings",
            dstName: "dstName3"
          }]
        }]
      };
      await removeOutputFileCounterpart("/projectRootDir", componentJson, 1);
      expect(removeOutputFileLinkToParentStub.calledTwice).to.be.true;
      expect(removeOutputFileLinkToParentStub.calledWith("/projectRootDir", "id", "dstName", "dstName1")).to.be.true;
      expect(removeOutputFileLinkToParentStub.calledWith("/projectRootDir", "id", "dstName", "dstName2")).to.be.true;
      expect(removeOutputFileLinkToSiblingsStub.calledOnce).to.be.true;
      expect(removeOutputFileLinkToSiblingsStub.calledWith("/projectRootDir", "id", "dstName", "siblings", "dstName3")).to.be.true;
    });
    it("should resolve if the all removing operation is successful", async ()=>{
      removeOutputFileLinkToParentStub.resolves();
      removeOutputFileLinkToSiblingsStub.resolves();
      const componentJson = {
        ID: "id",
        parent: "parentName",
        outputFiles: [{}, {
          name: "dstName",
          dst: [{
            dstNode: "parent",
            dstName: "dstName1"
          }, {
            dstNode: "siblings",
            dstName: "dstName3"
          }]
        }]
      };
      const ret = removeOutputFileCounterpart("/projectRootDir", componentJson, 1);
      await expect(ret).to.be.fulfilled;
    });
    it("should reject if one or more delete operations is failed", async ()=>{
      removeOutputFileLinkToParentStub.resolves();
      removeOutputFileLinkToSiblingsStub.rejects();
      const componentJson = {
        ID: "id",
        parent: "parentName",
        outputFiles: [{}, {
          name: "dstName",
          dst: [{
            dstNode: "parent",
            dstName: "dstName1"
          }, {
            dstNode: "siblings",
            dstName: "dstName3"
          }]
        }]
      };
      const ret = removeOutputFileCounterpart("/projectRootDir", componentJson, 1);
      await expect(ret).to.be.rejected;
    });
    it("should resolve if there is no counterpart", async ()=>{
      const componentJson = {
        ID: "id",
        parent: "parentName",
        outputFiles: [{}, {
          name: "dstName",
          dst: []
        }]
      };
      const ret = removeOutputFileCounterpart("/projectRootDir", componentJson, 1);
      await expect(ret).to.be.fulfilled;
    });
  });
  describe("#renameInputFileCounterpart", ()=>{
    let renameInputFileCounterpart;
    let getComponentDirStub;
    let readComponentJsonStub;
    let writeComponentJsonStub;
    beforeEach(()=>{
      renameInputFileCounterpart = _internal.renameInputFileCounterpart;
      getComponentDirStub = sinon.stub(_internal, "getComponentDir");
      readComponentJsonStub = sinon.stub(_internal, "readComponentJson");
      writeComponentJsonStub = sinon.stub(_internal, "writeComponentJson");
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("rename inputFile name and its counterparts' dstName", async ()=>{
      const componentJson = {
        ID: "id",
        inputFiles: [{}, {
          src: [{
            srcNode: "srcNode1"
          }, {
            srcNode: "srcNode2"
          }]
        }]
      };
      getComponentDirStub.withArgs("/projectRootDir", "srcNode1", true).resolves("/projectRootDir/srcNode1");
      getComponentDirStub.withArgs("/projectRootDir", "srcNode2", true).resolves("/projectRootDir/srcNode2");
      const readComponentJsonResultBase = {
        outputFiles: [{
          dst: [{
            dstNode: "dstNode1",
            dstName: "dstName1"
          }, {
            dstNode: "dstNode2",
            dstName: "dstName2"
          }]
        }, {
          dst: [{
            dstNode: "dstNode3",
            dstName: "dstNode3"
          }]
        }],
        inputFiles: [{
          forwardTo: [{
            dstNode: "dstNode4",
            dstName: "dstName4"
          }, {
            dstNode: "dstNode5",
            dstName: "dstName5"
          }]
        }, {
          forwardTo: [{
            dstNode: "dstNode6",
            dstName: "dstName6"
          }]
        }]
      };
      const readComponentJsonResultTest1 = JSON.parse(JSON.stringify(readComponentJsonResultBase));
      const readComponentJsonResultTest2 = JSON.parse(JSON.stringify(readComponentJsonResultBase));
      readComponentJsonResultTest1.outputFiles[0].dst[0].dstNode = "id";
      readComponentJsonResultTest1.outputFiles[0].dst[0].dstName = "oldName";
      readComponentJsonResultTest1.inputFiles[0].forwardTo[0].dstNode = "id";
      readComponentJsonResultTest1.inputFiles[0].forwardTo[0].dstName = "oldName";
      readComponentJsonResultTest2.outputFiles[0].dst[1].dstNode = "id";
      readComponentJsonResultTest2.outputFiles[0].dst[1].dstName = "oldName";
      readComponentJsonResultTest2.inputFiles[0].forwardTo[1].dstNode = "id";
      readComponentJsonResultTest2.inputFiles[0].forwardTo[1].dstName = "oldName";
      readComponentJsonStub.withArgs("/projectRootDir/srcNode1").resolves(readComponentJsonResultTest1);
      readComponentJsonStub.withArgs("/projectRootDir/srcNode2").resolves(readComponentJsonResultTest2);
      await renameInputFileCounterpart("/projectRootDir", componentJson, 1, "oldName", "newName");
      const readComponentJsonResultExpectation1 = JSON.parse(JSON.stringify(readComponentJsonResultTest1));
      const readComponentJsonResultExpectation2 = JSON.parse(JSON.stringify(readComponentJsonResultTest2));
      readComponentJsonResultExpectation1.outputFiles[0].dst[0].dstName = "newName";
      readComponentJsonResultExpectation1.inputFiles[0].forwardTo[0].dstName = "newName";
      readComponentJsonResultExpectation2.outputFiles[0].dst[1].dstName = "newName";
      readComponentJsonResultExpectation2.inputFiles[0].forwardTo[1].dstName = "newName";
      expect(writeComponentJsonStub.calledWith("/projectRootDir", "/projectRootDir/srcNode1", sinon.match(readComponentJsonResultExpectation1))).to.be.true;
      expect(writeComponentJsonStub.calledWith("/projectRootDir", "/projectRootDir/srcNode2", sinon.match(readComponentJsonResultExpectation2))).to.be.true;
    });
    it("should throw error if the index is less than 0", async ()=>{
      await expect(renameInputFileCounterpart("/projectRootDir", {}, -1, "oldName", "newName")).to.be.rejectedWith("invalid index -1");
    });
    it("should throw error if the index is out of range", async ()=>{
      await expect(renameInputFileCounterpart("/projectRootDir", {
        inputFiles: [{}]
      }, 1, "oldName", "newName")).to.be.rejectedWith("invalid index 1");
    });
    it("should resolve it all renaming operation is successful", async ()=>{
      const componentJson = {
        inputFiles: [{
          src: [{
            srcNode: "srcNode1"
          }, {
            srcNode: "srcNode2"
          }]
        }]
      };
      const counterpartJson1 = {
        name: "counterpartJson1",
        outputFiles: [],
        inputFiles: []
      };
      const counterpartJson2 = {
        name: "counterpartJson2",
        outputFiles: [],
        inputFiles: []
      };
      getComponentDirStub.withArgs("/projectRootDir", "srcNode1", true).resolves("/projectRootDir/srcNode1");
      getComponentDirStub.withArgs("/projectRootDir", "srcNode2", true).resolves("/projectRootDir/srcNode2");
      readComponentJsonStub.withArgs("/projectRootDir/srcNode1").resolves(counterpartJson1);
      readComponentJsonStub.withArgs("/projectRootDir/srcNode2").resolves(counterpartJson2);
      writeComponentJsonStub.withArgs("/projectRootDir", "/projectRootDir/dstNode1").resolves();
      writeComponentJsonStub.withArgs("/projectRootDir", "/projectRootDir/dstNode2").resolves();
      await expect(renameInputFileCounterpart("/projectRootDir", componentJson, 0, "oldName", "newName")).to.be.fulfilled;
    });
    it("should reject if one or more renaming operation is failed", async ()=>{
      const componentJson = {
        inputFiles: [{
          src: [{
            srcNode: "srcNode1"
          }, {
            srcNode: "srcNode2"
          }]
        }]
      };
      const counterpartJson1 = {
        name: "counterpartJson1",
        outputFiles: [],
        inputFiles: []
      };
      const counterpartJson2 = {
        name: "counterpartJson2",
        outputFiles: [],
        inputFiles: []
      };
      getComponentDirStub.withArgs("/projectRootDir", "srcNode1", true).resolves("/projectRootDir/srcNode1");
      getComponentDirStub.withArgs("/projectRootDir", "srcNode2", true).resolves("/projectRootDir/srcNode2");
      readComponentJsonStub.withArgs("/projectRootDir/srcNode1").resolves(counterpartJson1);
      readComponentJsonStub.withArgs("/projectRootDir/srcNode2").resolves(counterpartJson2);
      writeComponentJsonStub.withArgs("/projectRootDir", "/projectRootDir/srcNode1").resolves();
      writeComponentJsonStub.withArgs("/projectRootDir", "/projectRootDir/srcNode2").rejects();
      await expect(renameInputFileCounterpart("/projectRootDir", componentJson, 0, "oldName", "newName")).to.be.rejected;
    });
  });
  describe("#renameOutputFileCounterpart", ()=>{
    let renameOutputFileCounterpart;
    let getComponentDirStub;
    let readComponentJsonStub;
    let writeComponentJsonStub;
    beforeEach(()=>{
      renameOutputFileCounterpart = _internal.renameOutputFileCounterpart;
      getComponentDirStub = sinon.stub(_internal, "getComponentDir");
      readComponentJsonStub = sinon.stub(_internal, "readComponentJson");
      writeComponentJsonStub = sinon.stub(_internal, "writeComponentJson");
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("rename inputFile name and its counterparts' srcName", async ()=>{
      const componentJson = {
        ID: "id",
        outputFiles: [{}, {
          dst: [{
            dstNode: "dstNode1"
          }, {
            dstNode: "dstNode2"
          }]
        }]
      };
      getComponentDirStub.withArgs("/projectRootDir", "dstNode1", true).resolves("/projectRootDir/dstNode1");
      getComponentDirStub.withArgs("/projectRootDir", "dstNode2", true).resolves("/projectRootDir/dstNode2");
      const readComponentJsonResultBase = {
        inputFiles: [{
          src: [{
            srcNode: "srcNode1",
            srcName: "srcName1"
          }, {
            srcNode: "srcNode2",
            srcName: "srcName2"
          }]
        }, {
          src: [{
            srcNode: "srcNode3",
            srcName: "srcNode3"
          }]
        }],
        outputFiles: [{
          origin: [{
            srcNode: "srcNode4",
            srcName: "srcName4"
          }, {
            srcNode: "srcNode5",
            srcName: "srcName5"
          }]
        }, {
          origin: [{
            srcNode: "srcNode6",
            srcName: "srcName6"
          }]
        }]
      };
      const readComponentJsonResultTest1 = JSON.parse(JSON.stringify(readComponentJsonResultBase));
      const readComponentJsonResultTest2 = JSON.parse(JSON.stringify(readComponentJsonResultBase));
      readComponentJsonResultTest1.inputFiles[0].src[0].srcNode = "id";
      readComponentJsonResultTest1.inputFiles[0].src[0].srcName = "oldName";
      readComponentJsonResultTest1.outputFiles[0].origin[0].srcNode = "id";
      readComponentJsonResultTest1.outputFiles[0].origin[0].srcName = "oldName";
      readComponentJsonResultTest2.inputFiles[0].src[1].srcNode = "id";
      readComponentJsonResultTest2.inputFiles[0].src[1].srcName = "oldName";
      readComponentJsonResultTest2.outputFiles[0].origin[1].srcNode = "id";
      readComponentJsonResultTest2.outputFiles[0].origin[1].srcName = "oldName";
      readComponentJsonStub.withArgs("/projectRootDir/dstNode1").resolves(readComponentJsonResultTest1);
      readComponentJsonStub.withArgs("/projectRootDir/dstNode2").resolves(readComponentJsonResultTest2);
      await renameOutputFileCounterpart("/projectRootDir", componentJson, 1, "oldName", "newName");
      const readComponentJsonResultExpectation1 = JSON.parse(JSON.stringify(readComponentJsonResultTest1));
      const readComponentJsonResultExpectation2 = JSON.parse(JSON.stringify(readComponentJsonResultTest2));
      readComponentJsonResultExpectation1.inputFiles[0].src[0].srcName = "newName";
      readComponentJsonResultExpectation1.outputFiles[0].origin[0].srcName = "newName";
      readComponentJsonResultExpectation2.inputFiles[0].src[1].srcName = "newName";
      readComponentJsonResultExpectation2.outputFiles[0].origin[1].srcName = "newName";
      expect(writeComponentJsonStub.calledWith("/projectRootDir", "/projectRootDir/dstNode1", sinon.match(readComponentJsonResultExpectation1))).to.be.true;
      expect(writeComponentJsonStub.calledWith("/projectRootDir", "/projectRootDir/dstNode2", sinon.match(readComponentJsonResultExpectation2))).to.be.true;
    });
    it("should throw error if the index is less than 0", async ()=>{
      await expect(renameOutputFileCounterpart("/projectRootDir", {}, -1, "oldName", "newName")).to.be.rejectedWith("invalid index -1");
    });
    it("should throw error if the index is out of range", async ()=>{
      await expect(renameOutputFileCounterpart("/projectRootDir", {
        outputFiles: [{}]
      }, 1, "oldName", "newName")).to.be.rejectedWith("invalid index 1");
    });
    it("should resolve it all renaming operation is successful", async ()=>{
      const componentJson = {
        outputFiles: [{
          dst: [{
            dstNode: "dstNode1"
          }, {
            dstNode: "dstNode2"
          }]
        }]
      };
      const counterpartJson1 = {
        name: "counterpartJson1",
        outputFiles: [],
        inputFiles: []
      };
      const counterpartJson2 = {
        name: "counterpartJson2",
        outputFiles: [],
        inputFiles: []
      };
      getComponentDirStub.withArgs("/projectRootDir", "dstNode1", true).resolves("/projectRootDir/dstNode1");
      getComponentDirStub.withArgs("/projectRootDir", "dstNode2", true).resolves("/projectRootDir/dstNode2");
      readComponentJsonStub.withArgs("/projectRootDir/dstNode1").resolves(counterpartJson1);
      readComponentJsonStub.withArgs("/projectRootDir/dstNode2").resolves(counterpartJson2);
      writeComponentJsonStub.withArgs("/projectRootDir", "/projectRootDir/srcNode1").resolves();
      writeComponentJsonStub.withArgs("/projectRootDir", "/projectRootDir/srcNode2").resolves();
      await expect(renameOutputFileCounterpart("/projectRootDir", componentJson, 0, "oldName", "newName")).to.be.fulfilled;
    });
    it("should reject if one or more renaming operation is failed", async ()=>{
      const componentJson = {
        inputFiles: [{
          dst: [{
            dstNode: "dstNode1"
          }, {
            dstNode: "dstNode2"
          }]
        }]
      };
      const counterpartJson1 = {
        name: "counterpartJson1",
        outputFiles: [],
        inputFiles: []
      };
      const counterpartJson2 = {
        name: "counterpartJson2",
        outputFiles: [],
        inputFiles: []
      };
      getComponentDirStub.withArgs("/projectRootDir", "dstNode1", true).resolves("/projectRootDir/dstNode1");
      getComponentDirStub.withArgs("/projectRootDir", "dstNode2", true).resolves("/projectRootDir/dstNode2");
      readComponentJsonStub.withArgs("/projectRootDir/dstNode1").resolves(counterpartJson1);
      readComponentJsonStub.withArgs("/projectRootDir/dstNode2").resolves(counterpartJson2);
      writeComponentJsonStub.withArgs("/projectRootDir", "/projectRootDir/dstNode1").resolves();
      writeComponentJsonStub.withArgs("/projectRootDir", "/projectRootDir/dstNode2").rejects();
      await expect(renameOutputFileCounterpart("/projectRootDir", componentJson, 0, "oldName", "newName")).to.be.rejected;
    });
  });
  describe("#renameComponentDir", ()=>{
    let renameComponentDir;
    let getComponentDirStub;
    let gitRmStub;
    let moveStub;
    let updateComponentPathStub;
    beforeEach(()=>{
      renameComponentDir = _internal.renameComponentDir;
      getComponentDirStub = sinon.stub(_internal, "getComponentDir");
      gitRmStub = sinon.stub(_internal, "gitRm");
      moveStub = sinon.stub(_internal.fs, "move");
      updateComponentPathStub = sinon.stub(_internal, "updateComponentPath");
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should rename component directory", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "id", true).returns("/projectRootDir/id/oldName");
      gitRmStub.withArgs("/projectRootDir", "/projectRootDir/id/oldName").resolves();
      moveStub.withArgs("/projectRootDir/id/oldName", "/projectRootDir/id/newName").resolves();
      updateComponentPathStub.withArgs("/projectRootDir", "id", "newName").resolves();
      await expect(renameComponentDir("/projectRootDir", "id", "/projectRootDir/id/newName")).to.be.fulfilled;
      expect(gitRmStub.calledWith("/projectRootDir", "/projectRootDir/id/oldName")).to.be.true;
      expect(moveStub.calledWith("/projectRootDir/id/oldName", "/projectRootDir/id/newName")).to.be.true;
      expect(updateComponentPathStub.calledWith("/projectRootDir", "id", "/projectRootDir/id/newName")).to.be.true;
    });
    it("should reject if the project root dir is same as the component dir", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "id", true).returns("/projectRootDir");
      await expect(renameComponentDir("/projectRootDir", "id", "newName")).to.be.rejected;
    });
  });
  describe("#updateComponentPos", ()=>{
    let updateComponentPos;
    let getLoggerStub;
    let debugStub;
    let warnStub;
    let getComponentDirStub;
    let readComponentJsonStub;
    let writeComponentJsonStub;
    beforeEach(()=>{
      updateComponentPos = _internal.updateComponentPos;
      getLoggerStub = sinon.stub(_internal, "getLogger");
      debugStub = sinon.stub();
      warnStub = sinon.stub();
      getComponentDirStub = sinon.stub(_internal, "getComponentDir");
      readComponentJsonStub = sinon.stub(_internal, "readComponentJson");
      writeComponentJsonStub = sinon.stub(_internal, "writeComponentJson");
      getLoggerStub.returns({
        debug: debugStub,
        warn: warnStub
      });
    });
    afterEach(()=>{
      sinon.restore();
    });
    it("should update component position", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "id", true).returns("/projectRootDir/id");
      const componentJson = {
        pos: {
          x: 0,
          y: 0
        }
      };
      readComponentJsonStub.withArgs("/projectRootDir/id").resolves(componentJson);
      await updateComponentPos("/projectRootDir", "id", {
        x: 1,
        y: 2
      });
      expect(writeComponentJsonStub.calledWith("/projectRootDir", "/projectRootDir/id", sinon.match({
        pos: {
          x: 1,
          y: 2
        }
      }))).to.be.true;
    });
    it("should throw error if the typs is invalid", async ()=>{
      getComponentDirStub.withArgs("/projectRootDir", "id", true).returns("/projectRootDir/id");
      const componentJson = {
        pos: {
          x: 0,
          y: 0
        }
      };
      readComponentJsonStub.withArgs("/projectRootDir/id").resolves(componentJson);
      await expect(updateComponentPos("/projectRootDir", "id", {
        x: 1
      })).to.be.rejectedWith("invalid JSON specified");
    });
  });
});