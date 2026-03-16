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
var transaction_execution_service_client_exports = {};
__export(transaction_execution_service_client_exports, {
  TransactionExecutionServiceClient: () => TransactionExecutionServiceClient
});
module.exports = __toCommonJS(transaction_execution_service_client_exports);
var import_transaction_execution_service = require("./transaction_execution_service.js");
var import_runtime_rpc = require("@protobuf-ts/runtime-rpc");
class TransactionExecutionServiceClient {
  constructor(_transport) {
    this._transport = _transport;
    this.typeName = import_transaction_execution_service.TransactionExecutionService.typeName;
    this.methods = import_transaction_execution_service.TransactionExecutionService.methods;
    this.options = import_transaction_execution_service.TransactionExecutionService.options;
  }
  /**
   * @generated from protobuf rpc: ExecuteTransaction(sui.rpc.v2.ExecuteTransactionRequest) returns (sui.rpc.v2.ExecuteTransactionResponse);
   */
  executeTransaction(input, options) {
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
   * @generated from protobuf rpc: SimulateTransaction(sui.rpc.v2.SimulateTransactionRequest) returns (sui.rpc.v2.SimulateTransactionResponse);
   */
  simulateTransaction(input, options) {
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
//# sourceMappingURL=transaction_execution_service.client.js.map
