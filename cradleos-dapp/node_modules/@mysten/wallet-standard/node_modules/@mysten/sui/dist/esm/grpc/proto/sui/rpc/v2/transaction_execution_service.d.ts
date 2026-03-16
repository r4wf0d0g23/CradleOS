import { ServiceType } from '@protobuf-ts/runtime-rpc';
import { MessageType } from '@protobuf-ts/runtime';
import { Value } from '../../../google/protobuf/struct.js';
import { Bcs } from './bcs.js';
import { Argument } from './argument.js';
import { ExecutedTransaction } from './executed_transaction.js';
import { FieldMask } from '../../../google/protobuf/field_mask.js';
import { UserSignature } from './signature.js';
import { Transaction } from './transaction.js';
/**
 * @generated from protobuf message sui.rpc.v2.ExecuteTransactionRequest
 */
export interface ExecuteTransactionRequest {
    /**
     * The transaction to execute.
     *
     * @generated from protobuf field: optional sui.rpc.v2.Transaction transaction = 1;
     */
    transaction?: Transaction;
    /**
     * Set of `UserSignature`s authorizing the execution of the provided
     * transaction.
     *
     * @generated from protobuf field: repeated sui.rpc.v2.UserSignature signatures = 2;
     */
    signatures: UserSignature[];
    /**
     * Mask specifying which fields to read.
     * If no mask is specified, defaults to `effects.status,checkpoint`.
     *
     * @generated from protobuf field: optional google.protobuf.FieldMask read_mask = 3;
     */
    readMask?: FieldMask;
}
/**
 * Response message for `NodeService.ExecuteTransaction`.
 *
 * @generated from protobuf message sui.rpc.v2.ExecuteTransactionResponse
 */
export interface ExecuteTransactionResponse {
    /**
     * @generated from protobuf field: optional sui.rpc.v2.ExecutedTransaction transaction = 1;
     */
    transaction?: ExecutedTransaction;
}
/**
 * @generated from protobuf message sui.rpc.v2.SimulateTransactionRequest
 */
export interface SimulateTransactionRequest {
    /**
     * @generated from protobuf field: optional sui.rpc.v2.Transaction transaction = 1;
     */
    transaction?: Transaction;
    /**
     * Mask specifying which fields to read.
     *
     * @generated from protobuf field: optional google.protobuf.FieldMask read_mask = 2;
     */
    readMask?: FieldMask;
    /**
     * Specify whether checks should be ENABLED (default) or DISABLED while executing the transaction
     *
     * @generated from protobuf field: optional sui.rpc.v2.SimulateTransactionRequest.TransactionChecks checks = 3;
     */
    checks?: SimulateTransactionRequest_TransactionChecks;
    /**
     * Perform gas selection based on a budget estimation and include the
     * selected gas payment and budget in the response.
     *
     * This option will be ignored if `checks` is `DISABLED`.
     *
     * @generated from protobuf field: optional bool do_gas_selection = 4;
     */
    doGasSelection?: boolean;
}
/**
 * buf:lint:ignore ENUM_ZERO_VALUE_SUFFIX
 *
 * @generated from protobuf enum sui.rpc.v2.SimulateTransactionRequest.TransactionChecks
 */
export declare enum SimulateTransactionRequest_TransactionChecks {
    /**
     * @generated from protobuf enum value: ENABLED = 0;
     */
    ENABLED = 0,
    /**
     * @generated from protobuf enum value: DISABLED = 1;
     */
    DISABLED = 1
}
/**
 * @generated from protobuf message sui.rpc.v2.SimulateTransactionResponse
 */
export interface SimulateTransactionResponse {
    /**
     * @generated from protobuf field: optional sui.rpc.v2.ExecutedTransaction transaction = 1;
     */
    transaction?: ExecutedTransaction;
    /**
     * @generated from protobuf field: repeated sui.rpc.v2.CommandResult command_outputs = 2;
     */
    commandOutputs: CommandResult[];
}
/**
 * An intermediate result/output from the execution of a single command
 *
 * @generated from protobuf message sui.rpc.v2.CommandResult
 */
export interface CommandResult {
    /**
     * @generated from protobuf field: repeated sui.rpc.v2.CommandOutput return_values = 1;
     */
    returnValues: CommandOutput[];
    /**
     * @generated from protobuf field: repeated sui.rpc.v2.CommandOutput mutated_by_ref = 2;
     */
    mutatedByRef: CommandOutput[];
}
/**
 * @generated from protobuf message sui.rpc.v2.CommandOutput
 */
export interface CommandOutput {
    /**
     * @generated from protobuf field: optional sui.rpc.v2.Argument argument = 1;
     */
    argument?: Argument;
    /**
     * @generated from protobuf field: optional sui.rpc.v2.Bcs value = 2;
     */
    value?: Bcs;
    /**
     * JSON rendering of the output.
     *
     * @generated from protobuf field: optional google.protobuf.Value json = 3;
     */
    json?: Value;
}
declare class ExecuteTransactionRequest$Type extends MessageType<ExecuteTransactionRequest> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.ExecuteTransactionRequest
 */
export declare const ExecuteTransactionRequest: ExecuteTransactionRequest$Type;
declare class ExecuteTransactionResponse$Type extends MessageType<ExecuteTransactionResponse> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.ExecuteTransactionResponse
 */
export declare const ExecuteTransactionResponse: ExecuteTransactionResponse$Type;
declare class SimulateTransactionRequest$Type extends MessageType<SimulateTransactionRequest> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.SimulateTransactionRequest
 */
export declare const SimulateTransactionRequest: SimulateTransactionRequest$Type;
declare class SimulateTransactionResponse$Type extends MessageType<SimulateTransactionResponse> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.SimulateTransactionResponse
 */
export declare const SimulateTransactionResponse: SimulateTransactionResponse$Type;
declare class CommandResult$Type extends MessageType<CommandResult> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.CommandResult
 */
export declare const CommandResult: CommandResult$Type;
declare class CommandOutput$Type extends MessageType<CommandOutput> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.CommandOutput
 */
export declare const CommandOutput: CommandOutput$Type;
/**
 * @generated ServiceType for protobuf service sui.rpc.v2.TransactionExecutionService
 */
export declare const TransactionExecutionService: ServiceType;
export {};
