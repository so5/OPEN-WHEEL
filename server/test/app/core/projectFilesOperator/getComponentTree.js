/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import sinon from "sinon";
import path from "path";
import * as projectFilesOperator from "../../../../app/core/projectFilesOperator.js";

describe("#getComponentTree", ()=>{
  let readJsonGreedyStub;
  let originalPath;

  beforeEach(()=>{
    originalPath = projectFilesOperator._internal.path;
    projectFilesOperator._internal.path = path.posix;
    readJsonGreedyStub = sinon.stub(projectFilesOperator._internal, "readJsonGreedy");
  });

  afterEach(()=>{
    sinon.restore();
    projectFilesOperator._internal.path = originalPath;
  });

  it("should return the root component with children properly attached (absolute path case)", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockRootDir = "/mock/project/root";

    const mockProjectJson = {
      componentPath: {
        rootID: "./",
        childID1: "./child1",
        childID2: "./child1/child2"
      }
    };

    readJsonGreedyStub.withArgs(path.posix.resolve(mockProjectRootDir, "prj.wheel.json")).resolves(mockProjectJson);
    readJsonGreedyStub.withArgs(path.posix.resolve(mockProjectRootDir, "./", "cmp.wheel.json")).resolves({ ID: "rootID", parent: null });
    readJsonGreedyStub.withArgs(path.posix.resolve(mockProjectRootDir, "./child1", "cmp.wheel.json")).resolves({ ID: "childID1", parent: "rootID" });
    readJsonGreedyStub.withArgs(path.posix.resolve(mockProjectRootDir, "./child1/child2", "cmp.wheel.json")).resolves({ ID: "childID2", parent: "childID1" });

    const result = await projectFilesOperator.getComponentTree(mockProjectRootDir, mockRootDir);

    expect(result.ID).to.equal("rootID");
    expect(result.children).to.have.lengthOf(1);
    expect(result.children[0].ID).to.equal("childID1");
    expect(result.children[0].children).to.have.lengthOf(1);
    expect(result.children[0].children[0].ID).to.equal("childID2");
  });

  it("should return the root component with children (relative path case)", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockRootDir = "./";

    const mockProjectJson = {
      componentPath: {
        rootID: "./",
        childID1: "./child1"
      }
    };

    readJsonGreedyStub.withArgs(path.posix.resolve(mockProjectRootDir, "prj.wheel.json")).resolves(mockProjectJson);
    readJsonGreedyStub.withArgs(path.posix.resolve(mockProjectRootDir, "./", "cmp.wheel.json")).resolves({ ID: "rootID" });
    readJsonGreedyStub.withArgs(path.posix.resolve(mockProjectRootDir, "./child1", "cmp.wheel.json")).resolves({ ID: "childID1", parent: "rootID" });

    const result = await projectFilesOperator.getComponentTree(mockProjectRootDir, mockRootDir);

    expect(result.ID).to.equal("rootID");
    expect(result.children).to.have.lengthOf(1);
    expect(result.children[0].ID).to.equal("childID1");
  });

  it("should attach child to root if child refers a non-existent parent", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockRootDir = "/mock/project/root";

    const mockProjectJson = {
      componentPath: {
        rootID: "./",
        lonelyChild: "./child"
      }
    };
    readJsonGreedyStub.withArgs(path.posix.resolve(mockProjectRootDir, "prj.wheel.json")).resolves(mockProjectJson);
    readJsonGreedyStub.withArgs(path.posix.resolve(mockProjectRootDir, "./", "cmp.wheel.json")).resolves({ ID: "rootID" });
    readJsonGreedyStub.withArgs(path.posix.resolve(mockProjectRootDir, "./child", "cmp.wheel.json")).resolves({ ID: "lonelyChild", parent: "unknownParent" });

    const result = await projectFilesOperator.getComponentTree(mockProjectRootDir, mockRootDir);

    expect(result.ID).to.equal("rootID");
    expect(result.children).to.have.lengthOf(1);
    expect(result.children[0].ID).to.equal("lonelyChild");
  });

  it("should create a new children array if the parent component has no existing children array", async ()=>{
    const mockProjectRootDir = "/mock/project/root";
    const mockRootDir = "/mock/project/root";
    const mockProjectJson = {
      componentPath: {
        rootID: "./",
        childID: "./child"
      }
    };

    readJsonGreedyStub.withArgs(path.posix.resolve(mockProjectRootDir, "prj.wheel.json")).resolves(mockProjectJson);
    readJsonGreedyStub.withArgs(path.posix.resolve(mockProjectRootDir, "./", "cmp.wheel.json")).resolves({ ID: "rootID" });
    readJsonGreedyStub.withArgs(path.posix.resolve(mockProjectRootDir, "./child", "cmp.wheel.json")).resolves({ ID: "childID", parent: "rootID" });

    const result = await projectFilesOperator.getComponentTree(mockProjectRootDir, mockRootDir);

    expect(result.ID).to.equal("rootID");
    expect(result.children).to.have.lengthOf(1);
    expect(result.children[0].ID).to.equal("childID");
  });
});
