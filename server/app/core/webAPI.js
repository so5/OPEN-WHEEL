/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See Licensethe project root for the license information.
 */
import axios from "axios";
import querystring from "querystring";
import crypto from "crypto";
import { credentialFilename } from "../db/db.js";

const authDB = new Map();

let credentials;
(async ()=>{
  const { JSONFilePreset } = await import("lowdb/node");
  credentials = await JSONFilePreset(credentialFilename, {});
})();

//TODO remotehost.jsonから読むようにする
const tokenURL = "https://idp.fugaku.r-ccs.riken.jp/auth/realms/op/protocol/openid-connect/token";
const authURL = "https://idp.fugaku.r-ccs.riken.jp/auth/realms/op/protocol/openid-connect/auth";
export function hasEntry(remotehostID) {
  return authDB.has(remotehostID);
}
export function hasCode(remotehostID) {
  const auth = authDB.get(remotehostID);
  return auth && typeof auth.code === "string";
}
export function hasRefreshToken(remotehostID) {
  const auth = authDB.get(remotehostID);
  return auth && typeof auth.refresh_token === "string";
}
export function storeCode(remotehostID, code) {
  if (typeof code !== "string") {
    return false;
  }
  const auth = authDB.get(remotehostID);
  if (auth) {
    auth.code = code;
    return true;
  }
  return false;
}
export function getAccessToken(remotehostID) {
  const auth = authDB.get(remotehostID);
  return typeof auth.access_token === "string" ? auth.access_token : null;
}
export function getRemotehostIDFromState(state) {
  for (const [k, v] of authDB) {
    if (v.state === state) {
      return k;
    }
  }
}

/**
 * get access token and refresh token from token endpoint
 * @param {string} remotehostID - ID string for remotehost "fugaku" is the only allowed value for now
 */
export async function acquireAccessToken(remotehostID) {
  const auth = authDB.get(remotehostID);
  const { client_id: clientID, client_secret: clientSecret } = credentials.data[remotehostID];
  console.log("DEBUG: client_id", clientID);
  console.log("DEBUG: client_secret", clientSecret);
  const response = await axios.post(tokenURL, {
    grant_type: "authorization_code",
    code: auth.code,
    redirect_uri: auth.redirect_uri,
    client_id: clientID,
    client_secret: clientSecret
  }, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    } });
  if (response.status !== 200) {
    console.log("acquire access token failed with ", response.status);
  }
  auth.access_token = response.data.access_token;
  auth.refresh_token = response.data.refresh_token;
  console.log("DEBUG:", auth);
}

/*富岳web APIを access tokenで叩くとエラーが返ってくるのでこの関数は未テスト
async function acquireAccessTokenFromRefreshToken(remotehostID){
  const auth=authDB.get(remotehostID)
  const {client_id:clientID, client_secret: clientSecret} = credentials.data[remotehostID];
  const response = await axios.post(tokenURL,{
    grant_type:"refresh_token",
    refresh_token: auth.refresh_token,
    redirect_uri: auth.redirect_uri,
    client_id: clientID,
    client_secret: clientSecret
  }, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }});
  auth.access_token=response.data.access_token

  if(response.data.refresh_token){
    auth.refresh_token=response.data.refresh_token
  }
}
*/

export async function getURLtoAcquireCode(remotehostID, redirectURI) {
  const state = crypto.randomUUID();
  const { client_id: clientID } = credentials.data[remotehostID];
  const params = {
    response_type: "code",
    scope: "openid email profile offline_access",
    client_id: clientID,
    state,
    redirect_uri: redirectURI
  };
  console.log("DEBUG:", params);
  const url = `${authURL}?${querystring.stringify(params)}`;
  authDB.set(remotehostID, {
    state,
    redirect_uri: params.redirect_uri
  });
  return url;
}