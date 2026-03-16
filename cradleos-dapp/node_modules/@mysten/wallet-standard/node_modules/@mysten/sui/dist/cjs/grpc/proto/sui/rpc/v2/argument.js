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
var argument_exports = {};
__export(argument_exports, {
  Argument: () => Argument,
  Argument_ArgumentKind: () => Argument_ArgumentKind
});
module.exports = __toCommonJS(argument_exports);
var import_runtime = require("@protobuf-ts/runtime");
var Argument_ArgumentKind = /* @__PURE__ */ ((Argument_ArgumentKind2) => {
  Argument_ArgumentKind2[Argument_ArgumentKind2["ARGUMENT_KIND_UNKNOWN"] = 0] = "ARGUMENT_KIND_UNKNOWN";
  Argument_ArgumentKind2[Argument_ArgumentKind2["GAS"] = 1] = "GAS";
  Argument_ArgumentKind2[Argument_ArgumentKind2["INPUT"] = 2] = "INPUT";
  Argument_ArgumentKind2[Argument_ArgumentKind2["RESULT"] = 3] = "RESULT";
  return Argument_ArgumentKind2;
})(Argument_ArgumentKind || {});
class Argument$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.Argument", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.Argument.ArgumentKind", Argument_ArgumentKind]
      },
      {
        no: 2,
        name: "input",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 3,
        name: "result",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      },
      {
        no: 4,
        name: "subresult",
        kind: "scalar",
        opt: true,
        T: 13
        /*ScalarType.UINT32*/
      }
    ]);
  }
}
const Argument = new Argument$Type();
//# sourceMappingURL=argument.js.map
