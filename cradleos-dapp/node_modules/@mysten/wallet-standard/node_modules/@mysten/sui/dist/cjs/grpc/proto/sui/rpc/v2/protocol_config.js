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
var protocol_config_exports = {};
__export(protocol_config_exports, {
  ProtocolConfig: () => ProtocolConfig
});
module.exports = __toCommonJS(protocol_config_exports);
var import_runtime = require("@protobuf-ts/runtime");
class ProtocolConfig$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ProtocolConfig", [
      {
        no: 1,
        name: "protocol_version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 2,
        name: "feature_flags",
        kind: "map",
        K: 9,
        V: {
          kind: "scalar",
          T: 8
          /*ScalarType.BOOL*/
        }
      },
      {
        no: 3,
        name: "attributes",
        kind: "map",
        K: 9,
        V: {
          kind: "scalar",
          T: 9
          /*ScalarType.STRING*/
        }
      }
    ]);
  }
}
const ProtocolConfig = new ProtocolConfig$Type();
//# sourceMappingURL=protocol_config.js.map
