import { MessageType } from '@protobuf-ts/runtime';
import { Value } from '../../../google/protobuf/struct.js';
/**
 * An input to a user transaction.
 *
 * @generated from protobuf message sui.rpc.v2.Input
 */
export interface Input {
    /**
     * @generated from protobuf field: optional sui.rpc.v2.Input.InputKind kind = 1;
     */
    kind?: Input_InputKind;
    /**
     * A move value serialized as BCS.
     *
     * For normal operations this is required to be a move primitive type and not contain structs
     * or objects.
     *
     * @generated from protobuf field: optional bytes pure = 2;
     */
    pure?: Uint8Array;
    /**
     * `ObjectId` of the object input.
     *
     * @generated from protobuf field: optional string object_id = 3;
     */
    objectId?: string;
    /**
     * Requested version of the input object when `kind` is `IMMUTABLE_OR_OWNED`
     * or `RECEIVING` or if `kind` is `SHARED` this is the initial version of the
     * object when it was shared
     *
     * @generated from protobuf field: optional uint64 version = 4;
     */
    version?: bigint;
    /**
     * The digest of this object.
     *
     * @generated from protobuf field: optional string digest = 5;
     */
    digest?: string;
    /**
     * Controls whether the caller asks for a mutable reference to the shared
     * object.
     *
     * @generated from protobuf field: optional bool mutable = 6;
     */
    mutable?: boolean;
    /**
     * A literal value
     *
     * INPUT ONLY
     *
     * @generated from protobuf field: optional google.protobuf.Value literal = 1000;
     */
    literal?: Value;
}
/**
 * @generated from protobuf enum sui.rpc.v2.Input.InputKind
 */
export declare enum Input_InputKind {
    /**
     * @generated from protobuf enum value: INPUT_KIND_UNKNOWN = 0;
     */
    INPUT_KIND_UNKNOWN = 0,
    /**
     * A move value serialized as BCS.
     *
     * @generated from protobuf enum value: PURE = 1;
     */
    PURE = 1,
    /**
     * A Move object that is either immutable or address owned.
     *
     * @generated from protobuf enum value: IMMUTABLE_OR_OWNED = 2;
     */
    IMMUTABLE_OR_OWNED = 2,
    /**
     * A Move object whose owner is "Shared".
     *
     * @generated from protobuf enum value: SHARED = 3;
     */
    SHARED = 3,
    /**
     * A Move object that is attempted to be received in this transaction.
     *
     * @generated from protobuf enum value: RECEIVING = 4;
     */
    RECEIVING = 4
}
declare class Input$Type extends MessageType<Input> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.Input
 */
export declare const Input: Input$Type;
export {};
