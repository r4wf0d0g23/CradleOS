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
var object_exports = {};
__export(object_exports, {
  Object: () => Object2,
  ObjectSet: () => ObjectSet
});
module.exports = __toCommonJS(object_exports);
var import_runtime = require("@protobuf-ts/runtime");
var import_struct = require("../../../google/protobuf/struct.js");
var import_move_package = require("./move_package.js");
var import_owner = require("./owner.js");
var import_bcs = require("./bcs.js");
class Object$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.Object", [
      { no: 1, name: "bcs", kind: "message", T: () => import_bcs.Bcs },
      {
        no: 2,
        name: "object_id",
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
        T: 4,
        L: 0
      },
      {
        no: 4,
        name: "digest",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 5, name: "owner", kind: "message", T: () => import_owner.Owner },
      {
        no: 6,
        name: "object_type",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 7,
        name: "has_public_transfer",
        kind: "scalar",
        opt: true,
        T: 8
        /*ScalarType.BOOL*/
      },
      { no: 8, name: "contents", kind: "message", T: () => import_bcs.Bcs },
      { no: 9, name: "package", kind: "message", T: () => import_move_package.Package },
      {
        no: 10,
        name: "previous_transaction",
        kind: "scalar",
        opt: true,
        T: 9
      },
      {
        no: 11,
        name: "storage_rebate",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 100, name: "json", kind: "message", T: () => import_struct.Value },
      {
        no: 101,
        name: "balance",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      }
    ]);
  }
}
const Object2 = new Object$Type();
class ObjectSet$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ObjectSet", [
      { no: 1, name: "objects", kind: "message", repeat: 1, T: () => Object2 }
    ]);
  }
}
const ObjectSet = new ObjectSet$Type();
//# sourceMappingURL=object.js.map
