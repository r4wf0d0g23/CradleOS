import { MessageType } from '@protobuf-ts/runtime';
import { ObjectSet } from './object.js';
import { ExecutedTransaction } from './executed_transaction.js';
import { CheckpointContents } from './checkpoint_contents.js';
import { ValidatorAggregatedSignature } from './signature.js';
import { CheckpointSummary } from './checkpoint_summary.js';
/**
 * @generated from protobuf message sui.rpc.v2.Checkpoint
 */
export interface Checkpoint {
    /**
     * The height of this checkpoint.
     *
     * @generated from protobuf field: optional uint64 sequence_number = 1;
     */
    sequenceNumber?: bigint;
    /**
     * The digest of this Checkpoint's CheckpointSummary.
     *
     * @generated from protobuf field: optional string digest = 2;
     */
    digest?: string;
    /**
     * The `CheckpointSummary` for this checkpoint.
     *
     * @generated from protobuf field: optional sui.rpc.v2.CheckpointSummary summary = 3;
     */
    summary?: CheckpointSummary;
    /**
     * An aggregated quorum signature from the validator committee that
     * certified this checkpoint.
     *
     * @generated from protobuf field: optional sui.rpc.v2.ValidatorAggregatedSignature signature = 4;
     */
    signature?: ValidatorAggregatedSignature;
    /**
     * The `CheckpointContents` for this checkpoint.
     *
     * @generated from protobuf field: optional sui.rpc.v2.CheckpointContents contents = 5;
     */
    contents?: CheckpointContents;
    /**
     * List of transactions included in this checkpoint.
     *
     * @generated from protobuf field: repeated sui.rpc.v2.ExecutedTransaction transactions = 6;
     */
    transactions: ExecutedTransaction[];
    /**
     * Set of objects either referenced as inputs or produced as
     * outputs by transactions included in this checkpoint.
     *
     * In order to benefit from deduplication of objects that
     * appear in multiple transactions in this checkpoint, objects
     * will only be present here and the `transactions.objects`
     * field will not be populated.
     *
     * @generated from protobuf field: optional sui.rpc.v2.ObjectSet objects = 7;
     */
    objects?: ObjectSet;
}
declare class Checkpoint$Type extends MessageType<Checkpoint> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.Checkpoint
 */
export declare const Checkpoint: Checkpoint$Type;
export {};
