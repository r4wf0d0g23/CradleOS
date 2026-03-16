"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var uleb_exports = {};
__export(uleb_exports, {
  ulebDecode: () => ulebDecode,
  ulebEncode: () => ulebEncode
});
module.exports = __toCommonJS(uleb_exports);
function ulebEncode(num) {
  let bigNum = BigInt(num);
  const arr = [];
  let len = 0;
  if (bigNum === 0n) {
    return [0];
  }
  while (bigNum > 0) {
    arr[len] = Number(bigNum & 0x7fn);
    bigNum >>= 7n;
    if (bigNum > 0n) {
      arr[len] |= 128;
    }
    len += 1;
  }
  return arr;
}
function ulebDecode(arr) {
  let total = 0n;
  let shift = 0n;
  let len = 0;
  while (true) {
    if (len >= arr.length) {
      throw new Error("ULEB decode error: buffer overflow");
    }
    const byte = arr[len];
    len += 1;
    total += BigInt(byte & 127) << shift;
    if ((byte & 128) === 0) {
      break;
    }
    shift += 7n;
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("ULEB decode error: value exceeds MAX_SAFE_INTEGER");
  }
  return {
    value: Number(total),
    length: len
  };
}
//# sourceMappingURL=uleb.js.map
