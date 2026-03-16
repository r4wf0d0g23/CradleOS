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
var epoch_exports = {};
__export(epoch_exports, {
  Epoch: () => Epoch
});
module.exports = __toCommonJS(epoch_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_protocol_config = require("./protocol_config.js");
var import_timestamp = require("../../../google/protobuf/timestamp.js");
var import_system_state = require("./system_state.js");
var import_signature = require("./signature.js");
class Epoch$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.Epoch", [
      {
        no: 1,
        name: "epoch",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 2, name: "committee", kind: "message", T: () => import_signature.ValidatorCommittee },
      { no: 3, name: "system_state", kind: "message", T: () => import_system_state.SystemState },
      {
        no: 4,
        name: "first_checkpoint",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 5,
        name: "last_checkpoint",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 6, name: "start", kind: "message", T: () => import_timestamp.Timestamp },
      { no: 7, name: "end", kind: "message", T: () => import_timestamp.Timestamp },
      {
        no: 8,
        name: "reference_gas_price",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 9, name: "protocol_config", kind: "message", T: () => import_protocol_config.ProtocolConfig }
    ]);
  }
}
const Epoch = new Epoch$Type();
//# sourceMappingURL=epoch.js.map
