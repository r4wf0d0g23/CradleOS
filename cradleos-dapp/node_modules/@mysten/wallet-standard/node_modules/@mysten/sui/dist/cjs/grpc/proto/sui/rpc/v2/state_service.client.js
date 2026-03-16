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
var state_service_client_exports = {};
__export(state_service_client_exports, {
  StateServiceClient: () => StateServiceClient
});
module.exports = __toCommonJS(state_service_client_exports);
var import_state_service = require("./state_service.js");
var import_runtime_rpc = require("@protobuf-ts/runtime-rpc");
class StateServiceClient {
  constructor(_transport) {
    this._transport = _transport;
    this.typeName = import_state_service.StateService.typeName;
    this.methods = import_state_service.StateService.methods;
    this.options = import_state_service.StateService.options;
  }
  /**
   * @generated from protobuf rpc: ListDynamicFields(sui.rpc.v2.ListDynamicFieldsRequest) returns (sui.rpc.v2.ListDynamicFieldsResponse);
   */
  listDynamicFields(input, options) {
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
   * @generated from protobuf rpc: ListOwnedObjects(sui.rpc.v2.ListOwnedObjectsRequest) returns (sui.rpc.v2.ListOwnedObjectsResponse);
   */
  listOwnedObjects(input, options) {
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
   * @generated from protobuf rpc: GetCoinInfo(sui.rpc.v2.GetCoinInfoRequest) returns (sui.rpc.v2.GetCoinInfoResponse);
   */
  getCoinInfo(input, options) {
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
   * @generated from protobuf rpc: GetBalance(sui.rpc.v2.GetBalanceRequest) returns (sui.rpc.v2.GetBalanceResponse);
   */
  getBalance(input, options) {
    const method = this.methods[3], opt = this._transport.mergeOptions(options);
    return (0, import_runtime_rpc.stackIntercept)(
      "unary",
      this._transport,
      method,
      opt,
      input
    );
  }
  /**
   * @generated from protobuf rpc: ListBalances(sui.rpc.v2.ListBalancesRequest) returns (sui.rpc.v2.ListBalancesResponse);
   */
  listBalances(input, options) {
    const method = this.methods[4], opt = this._transport.mergeOptions(options);
    return (0, import_runtime_rpc.stackIntercept)(
      "unary",
      this._transport,
      method,
      opt,
      input
    );
  }
}
//# sourceMappingURL=state_service.client.js.map
