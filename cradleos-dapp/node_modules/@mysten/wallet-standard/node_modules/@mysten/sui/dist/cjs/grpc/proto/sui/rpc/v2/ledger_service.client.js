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
var ledger_service_client_exports = {};
__export(ledger_service_client_exports, {
  LedgerServiceClient: () => LedgerServiceClient
});
module.exports = __toCommonJS(ledger_service_client_exports);
var import_ledger_service = require("./ledger_service.js");
var import_runtime_rpc = require("@protobuf-ts/runtime-rpc");
class LedgerServiceClient {
  constructor(_transport) {
    this._transport = _transport;
    this.typeName = import_ledger_service.LedgerService.typeName;
    this.methods = import_ledger_service.LedgerService.methods;
    this.options = import_ledger_service.LedgerService.options;
  }
  /**
   * Query the service for general information about its current state.
   *
   * @generated from protobuf rpc: GetServiceInfo(sui.rpc.v2.GetServiceInfoRequest) returns (sui.rpc.v2.GetServiceInfoResponse);
   */
  getServiceInfo(input, options) {
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
   * @generated from protobuf rpc: GetObject(sui.rpc.v2.GetObjectRequest) returns (sui.rpc.v2.GetObjectResponse);
   */
  getObject(input, options) {
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
   * @generated from protobuf rpc: BatchGetObjects(sui.rpc.v2.BatchGetObjectsRequest) returns (sui.rpc.v2.BatchGetObjectsResponse);
   */
  batchGetObjects(input, options) {
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
   * @generated from protobuf rpc: GetTransaction(sui.rpc.v2.GetTransactionRequest) returns (sui.rpc.v2.GetTransactionResponse);
   */
  getTransaction(input, options) {
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
   * @generated from protobuf rpc: BatchGetTransactions(sui.rpc.v2.BatchGetTransactionsRequest) returns (sui.rpc.v2.BatchGetTransactionsResponse);
   */
  batchGetTransactions(input, options) {
    const method = this.methods[4], opt = this._transport.mergeOptions(options);
    return (0, import_runtime_rpc.stackIntercept)(
      "unary",
      this._transport,
      method,
      opt,
      input
    );
  }
  /**
   * @generated from protobuf rpc: GetCheckpoint(sui.rpc.v2.GetCheckpointRequest) returns (sui.rpc.v2.GetCheckpointResponse);
   */
  getCheckpoint(input, options) {
    const method = this.methods[5], opt = this._transport.mergeOptions(options);
    return (0, import_runtime_rpc.stackIntercept)(
      "unary",
      this._transport,
      method,
      opt,
      input
    );
  }
  /**
   * @generated from protobuf rpc: GetEpoch(sui.rpc.v2.GetEpochRequest) returns (sui.rpc.v2.GetEpochResponse);
   */
  getEpoch(input, options) {
    const method = this.methods[6], opt = this._transport.mergeOptions(options);
    return (0, import_runtime_rpc.stackIntercept)(
      "unary",
      this._transport,
      method,
      opt,
      input
    );
  }
}
//# sourceMappingURL=ledger_service.client.js.map
