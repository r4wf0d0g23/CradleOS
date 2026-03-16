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
var executed_transaction_exports = {};
__export(executed_transaction_exports, {
  ExecutedTransaction: () => ExecutedTransaction
});
module.exports = __toCommonJS(executed_transaction_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_object = require("./object.js");
var import_balance_change = require("./balance_change.js");
var import_timestamp = require("../../../google/protobuf/timestamp.js");
var import_event = require("./event.js");
var import_effects = require("./effects.js");
var import_signature = require("./signature.js");
var import_transaction = require("./transaction.js");
class ExecutedTransaction$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ExecutedTransaction", [
      {
        no: 1,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 2, name: "transaction", kind: "message", T: () => import_transaction.Transaction },
      {
        no: 3,
        name: "signatures",
        kind: "message",
        repeat: 1,
        T: () => import_signature.UserSignature
      },
      { no: 4, name: "effects", kind: "message", T: () => import_effects.TransactionEffects },
      { no: 5, name: "events", kind: "message", T: () => import_event.TransactionEvents },
      {
        no: 6,
        name: "checkpoint",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 7, name: "timestamp", kind: "message", T: () => import_timestamp.Timestamp },
      {
        no: 8,
        name: "balance_changes",
        kind: "message",
        repeat: 1,
        T: () => import_balance_change.BalanceChange
      },
      { no: 9, name: "objects", kind: "message", T: () => import_object.ObjectSet }
    ]);
  }
}
const ExecutedTransaction = new ExecutedTransaction$Type();
//# sourceMappingURL=executed_transaction.js.map
