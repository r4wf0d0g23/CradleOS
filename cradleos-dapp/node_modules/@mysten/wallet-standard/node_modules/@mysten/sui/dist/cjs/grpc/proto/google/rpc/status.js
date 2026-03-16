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
var status_exports = {};
__export(status_exports, {
  Status: () => Status
});
module.exports = __toCommonJS(status_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_any = require("../protobuf/any.js");
class Status$Type extends import_runtime.MessageType {
  constructor() {
    super("google.rpc.Status", [
      {
        no: 1,
        name: "code",
        kind: "scalar",
        T: 5
        /*ScalarType.INT32*/
      },
      {
        no: 2,
        name: "message",
        kind: "scalar",
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 3, name: "details", kind: "message", repeat: 1, T: () => import_any.Any }
    ]);
  }
}
const Status = new Status$Type();
//# sourceMappingURL=status.js.map
