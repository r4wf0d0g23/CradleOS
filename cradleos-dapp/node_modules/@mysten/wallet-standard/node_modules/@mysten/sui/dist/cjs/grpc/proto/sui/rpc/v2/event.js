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
var event_exports = {};
__export(event_exports, {
  Event: () => Event,
  TransactionEvents: () => TransactionEvents
});
module.exports = __toCommonJS(event_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_struct = require("../../../google/protobuf/struct.js");
var import_bcs = require("./bcs.js");
class TransactionEvents$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.TransactionEvents", [
      { no: 1, name: "bcs", kind: "message", T: () => import_bcs.Bcs },
      {
        no: 2,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 3, name: "events", kind: "message", repeat: 1, T: () => Event }
    ]);
  }
}
const TransactionEvents = new TransactionEvents$Type();
class Event$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.Event", [
      {
        no: 1,
        name: "package_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "module",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "sender",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "event_type",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 5, name: "contents", kind: "message", T: () => import_bcs.Bcs },
      { no: 6, name: "json", kind: "message", T: () => import_struct.Value }
    ]);
  }
}
const Event = new Event$Type();
//# sourceMappingURL=event.js.map
