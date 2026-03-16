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
var subscription_service_client_exports = {};
__export(subscription_service_client_exports, {
  SubscriptionServiceClient: () => SubscriptionServiceClient
});
module.exports = __toCommonJS(subscription_service_client_exports);
var import_subscription_service = require("./subscription_service.js");
var import_runtime_rpc = require("@protobuf-ts/runtime-rpc");
class SubscriptionServiceClient {
  constructor(_transport) {
    this._transport = _transport;
    this.typeName = import_subscription_service.SubscriptionService.typeName;
    this.methods = import_subscription_service.SubscriptionService.methods;
    this.options = import_subscription_service.SubscriptionService.options;
  }
  /**
   * Subscribe to the stream of checkpoints.
   *
   * This API provides a subscription to the checkpoint stream for the Sui
   * blockchain. When a subscription is initialized the stream will begin with
   * the latest executed checkpoint as seen by the server. Responses are
   * guaranteed to return checkpoints in-order and without gaps. This enables
   * clients to know exactly the last checkpoint they have processed and in the
   * event the subscription terminates (either by the client/server or by the
   * connection breaking), clients will be able to reinitialize a subscription
   * and then leverage other APIs in order to request data for the checkpoints
   * they missed.
   *
   * @generated from protobuf rpc: SubscribeCheckpoints(sui.rpc.v2.SubscribeCheckpointsRequest) returns (stream sui.rpc.v2.SubscribeCheckpointsResponse);
   */
  subscribeCheckpoints(input, options) {
    const method = this.methods[0], opt = this._transport.mergeOptions(options);
    return (0, import_runtime_rpc.stackIntercept)(
      "serverStreaming",
      this._transport,
      method,
      opt,
      input
    );
  }
}
//# sourceMappingURL=subscription_service.client.js.map
