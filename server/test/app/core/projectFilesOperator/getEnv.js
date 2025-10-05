/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it, beforeEach, afterEach } = require("mocha");
const sinon = require("sinon");
const projectFilesOperator = require("../../../../app/core/projectFilesOperator.js");

describe("#getEnv", ()=>{
  let readComponentJsonByIDStub;

  beforeEach(()=>{
    readComponentJsonByIDStub = sinon.stub(projectFilesOperator._internal, "readComponentJsonByID");
  });

  afterEach(()=>{
    sinon.restore();
  });

  it("should return the env object if the component has env property", async ()=>{
    const mockComponentJson = {
      env: {
        VAR_A: "VALUE_A",
        VAR_B: "VALUE_B"
      }
    };
    readComponentJsonByIDStub.resolves(mockComponentJson);

    const projectRootDir = "/mock/project/root";
    const componentID = "mockComponentID";
    const result = await projectFilesOperator.getEnv(projectRootDir, componentID);

    expect(readComponentJsonByIDStub.calledOnceWith(projectRootDir, componentID)).to.be.true;
    expect(result).to.deep.equal(mockComponentJson.env);
  });

  it("should return an empty object if env property is not defined", async ()=>{
    const mockComponentJson = { name: "testComponent" };
    readComponentJsonByIDStub.resolves(mockComponentJson);

    const result = await projectFilesOperator.getEnv("/mock/project/root", "mockComponentID");

    expect(result).to.deep.equal({});
  });

  it("should throw an error if readComponentJsonByID rejects", async ()=>{
    const mockError = new Error("Failed to read component JSON");
    readComponentJsonByIDStub.rejects(mockError);

    try {
      await projectFilesOperator.getEnv("/mock/project/root", "errorComponentID");
      throw new Error("getEnv should have thrown an error");
    } catch (err) {
      expect(err).to.equal(mockError);
    }
  });
});