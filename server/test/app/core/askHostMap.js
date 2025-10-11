/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */

"use strict";
//setup test framework
const chai = require("chai");
const expect = chai.expect;
chai.use(require("chai-fs"));
chai.use(require("chai-as-promised"));
const sinon = require("sinon");

const dummyRemoteHost = {
  getAll() {
    return [{ name: "a" }, { name: "b" }, { name: "c" }];
  }
};
//testee
const { isValidHostMap, askHostMap, _internal } = require("../../../app/core/askHostMap.js");

describe("hostMapper UT", function () {
  beforeEach(()=>{
    sinon.stub(_internal, "emitAll");
    sinon.replace(_internal, "remoteHost", dummyRemoteHost);
    sinon.stub(_internal, "getLogger").returns({ error: sinon.stub() });
  });
  afterEach(()=>{ return sinon.restore(); });
  describe("#isValidHostMap", ()=>{
    it("should return false if one of hostMap's key is not string", ()=>{
      expect(isValidHostMap({ 0: 1 }, [])).to.be.false;
    });
    it("should return false if one of hostMap's key is not included in hosts", ()=>{
      expect(isValidHostMap({ key: "hostname" }, [])).to.be.false;
    });
    it("should return false if one of hostMap's value is not included in remoteHost", ()=>{
      expect(isValidHostMap({ key: "hostname" }, [{ hostname: "key" }])).to.be.false;
    });
    it("sholud return true if all hostMap entry is valid", ()=>{
      expect(isValidHostMap({ foo: "a", bar: "b", baz: "b" }, [{ hostname: "foo" }, { hostname: "bar" }])).to.be.true;
    });
  });
  describe("#askHostMap", ()=>{
    const clientID = "dummyClientID";
    const hostMap = { foo: "a", bar: "b", baz: "b" };
    const hosts = [{ hostname: "foo" }, { hostname: "bar" }];
    it("should resolve with hostMap", async ()=>{
      _internal.emitAll.callsArgWith(3, hostMap);
      expect(await askHostMap(clientID, hosts)).to.equal(hostMap);
      const firstCall = _internal.emitAll.getCall(0);
      expect(firstCall.args[0]).to.equal(clientID);
      expect(firstCall.args[1]).to.equal("askHostMap");
      expect(firstCall.args[2]).to.deep.equal(hosts);
    });
    it("should throw exception if cb called with null", ()=>{
      _internal.emitAll.callsArgWith(3, null);
      return expect(askHostMap(clientID, hosts)).to.be.rejectedWith("user canceled host map input");
    });
    it("should throw exception if cb called with invalid hostMap", ()=>{
      const invalidHostMap = { 0: 1 };
      _internal.emitAll.callsArgWith(3, invalidHostMap);
      return expect(askHostMap(clientID, hosts)).to.be.rejectedWith("invalid host map");
    });
  });
});
