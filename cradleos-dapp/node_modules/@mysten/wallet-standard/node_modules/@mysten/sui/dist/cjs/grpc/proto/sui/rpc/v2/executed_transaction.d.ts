import { MessageType } from '@protobuf-ts/runtime';
import { ObjectSet } from './object.js';
import { BalanceChange } from './balance_change.js';
import { Timestamp } from '../../../google/protobuf/timestamp.js';
import { TransactionEvents } from './event.js';
import { TransactionEffects } from './effects.js';
import { UserSignature } from './signature.js';
import { Transaction } from './transaction.js';
/**
 * @generated from protobuf message sui.rpc.v2.ExecutedTransaction
 */
export interface ExecutedTransaction {
    /**
     * The digest of this Transaction.
     *
     * @generated from protobuf field: optional string digest = 1;
     */
    digest?: string;
    /**
     * The transaction itself.
     *
     * @generated from protobuf field: optional sui.rpc.v2.Transaction transaction = 2;
     */
    transaction?: Transaction;
    /**
     * List of user signatures that are used to authorize the
     * execution of this transaction.
     *
     * @generated from protobuf field: repeated sui.rpc.v2.UserSignature signatures = 3;
     */
    signatures: UserSignature[];
    /**
     * The `TransactionEffects` for this transaction.
     *
     * @generated from protobuf field: optional sui.rpc.v2.TransactionEffects effects = 4;
     */
    effects?: TransactionEffects;
    /**
     * The `TransactionEvents` for this transaction.
     *
     * This field might be empty, even if it was explicitly requested, if the
     * transaction didn't produce any events.
     * `sui.types.TransactionEffects.events_digest` is populated if the
     * transaction produced any events.
     *
     * @generated from protobuf field: optional sui.rpc.v2.TransactionEvents events = 5;
     */
    events?: TransactionEvents;
    /**
     * The sequence number for the checkpoint that includes this transaction.
     *
     * @generated from protobuf field: optional uint64 checkpoint = 6;
     */
    checkpoint?: bigint;
    /**
     * The Unix timestamp of the checkpoint that includes this transaction.
     *
     * @generated from protobuf field: optional google.protobuf.Timestamp timestamp = 7;
     */
    timestamp?: Timestamp;
    /**
     * @generated from protobuf field: repeated sui.rpc.v2.BalanceChange balance_changes = 8;
     */
    balanceChanges: BalanceChange[];
    /**
     * Set of objects either referenced as inputs or produced as
     * outputs from this Transaction.
     *
     * @generated from protobuf field: optional sui.rpc.v2.ObjectSet objects = 9;
     */
    objects?: ObjectSet;
}
declare class ExecutedTransaction$Type extends MessageType<ExecutedTransaction> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.ExecutedTransaction
 */
export declare const ExecutedTransaction: ExecutedTransaction$Type;
export {};
