/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
const { expect } = require("chai");
const { describe, it } = require("mocha");
const projectFilesOperator = require("../../../../app/core/projectFilesOperator.js");

describe("#arrangeComponent", ()=>{
  const { arrangeComponent } = projectFilesOperator._internal;

  it("should return an empty array when stepjobGroupArray is empty", async ()=>{
    const stepjobGroupArray = [];

    const result = await arrangeComponent(stepjobGroupArray);

    expect(result).to.deep.equal([]);
  });

  it("should return the entire group if no initial node is found (arrangeArraytemp.length === 0 on first filter)", async ()=>{
    const stepjobTaskGroup = [
      {
        ID: "comp1",
        previous: ["comp2"],
        next: []
      },
      {
        ID: "comp2",
        previous: [],
        next: []
      }
    ];
    const stepjobGroupArray = [stepjobTaskGroup];

    const result = await arrangeComponent(stepjobGroupArray);

    expect(result).to.deep.equal(stepjobTaskGroup);
  });

  it("should arrange a single connected chain in the correct order (normal chain scenario)", async ()=>{
    const stepjobTaskGroup = [
      {
        ID: "comp1",
        previous: [],
        next: ["comp2"]
      },
      {
        ID: "comp2",
        previous: ["comp1"],
        next: ["comp3"]
      },
      {
        ID: "comp3",
        previous: ["comp2"],
        next: []
      }
    ];
    const stepjobGroupArray = [stepjobTaskGroup];

    const result = await arrangeComponent(stepjobGroupArray);

    expect(result.map((c)=>{ return c.ID; })).to.deep.equal(["comp1", "comp2", "comp3"]);
  });

  it("should continue loop but skip pushing next if next component is not found (nextComponent.length === 0)", async ()=>{
    const stepjobTaskGroup = [
      {
        ID: "comp1",
        previous: [],
        next: ["comp2"]
      }
    ];
    const stepjobGroupArray = [stepjobTaskGroup];

    const result = await arrangeComponent(stepjobGroupArray);

    expect(result).to.have.lengthOf(1);
    expect(result[0].ID).to.equal("comp1");
  });

  it("should put isolated tasks (no previous & no next) at the end of the array", async ()=>{
    const stepjobTaskGroup = [
      {
        ID: "comp1",
        previous: [],
        next: ["comp2"]
      },
      {
        ID: "comp2",
        previous: ["comp1"],
        next: []
      },
      {
        ID: "comp3",
        previous: [],
        next: []
      }
    ];
    const stepjobGroupArray = [stepjobTaskGroup];

    const result = await arrangeComponent(stepjobGroupArray);
    expect(result.map((c)=>{ return c.ID; })).to.deep.equal(["comp1", "comp2", "comp3"]);
  });

  it("should correctly handle multiple groups and flatten all results into a single array", async ()=>{
    const group1 = [
      { ID: "g1c1", previous: [], next: ["g1c2"] },
      { ID: "g1c2", previous: ["g1c1"], next: [] }
    ];
    const group2 = [
      { ID: "g2c1", previous: [], next: [] },
      { ID: "g2c2", previous: [], next: ["g2c3"] },
      { ID: "g2c3", previous: ["g2c2"], next: [] }
    ];
    const stepjobGroupArray = [group1, group2];

    const result = await arrangeComponent(stepjobGroupArray);

    expect(result).to.have.lengthOf(5);
    expect(result.map((c)=>{ return c.ID; })).to.deep.equal(["g1c1", "g1c2", "g2c2", "g2c3", "g2c1"]);
  });

  it("should handle a group that has a single element (both previous and next are empty)", async ()=>{
    const stepjobTaskGroup = [
      { ID: "single", previous: [], next: [] }
    ];
    const stepjobGroupArray = [stepjobTaskGroup];

    const result = await arrangeComponent(stepjobGroupArray);

    expect(result).to.have.lengthOf(1);
    expect(result[0].ID).to.equal("single");
  });

  it("should handle a group that has tasks but none have next.length !== 0", async ()=>{
    const stepjobTaskGroup = [
      {
        ID: "compA",
        previous: [],
        next: []
      },
      {
        ID: "compB",
        previous: [],
        next: []
      }
    ];
    const stepjobGroupArray = [stepjobTaskGroup];

    const result = await arrangeComponent(stepjobGroupArray);

    expect(result).to.deep.equal(stepjobTaskGroup);
  });
});
