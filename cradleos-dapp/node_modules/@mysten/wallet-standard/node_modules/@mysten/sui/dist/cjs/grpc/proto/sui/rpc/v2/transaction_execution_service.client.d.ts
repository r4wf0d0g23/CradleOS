import type { RpcTransport } from '@protobuf-ts/runtime-rpc';
import type { ServiceInfo } from '@protobuf-ts/runtime-rpc';
import type { SimulateTransactionResponse } from './transaction_execution_service.js';
import type { SimulateTransactionRequest } from './transaction_execution_service.js';
import type { ExecuteTransactionResponse } from './transaction_execution_service.js';
import type { ExecuteTransactionRequest } from './transaction_execution_service.js';
import type { UnaryCall } from '@protobuf-ts/runtime-rpc';
import type { RpcOptions } from '@protobuf-ts/runtime-rpc';
/**
 * @generated from protobuf service sui.rpc.v2.TransactionExecutionService
 */
export interface ITransactionExecutionServiceClient {
    /**
     * @generated from protobuf rpc: ExecuteTransaction(sui.rpc.v2.ExecuteTransactionRequest) returns (sui.rpc.v2.ExecuteTransactionResponse);
     */
    executeTransaction(input: ExecuteTransactionRequest, options?: RpcOptions): UnaryCall<ExecuteTransactionRequest, ExecuteTransactionResponse>;
    /**
     * @generated from protobuf rpc: SimulateTransaction(sui.rpc.v2.SimulateTransactionRequest) returns (sui.rpc.v2.SimulateTransactionResponse);
     */
    simulateTransaction(input: SimulateTransactionRequest, options?: RpcOptions): UnaryCall<SimulateTransactionRequest, SimulateTransactionResponse>;
}
/**
 * @generated from protobuf service sui.rpc.v2.TransactionExecutionService
 */
export declare class TransactionExecutionServiceClient implements ITransactionExecutionServiceClient, ServiceInfo {
    private readonly _transport;
    typeName: string;
    methods: import("@protobuf-ts/runtime-rpc").MethodInfo<any, any>[];
    options: {
        [extensionName: string]: import("@protobuf-ts/runtime").JsonValue;
    };
    constructor(_transport: RpcTransport);
    /**
     * @generated from protobuf rpc: ExecuteTransaction(sui.rpc.v2.ExecuteTransactionRequest) returns (sui.rpc.v2.ExecuteTransactionResponse);
     */
    executeTransaction(input: ExecuteTransactionRequest, options?: RpcOptions): UnaryCall<ExecuteTransactionRequest, ExecuteTransactionResponse>;
    /**
     * @generated from protobuf rpc: SimulateTransaction(sui.rpc.v2.SimulateTransactionRequest) returns (sui.rpc.v2.SimulateTransactionResponse);
     */
    simulateTransaction(input: SimulateTransactionRequest, options?: RpcOptions): UnaryCall<SimulateTransactionRequest, SimulateTransactionResponse>;
}
