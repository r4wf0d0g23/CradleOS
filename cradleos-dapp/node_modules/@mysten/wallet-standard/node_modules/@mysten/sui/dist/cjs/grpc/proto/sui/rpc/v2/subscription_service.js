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
var subscription_service_exports = {};
__export(subscription_service_exports, {
  SubscribeCheckpointsRequest: () => SubscribeCheckpointsRequest,
  SubscribeCheckpointsResponse: () => SubscribeCheckpointsResponse,
  SubscriptionService: () => SubscriptionService
});
module.exports = __toCommonJS(subscription_service_exports);
var import_runtime_rpc = require("@protobuf-ts/runtime-rpc");
var import_runtime = require("@protobuf-ts/runtime");
var import_checkpoint = require("./checkpoint.js");
var import_field_mask = require("../../../google/protobuf/field_mask.js");
class SubscribeCheckpointsRequest$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.SubscribeCheckpointsRequest", [
      { no: 1, name: "read_mask", kind: "message", T: () => import_field_mask.FieldMask }
    ]);
  }
}
const SubscribeCheckpointsRequest = new SubscribeCheckpointsRequest$Type();
class SubscribeCheckpointsResponse$Type extends import_runtime.MessageType {
  constructor() {
    super("sui.rpc.v2.SubscribeCheckpointsResponse", [
      {
        no: 1,
        name: "cursor",
        kind: "scalar",
        opt: true,
        T: 4,
        L: 0
      },
      { no: 2, name: "checkpoint", kind: "message", T: () => import_checkpoint.Checkpoint }
    ]);
  }
}
const SubscribeCheckpointsResponse = new SubscribeCheckpointsResponse$Type();
const SubscriptionService = new import_runtime_rpc.ServiceType("sui.rpc.v2.SubscriptionService", [
  {
    name: "SubscribeCheckpoints",
    serverStreaming: true,
    options: {},
    I: SubscribeCheckpointsRequest,
    O: SubscribeCheckpointsResponse
  }
]);
//# sourceMappingURL=subscription_service.js.map
