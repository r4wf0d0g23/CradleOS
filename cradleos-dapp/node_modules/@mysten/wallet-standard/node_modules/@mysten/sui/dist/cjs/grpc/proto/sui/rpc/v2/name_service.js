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
var name_service_exports = {};
__export(name_service_exports, {
  LookupNameRequest: () => LookupNameRequest,
  LookupNameResponse: () => LookupNameResponse,
  NameRecord: () => NameRecord,
  NameService: () => NameService,
  ReverseLookupNameRequest: () => ReverseLookupNameRequest,
  ReverseLookupNameResponse: () => ReverseLookupNameResponse
});
module.exports = __toCommonJS(name_service_exports);
var import_runtime_rpc = require("@protobuf-ts/runtime-rpc");
var import_runtime = require("@protobuf-ts/runtime");
var import_timestamp = require("../../../google/protobuf/timestamp.js");
class LookupNameRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.LookupNameRequest", [
      {
        no: 1,
        name: "name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const LookupNameRequest = new LookupNameRequest$Type();
class LookupNameResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.LookupNameResponse", [
      { no: 1, name: "record", kind: "message", T: () => NameRecord }
    ]);
  }
}
const LookupNameResponse = new LookupNameResponse$Type();
class ReverseLookupNameRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ReverseLookupNameRequest", [
      {
        no: 1,
        name: "address",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      }
    ]);
  }
}
const ReverseLookupNameRequest = new ReverseLookupNameRequest$Type();
class ReverseLookupNameResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.ReverseLookupNameResponse", [
      { no: 1, name: "record", kind: "message", T: () => NameRecord }
    ]);
  }
}
const ReverseLookupNameResponse = new ReverseLookupNameResponse$Type();
class NameRecord$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.NameRecord", [
      {
        no: 1,
        name: "id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 2,
        name: "name",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 3,
        name: "registration_nft_id",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      { no: 4, name: "expiration_timestamp", kind: "message", T: () => import_timestamp.Timestamp },
      {
        no: 5,
        name: "target_address",
        kind: "scalar",
        opt: true,
        T: 9
        /*ScalarType.STRING*/
      },
      {
        no: 6,
        name: "data",
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
const NameRecord = new NameRecord$Type();
const NameService = new import_runtime_rpc.ServiceType("sui.rpc.v2.NameService", [
  { name: "LookupName", options: {}, I: LookupNameRequest, O: LookupNameResponse },
  {
    name: "ReverseLookupName",
    options: {},
    I: ReverseLookupNameRequest,
    O: ReverseLookupNameResponse
  }
]);
//# sourceMappingURL=name_service.js.map
