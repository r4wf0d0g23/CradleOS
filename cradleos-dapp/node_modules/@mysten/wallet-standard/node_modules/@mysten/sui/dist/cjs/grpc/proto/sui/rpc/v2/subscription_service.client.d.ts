import type { RpcTransport } from '@protobuf-ts/runtime-rpc';
import type { ServiceInfo } from '@protobuf-ts/runtime-rpc';
import type { SubscribeCheckpointsResponse } from './subscription_service.js';
import type { SubscribeCheckpointsRequest } from './subscription_service.js';
import type { ServerStreamingCall } from '@protobuf-ts/runtime-rpc';
import type { RpcOptions } from '@protobuf-ts/runtime-rpc';
/**
 * @generated from protobuf service sui.rpc.v2.SubscriptionService
 */
export interface ISubscriptionServiceClient {
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
    subscribeCheckpoints(input: SubscribeCheckpointsRequest, options?: RpcOptions): ServerStreamingCall<SubscribeCheckpointsRequest, SubscribeCheckpointsResponse>;
}
/**
 * @generated from protobuf service sui.rpc.v2.SubscriptionService
 */
export declare class SubscriptionServiceClient implements ISubscriptionServiceClient, ServiceInfo {
    private readonly _transport;
    typeName: string;
    methods: import("@protobuf-ts/runtime-rpc").MethodInfo<any, any>[];
    options: {
        [extensionName: string]: import("@protobuf-ts/runtime").JsonValue;
    };
    constructor(_transport: RpcTransport);
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
    subscribeCheckpoints(input: SubscribeCheckpointsRequest, options?: RpcOptions): ServerStreamingCall<SubscribeCheckpointsRequest, SubscribeCheckpointsResponse>;
}
