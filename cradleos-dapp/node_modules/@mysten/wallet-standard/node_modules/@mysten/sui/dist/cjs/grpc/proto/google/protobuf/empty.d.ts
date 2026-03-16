import { MessageType } from '@protobuf-ts/runtime';
/**
 * A generic empty message that you can re-use to avoid defining duplicated
 * empty messages in your APIs. A typical example is to use it as the request
 * or the response type of an API method. For instance:
 *
 * ```
 * service Foo {
 *   rpc Bar(google.protobuf.Empty) returns (google.protobuf.Empty);
 * }
 * ```
 *
 *
 * @generated from protobuf message google.protobuf.Empty
 */
export interface Empty {
}
declare class Empty$Type extends MessageType<Empty> {
    constructor();
}
/**
 * @generated MessageType for protobuf message google.protobuf.Empty
 */
export declare const Empty: Empty$Type;
export {};
