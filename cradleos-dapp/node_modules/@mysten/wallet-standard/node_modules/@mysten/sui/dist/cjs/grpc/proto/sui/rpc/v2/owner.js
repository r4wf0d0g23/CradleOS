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
var owner_exports = {};
__export(owner_exports, {
  Owner: () => Owner,
  Owner_OwnerKind: () => Owner_OwnerKind
});
module.exports = __toCommonJS(owner_exports);
var import_runtime = require("@protobuf-ts/runtime");
var Owner_OwnerKind = /* @__PURE__ */ ((Owner_OwnerKind2) => {
  Owner_OwnerKind2[Owner_OwnerKind2["OWNER_KIND_UNKNOWN"] = 0] = "OWNER_KIND_UNKNOWN";
  Owner_OwnerKind2[Owner_OwnerKind2["ADDRESS"] = 1] = "ADDRESS";
  Owner_OwnerKind2[Owner_OwnerKind2["OBJECT"] = 2] = "OBJECT";
  Owner_OwnerKind2[Owner_OwnerKind2["SHARED"] = 3] = "SHARED";
  Owner_OwnerKind2[Owner_OwnerKind2["IMMUTABLE"] = 4] = "IMMUTABLE";
  Owner_OwnerKind2[Owner_OwnerKind2["CONSENSUS_ADDRESS"] = 5] = "CONSENSUS_ADDRESS";
  return Owner_OwnerKind2;
})(Owner_OwnerKind || {});
class Owner$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.Owner", [
      {
        no: 1,
        name: "kind",
        kind: "enum",
        opt: true,
        T: () => ["sui.rpc.v2.Owner.OwnerKind", Owner_OwnerKind]
      },
      {
        no: 2,
        name: "address",
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
      }
    ]);
  }
}
const Owner = new Owner$Type();
//# sourceMappingURL=owner.js.map
