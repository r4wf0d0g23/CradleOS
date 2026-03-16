import { MessageType } from '@protobuf-ts/runtime';
import { Value } from '../../../google/protobuf/struct.js';
import { Bcs } from './bcs.js';
/**
 * Events emitted during the successful execution of a transaction.
 *
 * @generated from protobuf message sui.rpc.v2.TransactionEvents
 */
export interface TransactionEvents {
    /**
     * This TransactionEvents serialized as BCS.
     *
     * @generated from protobuf field: optional sui.rpc.v2.Bcs bcs = 1;
     */
    bcs?: Bcs;
    /**
     * The digest of this TransactionEvents.
     *
     * @generated from protobuf field: optional string digest = 2;
     */
    digest?: string;
    /**
     * Set of events emitted by a transaction.
     *
     * @generated from protobuf field: repeated sui.rpc.v2.Event events = 3;
     */
    events: Event[];
}
/**
 * An event.
 *
 * @generated from protobuf message sui.rpc.v2.Event
 */
export interface Event {
    /**
     * Package ID of the top-level function invoked by a `MoveCall` command that triggered this
     * event to be emitted.
     *
     * @generated from protobuf field: optional string package_id = 1;
     */
    packageId?: string;
    /**
     * Module name of the top-level function invoked by a `MoveCall` command that triggered this
     * event to be emitted.
     *
     * @generated from protobuf field: optional string module = 2;
     */
    module?: string;
    /**
     * Address of the account that sent the transaction where this event was emitted.
     *
     * @generated from protobuf field: optional string sender = 3;
     */
    sender?: string;
    /**
     * The type of the event emitted.
     *
     * @generated from protobuf field: optional string event_type = 4;
     */
    eventType?: string;
    /**
     * BCS serialized bytes of the event.
     *
     * @generated from protobuf field: optional sui.rpc.v2.Bcs contents = 5;
     */
    contents?: Bcs;
    /**
     * JSON rendering of the event.
     *
     * @generated from protobuf field: optional google.protobuf.Value json = 6;
     */
    json?: Value;
}
declare class TransactionEvents$Type extends MessageType<TransactionEvents> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.TransactionEvents
 */
export declare const TransactionEvents: TransactionEvents$Type;
declare class Event$Type extends MessageType<Event> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.Event
 */
export declare const Event: Event$Type;
export {};
