import type { RpcTransport } from '@protobuf-ts/runtime-rpc';
import type { ServiceInfo } from '@protobuf-ts/runtime-rpc';
import type { GetEpochResponse } from './ledger_service.js';
import type { GetEpochRequest } from './ledger_service.js';
import type { GetCheckpointResponse } from './ledger_service.js';
import type { GetCheckpointRequest } from './ledger_service.js';
import type { BatchGetTransactionsResponse } from './ledger_service.js';
import type { BatchGetTransactionsRequest } from './ledger_service.js';
import type { GetTransactionResponse } from './ledger_service.js';
import type { GetTransactionRequest } from './ledger_service.js';
import type { BatchGetObjectsResponse } from './ledger_service.js';
import type { BatchGetObjectsRequest } from './ledger_service.js';
import type { GetObjectResponse } from './ledger_service.js';
import type { GetObjectRequest } from './ledger_service.js';
import type { GetServiceInfoResponse } from './ledger_service.js';
import type { GetServiceInfoRequest } from './ledger_service.js';
import type { UnaryCall } from '@protobuf-ts/runtime-rpc';
import type { RpcOptions } from '@protobuf-ts/runtime-rpc';
/**
 * @generated from protobuf service sui.rpc.v2.LedgerService
 */
export interface ILedgerServiceClient {
    /**
     * Query the service for general information about its current state.
     *
     * @generated from protobuf rpc: GetServiceInfo(sui.rpc.v2.GetServiceInfoRequest) returns (sui.rpc.v2.GetServiceInfoResponse);
     */
    getServiceInfo(input: GetServiceInfoRequest, options?: RpcOptions): UnaryCall<GetServiceInfoRequest, GetServiceInfoResponse>;
    /**
     * @generated from protobuf rpc: GetObject(sui.rpc.v2.GetObjectRequest) returns (sui.rpc.v2.GetObjectResponse);
     */
    getObject(input: GetObjectRequest, options?: RpcOptions): UnaryCall<GetObjectRequest, GetObjectResponse>;
    /**
     * @generated from protobuf rpc: BatchGetObjects(sui.rpc.v2.BatchGetObjectsRequest) returns (sui.rpc.v2.BatchGetObjectsResponse);
     */
    batchGetObjects(input: BatchGetObjectsRequest, options?: RpcOptions): UnaryCall<BatchGetObjectsRequest, BatchGetObjectsResponse>;
    /**
     * @generated from protobuf rpc: GetTransaction(sui.rpc.v2.GetTransactionRequest) returns (sui.rpc.v2.GetTransactionResponse);
     */
    getTransaction(input: GetTransactionRequest, options?: RpcOptions): UnaryCall<GetTransactionRequest, GetTransactionResponse>;
    /**
     * @generated from protobuf rpc: BatchGetTransactions(sui.rpc.v2.BatchGetTransactionsRequest) returns (sui.rpc.v2.BatchGetTransactionsResponse);
     */
    batchGetTransactions(input: BatchGetTransactionsRequest, options?: RpcOptions): UnaryCall<BatchGetTransactionsRequest, BatchGetTransactionsResponse>;
    /**
     * @generated from protobuf rpc: GetCheckpoint(sui.rpc.v2.GetCheckpointRequest) returns (sui.rpc.v2.GetCheckpointResponse);
     */
    getCheckpoint(input: GetCheckpointRequest, options?: RpcOptions): UnaryCall<GetCheckpointRequest, GetCheckpointResponse>;
    /**
     * @generated from protobuf rpc: GetEpoch(sui.rpc.v2.GetEpochRequest) returns (sui.rpc.v2.GetEpochResponse);
     */
    getEpoch(input: GetEpochRequest, options?: RpcOptions): UnaryCall<GetEpochRequest, GetEpochResponse>;
}
/**
 * @generated from protobuf service sui.rpc.v2.LedgerService
 */
export declare class LedgerServiceClient implements ILedgerServiceClient, ServiceInfo {
    private readonly _transport;
    typeName: string;
    methods: import("@protobuf-ts/runtime-rpc").MethodInfo<any, any>[];
    options: {
        [extensionName: string]: import("@protobuf-ts/runtime").JsonValue;
    };
    constructor(_transport: RpcTransport);
    /**
     * Query the service for general information about its current state.
     *
     * @generated from protobuf rpc: GetServiceInfo(sui.rpc.v2.GetServiceInfoRequest) returns (sui.rpc.v2.GetServiceInfoResponse);
     */
    getServiceInfo(input: GetServiceInfoRequest, options?: RpcOptions): UnaryCall<GetServiceInfoRequest, GetServiceInfoResponse>;
    /**
     * @generated from protobuf rpc: GetObject(sui.rpc.v2.GetObjectRequest) returns (sui.rpc.v2.GetObjectResponse);
     */
    getObject(input: GetObjectRequest, options?: RpcOptions): UnaryCall<GetObjectRequest, GetObjectResponse>;
    /**
     * @generated from protobuf rpc: BatchGetObjects(sui.rpc.v2.BatchGetObjectsRequest) returns (sui.rpc.v2.BatchGetObjectsResponse);
     */
    batchGetObjects(input: BatchGetObjectsRequest, options?: RpcOptions): UnaryCall<BatchGetObjectsRequest, BatchGetObjectsResponse>;
    /**
     * @generated from protobuf rpc: GetTransaction(sui.rpc.v2.GetTransactionRequest) returns (sui.rpc.v2.GetTransactionResponse);
     */
    getTransaction(input: GetTransactionRequest, options?: RpcOptions): UnaryCall<GetTransactionRequest, GetTransactionResponse>;
    /**
     * @generated from protobuf rpc: BatchGetTransactions(sui.rpc.v2.BatchGetTransactionsRequest) returns (sui.rpc.v2.BatchGetTransactionsResponse);
     */
    batchGetTransactions(input: BatchGetTransactionsRequest, options?: RpcOptions): UnaryCall<BatchGetTransactionsRequest, BatchGetTransactionsResponse>;
    /**
     * @generated from protobuf rpc: GetCheckpoint(sui.rpc.v2.GetCheckpointRequest) returns (sui.rpc.v2.GetCheckpointResponse);
     */
    getCheckpoint(input: GetCheckpointRequest, options?: RpcOptions): UnaryCall<GetCheckpointRequest, GetCheckpointResponse>;
    /**
     * @generated from protobuf rpc: GetEpoch(sui.rpc.v2.GetEpochRequest) returns (sui.rpc.v2.GetEpochResponse);
     */
    getEpoch(input: GetEpochRequest, options?: RpcOptions): UnaryCall<GetEpochRequest, GetEpochResponse>;
}
