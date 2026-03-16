import type { RpcTransport } from '@protobuf-ts/runtime-rpc';
import type { ServiceInfo } from '@protobuf-ts/runtime-rpc';
import type { ListBalancesResponse } from './state_service.js';
import type { ListBalancesRequest } from './state_service.js';
import type { GetBalanceResponse } from './state_service.js';
import type { GetBalanceRequest } from './state_service.js';
import type { GetCoinInfoResponse } from './state_service.js';
import type { GetCoinInfoRequest } from './state_service.js';
import type { ListOwnedObjectsResponse } from './state_service.js';
import type { ListOwnedObjectsRequest } from './state_service.js';
import type { ListDynamicFieldsResponse } from './state_service.js';
import type { ListDynamicFieldsRequest } from './state_service.js';
import type { UnaryCall } from '@protobuf-ts/runtime-rpc';
import type { RpcOptions } from '@protobuf-ts/runtime-rpc';
/**
 * @generated from protobuf service sui.rpc.v2.StateService
 */
export interface IStateServiceClient {
    /**
     * @generated from protobuf rpc: ListDynamicFields(sui.rpc.v2.ListDynamicFieldsRequest) returns (sui.rpc.v2.ListDynamicFieldsResponse);
     */
    listDynamicFields(input: ListDynamicFieldsRequest, options?: RpcOptions): UnaryCall<ListDynamicFieldsRequest, ListDynamicFieldsResponse>;
    /**
     * @generated from protobuf rpc: ListOwnedObjects(sui.rpc.v2.ListOwnedObjectsRequest) returns (sui.rpc.v2.ListOwnedObjectsResponse);
     */
    listOwnedObjects(input: ListOwnedObjectsRequest, options?: RpcOptions): UnaryCall<ListOwnedObjectsRequest, ListOwnedObjectsResponse>;
    /**
     * @generated from protobuf rpc: GetCoinInfo(sui.rpc.v2.GetCoinInfoRequest) returns (sui.rpc.v2.GetCoinInfoResponse);
     */
    getCoinInfo(input: GetCoinInfoRequest, options?: RpcOptions): UnaryCall<GetCoinInfoRequest, GetCoinInfoResponse>;
    /**
     * @generated from protobuf rpc: GetBalance(sui.rpc.v2.GetBalanceRequest) returns (sui.rpc.v2.GetBalanceResponse);
     */
    getBalance(input: GetBalanceRequest, options?: RpcOptions): UnaryCall<GetBalanceRequest, GetBalanceResponse>;
    /**
     * @generated from protobuf rpc: ListBalances(sui.rpc.v2.ListBalancesRequest) returns (sui.rpc.v2.ListBalancesResponse);
     */
    listBalances(input: ListBalancesRequest, options?: RpcOptions): UnaryCall<ListBalancesRequest, ListBalancesResponse>;
}
/**
 * @generated from protobuf service sui.rpc.v2.StateService
 */
export declare class StateServiceClient implements IStateServiceClient, ServiceInfo {
    private readonly _transport;
    typeName: string;
    methods: import("@protobuf-ts/runtime-rpc").MethodInfo<any, any>[];
    options: {
        [extensionName: string]: import("@protobuf-ts/runtime").JsonValue;
    };
    constructor(_transport: RpcTransport);
    /**
     * @generated from protobuf rpc: ListDynamicFields(sui.rpc.v2.ListDynamicFieldsRequest) returns (sui.rpc.v2.ListDynamicFieldsResponse);
     */
    listDynamicFields(input: ListDynamicFieldsRequest, options?: RpcOptions): UnaryCall<ListDynamicFieldsRequest, ListDynamicFieldsResponse>;
    /**
     * @generated from protobuf rpc: ListOwnedObjects(sui.rpc.v2.ListOwnedObjectsRequest) returns (sui.rpc.v2.ListOwnedObjectsResponse);
     */
    listOwnedObjects(input: ListOwnedObjectsRequest, options?: RpcOptions): UnaryCall<ListOwnedObjectsRequest, ListOwnedObjectsResponse>;
    /**
     * @generated from protobuf rpc: GetCoinInfo(sui.rpc.v2.GetCoinInfoRequest) returns (sui.rpc.v2.GetCoinInfoResponse);
     */
    getCoinInfo(input: GetCoinInfoRequest, options?: RpcOptions): UnaryCall<GetCoinInfoRequest, GetCoinInfoResponse>;
    /**
     * @generated from protobuf rpc: GetBalance(sui.rpc.v2.GetBalanceRequest) returns (sui.rpc.v2.GetBalanceResponse);
     */
    getBalance(input: GetBalanceRequest, options?: RpcOptions): UnaryCall<GetBalanceRequest, GetBalanceResponse>;
    /**
     * @generated from protobuf rpc: ListBalances(sui.rpc.v2.ListBalancesRequest) returns (sui.rpc.v2.ListBalancesResponse);
     */
    listBalances(input: ListBalancesRequest, options?: RpcOptions): UnaryCall<ListBalancesRequest, ListBalancesResponse>;
}
