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


describe.skip("#removeAllLinkFromComponent", ()=>{
  let removeAllLinkFromComponent;
  let readComponentJsonByIDMock;
  let writeComponentJsonByIDMock;

  beforeEach(()=>{
    removeAllLinkFromComponent = projectFilesOperator._internal.removeAllLinkFromComponent;
    readComponentJsonByIDMock = sinon.stub();
    writeComponentJsonByIDMock = sinon.stub();
    projectFilesOperator._internal.readComponentJsonByID = readComponentJsonByIDMock;
    projectFilesOperator._internal.writeComponentJsonByID = writeComponentJsonByIDMock;
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should remove all links from the specified component", async ()=>{
    const projectRootDir = "/mock/project/root";
    const componentID = "testComponent";

    const targetComponent = {
      ID: componentID,
      previous: ["prev1", "prev2"],
      next: ["next1"],
      else: ["else1"]
    };

    const prev1Component = {
      ID: "prev1",
      next: [componentID]
    };
    const prev2Component = {
      ID: "prev2",
      next: [componentID],
      else: [componentID]
    };
    const nextComponent = {
      ID: "next1",
      previous: [componentID]
    };
    const elseComponent = {
      ID: "else1",
      previous: [componentID]
    };

    readComponentJsonByIDMock.withArgs(projectRootDir, componentID).resolves(targetComponent);
    readComponentJsonByIDMock.withArgs(projectRootDir, "prev1").resolves(prev1Component);
    readComponentJsonByIDMock.withArgs(projectRootDir, "prev2").resolves(prev2Component);
    readComponentJsonByIDMock.withArgs(projectRootDir, "next1").resolves(nextComponent);
    readComponentJsonByIDMock.withArgs(projectRootDir, "else1").resolves(elseComponent);

    await removeAllLinkFromComponent(projectRootDir, componentID);

    expect(prev1Component.next).to.not.include(componentID);
    expect(prev2Component.next).to.not.include(componentID);
    expect(prev2Component.else).to.not.include(componentID);
    expect(nextComponent.previous).to.not.include(componentID);
    expect(elseComponent.previous).to.not.include(componentID);

    expect(writeComponentJsonByIDMock.callCount).to.equal(4);
    expect(writeComponentJsonByIDMock.calledWith(projectRootDir, "prev1", sinon.match.object)).to.be.true;
    expect(writeComponentJsonByIDMock.calledWith(projectRootDir, "prev2", sinon.match.object)).to.be.true;
    expect(writeComponentJsonByIDMock.calledWith(projectRootDir, "next1", sinon.match.object)).to.be.true;
    expect(writeComponentJsonByIDMock.calledWith(projectRootDir, "else1", sinon.match.object)).to.be.true;
  });

  it("should handle components with no links gracefully", async ()=>{
    const projectRootDir = "/mock/project/root";
    const componentID = "isolatedComponent";

    const isolatedComponent = {
      ID: componentID
    };

    readComponentJsonByIDMock.withArgs(projectRootDir, componentID).resolves(isolatedComponent);

    await removeAllLinkFromComponent(projectRootDir, componentID);

    expect(writeComponentJsonByIDMock.notCalled).to.be.true;
  });

  it("should remove all file links from inputFiles and outputFiles", async ()=>{
    const projectRootDir = "/mock/project/root";
    const componentID = "fileLinkComponent";

    const targetComponent = {
      ID: componentID,
      inputFiles: [
        {
          src: [{ srcNode: "srcComponent1" }, { srcNode: "srcComponent2" }]
        }
      ],
      outputFiles: [
        {
          dst: [{ dstNode: "dstComponent1" }, { dstNode: "dstComponent2" }]
        }
      ]
    };

    const srcComponent1 = {
      ID: "srcComponent1",
      outputFiles: [
        { dst: [{ dstNode: componentID }, { dstNode: "otherComponent" }] }
      ]
    };
    const srcComponent2 = {
      ID: "srcComponent2",
      outputFiles: [{ dst: [{ dstNode: componentID }] }]
    };

    const dstComponent1 = {
      ID: "dstComponent1",
      inputFiles: [
        { src: [{ srcNode: componentID }, { srcNode: "otherComponent" }] }
      ]
    };
    const dstComponent2 = {
      ID: "dstComponent2",
      inputFiles: [{ src: [{ srcNode: componentID }] }]
    };

    readComponentJsonByIDMock.withArgs(projectRootDir, componentID).resolves(targetComponent);
    readComponentJsonByIDMock.withArgs(projectRootDir, "srcComponent1").resolves(srcComponent1);
    readComponentJsonByIDMock.withArgs(projectRootDir, "srcComponent2").resolves(srcComponent2);
    readComponentJsonByIDMock.withArgs(projectRootDir, "dstComponent1").resolves(dstComponent1);
    readComponentJsonByIDMock.withArgs(projectRootDir, "dstComponent2").resolves(dstComponent2);

    await removeAllLinkFromComponent(projectRootDir, componentID);

    expect(srcComponent1.outputFiles[0].dst).to.not.deep.include({ dstNode: componentID });
    expect(srcComponent2.outputFiles[0].dst).to.not.deep.include({ dstNode: componentID });

    expect(dstComponent1.inputFiles[0].src).to.not.deep.include({ srcNode: componentID });
    expect(dstComponent2.inputFiles[0].src).to.not.deep.include({ srcNode: componentID });

    expect(writeComponentJsonByIDMock.callCount).to.equal(4);
    expect(writeComponentJsonByIDMock.calledWith(projectRootDir, "srcComponent1", sinon.match.object)).to.be.true;
    expect(writeComponentJsonByIDMock.calledWith(projectRootDir, "srcComponent2", sinon.match.object)).to.be.true;
    expect(writeComponentJsonByIDMock.calledWith(projectRootDir, "dstComponent1", sinon.match.object)).to.be.true;
    expect(writeComponentJsonByIDMock.calledWith(projectRootDir, "dstComponent2", sinon.match.object)).to.be.true;
  });
});
