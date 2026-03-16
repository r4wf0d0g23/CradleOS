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
var move_package_service_client_exports = {};
__export(move_package_service_client_exports, {
  MovePackageServiceClient: () => MovePackageServiceClient
});
module.exports = __toCommonJS(move_package_service_client_exports);
var import_move_package_service = require("./move_package_service.js");
var import_runtime_rpc = require("@protobuf-ts/runtime-rpc");
class MovePackageServiceClient {
  constructor(_transport) {
    this._transport = _transport;
    this.typeName = import_move_package_service.MovePackageService.typeName;
    this.methods = import_move_package_service.MovePackageService.methods;
    this.options = import_move_package_service.MovePackageService.options;
  }
  /**
   * @generated from protobuf rpc: GetPackage(sui.rpc.v2.GetPackageRequest) returns (sui.rpc.v2.GetPackageResponse);
   */
  getPackage(input, options) {
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
   * @generated from protobuf rpc: GetDatatype(sui.rpc.v2.GetDatatypeRequest) returns (sui.rpc.v2.GetDatatypeResponse);
   */
  getDatatype(input, options) {
    const method = this.methods[1], opt = this._transport.mergeOptions(options);
    return (0, import_runtime_rpc.stackIntercept)(
      "unary",
      this._transport,
      method,
      opt,
      input
    );
  }
  /**
   * @generated from protobuf rpc: GetFunction(sui.rpc.v2.GetFunctionRequest) returns (sui.rpc.v2.GetFunctionResponse);
   */
  getFunction(input, options) {
    const method = this.methods[2], opt = this._transport.mergeOptions(options);
    return (0, import_runtime_rpc.stackIntercept)(
      "unary",
      this._transport,
      method,
      opt,
      input
    );
  }
  /**
   * @generated from protobuf rpc: ListPackageVersions(sui.rpc.v2.ListPackageVersionsRequest) returns (sui.rpc.v2.ListPackageVersionsResponse);
   */
  listPackageVersions(input, options) {
    const method = this.methods[3], opt = this._transport.mergeOptions(options);
    return (0, import_runtime_rpc.stackIntercept)(
      "unary",
      this._transport,
      method,
      opt,
      input
    );
  }
}
//# sourceMappingURL=move_package_service.client.js.map
