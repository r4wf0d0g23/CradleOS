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
var name_service_client_exports = {};
__export(name_service_client_exports, {
  NameServiceClient: () => NameServiceClient
});
module.exports = __toCommonJS(name_service_client_exports);
var import_name_service = require("./name_service.js");
var import_runtime_rpc = require("@protobuf-ts/runtime-rpc");
class NameServiceClient {
  constructor(_transport) {
    this._transport = _transport;
    this.typeName = import_name_service.NameService.typeName;
    this.methods = import_name_service.NameService.methods;
    this.options = import_name_service.NameService.options;
  }
  /**
   * @generated from protobuf rpc: LookupName(sui.rpc.v2.LookupNameRequest) returns (sui.rpc.v2.LookupNameResponse);
   */
  lookupName(input, options) {
    const method = this.methods[0], opt = this._transport.mergeOptions(options);
    return (0, import_runtime_rpc.stackIntercept)(
      "unary",
      this._transport,
      method,
      opt,
      input
    );
  }
  /**
   * @generated from protobuf rpc: ReverseLookupName(sui.rpc.v2.ReverseLookupNameRequest) returns (sui.rpc.v2.ReverseLookupNameResponse);
   */
  reverseLookupName(input, options) {
    const method = this.methods[1], opt = this._transport.mergeOptions(options);
    return (0, import_runtime_rpc.stackIntercept)(
      "unary",
      this._transport,
      method,
      opt,
      input
    );
  }
}
//# sourceMappingURL=name_service.client.js.map
