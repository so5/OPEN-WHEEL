/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#removeAllLinkFromComponent", ()=>{
  let readComponentJsonByIDStub;
  let writeComponentJsonByIDStub;
  const projectRootDir = "/mock/project/root";
  const componentID = "testComponent";

  beforeEach(()=>{
    readComponentJsonByIDStub = sinon.stub(projectFilesOperator._internal, "readComponentJsonByID");
    writeComponentJsonByIDStub = sinon.stub(projectFilesOperator._internal, "writeComponentJsonByID").resolves();
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should remove all workflow links from the specified component", async ()=>{
    const targetComponent = {
      ID: componentID,
      previous: ["prev1", "prev2"],
      next: ["next1"],
      else: ["else1"]
    };
    const prev1Component = { ID: "prev1", next: [componentID, "other"] };
    const prev2Component = { ID: "prev2", next: [componentID], else: [componentID] };
    const nextComponent = { ID: "next1", previous: [componentID, "other"] };
    const elseComponent = { ID: "else1", previous: [componentID] };

    readComponentJsonByIDStub.withArgs(projectRootDir, componentID).resolves(targetComponent);
    readComponentJsonByIDStub.withArgs(projectRootDir, "prev1").resolves(prev1Component);
    readComponentJsonByIDStub.withArgs(projectRootDir, "prev2").resolves(prev2Component);
    readComponentJsonByIDStub.withArgs(projectRootDir, "next1").resolves(nextComponent);
    readComponentJsonByIDStub.withArgs(projectRootDir, "else1").resolves(elseComponent);

    await projectFilesOperator._internal.removeAllLinkFromComponent(projectRootDir, componentID);

    expect(writeComponentJsonByIDStub.callCount).to.equal(4);
    expect(writeComponentJsonByIDStub.calledWith(projectRootDir, "prev1", { ID: "prev1", next: ["other"] })).to.be.true;
    expect(writeComponentJsonByIDStub.calledWith(projectRootDir, "prev2", { ID: "prev2", next: [], else: [] })).to.be.true;
    expect(writeComponentJsonByIDStub.calledWith(projectRootDir, "next1", { ID: "next1", previous: ["other"] })).to.be.true;
    expect(writeComponentJsonByIDStub.calledWith(projectRootDir, "else1", { ID: "else1", previous: [] })).to.be.true;
  });

  it("should handle components with no links gracefully", async ()=>{
    const isolatedComponent = { ID: componentID };
    readComponentJsonByIDStub.withArgs(projectRootDir, componentID).resolves(isolatedComponent);
    await projectFilesOperator._internal.removeAllLinkFromComponent(projectRootDir, componentID);
    expect(writeComponentJsonByIDStub.notCalled).to.be.true;
  });

  it("should remove all file links from inputFiles and outputFiles", async ()=>{
    const targetComponent = {
      ID: componentID,
      inputFiles: [{ src: [{ srcNode: "srcComponent1" }, { srcNode: "srcComponent2" }] }],
      outputFiles: [{ dst: [{ dstNode: "dstComponent1" }, { dstNode: "dstComponent2" }] }]
    };
    const srcComponent1 = { ID: "srcComponent1", outputFiles: [{ dst: [{ dstNode: componentID }, { dstNode: "other" }] }] };
    const srcComponent2 = { ID: "srcComponent2", outputFiles: [{ dst: [{ dstNode: componentID }] }] };
    const dstComponent1 = { ID: "dstComponent1", inputFiles: [{ src: [{ srcNode: componentID }, { srcNode: "other" }] }] };
    const dstComponent2 = { ID: "dstComponent2", inputFiles: [{ src: [{ srcNode: componentID }] }] };

    readComponentJsonByIDStub.withArgs(projectRootDir, componentID).resolves(targetComponent);
    readComponentJsonByIDStub.withArgs(projectRootDir, "srcComponent1").resolves(srcComponent1);
    readComponentJsonByIDStub.withArgs(projectRootDir, "srcComponent2").resolves(srcComponent2);
    readComponentJsonByIDStub.withArgs(projectRootDir, "dstComponent1").resolves(dstComponent1);
    readComponentJsonByIDStub.withArgs(projectRootDir, "dstComponent2").resolves(dstComponent2);

    await projectFilesOperator._internal.removeAllLinkFromComponent(projectRootDir, componentID);

    expect(writeComponentJsonByIDStub.callCount).to.equal(4);
    expect(writeComponentJsonByIDStub.calledWith(projectRootDir, "srcComponent1", { ID: "srcComponent1", outputFiles: [{ dst: [{ dstNode: "other" }] }] })).to.be.true;
    expect(writeComponentJsonByIDStub.calledWith(projectRootDir, "srcComponent2", { ID: "srcComponent2", outputFiles: [{ dst: [] }] })).to.be.true;
    expect(writeComponentJsonByIDStub.calledWith(projectRootDir, "dstComponent1", { ID: "dstComponent1", inputFiles: [{ src: [{ srcNode: "other" }] }] })).to.be.true;
    expect(writeComponentJsonByIDStub.calledWith(projectRootDir, "dstComponent2", { ID: "dstComponent2", inputFiles: [{ src: [] }] })).to.be.true;
  });
});
