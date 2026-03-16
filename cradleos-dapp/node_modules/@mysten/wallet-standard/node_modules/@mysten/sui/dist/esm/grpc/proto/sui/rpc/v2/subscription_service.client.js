import { SubscriptionService } from "./subscription_service.js";
import { stackIntercept } from "@protobuf-ts/runtime-rpc";
class SubscriptionServiceClient {
  constructor(_transport) {
    this._transport = _transport;
    this.typeName = SubscriptionService.typeName;
    this.methods = SubscriptionService.methods;
    this.options = SubscriptionService.options;
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
    return stackIntercept(
      "serverStreaming",
      this._transport,
      method,
      opt,
      input
    );
  }
}
export {
  SubscriptionServiceClient
};
//# sourceMappingURL=subscription_service.client.js.map
