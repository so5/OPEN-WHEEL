/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#getComponentFullName", ()=>{
  let getComponentDirStub;

  beforeEach(()=>{
    getComponentDirStub = sinon.stub(projectFilesOperator._internal, "getComponentDir");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return the path without a leading dot when getComponentDir returns a valid relative path", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockID = "component123";
    const mockPath = "./relative/path/to/component";

    getComponentDirStub.resolves(mockPath);

    const result = await projectFilesOperator._internal.getComponentFullName(mockProjectRootDir, mockID);

    expect(getComponentDirStub.calledOnceWith(mockProjectRootDir, mockID)).to.be.true;
    expect(result).to.equal("/relative/path/to/component");
  });

  it("should return null when getComponentDir returns null", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockID = "component123";

    getComponentDirStub.resolves(null);

    const result = await projectFilesOperator._internal.getComponentFullName(mockProjectRootDir, mockID);

    expect(getComponentDirStub.calledOnceWith(mockProjectRootDir, mockID)).to.be.true;
    expect(result).to.be.null;
  });

  it("should return the original path when getComponentDir returns a path without a leading dot", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockID = "component123";
    const mockPath = "absolute/path/to/component";

    getComponentDirStub.resolves(mockPath);

    const result = await projectFilesOperator._internal.getComponentFullName(mockProjectRootDir, mockID);

    expect(getComponentDirStub.calledOnceWith(mockProjectRootDir, mockID)).to.be.true;
    expect(result).to.equal(mockPath);
  });
});
