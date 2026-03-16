import { MessageType } from '@protobuf-ts/runtime';
/**
 * `Bcs` contains an arbitrary type that is serialized using the
 * [BCS](https://mystenlabs.github.io/sui-rust-sdk/sui_sdk_types/index.html#bcs)
 * format as well as a name that identifies the type of the serialized value.
 *
 * @generated from protobuf message sui.rpc.v2.Bcs
 */
export interface Bcs {
    /**
     * Name that identifies the type of the serialized value.
     *
     * @generated from protobuf field: optional string name = 1;
     */
    name?: string;
    /**
     * Bytes of a BCS serialized value.
     *
     * @generated from protobuf field: optional bytes value = 2;
     */
    value?: Uint8Array;
}
declare class Bcs$Type extends MessageType<Bcs> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.Bcs
 */
export declare const Bcs: Bcs$Type;
export {};
