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
var input_exports = {};
__export(input_exports, {
  Input: () => Input,
  Input_InputKind: () => Input_InputKind
});
module.exports = __toCommonJS(input_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_struct = require("../../../google/protobuf/struct.js");
var Input_InputKind = /* @__PURE__ */ ((Input_InputKind2) => {
  Input_InputKind2[Input_InputKind2["INPUT_KIND_UNKNOWN"] = 0] = "INPUT_KIND_UNKNOWN";
  Input_InputKind2[Input_InputKind2["PURE"] = 1] = "PURE";
  Input_InputKind2[Input_InputKind2["IMMUTABLE_OR_OWNED"] = 2] = "IMMUTABLE_OR_OWNED";
  Input_InputKind2[Input_InputKind2["SHARED"] = 3] = "SHARED";
  Input_InputKind2[Input_InputKind2["RECEIVING"] = 4] = "RECEIVING";
  return Input_InputKind2;
})(Input_InputKind || {});
class Input$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.Input", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.Input.InputKind", Input_InputKind]
      },
      {
        no: 2,
        name: "pure",
        kind: "scalar",
        opt: true,
        T: 12
        /*ScalarType.BYTES*/
      },
      {
        no: 3,
        name: "object_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 4,
        name: "version",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      {
        no: 5,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 6,
        name: "mutable",
        kind: "scalar",
        opt: true,
        T: 8
        /*ScalarType.BOOL*/
      },
      { no: 1e3, name: "literal", kind: "message", T: () => import_struct.Value }
    ]);
  }
}
const Input = new Input$Type();
//# sourceMappingURL=input.js.map
