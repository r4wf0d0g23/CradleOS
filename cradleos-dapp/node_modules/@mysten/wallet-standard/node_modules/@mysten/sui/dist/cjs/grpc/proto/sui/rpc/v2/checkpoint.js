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
var checkpoint_exports = {};
__export(checkpoint_exports, {
  Checkpoint: () => Checkpoint
});
module.exports = __toCommonJS(checkpoint_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_object = require("./object.js");
var import_executed_transaction = require("./executed_transaction.js");
var import_checkpoint_contents = require("./checkpoint_contents.js");
var import_signature = require("./signature.js");
var import_checkpoint_summary = require("./checkpoint_summary.js");
class Checkpoint$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.Checkpoint", [
      {
        no: 1,
        name: "sequence_number",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 3, name: "summary", kind: "message", T: () => import_checkpoint_summary.CheckpointSummary },
      { no: 4, name: "signature", kind: "message", T: () => import_signature.ValidatorAggregatedSignature },
      { no: 5, name: "contents", kind: "message", T: () => import_checkpoint_contents.CheckpointContents },
      {
        no: 6,
        name: "transactions",
        kind: "message",
        repeat: 1,
        T: () => import_executed_transaction.ExecutedTransaction
      },
      { no: 7, name: "objects", kind: "message", T: () => import_object.ObjectSet }
    ]);
  }
}
const Checkpoint = new Checkpoint$Type();
//# sourceMappingURL=checkpoint.js.map
