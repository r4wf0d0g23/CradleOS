import { MessageType } from '@protobuf-ts/runtime';
/**
 * The delta, or change, in balance for an address for a particular `Coin` type.
 *
 * @generated from protobuf message sui.rpc.v2.BalanceChange
 */
export interface BalanceChange {
    /**
     * The account address that is affected by this balance change event.
     *
     * @generated from protobuf field: optional string address = 1;
     */
    address?: string;
    /**
     * The `Coin` type of this balance change event.
     *
     * @generated from protobuf field: optional string coin_type = 2;
     */
    coinType?: string;
    /**
     * The amount or change in balance.
     *
     * @generated from protobuf field: optional string amount = 3;
     */
    amount?: string;
}
declare class BalanceChange$Type extends MessageType<BalanceChange> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.BalanceChange
 */
export declare const BalanceChange: BalanceChange$Type;
export {};
