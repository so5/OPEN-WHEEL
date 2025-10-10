/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License in the project root for the license information.
 */
"use strict";
import { expect } from "chai";
import { describe, it } from "mocha";
import { getBulkFirstCapture } from "../../../../app/core/jobManager.js";

describe("#getBulkFirstCapture", ()=>{
  it("should return [1, []] if no lines match the pattern", ()=>{
    //準備: outputTextに正規表現とマッチする行が無い
    const outputText = [
      "some line",
      "another line",
      "yet another line"
    ].join("\n");

    //実行: マッチしないパターンを与える
    const reSubCode = /CODE=(\d+)/; //例: CODE=数字 で探す
    const result = getBulkFirstCapture(outputText, reSubCode);

    //検証: subJobOutputsが空 => bulkjobFailed = true => result=1, codeList=[]
    expect(result).to.deep.equal([1, []]);
  });

  it("should return [0, codeList] if some lines match and at least one capture is '0'", ()=>{
    //準備: 複数行の中に CODE=0 を含む
    const outputText = [
      "some line CODE=1",
      "some line CODE=0", //<-- キャプチャグループ[1] が "0"
      "last line CODE=2"
    ].join("\n");

    const reSubCode = /CODE=(\d+)/;
    const result = getBulkFirstCapture(outputText, reSubCode);

    //検証: 1つでも "0" があれば bulkjobFailed = false => result=0
    //codeList はマッチしたもの全部 [ "1", "0", "2" ]
    expect(result).to.deep.equal([0, ["1", "0", "2"]]);
  });

  it("should return [1, codeList] if all captures are not '0'", ()=>{
    //準備: マッチする行がすべて "0" 以外
    const outputText = [
      "some line CODE=5",
      "some line CODE=9"
    ].join("\n");

    const reSubCode = /CODE=(\d+)/;
    const result = getBulkFirstCapture(outputText, reSubCode);

    //検証: キャプチャすべてが"0"以外 => bulkjobFailed = true => result=1
    //codeList => [ "5", "9" ]
    expect(result).to.deep.equal([1, ["5", "9"]]);
  });

  it("should treat lines with undefined capture group as nonzero, returning [1, codeList]", ()=>{
    //準備: 正規表現にマッチはするが、キャプチャグループが存在しないケース
    //例: キャプチャグループを (?: ...) にするとグループ[1] が無い
    const outputText = [
      "line1 CODE=0", //この行は通常通り CODE=0 (キャプチャ1あり)
      "line2 CODE=123" //この行はマッチするけど数値キャプチャが取れない想定
    ].join("\n");

    //正規表現にグループを設定していない例
    ///CODE=(\d+)/ → [0] 全体マッチ, [1] = "0" or "5" など
    ///CODE=\d+/   → キャプチャが無い => arrText[1] は undefined
    //ここでは複数パターンで意図的にグループを壊す
    const reSubCode = /CODE=\d+/;

    const result = getBulkFirstCapture(outputText, reSubCode);

    //subJobOutputsは2つマッチ
    //arrText[0] = "CODE=0" or "CODE=123"
    //arrText[1] = undefined => "0" と等しくない => すべて "0" 以外とみなされる
    //=> bulkjobFailed=true => result=1, codeList = [undefined, undefined]
    expect(result).to.deep.equal([1, [undefined, undefined]]);
  });
});