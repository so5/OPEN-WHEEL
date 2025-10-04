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


describe.skip("#arrangeComponent", ()=>{
  let rewireProjectFilesOperator;
  let arrangeComponent;

  beforeEach(()=>{
    rewireProjectFilesOperator = rewire("../../../app/core/projectFilesOperator.js");
    arrangeComponent = rewireProjectFilesOperator.__get__("arrangeComponent");
  });

  it("should return an empty array when stepjobGroupArray is empty", async ()=>{
    const stepjobGroupArray = []; //空

    const result = await arrangeComponent(stepjobGroupArray);

    expect(result).to.deep.equal([]);
  });

  it("should return the entire group if no initial node is found (arrangeArraytemp.length === 0 on first filter)", async ()=>{
    //全てのタスクが next.length === 0 or previous.length !== 0 などで「先頭」になりうるコンポーネントが存在しない例
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

    //初期filterでarrangeArraytempが空 → breakしてstepjobTaskGroupそのものを返す
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

    //comp1 -> comp2 -> comp3
    expect(result.map((c)=>c.ID)).to.deep.equal(["comp1", "comp2", "comp3"]);
  });

  it("should continue loop but skip pushing next if next component is not found (nextComponent.length === 0)", async ()=>{
    //comp1がnext=["comp2"]だが、comp2がいないのでpushしないケース
    const stepjobTaskGroup = [
      {
        ID: "comp1",
        previous: [],
        next: ["comp2"]
      }
      //comp2は定義されていない
    ];
    const stepjobGroupArray = [stepjobTaskGroup];

    const result = await arrangeComponent(stepjobGroupArray);

    //comp2が見つからないのでcomp1のみ
    expect(result).to.have.lengthOf(1);
    expect(result[0].ID).to.equal("comp1");
  });

  it("should put isolated tasks (no previous & no next) at the end of the array", async ()=>{
    //comp1 -> comp2 の後ろに、完全に接続されていないcomp3を末尾に追加するか
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
    //comp3が最後に回される
    expect(result.map((c)=>c.ID)).to.deep.equal(["comp1", "comp2", "comp3"]);
  });

  it("should correctly handle multiple groups and flatten all results into a single array", async ()=>{
    const group1 = [
      { ID: "g1c1", previous: [], next: ["g1c2"] },
      { ID: "g1c2", previous: ["g1c1"], next: [] }
    ];
    const group2 = [
      { ID: "g2c1", previous: [], next: [] }, //isolated
      { ID: "g2c2", previous: [], next: ["g2c3"] },
      { ID: "g2c3", previous: ["g2c2"], next: [] }
    ];
    const stepjobGroupArray = [group1, group2];

    const result = await arrangeComponent(stepjobGroupArray);

    //group1 は [g1c1, g1c2]
    //group2 は [g2c2, g2c3, g2c1] の順（g2c1はisolatedで最後に来る）
    //flatにすると [g1c1, g1c2, g2c2, g2c3, g2c1]
    expect(result).to.have.lengthOf(5);
    expect(result.map((c)=>c.ID)).to.deep.equal(["g1c1", "g1c2", "g2c2", "g2c3", "g2c1"]);
  });

  it("should handle a group that has a single element (both previous and next are empty)", async ()=>{
    const stepjobTaskGroup = [
      { ID: "single", previous: [], next: [] }
    ];
    const stepjobGroupArray = [stepjobTaskGroup];

    const result = await arrangeComponent(stepjobGroupArray);

    //単一要素なので、そのまま返る
    expect(result).to.have.lengthOf(1);
    expect(result[0].ID).to.equal("single");
  });

  it("should handle a group that has tasks but none have next.length !== 0", async ()=>{
    //先頭filterで next.length !== 0 のものが1つもないケース
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

    //arrangeArraytemp = stepjobTaskComponents となり break
    expect(result).to.deep.equal(stepjobTaskGroup);
  });
});
