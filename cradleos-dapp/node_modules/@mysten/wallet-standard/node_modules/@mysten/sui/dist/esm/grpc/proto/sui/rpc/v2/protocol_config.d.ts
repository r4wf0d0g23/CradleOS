import { MessageType } from '@protobuf-ts/runtime';
/**
 * @generated from protobuf message sui.rpc.v2.ProtocolConfig
 */
export interface ProtocolConfig {
    /**
     * @generated from protobuf field: optional uint64 protocol_version = 1;
     */
    protocolVersion?: bigint;
    /**
     * @generated from protobuf field: map<string, bool> feature_flags = 2;
     */
    featureFlags: {
        [key: string]: boolean;
    };
    /**
     * @generated from protobuf field: map<string, string> attributes = 3;
     */
    attributes: {
        [key: string]: string;
    };
}
declare class ProtocolConfig$Type extends MessageType<ProtocolConfig> {
    constructor();
}
/**
 * @generated MessageType for protobuf message sui.rpc.v2.ProtocolConfig
 */
export declare const ProtocolConfig: ProtocolConfig$Type;
export {};
