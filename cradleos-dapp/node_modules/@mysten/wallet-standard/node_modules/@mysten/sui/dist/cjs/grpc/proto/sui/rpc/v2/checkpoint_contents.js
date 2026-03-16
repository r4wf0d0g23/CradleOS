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
var checkpoint_contents_exports = {};
__export(checkpoint_contents_exports, {
  CheckpointContents: () => CheckpointContents,
  CheckpointedTransactionInfo: () => CheckpointedTransactionInfo
});
module.exports = __toCommonJS(checkpoint_contents_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_signature = require("./signature.js");
var import_bcs = require("./bcs.js");
class CheckpointContents$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CheckpointContents", [
      { no: 1, name: "bcs", kind: "message", T: () => import_bcs.Bcs },
      {
        no: 2,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "version",
        kind: "scalar",
        opt: true,
        T: 5
        /*ScalarType.INT32*/
      },
      {
        no: 4,
        name: "transactions",
        kind: "message",
        repeat: 1,
        T: () => CheckpointedTransactionInfo
      }
    ]);
  }
}
const CheckpointContents = new CheckpointContents$Type();
class CheckpointedTransactionInfo$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.CheckpointedTransactionInfo", [
      {
        no: 1,
        name: "transaction",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "effects",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "signatures",
        kind: "message",
        repeat: 1,
        T: () => import_signature.UserSignature
      }
    ]);
  }
}
const CheckpointedTransactionInfo = new CheckpointedTransactionInfo$Type();
//# sourceMappingURL=checkpoint_contents.js.map
