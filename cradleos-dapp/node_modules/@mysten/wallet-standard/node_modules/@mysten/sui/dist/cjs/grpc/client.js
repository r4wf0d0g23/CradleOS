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
var client_exports = {};
__export(client_exports, {
  SuiGrpcClient: () => SuiGrpcClient
});
module.exports = __toCommonJS(client_exports);
var import_grpcweb_transport = require("@protobuf-ts/grpcweb-transport");
var import_transaction_execution_service_client = require("./proto/sui/rpc/v2/transaction_execution_service.client.js");
var import_ledger_service_client = require("./proto/sui/rpc/v2/ledger_service.client.js");
var import_move_package_service_client = require("./proto/sui/rpc/v2/move_package_service.client.js");
var import_signature_verification_service_client = require("./proto/sui/rpc/v2/signature_verification_service.client.js");
var import_state_service_client = require("./proto/sui/rpc/v2/state_service.client.js");
var import_subscription_service_client = require("./proto/sui/rpc/v2/subscription_service.client.js");
var import_core = require("./core.js");
var import_experimental = require("../experimental/index.js");
var import_name_service_client = require("./proto/sui/rpc/v2/name_service.client.js");
class SuiGrpcClient extends import_experimental.Experimental_BaseClient {
  constructor(options) {
    super({ network: options.network });
    const transport = options.transport ?? new import_grpcweb_transport.GrpcWebFetchTransport({ baseUrl: options.baseUrl, fetchInit: options.fetchInit });
    this.transactionExecutionService = new import_transaction_execution_service_client.TransactionExecutionServiceClient(transport);
    this.ledgerService = new import_ledger_service_client.LedgerServiceClient(transport);
    this.stateService = new import_state_service_client.StateServiceClient(transport);
    this.subscriptionService = new import_subscription_service_client.SubscriptionServiceClient(transport);
    this.movePackageService = new import_move_package_service_client.MovePackageServiceClient(transport);
    this.signatureVerificationService = new import_signature_verification_service_client.SignatureVerificationServiceClient(transport);
    this.nameService = new import_name_service_client.NameServiceClient(transport);
    this.core = new import_core.GrpcCoreClient({
      client: this,
      base: this,
      network: options.network,
      mvr: options.mvr
    });
  }
}
//# sourceMappingURL=client.js.map
