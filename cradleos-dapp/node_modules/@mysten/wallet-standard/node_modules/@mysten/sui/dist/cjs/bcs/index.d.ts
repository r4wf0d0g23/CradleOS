import { IntentMessage } from './bcs.js';
export type { TypeTag } from './types.js';
export { TypeTagSerializer } from './type-tag-serializer.js';
export { BcsType, BcsStruct, BcsEnum, BcsTuple, type BcsTypeOptions } from '@mysten/bcs';
declare const suiBcs: {
    U8: import("@mysten/bcs").BcsType<number, number, "u8">;
    U16: import("@mysten/bcs").BcsType<number, number, "u16">;
    U32: import("@mysten/bcs").BcsType<number, number, "u32">;
    U64: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
    U128: import("@mysten/bcs").BcsType<string, string | number | bigint, "u128">;
    U256: import("@mysten/bcs").BcsType<string, string | number | bigint, "u256">;
    ULEB128: import("@mysten/bcs").BcsType<number, number, string>;
    Bool: import("@mysten/bcs").BcsType<boolean, boolean, "bool">;
    String: import("@mysten/bcs").BcsType<string, string, "string">;
    Address: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
    AppId: import("@mysten/bcs").BcsEnum<{
        Sui: null;
    }, "AppId">;
    Argument: import("@mysten/bcs").BcsEnum<{
        GasCoin: null;
        Input: import("@mysten/bcs").BcsType<number, number, "u16">;
        Result: import("@mysten/bcs").BcsType<number, number, "u16">;
        NestedResult: import("@mysten/bcs").BcsTuple<readonly [import("@mysten/bcs").BcsType<number, number, "u16">, import("@mysten/bcs").BcsType<number, number, "u16">], string>;
    }, "Argument">;
    CallArg: import("@mysten/bcs").BcsEnum<{
        Pure: import("@mysten/bcs").BcsStruct<{
            bytes: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, string>;
        }, string>;
        Object: import("@mysten/bcs").BcsEnum<{
            ImmOrOwnedObject: import("@mysten/bcs").BcsStruct<{
                objectId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                version: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                digest: import("@mysten/bcs").BcsType<string, string, "ObjectDigest">;
            }, string>;
            SharedObject: import("@mysten/bcs").BcsStruct<{
                objectId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                initialSharedVersion: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                mutable: import("@mysten/bcs").BcsType<boolean, boolean, "bool">;
            }, string>;
            Receiving: import("@mysten/bcs").BcsStruct<{
                objectId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                version: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                digest: import("@mysten/bcs").BcsType<string, string, "ObjectDigest">;
            }, string>;
        }, "ObjectArg">;
    }, "CallArg">;
    Command: import("@mysten/bcs").BcsEnum<{
        MoveCall: import("@mysten/bcs").BcsStruct<{
            package: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
            module: import("@mysten/bcs").BcsType<string, string, "string">;
            function: import("@mysten/bcs").BcsType<string, string, "string">;
            typeArguments: import("@mysten/bcs").BcsType<string[], Iterable<string | import("./types.js").TypeTag> & {
                length: number;
            }, string>;
            arguments: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
                GasCoin: true;
                Input: number;
                Result: number;
                NestedResult: [number, number];
            }, "GasCoin" | "Input" | "Result" | "NestedResult">[], Iterable<import("@mysten/bcs").EnumInputShape<{
                GasCoin: boolean | object | null;
                Input: number;
                Result: number;
                NestedResult: readonly [number, number];
            }>> & {
                length: number;
            }, string>;
        }, string>;
        TransferObjects: import("@mysten/bcs").BcsStruct<{
            objects: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
                GasCoin: true;
                Input: number;
                Result: number;
                NestedResult: [number, number];
            }, "GasCoin" | "Input" | "Result" | "NestedResult">[], Iterable<import("@mysten/bcs").EnumInputShape<{
                GasCoin: boolean | object | null;
                Input: number;
                Result: number;
                NestedResult: readonly [number, number];
            }>> & {
                length: number;
            }, string>;
            address: import("@mysten/bcs").BcsEnum<{
                GasCoin: null;
                Input: import("@mysten/bcs").BcsType<number, number, "u16">;
                Result: import("@mysten/bcs").BcsType<number, number, "u16">;
                NestedResult: import("@mysten/bcs").BcsTuple<readonly [import("@mysten/bcs").BcsType<number, number, "u16">, import("@mysten/bcs").BcsType<number, number, "u16">], string>;
            }, "Argument">;
        }, string>;
        SplitCoins: import("@mysten/bcs").BcsStruct<{
            coin: import("@mysten/bcs").BcsEnum<{
                GasCoin: null;
                Input: import("@mysten/bcs").BcsType<number, number, "u16">;
                Result: import("@mysten/bcs").BcsType<number, number, "u16">;
                NestedResult: import("@mysten/bcs").BcsTuple<readonly [import("@mysten/bcs").BcsType<number, number, "u16">, import("@mysten/bcs").BcsType<number, number, "u16">], string>;
            }, "Argument">;
            amounts: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
                GasCoin: true;
                Input: number;
                Result: number;
                NestedResult: [number, number];
            }, "GasCoin" | "Input" | "Result" | "NestedResult">[], Iterable<import("@mysten/bcs").EnumInputShape<{
                GasCoin: boolean | object | null;
                Input: number;
                Result: number;
                NestedResult: readonly [number, number];
            }>> & {
                length: number;
            }, string>;
        }, string>;
        MergeCoins: import("@mysten/bcs").BcsStruct<{
            destination: import("@mysten/bcs").BcsEnum<{
                GasCoin: null;
                Input: import("@mysten/bcs").BcsType<number, number, "u16">;
                Result: import("@mysten/bcs").BcsType<number, number, "u16">;
                NestedResult: import("@mysten/bcs").BcsTuple<readonly [import("@mysten/bcs").BcsType<number, number, "u16">, import("@mysten/bcs").BcsType<number, number, "u16">], string>;
            }, "Argument">;
            sources: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
                GasCoin: true;
                Input: number;
                Result: number;
                NestedResult: [number, number];
            }, "GasCoin" | "Input" | "Result" | "NestedResult">[], Iterable<import("@mysten/bcs").EnumInputShape<{
                GasCoin: boolean | object | null;
                Input: number;
                Result: number;
                NestedResult: readonly [number, number];
            }>> & {
                length: number;
            }, string>;
        }, string>;
        Publish: import("@mysten/bcs").BcsStruct<{
            modules: import("@mysten/bcs").BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
                length: number;
            }, string>;
            dependencies: import("@mysten/bcs").BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
                length: number;
            }, string>;
        }, string>;
        MakeMoveVec: import("@mysten/bcs").BcsStruct<{
            type: import("@mysten/bcs").BcsType<string | null, string | null, string>;
            elements: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
                GasCoin: true;
                Input: number;
                Result: number;
                NestedResult: [number, number];
            }, "GasCoin" | "Input" | "Result" | "NestedResult">[], Iterable<import("@mysten/bcs").EnumInputShape<{
                GasCoin: boolean | object | null;
                Input: number;
                Result: number;
                NestedResult: readonly [number, number];
            }>> & {
                length: number;
            }, string>;
        }, string>;
        Upgrade: import("@mysten/bcs").BcsStruct<{
            modules: import("@mysten/bcs").BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
                length: number;
            }, string>;
            dependencies: import("@mysten/bcs").BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
                length: number;
            }, string>;
            package: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
            ticket: import("@mysten/bcs").BcsEnum<{
                GasCoin: null;
                Input: import("@mysten/bcs").BcsType<number, number, "u16">;
                Result: import("@mysten/bcs").BcsType<number, number, "u16">;
                NestedResult: import("@mysten/bcs").BcsTuple<readonly [import("@mysten/bcs").BcsType<number, number, "u16">, import("@mysten/bcs").BcsType<number, number, "u16">], string>;
            }, "Argument">;
        }, string>;
    }, "Command">;
    CompressedSignature: import("@mysten/bcs").BcsEnum<{
        ED25519: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[64]">;
        Secp256k1: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[64]">;
        Secp256r1: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[64]">;
        ZkLogin: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
        Passkey: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
    }, "CompressedSignature">;
    GasData: import("@mysten/bcs").BcsStruct<{
        payment: import("@mysten/bcs").BcsType<{
            objectId: string;
            version: string;
            digest: string;
        }[], Iterable<{
            objectId: string | Uint8Array<ArrayBufferLike>;
            version: string | number | bigint;
            digest: string;
        }> & {
            length: number;
        }, string>;
        owner: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        price: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
        budget: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
    }, string>;
    Intent: import("@mysten/bcs").BcsStruct<{
        scope: import("@mysten/bcs").BcsEnum<{
            TransactionData: null;
            TransactionEffects: null;
            CheckpointSummary: null;
            PersonalMessage: null;
        }, "IntentScope">;
        version: import("@mysten/bcs").BcsEnum<{
            V0: null;
        }, "IntentVersion">;
        appId: import("@mysten/bcs").BcsEnum<{
            Sui: null;
        }, "AppId">;
    }, string>;
    IntentMessage: typeof IntentMessage;
    IntentScope: import("@mysten/bcs").BcsEnum<{
        TransactionData: null;
        TransactionEffects: null;
        CheckpointSummary: null;
        PersonalMessage: null;
    }, "IntentScope">;
    IntentVersion: import("@mysten/bcs").BcsEnum<{
        V0: null;
    }, "IntentVersion">;
    MultiSig: import("@mysten/bcs").BcsStruct<{
        sigs: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
            ED25519: Uint8Array<ArrayBufferLike>;
            Secp256k1: Uint8Array<ArrayBufferLike>;
            Secp256r1: Uint8Array<ArrayBufferLike>;
            ZkLogin: Uint8Array<ArrayBufferLike>;
            Passkey: Uint8Array<ArrayBufferLike>;
        }, "ED25519" | "Secp256k1" | "Secp256r1" | "ZkLogin" | "Passkey">[], Iterable<import("@mysten/bcs").EnumInputShape<{
            ED25519: Iterable<number>;
            Secp256k1: Iterable<number>;
            Secp256r1: Iterable<number>;
            ZkLogin: Iterable<number>;
            Passkey: Iterable<number>;
        }>> & {
            length: number;
        }, string>;
        bitmap: import("@mysten/bcs").BcsType<number, number, "u16">;
        multisig_pk: import("@mysten/bcs").BcsStruct<{
            pk_map: import("@mysten/bcs").BcsType<{
                pubKey: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    ED25519: Uint8Array<ArrayBufferLike>;
                    Secp256k1: Uint8Array<ArrayBufferLike>;
                    Secp256r1: Uint8Array<ArrayBufferLike>;
                    ZkLogin: Uint8Array<ArrayBufferLike>;
                    Passkey: Uint8Array<ArrayBufferLike>;
                }, "ED25519" | "Secp256k1" | "Secp256r1" | "ZkLogin" | "Passkey">;
                weight: number;
            }[], Iterable<{
                pubKey: import("@mysten/bcs").EnumInputShape<{
                    ED25519: Iterable<number>;
                    Secp256k1: Iterable<number>;
                    Secp256r1: Iterable<number>;
                    ZkLogin: Iterable<number>;
                    Passkey: Iterable<number>;
                }>;
                weight: number;
            }> & {
                length: number;
            }, string>;
            threshold: import("@mysten/bcs").BcsType<number, number, "u16">;
        }, string>;
    }, string>;
    MultiSigPkMap: import("@mysten/bcs").BcsStruct<{
        pubKey: import("@mysten/bcs").BcsEnum<{
            ED25519: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[32]">;
            Secp256k1: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[33]">;
            Secp256r1: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[33]">;
            ZkLogin: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
            Passkey: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[33]">;
        }, "PublicKey">;
        weight: import("@mysten/bcs").BcsType<number, number, "u8">;
    }, string>;
    MultiSigPublicKey: import("@mysten/bcs").BcsStruct<{
        pk_map: import("@mysten/bcs").BcsType<{
            pubKey: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                ED25519: Uint8Array<ArrayBufferLike>;
                Secp256k1: Uint8Array<ArrayBufferLike>;
                Secp256r1: Uint8Array<ArrayBufferLike>;
                ZkLogin: Uint8Array<ArrayBufferLike>;
                Passkey: Uint8Array<ArrayBufferLike>;
            }, "ED25519" | "Secp256k1" | "Secp256r1" | "ZkLogin" | "Passkey">;
            weight: number;
        }[], Iterable<{
            pubKey: import("@mysten/bcs").EnumInputShape<{
                ED25519: Iterable<number>;
                Secp256k1: Iterable<number>;
                Secp256r1: Iterable<number>;
                ZkLogin: Iterable<number>;
                Passkey: Iterable<number>;
            }>;
            weight: number;
        }> & {
            length: number;
        }, string>;
        threshold: import("@mysten/bcs").BcsType<number, number, "u16">;
    }, string>;
    ObjectArg: import("@mysten/bcs").BcsEnum<{
        ImmOrOwnedObject: import("@mysten/bcs").BcsStruct<{
            objectId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
            version: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
            digest: import("@mysten/bcs").BcsType<string, string, "ObjectDigest">;
        }, string>;
        SharedObject: import("@mysten/bcs").BcsStruct<{
            objectId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
            initialSharedVersion: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
            mutable: import("@mysten/bcs").BcsType<boolean, boolean, "bool">;
        }, string>;
        Receiving: import("@mysten/bcs").BcsStruct<{
            objectId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
            version: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
            digest: import("@mysten/bcs").BcsType<string, string, "ObjectDigest">;
        }, string>;
    }, "ObjectArg">;
    ObjectDigest: import("@mysten/bcs").BcsType<string, string, "ObjectDigest">;
    Owner: import("@mysten/bcs").BcsEnum<{
        AddressOwner: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        ObjectOwner: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        Shared: import("@mysten/bcs").BcsStruct<{
            initialSharedVersion: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
        }, string>;
        Immutable: null;
        ConsensusAddressOwner: import("@mysten/bcs").BcsStruct<{
            owner: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
            startVersion: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
        }, string>;
    }, "Owner">;
    PasskeyAuthenticator: import("@mysten/bcs").BcsStruct<{
        authenticatorData: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
        clientDataJson: import("@mysten/bcs").BcsType<string, string, "string">;
        userSignature: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
    }, string>;
    ProgrammableMoveCall: import("@mysten/bcs").BcsStruct<{
        package: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        module: import("@mysten/bcs").BcsType<string, string, "string">;
        function: import("@mysten/bcs").BcsType<string, string, "string">;
        typeArguments: import("@mysten/bcs").BcsType<string[], Iterable<string | import("./types.js").TypeTag> & {
            length: number;
        }, string>;
        arguments: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
            GasCoin: true;
            Input: number;
            Result: number;
            NestedResult: [number, number];
        }, "GasCoin" | "Input" | "Result" | "NestedResult">[], Iterable<import("@mysten/bcs").EnumInputShape<{
            GasCoin: boolean | object | null;
            Input: number;
            Result: number;
            NestedResult: readonly [number, number];
        }>> & {
            length: number;
        }, string>;
    }, string>;
    ProgrammableTransaction: import("@mysten/bcs").BcsStruct<{
        inputs: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
            Pure: {
                bytes: string;
            };
            Object: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                ImmOrOwnedObject: {
                    objectId: string;
                    version: string;
                    digest: string;
                };
                SharedObject: {
                    objectId: string;
                    initialSharedVersion: string;
                    mutable: boolean;
                };
                Receiving: {
                    objectId: string;
                    version: string;
                    digest: string;
                };
            }, "ImmOrOwnedObject" | "SharedObject" | "Receiving">;
        }, "Pure" | "Object">[], Iterable<import("@mysten/bcs").EnumInputShape<{
            Pure: {
                bytes: string | Uint8Array<ArrayBufferLike>;
            };
            Object: import("@mysten/bcs").EnumInputShape<{
                ImmOrOwnedObject: {
                    objectId: string | Uint8Array<ArrayBufferLike>;
                    version: string | number | bigint;
                    digest: string;
                };
                SharedObject: {
                    objectId: string | Uint8Array<ArrayBufferLike>;
                    initialSharedVersion: string | number | bigint;
                    mutable: boolean;
                };
                Receiving: {
                    objectId: string | Uint8Array<ArrayBufferLike>;
                    version: string | number | bigint;
                    digest: string;
                };
            }>;
        }>> & {
            length: number;
        }, string>;
        commands: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
            MoveCall: {
                package: string;
                module: string;
                function: string;
                typeArguments: string[];
                arguments: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    GasCoin: true;
                    Input: number;
                    Result: number;
                    NestedResult: [number, number];
                }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
            };
            TransferObjects: {
                objects: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    GasCoin: true;
                    Input: number;
                    Result: number;
                    NestedResult: [number, number];
                }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                address: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    GasCoin: true;
                    Input: number;
                    Result: number;
                    NestedResult: [number, number];
                }, "GasCoin" | "Input" | "Result" | "NestedResult">;
            };
            SplitCoins: {
                coin: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    GasCoin: true;
                    Input: number;
                    Result: number;
                    NestedResult: [number, number];
                }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                amounts: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    GasCoin: true;
                    Input: number;
                    Result: number;
                    NestedResult: [number, number];
                }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
            };
            MergeCoins: {
                destination: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    GasCoin: true;
                    Input: number;
                    Result: number;
                    NestedResult: [number, number];
                }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                sources: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    GasCoin: true;
                    Input: number;
                    Result: number;
                    NestedResult: [number, number];
                }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
            };
            Publish: {
                modules: string[];
                dependencies: string[];
            };
            MakeMoveVec: {
                type: string | null;
                elements: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    GasCoin: true;
                    Input: number;
                    Result: number;
                    NestedResult: [number, number];
                }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
            };
            Upgrade: {
                modules: string[];
                dependencies: string[];
                package: string;
                ticket: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    GasCoin: true;
                    Input: number;
                    Result: number;
                    NestedResult: [number, number];
                }, "GasCoin" | "Input" | "Result" | "NestedResult">;
            };
        }, "MoveCall" | "TransferObjects" | "SplitCoins" | "MergeCoins" | "Publish" | "MakeMoveVec" | "Upgrade">[], Iterable<import("@mysten/bcs").EnumInputShape<{
            MoveCall: {
                package: string | Uint8Array<ArrayBufferLike>;
                module: string;
                function: string;
                typeArguments: Iterable<string | import("./types.js").TypeTag> & {
                    length: number;
                };
                arguments: Iterable<import("@mysten/bcs").EnumInputShape<{
                    GasCoin: boolean | object | null;
                    Input: number;
                    Result: number;
                    NestedResult: readonly [number, number];
                }>> & {
                    length: number;
                };
            };
            TransferObjects: {
                objects: Iterable<import("@mysten/bcs").EnumInputShape<{
                    GasCoin: boolean | object | null;
                    Input: number;
                    Result: number;
                    NestedResult: readonly [number, number];
                }>> & {
                    length: number;
                };
                address: import("@mysten/bcs").EnumInputShape<{
                    GasCoin: boolean | object | null;
                    Input: number;
                    Result: number;
                    NestedResult: readonly [number, number];
                }>;
            };
            SplitCoins: {
                coin: import("@mysten/bcs").EnumInputShape<{
                    GasCoin: boolean | object | null;
                    Input: number;
                    Result: number;
                    NestedResult: readonly [number, number];
                }>;
                amounts: Iterable<import("@mysten/bcs").EnumInputShape<{
                    GasCoin: boolean | object | null;
                    Input: number;
                    Result: number;
                    NestedResult: readonly [number, number];
                }>> & {
                    length: number;
                };
            };
            MergeCoins: {
                destination: import("@mysten/bcs").EnumInputShape<{
                    GasCoin: boolean | object | null;
                    Input: number;
                    Result: number;
                    NestedResult: readonly [number, number];
                }>;
                sources: Iterable<import("@mysten/bcs").EnumInputShape<{
                    GasCoin: boolean | object | null;
                    Input: number;
                    Result: number;
                    NestedResult: readonly [number, number];
                }>> & {
                    length: number;
                };
            };
            Publish: {
                modules: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                    length: number;
                };
                dependencies: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                    length: number;
                };
            };
            MakeMoveVec: {
                type: string | null;
                elements: Iterable<import("@mysten/bcs").EnumInputShape<{
                    GasCoin: boolean | object | null;
                    Input: number;
                    Result: number;
                    NestedResult: readonly [number, number];
                }>> & {
                    length: number;
                };
            };
            Upgrade: {
                modules: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                    length: number;
                };
                dependencies: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                    length: number;
                };
                package: string | Uint8Array<ArrayBufferLike>;
                ticket: import("@mysten/bcs").EnumInputShape<{
                    GasCoin: boolean | object | null;
                    Input: number;
                    Result: number;
                    NestedResult: readonly [number, number];
                }>;
            };
        }>> & {
            length: number;
        }, string>;
    }, string>;
    PublicKey: import("@mysten/bcs").BcsEnum<{
        ED25519: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[32]">;
        Secp256k1: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[33]">;
        Secp256r1: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[33]">;
        ZkLogin: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
        Passkey: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[33]">;
    }, "PublicKey">;
    SenderSignedData: import("@mysten/bcs").BcsType<{
        intentMessage: {
            intent: {
                scope: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    TransactionData: true;
                    TransactionEffects: true;
                    CheckpointSummary: true;
                    PersonalMessage: true;
                }, "TransactionData" | "TransactionEffects" | "CheckpointSummary" | "PersonalMessage">;
                version: {
                    V0: true;
                    $kind: "V0";
                };
                appId: {
                    Sui: true;
                    $kind: "Sui";
                };
            };
            value: {
                V1: {
                    kind: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        ProgrammableTransaction: {
                            inputs: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                Pure: {
                                    bytes: string;
                                };
                                Object: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                    ImmOrOwnedObject: {
                                        objectId: string;
                                        version: string;
                                        digest: string;
                                    };
                                    SharedObject: {
                                        objectId: string;
                                        initialSharedVersion: string;
                                        mutable: boolean;
                                    };
                                    Receiving: {
                                        objectId: string;
                                        version: string;
                                        digest: string;
                                    };
                                }, "ImmOrOwnedObject" | "SharedObject" | "Receiving">;
                            }, "Pure" | "Object">[];
                            commands: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                MoveCall: {
                                    package: string;
                                    module: string;
                                    function: string;
                                    typeArguments: string[];
                                    arguments: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                                };
                                TransferObjects: {
                                    objects: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                                    address: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                                };
                                SplitCoins: {
                                    coin: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                                    amounts: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                                };
                                MergeCoins: {
                                    destination: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                                    sources: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                                };
                                Publish: {
                                    modules: string[];
                                    dependencies: string[];
                                };
                                MakeMoveVec: {
                                    type: string | null;
                                    elements: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                                };
                                Upgrade: {
                                    modules: string[];
                                    dependencies: string[];
                                    package: string;
                                    ticket: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                                };
                            }, "MoveCall" | "TransferObjects" | "SplitCoins" | "MergeCoins" | "Publish" | "MakeMoveVec" | "Upgrade">[];
                        };
                        ChangeEpoch: true;
                        Genesis: true;
                        ConsensusCommitPrologue: true;
                    }, "ProgrammableTransaction" | "ChangeEpoch" | "Genesis" | "ConsensusCommitPrologue">;
                    sender: string;
                    gasData: {
                        payment: {
                            objectId: string;
                            version: string;
                            digest: string;
                        }[];
                        owner: string;
                        price: string;
                        budget: string;
                    };
                    expiration: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        None: true;
                        Epoch: number;
                    }, "None" | "Epoch">;
                };
                $kind: "V1";
            };
        };
        txSignatures: string[];
    }[], Iterable<{
        intentMessage: {
            intent: {
                scope: import("@mysten/bcs").EnumInputShape<{
                    TransactionData: boolean | object | null;
                    TransactionEffects: boolean | object | null;
                    CheckpointSummary: boolean | object | null;
                    PersonalMessage: boolean | object | null;
                }>;
                version: {
                    V0: boolean | object | null;
                };
                appId: {
                    Sui: boolean | object | null;
                };
            };
            value: {
                V1: {
                    kind: import("@mysten/bcs").EnumInputShape<{
                        ProgrammableTransaction: {
                            inputs: Iterable<import("@mysten/bcs").EnumInputShape<{
                                Pure: {
                                    bytes: string | Uint8Array<ArrayBufferLike>;
                                };
                                Object: import("@mysten/bcs").EnumInputShape<{
                                    ImmOrOwnedObject: {
                                        objectId: string | Uint8Array<ArrayBufferLike>;
                                        version: string | number | bigint;
                                        digest: string;
                                    };
                                    SharedObject: {
                                        objectId: string | Uint8Array<ArrayBufferLike>;
                                        initialSharedVersion: string | number | bigint;
                                        mutable: boolean;
                                    };
                                    Receiving: {
                                        objectId: string | Uint8Array<ArrayBufferLike>;
                                        version: string | number | bigint;
                                        digest: string;
                                    };
                                }>;
                            }>> & {
                                length: number;
                            };
                            commands: Iterable<import("@mysten/bcs").EnumInputShape<{
                                MoveCall: {
                                    package: string | Uint8Array<ArrayBufferLike>;
                                    module: string;
                                    function: string;
                                    typeArguments: Iterable<string | import("./types.js").TypeTag> & {
                                        length: number;
                                    };
                                    arguments: Iterable<import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>> & {
                                        length: number;
                                    };
                                };
                                TransferObjects: {
                                    objects: Iterable<import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>> & {
                                        length: number;
                                    };
                                    address: import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>;
                                };
                                SplitCoins: {
                                    coin: import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>;
                                    amounts: Iterable<import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>> & {
                                        length: number;
                                    };
                                };
                                MergeCoins: {
                                    destination: import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>;
                                    sources: Iterable<import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>> & {
                                        length: number;
                                    };
                                };
                                Publish: {
                                    modules: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                                        length: number;
                                    };
                                    dependencies: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                                        length: number;
                                    };
                                };
                                MakeMoveVec: {
                                    type: string | null;
                                    elements: Iterable<import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>> & {
                                        length: number;
                                    };
                                };
                                Upgrade: {
                                    modules: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                                        length: number;
                                    };
                                    dependencies: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                                        length: number;
                                    };
                                    package: string | Uint8Array<ArrayBufferLike>;
                                    ticket: import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>;
                                };
                            }>> & {
                                length: number;
                            };
                        };
                        ChangeEpoch: boolean | object | null;
                        Genesis: boolean | object | null;
                        ConsensusCommitPrologue: boolean | object | null;
                    }>;
                    sender: string | Uint8Array<ArrayBufferLike>;
                    gasData: {
                        payment: Iterable<{
                            objectId: string | Uint8Array<ArrayBufferLike>;
                            version: string | number | bigint;
                            digest: string;
                        }> & {
                            length: number;
                        };
                        owner: string | Uint8Array<ArrayBufferLike>;
                        price: string | number | bigint;
                        budget: string | number | bigint;
                    };
                    expiration: import("@mysten/bcs").EnumInputShape<{
                        None: boolean | object | null;
                        Epoch: string | number;
                    }>;
                };
            };
        };
        txSignatures: Iterable<string | Uint8Array<ArrayBufferLike>> & {
            length: number;
        };
    }> & {
        length: number;
    }, "SenderSignedData">;
    SenderSignedTransaction: import("@mysten/bcs").BcsStruct<{
        intentMessage: import("@mysten/bcs").BcsStruct<{
            intent: import("@mysten/bcs").BcsStruct<{
                scope: import("@mysten/bcs").BcsEnum<{
                    TransactionData: null;
                    TransactionEffects: null;
                    CheckpointSummary: null;
                    PersonalMessage: null;
                }, "IntentScope">;
                version: import("@mysten/bcs").BcsEnum<{
                    V0: null;
                }, "IntentVersion">;
                appId: import("@mysten/bcs").BcsEnum<{
                    Sui: null;
                }, "AppId">;
            }, string>;
            value: import("@mysten/bcs").BcsEnum<{
                V1: import("@mysten/bcs").BcsStruct<{
                    kind: import("@mysten/bcs").BcsEnum<{
                        ProgrammableTransaction: import("@mysten/bcs").BcsStruct<{
                            inputs: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                Pure: {
                                    bytes: string;
                                };
                                Object: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                    ImmOrOwnedObject: {
                                        objectId: string;
                                        version: string;
                                        digest: string;
                                    };
                                    SharedObject: {
                                        objectId: string;
                                        initialSharedVersion: string;
                                        mutable: boolean;
                                    };
                                    Receiving: {
                                        objectId: string;
                                        version: string;
                                        digest: string;
                                    };
                                }, "ImmOrOwnedObject" | "SharedObject" | "Receiving">;
                            }, "Pure" | "Object">[], Iterable<import("@mysten/bcs").EnumInputShape<{
                                Pure: {
                                    bytes: string | Uint8Array<ArrayBufferLike>;
                                };
                                Object: import("@mysten/bcs").EnumInputShape<{
                                    ImmOrOwnedObject: {
                                        objectId: string | Uint8Array<ArrayBufferLike>;
                                        version: string | number | bigint;
                                        digest: string;
                                    };
                                    SharedObject: {
                                        objectId: string | Uint8Array<ArrayBufferLike>;
                                        initialSharedVersion: string | number | bigint;
                                        mutable: boolean;
                                    };
                                    Receiving: {
                                        objectId: string | Uint8Array<ArrayBufferLike>;
                                        version: string | number | bigint;
                                        digest: string;
                                    };
                                }>;
                            }>> & {
                                length: number;
                            }, string>;
                            commands: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                MoveCall: {
                                    package: string;
                                    module: string;
                                    function: string;
                                    typeArguments: string[];
                                    arguments: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                                };
                                TransferObjects: {
                                    objects: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                                    address: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                                };
                                SplitCoins: {
                                    coin: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                                    amounts: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                                };
                                MergeCoins: {
                                    destination: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                                    sources: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                                };
                                Publish: {
                                    modules: string[];
                                    dependencies: string[];
                                };
                                MakeMoveVec: {
                                    type: string | null;
                                    elements: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                                };
                                Upgrade: {
                                    modules: string[];
                                    dependencies: string[];
                                    package: string;
                                    ticket: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                        GasCoin: true;
                                        Input: number;
                                        Result: number;
                                        NestedResult: [number, number];
                                    }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                                };
                            }, "MoveCall" | "TransferObjects" | "SplitCoins" | "MergeCoins" | "Publish" | "MakeMoveVec" | "Upgrade">[], Iterable<import("@mysten/bcs").EnumInputShape<{
                                MoveCall: {
                                    package: string | Uint8Array<ArrayBufferLike>;
                                    module: string;
                                    function: string;
                                    typeArguments: Iterable<string | import("./types.js").TypeTag> & {
                                        length: number;
                                    };
                                    arguments: Iterable<import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>> & {
                                        length: number;
                                    };
                                };
                                TransferObjects: {
                                    objects: Iterable<import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>> & {
                                        length: number;
                                    };
                                    address: import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>;
                                };
                                SplitCoins: {
                                    coin: import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>;
                                    amounts: Iterable<import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>> & {
                                        length: number;
                                    };
                                };
                                MergeCoins: {
                                    destination: import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>;
                                    sources: Iterable<import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>> & {
                                        length: number;
                                    };
                                };
                                Publish: {
                                    modules: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                                        length: number;
                                    };
                                    dependencies: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                                        length: number;
                                    };
                                };
                                MakeMoveVec: {
                                    type: string | null;
                                    elements: Iterable<import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>> & {
                                        length: number;
                                    };
                                };
                                Upgrade: {
                                    modules: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                                        length: number;
                                    };
                                    dependencies: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                                        length: number;
                                    };
                                    package: string | Uint8Array<ArrayBufferLike>;
                                    ticket: import("@mysten/bcs").EnumInputShape<{
                                        GasCoin: boolean | object | null;
                                        Input: number;
                                        Result: number;
                                        NestedResult: readonly [number, number];
                                    }>;
                                };
                            }>> & {
                                length: number;
                            }, string>;
                        }, string>;
                        ChangeEpoch: null;
                        Genesis: null;
                        ConsensusCommitPrologue: null;
                    }, "TransactionKind">;
                    sender: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                    gasData: import("@mysten/bcs").BcsStruct<{
                        payment: import("@mysten/bcs").BcsType<{
                            objectId: string;
                            version: string;
                            digest: string;
                        }[], Iterable<{
                            objectId: string | Uint8Array<ArrayBufferLike>;
                            version: string | number | bigint;
                            digest: string;
                        }> & {
                            length: number;
                        }, string>;
                        owner: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                        price: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                        budget: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                    }, string>;
                    expiration: import("@mysten/bcs").BcsEnum<{
                        None: null;
                        Epoch: import("@mysten/bcs").BcsType<number, string | number, "u64">;
                    }, "TransactionExpiration">;
                }, string>;
            }, "TransactionData">;
        }, string>;
        txSignatures: import("@mysten/bcs").BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
            length: number;
        }, string>;
    }, string>;
    SharedObjectRef: import("@mysten/bcs").BcsStruct<{
        objectId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        initialSharedVersion: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
        mutable: import("@mysten/bcs").BcsType<boolean, boolean, "bool">;
    }, string>;
    StructTag: import("@mysten/bcs").BcsStruct<{
        address: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        module: import("@mysten/bcs").BcsType<string, string, "string">;
        name: import("@mysten/bcs").BcsType<string, string, "string">;
        typeParams: import("@mysten/bcs").BcsType<import("./types.js").TypeTag[], Iterable<import("./types.js").TypeTag> & {
            length: number;
        }, string>;
    }, string>;
    SuiObjectRef: import("@mysten/bcs").BcsStruct<{
        objectId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        version: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
        digest: import("@mysten/bcs").BcsType<string, string, "ObjectDigest">;
    }, string>;
    TransactionData: import("@mysten/bcs").BcsEnum<{
        V1: import("@mysten/bcs").BcsStruct<{
            kind: import("@mysten/bcs").BcsEnum<{
                ProgrammableTransaction: import("@mysten/bcs").BcsStruct<{
                    inputs: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        Pure: {
                            bytes: string;
                        };
                        Object: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                            ImmOrOwnedObject: {
                                objectId: string;
                                version: string;
                                digest: string;
                            };
                            SharedObject: {
                                objectId: string;
                                initialSharedVersion: string;
                                mutable: boolean;
                            };
                            Receiving: {
                                objectId: string;
                                version: string;
                                digest: string;
                            };
                        }, "ImmOrOwnedObject" | "SharedObject" | "Receiving">;
                    }, "Pure" | "Object">[], Iterable<import("@mysten/bcs").EnumInputShape<{
                        Pure: {
                            bytes: string | Uint8Array<ArrayBufferLike>;
                        };
                        Object: import("@mysten/bcs").EnumInputShape<{
                            ImmOrOwnedObject: {
                                objectId: string | Uint8Array<ArrayBufferLike>;
                                version: string | number | bigint;
                                digest: string;
                            };
                            SharedObject: {
                                objectId: string | Uint8Array<ArrayBufferLike>;
                                initialSharedVersion: string | number | bigint;
                                mutable: boolean;
                            };
                            Receiving: {
                                objectId: string | Uint8Array<ArrayBufferLike>;
                                version: string | number | bigint;
                                digest: string;
                            };
                        }>;
                    }>> & {
                        length: number;
                    }, string>;
                    commands: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        MoveCall: {
                            package: string;
                            module: string;
                            function: string;
                            typeArguments: string[];
                            arguments: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                GasCoin: true;
                                Input: number;
                                Result: number;
                                NestedResult: [number, number];
                            }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                        };
                        TransferObjects: {
                            objects: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                GasCoin: true;
                                Input: number;
                                Result: number;
                                NestedResult: [number, number];
                            }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                            address: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                GasCoin: true;
                                Input: number;
                                Result: number;
                                NestedResult: [number, number];
                            }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                        };
                        SplitCoins: {
                            coin: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                GasCoin: true;
                                Input: number;
                                Result: number;
                                NestedResult: [number, number];
                            }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                            amounts: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                GasCoin: true;
                                Input: number;
                                Result: number;
                                NestedResult: [number, number];
                            }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                        };
                        MergeCoins: {
                            destination: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                GasCoin: true;
                                Input: number;
                                Result: number;
                                NestedResult: [number, number];
                            }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                            sources: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                GasCoin: true;
                                Input: number;
                                Result: number;
                                NestedResult: [number, number];
                            }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                        };
                        Publish: {
                            modules: string[];
                            dependencies: string[];
                        };
                        MakeMoveVec: {
                            type: string | null;
                            elements: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                GasCoin: true;
                                Input: number;
                                Result: number;
                                NestedResult: [number, number];
                            }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                        };
                        Upgrade: {
                            modules: string[];
                            dependencies: string[];
                            package: string;
                            ticket: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                                GasCoin: true;
                                Input: number;
                                Result: number;
                                NestedResult: [number, number];
                            }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                        };
                    }, "MoveCall" | "TransferObjects" | "SplitCoins" | "MergeCoins" | "Publish" | "MakeMoveVec" | "Upgrade">[], Iterable<import("@mysten/bcs").EnumInputShape<{
                        MoveCall: {
                            package: string | Uint8Array<ArrayBufferLike>;
                            module: string;
                            function: string;
                            typeArguments: Iterable<string | import("./types.js").TypeTag> & {
                                length: number;
                            };
                            arguments: Iterable<import("@mysten/bcs").EnumInputShape<{
                                GasCoin: boolean | object | null;
                                Input: number;
                                Result: number;
                                NestedResult: readonly [number, number];
                            }>> & {
                                length: number;
                            };
                        };
                        TransferObjects: {
                            objects: Iterable<import("@mysten/bcs").EnumInputShape<{
                                GasCoin: boolean | object | null;
                                Input: number;
                                Result: number;
                                NestedResult: readonly [number, number];
                            }>> & {
                                length: number;
                            };
                            address: import("@mysten/bcs").EnumInputShape<{
                                GasCoin: boolean | object | null;
                                Input: number;
                                Result: number;
                                NestedResult: readonly [number, number];
                            }>;
                        };
                        SplitCoins: {
                            coin: import("@mysten/bcs").EnumInputShape<{
                                GasCoin: boolean | object | null;
                                Input: number;
                                Result: number;
                                NestedResult: readonly [number, number];
                            }>;
                            amounts: Iterable<import("@mysten/bcs").EnumInputShape<{
                                GasCoin: boolean | object | null;
                                Input: number;
                                Result: number;
                                NestedResult: readonly [number, number];
                            }>> & {
                                length: number;
                            };
                        };
                        MergeCoins: {
                            destination: import("@mysten/bcs").EnumInputShape<{
                                GasCoin: boolean | object | null;
                                Input: number;
                                Result: number;
                                NestedResult: readonly [number, number];
                            }>;
                            sources: Iterable<import("@mysten/bcs").EnumInputShape<{
                                GasCoin: boolean | object | null;
                                Input: number;
                                Result: number;
                                NestedResult: readonly [number, number];
                            }>> & {
                                length: number;
                            };
                        };
                        Publish: {
                            modules: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                                length: number;
                            };
                            dependencies: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                                length: number;
                            };
                        };
                        MakeMoveVec: {
                            type: string | null;
                            elements: Iterable<import("@mysten/bcs").EnumInputShape<{
                                GasCoin: boolean | object | null;
                                Input: number;
                                Result: number;
                                NestedResult: readonly [number, number];
                            }>> & {
                                length: number;
                            };
                        };
                        Upgrade: {
                            modules: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                                length: number;
                            };
                            dependencies: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                                length: number;
                            };
                            package: string | Uint8Array<ArrayBufferLike>;
                            ticket: import("@mysten/bcs").EnumInputShape<{
                                GasCoin: boolean | object | null;
                                Input: number;
                                Result: number;
                                NestedResult: readonly [number, number];
                            }>;
                        };
                    }>> & {
                        length: number;
                    }, string>;
                }, string>;
                ChangeEpoch: null;
                Genesis: null;
                ConsensusCommitPrologue: null;
            }, "TransactionKind">;
            sender: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
            gasData: import("@mysten/bcs").BcsStruct<{
                payment: import("@mysten/bcs").BcsType<{
                    objectId: string;
                    version: string;
                    digest: string;
                }[], Iterable<{
                    objectId: string | Uint8Array<ArrayBufferLike>;
                    version: string | number | bigint;
                    digest: string;
                }> & {
                    length: number;
                }, string>;
                owner: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                price: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                budget: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
            }, string>;
            expiration: import("@mysten/bcs").BcsEnum<{
                None: null;
                Epoch: import("@mysten/bcs").BcsType<number, string | number, "u64">;
            }, "TransactionExpiration">;
        }, string>;
    }, "TransactionData">;
    TransactionDataV1: import("@mysten/bcs").BcsStruct<{
        kind: import("@mysten/bcs").BcsEnum<{
            ProgrammableTransaction: import("@mysten/bcs").BcsStruct<{
                inputs: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    Pure: {
                        bytes: string;
                    };
                    Object: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        ImmOrOwnedObject: {
                            objectId: string;
                            version: string;
                            digest: string;
                        };
                        SharedObject: {
                            objectId: string;
                            initialSharedVersion: string;
                            mutable: boolean;
                        };
                        Receiving: {
                            objectId: string;
                            version: string;
                            digest: string;
                        };
                    }, "ImmOrOwnedObject" | "SharedObject" | "Receiving">;
                }, "Pure" | "Object">[], Iterable<import("@mysten/bcs").EnumInputShape<{
                    Pure: {
                        bytes: string | Uint8Array<ArrayBufferLike>;
                    };
                    Object: import("@mysten/bcs").EnumInputShape<{
                        ImmOrOwnedObject: {
                            objectId: string | Uint8Array<ArrayBufferLike>;
                            version: string | number | bigint;
                            digest: string;
                        };
                        SharedObject: {
                            objectId: string | Uint8Array<ArrayBufferLike>;
                            initialSharedVersion: string | number | bigint;
                            mutable: boolean;
                        };
                        Receiving: {
                            objectId: string | Uint8Array<ArrayBufferLike>;
                            version: string | number | bigint;
                            digest: string;
                        };
                    }>;
                }>> & {
                    length: number;
                }, string>;
                commands: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    MoveCall: {
                        package: string;
                        module: string;
                        function: string;
                        typeArguments: string[];
                        arguments: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                            GasCoin: true;
                            Input: number;
                            Result: number;
                            NestedResult: [number, number];
                        }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                    };
                    TransferObjects: {
                        objects: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                            GasCoin: true;
                            Input: number;
                            Result: number;
                            NestedResult: [number, number];
                        }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                        address: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                            GasCoin: true;
                            Input: number;
                            Result: number;
                            NestedResult: [number, number];
                        }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                    };
                    SplitCoins: {
                        coin: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                            GasCoin: true;
                            Input: number;
                            Result: number;
                            NestedResult: [number, number];
                        }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                        amounts: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                            GasCoin: true;
                            Input: number;
                            Result: number;
                            NestedResult: [number, number];
                        }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                    };
                    MergeCoins: {
                        destination: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                            GasCoin: true;
                            Input: number;
                            Result: number;
                            NestedResult: [number, number];
                        }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                        sources: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                            GasCoin: true;
                            Input: number;
                            Result: number;
                            NestedResult: [number, number];
                        }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                    };
                    Publish: {
                        modules: string[];
                        dependencies: string[];
                    };
                    MakeMoveVec: {
                        type: string | null;
                        elements: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                            GasCoin: true;
                            Input: number;
                            Result: number;
                            NestedResult: [number, number];
                        }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                    };
                    Upgrade: {
                        modules: string[];
                        dependencies: string[];
                        package: string;
                        ticket: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                            GasCoin: true;
                            Input: number;
                            Result: number;
                            NestedResult: [number, number];
                        }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                    };
                }, "MoveCall" | "TransferObjects" | "SplitCoins" | "MergeCoins" | "Publish" | "MakeMoveVec" | "Upgrade">[], Iterable<import("@mysten/bcs").EnumInputShape<{
                    MoveCall: {
                        package: string | Uint8Array<ArrayBufferLike>;
                        module: string;
                        function: string;
                        typeArguments: Iterable<string | import("./types.js").TypeTag> & {
                            length: number;
                        };
                        arguments: Iterable<import("@mysten/bcs").EnumInputShape<{
                            GasCoin: boolean | object | null;
                            Input: number;
                            Result: number;
                            NestedResult: readonly [number, number];
                        }>> & {
                            length: number;
                        };
                    };
                    TransferObjects: {
                        objects: Iterable<import("@mysten/bcs").EnumInputShape<{
                            GasCoin: boolean | object | null;
                            Input: number;
                            Result: number;
                            NestedResult: readonly [number, number];
                        }>> & {
                            length: number;
                        };
                        address: import("@mysten/bcs").EnumInputShape<{
                            GasCoin: boolean | object | null;
                            Input: number;
                            Result: number;
                            NestedResult: readonly [number, number];
                        }>;
                    };
                    SplitCoins: {
                        coin: import("@mysten/bcs").EnumInputShape<{
                            GasCoin: boolean | object | null;
                            Input: number;
                            Result: number;
                            NestedResult: readonly [number, number];
                        }>;
                        amounts: Iterable<import("@mysten/bcs").EnumInputShape<{
                            GasCoin: boolean | object | null;
                            Input: number;
                            Result: number;
                            NestedResult: readonly [number, number];
                        }>> & {
                            length: number;
                        };
                    };
                    MergeCoins: {
                        destination: import("@mysten/bcs").EnumInputShape<{
                            GasCoin: boolean | object | null;
                            Input: number;
                            Result: number;
                            NestedResult: readonly [number, number];
                        }>;
                        sources: Iterable<import("@mysten/bcs").EnumInputShape<{
                            GasCoin: boolean | object | null;
                            Input: number;
                            Result: number;
                            NestedResult: readonly [number, number];
                        }>> & {
                            length: number;
                        };
                    };
                    Publish: {
                        modules: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                            length: number;
                        };
                        dependencies: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                            length: number;
                        };
                    };
                    MakeMoveVec: {
                        type: string | null;
                        elements: Iterable<import("@mysten/bcs").EnumInputShape<{
                            GasCoin: boolean | object | null;
                            Input: number;
                            Result: number;
                            NestedResult: readonly [number, number];
                        }>> & {
                            length: number;
                        };
                    };
                    Upgrade: {
                        modules: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                            length: number;
                        };
                        dependencies: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                            length: number;
                        };
                        package: string | Uint8Array<ArrayBufferLike>;
                        ticket: import("@mysten/bcs").EnumInputShape<{
                            GasCoin: boolean | object | null;
                            Input: number;
                            Result: number;
                            NestedResult: readonly [number, number];
                        }>;
                    };
                }>> & {
                    length: number;
                }, string>;
            }, string>;
            ChangeEpoch: null;
            Genesis: null;
            ConsensusCommitPrologue: null;
        }, "TransactionKind">;
        sender: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        gasData: import("@mysten/bcs").BcsStruct<{
            payment: import("@mysten/bcs").BcsType<{
                objectId: string;
                version: string;
                digest: string;
            }[], Iterable<{
                objectId: string | Uint8Array<ArrayBufferLike>;
                version: string | number | bigint;
                digest: string;
            }> & {
                length: number;
            }, string>;
            owner: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
            price: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
            budget: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
        }, string>;
        expiration: import("@mysten/bcs").BcsEnum<{
            None: null;
            Epoch: import("@mysten/bcs").BcsType<number, string | number, "u64">;
        }, "TransactionExpiration">;
    }, string>;
    TransactionEffects: import("@mysten/bcs").BcsEnum<{
        V1: import("@mysten/bcs").BcsStruct<{
            status: import("@mysten/bcs").BcsEnum<{
                Success: null;
                Failed: import("@mysten/bcs").BcsStruct<{
                    error: import("@mysten/bcs").BcsEnum<{
                        InsufficientGas: null;
                        InvalidGasObject: null;
                        InvariantViolation: null;
                        FeatureNotYetSupported: null;
                        MoveObjectTooBig: import("@mysten/bcs").BcsStruct<{
                            objectSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                            maxObjectSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                        }, string>;
                        MovePackageTooBig: import("@mysten/bcs").BcsStruct<{
                            objectSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                            maxObjectSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                        }, string>;
                        CircularObjectOwnership: import("@mysten/bcs").BcsStruct<{
                            object: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                        }, string>;
                        InsufficientCoinBalance: null;
                        CoinBalanceOverflow: null;
                        PublishErrorNonZeroAddress: null;
                        SuiMoveVerificationError: null;
                        MovePrimitiveRuntimeError: import("@mysten/bcs").BcsType<{
                            module: {
                                address: string;
                                name: string;
                            };
                            function: number;
                            instruction: number;
                            functionName: string | null;
                        } | null, {
                            module: {
                                address: string | Uint8Array<ArrayBufferLike>;
                                name: string;
                            };
                            function: number;
                            instruction: number;
                            functionName: string | null | undefined;
                        } | null | undefined, `Option<${string}>`>;
                        MoveAbort: import("@mysten/bcs").BcsTuple<readonly [import("@mysten/bcs").BcsStruct<{
                            module: import("@mysten/bcs").BcsStruct<{
                                address: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                                name: import("@mysten/bcs").BcsType<string, string, "string">;
                            }, string>;
                            function: import("@mysten/bcs").BcsType<number, number, "u16">;
                            instruction: import("@mysten/bcs").BcsType<number, number, "u16">;
                            functionName: import("@mysten/bcs").BcsType<string | null, string | null | undefined, "Option<string>">;
                        }, string>, import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">], string>;
                        VMVerificationOrDeserializationError: null;
                        VMInvariantViolation: null;
                        FunctionNotFound: null;
                        ArityMismatch: null;
                        TypeArityMismatch: null;
                        NonEntryFunctionInvoked: null;
                        CommandArgumentError: import("@mysten/bcs").BcsStruct<{
                            argIdx: import("@mysten/bcs").BcsType<number, number, "u16">;
                            kind: import("@mysten/bcs").BcsEnum<{
                                TypeMismatch: null;
                                InvalidBCSBytes: null;
                                InvalidUsageOfPureArg: null;
                                InvalidArgumentToPrivateEntryFunction: null;
                                IndexOutOfBounds: import("@mysten/bcs").BcsStruct<{
                                    idx: import("@mysten/bcs").BcsType<number, number, "u16">;
                                }, string>;
                                SecondaryIndexOutOfBounds: import("@mysten/bcs").BcsStruct<{
                                    resultIdx: import("@mysten/bcs").BcsType<number, number, "u16">;
                                    secondaryIdx: import("@mysten/bcs").BcsType<number, number, "u16">;
                                }, string>;
                                InvalidResultArity: import("@mysten/bcs").BcsStruct<{
                                    resultIdx: import("@mysten/bcs").BcsType<number, number, "u16">;
                                }, string>;
                                InvalidGasCoinUsage: null;
                                InvalidValueUsage: null;
                                InvalidObjectByValue: null;
                                InvalidObjectByMutRef: null;
                                SharedObjectOperationNotAllowed: null;
                            }, "CommandArgumentError">;
                        }, string>;
                        TypeArgumentError: import("@mysten/bcs").BcsStruct<{
                            argumentIdx: import("@mysten/bcs").BcsType<number, number, "u16">;
                            kind: import("@mysten/bcs").BcsEnum<{
                                TypeNotFound: null;
                                ConstraintNotSatisfied: null;
                            }, "TypeArgumentError">;
                        }, string>;
                        UnusedValueWithoutDrop: import("@mysten/bcs").BcsStruct<{
                            resultIdx: import("@mysten/bcs").BcsType<number, number, "u16">;
                            secondaryIdx: import("@mysten/bcs").BcsType<number, number, "u16">;
                        }, string>;
                        InvalidPublicFunctionReturnType: import("@mysten/bcs").BcsStruct<{
                            idx: import("@mysten/bcs").BcsType<number, number, "u16">;
                        }, string>;
                        InvalidTransferObject: null;
                        EffectsTooLarge: import("@mysten/bcs").BcsStruct<{
                            currentSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                            maxSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                        }, string>;
                        PublishUpgradeMissingDependency: null;
                        PublishUpgradeDependencyDowngrade: null;
                        PackageUpgradeError: import("@mysten/bcs").BcsStruct<{
                            upgradeError: import("@mysten/bcs").BcsEnum<{
                                UnableToFetchPackage: import("@mysten/bcs").BcsStruct<{
                                    packageId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                                }, string>;
                                NotAPackage: import("@mysten/bcs").BcsStruct<{
                                    objectId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                                }, string>;
                                IncompatibleUpgrade: null;
                                DigestDoesNotMatch: import("@mysten/bcs").BcsStruct<{
                                    digest: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
                                }, string>;
                                UnknownUpgradePolicy: import("@mysten/bcs").BcsStruct<{
                                    policy: import("@mysten/bcs").BcsType<number, number, "u8">;
                                }, string>;
                                PackageIDDoesNotMatch: import("@mysten/bcs").BcsStruct<{
                                    packageId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                                    ticketId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                                }, string>;
                            }, "PackageUpgradeError">;
                        }, string>;
                        WrittenObjectsTooLarge: import("@mysten/bcs").BcsStruct<{
                            currentSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                            maxSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                        }, string>;
                        CertificateDenied: null;
                        SuiMoveVerificationTimedout: null;
                        SharedObjectOperationNotAllowed: null;
                        InputObjectDeleted: null;
                        ExecutionCancelledDueToSharedObjectCongestion: import("@mysten/bcs").BcsStruct<{
                            congestedObjects: import("@mysten/bcs").BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
                                length: number;
                            }, string>;
                        }, string>;
                        AddressDeniedForCoin: import("@mysten/bcs").BcsStruct<{
                            address: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                            coinType: import("@mysten/bcs").BcsType<string, string, "string">;
                        }, string>;
                        CoinTypeGlobalPause: import("@mysten/bcs").BcsStruct<{
                            coinType: import("@mysten/bcs").BcsType<string, string, "string">;
                        }, string>;
                        ExecutionCancelledDueToRandomnessUnavailable: null;
                    }, "ExecutionFailureStatus">;
                    command: import("@mysten/bcs").BcsType<string | null, string | number | bigint | null | undefined, "Option<u64>">;
                }, string>;
            }, "ExecutionStatus">;
            executedEpoch: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
            gasUsed: import("@mysten/bcs").BcsStruct<{
                computationCost: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                storageCost: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                storageRebate: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                nonRefundableStorageFee: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
            }, string>;
            modifiedAtVersions: import("@mysten/bcs").BcsType<[string, string][], Iterable<readonly [string | Uint8Array<ArrayBufferLike>, string | number | bigint]> & {
                length: number;
            }, string>;
            sharedObjects: import("@mysten/bcs").BcsType<{
                objectId: string;
                version: string;
                digest: string;
            }[], Iterable<{
                objectId: string | Uint8Array<ArrayBufferLike>;
                version: string | number | bigint;
                digest: string;
            }> & {
                length: number;
            }, string>;
            transactionDigest: import("@mysten/bcs").BcsType<string, string, "ObjectDigest">;
            created: import("@mysten/bcs").BcsType<[{
                objectId: string;
                version: string;
                digest: string;
            }, import("@mysten/bcs").EnumOutputShapeWithKeys<{
                AddressOwner: string;
                ObjectOwner: string;
                Shared: {
                    initialSharedVersion: string;
                };
                Immutable: true;
                ConsensusAddressOwner: {
                    owner: string;
                    startVersion: string;
                };
            }, "AddressOwner" | "ObjectOwner" | "Shared" | "Immutable" | "ConsensusAddressOwner">][], Iterable<readonly [{
                objectId: string | Uint8Array<ArrayBufferLike>;
                version: string | number | bigint;
                digest: string;
            }, import("@mysten/bcs").EnumInputShape<{
                AddressOwner: string | Uint8Array<ArrayBufferLike>;
                ObjectOwner: string | Uint8Array<ArrayBufferLike>;
                Shared: {
                    initialSharedVersion: string | number | bigint;
                };
                Immutable: boolean | object | null;
                ConsensusAddressOwner: {
                    owner: string | Uint8Array<ArrayBufferLike>;
                    startVersion: string | number | bigint;
                };
            }>]> & {
                length: number;
            }, string>;
            mutated: import("@mysten/bcs").BcsType<[{
                objectId: string;
                version: string;
                digest: string;
            }, import("@mysten/bcs").EnumOutputShapeWithKeys<{
                AddressOwner: string;
                ObjectOwner: string;
                Shared: {
                    initialSharedVersion: string;
                };
                Immutable: true;
                ConsensusAddressOwner: {
                    owner: string;
                    startVersion: string;
                };
            }, "AddressOwner" | "ObjectOwner" | "Shared" | "Immutable" | "ConsensusAddressOwner">][], Iterable<readonly [{
                objectId: string | Uint8Array<ArrayBufferLike>;
                version: string | number | bigint;
                digest: string;
            }, import("@mysten/bcs").EnumInputShape<{
                AddressOwner: string | Uint8Array<ArrayBufferLike>;
                ObjectOwner: string | Uint8Array<ArrayBufferLike>;
                Shared: {
                    initialSharedVersion: string | number | bigint;
                };
                Immutable: boolean | object | null;
                ConsensusAddressOwner: {
                    owner: string | Uint8Array<ArrayBufferLike>;
                    startVersion: string | number | bigint;
                };
            }>]> & {
                length: number;
            }, string>;
            unwrapped: import("@mysten/bcs").BcsType<[{
                objectId: string;
                version: string;
                digest: string;
            }, import("@mysten/bcs").EnumOutputShapeWithKeys<{
                AddressOwner: string;
                ObjectOwner: string;
                Shared: {
                    initialSharedVersion: string;
                };
                Immutable: true;
                ConsensusAddressOwner: {
                    owner: string;
                    startVersion: string;
                };
            }, "AddressOwner" | "ObjectOwner" | "Shared" | "Immutable" | "ConsensusAddressOwner">][], Iterable<readonly [{
                objectId: string | Uint8Array<ArrayBufferLike>;
                version: string | number | bigint;
                digest: string;
            }, import("@mysten/bcs").EnumInputShape<{
                AddressOwner: string | Uint8Array<ArrayBufferLike>;
                ObjectOwner: string | Uint8Array<ArrayBufferLike>;
                Shared: {
                    initialSharedVersion: string | number | bigint;
                };
                Immutable: boolean | object | null;
                ConsensusAddressOwner: {
                    owner: string | Uint8Array<ArrayBufferLike>;
                    startVersion: string | number | bigint;
                };
            }>]> & {
                length: number;
            }, string>;
            deleted: import("@mysten/bcs").BcsType<{
                objectId: string;
                version: string;
                digest: string;
            }[], Iterable<{
                objectId: string | Uint8Array<ArrayBufferLike>;
                version: string | number | bigint;
                digest: string;
            }> & {
                length: number;
            }, string>;
            unwrappedThenDeleted: import("@mysten/bcs").BcsType<{
                objectId: string;
                version: string;
                digest: string;
            }[], Iterable<{
                objectId: string | Uint8Array<ArrayBufferLike>;
                version: string | number | bigint;
                digest: string;
            }> & {
                length: number;
            }, string>;
            wrapped: import("@mysten/bcs").BcsType<{
                objectId: string;
                version: string;
                digest: string;
            }[], Iterable<{
                objectId: string | Uint8Array<ArrayBufferLike>;
                version: string | number | bigint;
                digest: string;
            }> & {
                length: number;
            }, string>;
            gasObject: import("@mysten/bcs").BcsTuple<readonly [import("@mysten/bcs").BcsStruct<{
                objectId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                version: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                digest: import("@mysten/bcs").BcsType<string, string, "ObjectDigest">;
            }, string>, import("@mysten/bcs").BcsEnum<{
                AddressOwner: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                ObjectOwner: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                Shared: import("@mysten/bcs").BcsStruct<{
                    initialSharedVersion: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                }, string>;
                Immutable: null;
                ConsensusAddressOwner: import("@mysten/bcs").BcsStruct<{
                    owner: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                    startVersion: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                }, string>;
            }, "Owner">], string>;
            eventsDigest: import("@mysten/bcs").BcsType<string | null, string | null | undefined, "Option<ObjectDigest>">;
            dependencies: import("@mysten/bcs").BcsType<string[], Iterable<string> & {
                length: number;
            }, string>;
        }, string>;
        V2: import("@mysten/bcs").BcsStruct<{
            status: import("@mysten/bcs").BcsEnum<{
                Success: null;
                Failed: import("@mysten/bcs").BcsStruct<{
                    error: import("@mysten/bcs").BcsEnum<{
                        InsufficientGas: null;
                        InvalidGasObject: null;
                        InvariantViolation: null;
                        FeatureNotYetSupported: null;
                        MoveObjectTooBig: import("@mysten/bcs").BcsStruct<{
                            objectSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                            maxObjectSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                        }, string>;
                        MovePackageTooBig: import("@mysten/bcs").BcsStruct<{
                            objectSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                            maxObjectSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                        }, string>;
                        CircularObjectOwnership: import("@mysten/bcs").BcsStruct<{
                            object: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                        }, string>;
                        InsufficientCoinBalance: null;
                        CoinBalanceOverflow: null;
                        PublishErrorNonZeroAddress: null;
                        SuiMoveVerificationError: null;
                        MovePrimitiveRuntimeError: import("@mysten/bcs").BcsType<{
                            module: {
                                address: string;
                                name: string;
                            };
                            function: number;
                            instruction: number;
                            functionName: string | null;
                        } | null, {
                            module: {
                                address: string | Uint8Array<ArrayBufferLike>;
                                name: string;
                            };
                            function: number;
                            instruction: number;
                            functionName: string | null | undefined;
                        } | null | undefined, `Option<${string}>`>;
                        MoveAbort: import("@mysten/bcs").BcsTuple<readonly [import("@mysten/bcs").BcsStruct<{
                            module: import("@mysten/bcs").BcsStruct<{
                                address: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                                name: import("@mysten/bcs").BcsType<string, string, "string">;
                            }, string>;
                            function: import("@mysten/bcs").BcsType<number, number, "u16">;
                            instruction: import("@mysten/bcs").BcsType<number, number, "u16">;
                            functionName: import("@mysten/bcs").BcsType<string | null, string | null | undefined, "Option<string>">;
                        }, string>, import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">], string>;
                        VMVerificationOrDeserializationError: null;
                        VMInvariantViolation: null;
                        FunctionNotFound: null;
                        ArityMismatch: null;
                        TypeArityMismatch: null;
                        NonEntryFunctionInvoked: null;
                        CommandArgumentError: import("@mysten/bcs").BcsStruct<{
                            argIdx: import("@mysten/bcs").BcsType<number, number, "u16">;
                            kind: import("@mysten/bcs").BcsEnum<{
                                TypeMismatch: null;
                                InvalidBCSBytes: null;
                                InvalidUsageOfPureArg: null;
                                InvalidArgumentToPrivateEntryFunction: null;
                                IndexOutOfBounds: import("@mysten/bcs").BcsStruct<{
                                    idx: import("@mysten/bcs").BcsType<number, number, "u16">;
                                }, string>;
                                SecondaryIndexOutOfBounds: import("@mysten/bcs").BcsStruct<{
                                    resultIdx: import("@mysten/bcs").BcsType<number, number, "u16">;
                                    secondaryIdx: import("@mysten/bcs").BcsType<number, number, "u16">;
                                }, string>;
                                InvalidResultArity: import("@mysten/bcs").BcsStruct<{
                                    resultIdx: import("@mysten/bcs").BcsType<number, number, "u16">;
                                }, string>;
                                InvalidGasCoinUsage: null;
                                InvalidValueUsage: null;
                                InvalidObjectByValue: null;
                                InvalidObjectByMutRef: null;
                                SharedObjectOperationNotAllowed: null;
                            }, "CommandArgumentError">;
                        }, string>;
                        TypeArgumentError: import("@mysten/bcs").BcsStruct<{
                            argumentIdx: import("@mysten/bcs").BcsType<number, number, "u16">;
                            kind: import("@mysten/bcs").BcsEnum<{
                                TypeNotFound: null;
                                ConstraintNotSatisfied: null;
                            }, "TypeArgumentError">;
                        }, string>;
                        UnusedValueWithoutDrop: import("@mysten/bcs").BcsStruct<{
                            resultIdx: import("@mysten/bcs").BcsType<number, number, "u16">;
                            secondaryIdx: import("@mysten/bcs").BcsType<number, number, "u16">;
                        }, string>;
                        InvalidPublicFunctionReturnType: import("@mysten/bcs").BcsStruct<{
                            idx: import("@mysten/bcs").BcsType<number, number, "u16">;
                        }, string>;
                        InvalidTransferObject: null;
                        EffectsTooLarge: import("@mysten/bcs").BcsStruct<{
                            currentSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                            maxSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                        }, string>;
                        PublishUpgradeMissingDependency: null;
                        PublishUpgradeDependencyDowngrade: null;
                        PackageUpgradeError: import("@mysten/bcs").BcsStruct<{
                            upgradeError: import("@mysten/bcs").BcsEnum<{
                                UnableToFetchPackage: import("@mysten/bcs").BcsStruct<{
                                    packageId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                                }, string>;
                                NotAPackage: import("@mysten/bcs").BcsStruct<{
                                    objectId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                                }, string>;
                                IncompatibleUpgrade: null;
                                DigestDoesNotMatch: import("@mysten/bcs").BcsStruct<{
                                    digest: import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
                                }, string>;
                                UnknownUpgradePolicy: import("@mysten/bcs").BcsStruct<{
                                    policy: import("@mysten/bcs").BcsType<number, number, "u8">;
                                }, string>;
                                PackageIDDoesNotMatch: import("@mysten/bcs").BcsStruct<{
                                    packageId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                                    ticketId: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                                }, string>;
                            }, "PackageUpgradeError">;
                        }, string>;
                        WrittenObjectsTooLarge: import("@mysten/bcs").BcsStruct<{
                            currentSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                            maxSize: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                        }, string>;
                        CertificateDenied: null;
                        SuiMoveVerificationTimedout: null;
                        SharedObjectOperationNotAllowed: null;
                        InputObjectDeleted: null;
                        ExecutionCancelledDueToSharedObjectCongestion: import("@mysten/bcs").BcsStruct<{
                            congestedObjects: import("@mysten/bcs").BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
                                length: number;
                            }, string>;
                        }, string>;
                        AddressDeniedForCoin: import("@mysten/bcs").BcsStruct<{
                            address: import("@mysten/bcs").BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                            coinType: import("@mysten/bcs").BcsType<string, string, "string">;
                        }, string>;
                        CoinTypeGlobalPause: import("@mysten/bcs").BcsStruct<{
                            coinType: import("@mysten/bcs").BcsType<string, string, "string">;
                        }, string>;
                        ExecutionCancelledDueToRandomnessUnavailable: null;
                    }, "ExecutionFailureStatus">;
                    command: import("@mysten/bcs").BcsType<string | null, string | number | bigint | null | undefined, "Option<u64>">;
                }, string>;
            }, "ExecutionStatus">;
            executedEpoch: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
            gasUsed: import("@mysten/bcs").BcsStruct<{
                computationCost: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                storageCost: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                storageRebate: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
                nonRefundableStorageFee: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
            }, string>;
            transactionDigest: import("@mysten/bcs").BcsType<string, string, "ObjectDigest">;
            gasObjectIndex: import("@mysten/bcs").BcsType<number | null, number | null | undefined, "Option<u32>">;
            eventsDigest: import("@mysten/bcs").BcsType<string | null, string | null | undefined, "Option<ObjectDigest>">;
            dependencies: import("@mysten/bcs").BcsType<string[], Iterable<string> & {
                length: number;
            }, string>;
            lamportVersion: import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
            changedObjects: import("@mysten/bcs").BcsType<[string, {
                inputState: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    NotExist: true;
                    Exist: [[string, string], import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        AddressOwner: string;
                        ObjectOwner: string;
                        Shared: {
                            initialSharedVersion: string;
                        };
                        Immutable: true;
                        ConsensusAddressOwner: {
                            owner: string;
                            startVersion: string;
                        };
                    }, "AddressOwner" | "ObjectOwner" | "Shared" | "Immutable" | "ConsensusAddressOwner">];
                }, "NotExist" | "Exist">;
                outputState: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    NotExist: true;
                    ObjectWrite: [string, import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        AddressOwner: string;
                        ObjectOwner: string;
                        Shared: {
                            initialSharedVersion: string;
                        };
                        Immutable: true;
                        ConsensusAddressOwner: {
                            owner: string;
                            startVersion: string;
                        };
                    }, "AddressOwner" | "ObjectOwner" | "Shared" | "Immutable" | "ConsensusAddressOwner">];
                    PackageWrite: [string, string];
                }, "NotExist" | "ObjectWrite" | "PackageWrite">;
                idOperation: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    None: true;
                    Created: true;
                    Deleted: true;
                }, "None" | "Created" | "Deleted">;
            }][], Iterable<readonly [string | Uint8Array<ArrayBufferLike>, {
                inputState: import("@mysten/bcs").EnumInputShape<{
                    NotExist: boolean | object | null;
                    Exist: readonly [readonly [string | number | bigint, string], import("@mysten/bcs").EnumInputShape<{
                        AddressOwner: string | Uint8Array<ArrayBufferLike>;
                        ObjectOwner: string | Uint8Array<ArrayBufferLike>;
                        Shared: {
                            initialSharedVersion: string | number | bigint;
                        };
                        Immutable: boolean | object | null;
                        ConsensusAddressOwner: {
                            owner: string | Uint8Array<ArrayBufferLike>;
                            startVersion: string | number | bigint;
                        };
                    }>];
                }>;
                outputState: import("@mysten/bcs").EnumInputShape<{
                    NotExist: boolean | object | null;
                    ObjectWrite: readonly [string, import("@mysten/bcs").EnumInputShape<{
                        AddressOwner: string | Uint8Array<ArrayBufferLike>;
                        ObjectOwner: string | Uint8Array<ArrayBufferLike>;
                        Shared: {
                            initialSharedVersion: string | number | bigint;
                        };
                        Immutable: boolean | object | null;
                        ConsensusAddressOwner: {
                            owner: string | Uint8Array<ArrayBufferLike>;
                            startVersion: string | number | bigint;
                        };
                    }>];
                    PackageWrite: readonly [string | number | bigint, string];
                }>;
                idOperation: import("@mysten/bcs").EnumInputShape<{
                    None: boolean | object | null;
                    Created: boolean | object | null;
                    Deleted: boolean | object | null;
                }>;
            }]> & {
                length: number;
            }, string>;
            unchangedSharedObjects: import("@mysten/bcs").BcsType<[string, import("@mysten/bcs").EnumOutputShapeWithKeys<{
                ReadOnlyRoot: [string, string];
                MutateDeleted: string;
                ReadDeleted: string;
                Cancelled: string;
                PerEpochConfig: true;
            }, "ReadOnlyRoot" | "MutateDeleted" | "ReadDeleted" | "Cancelled" | "PerEpochConfig">][], Iterable<readonly [string | Uint8Array<ArrayBufferLike>, import("@mysten/bcs").EnumInputShape<{
                ReadOnlyRoot: readonly [string | number | bigint, string];
                MutateDeleted: string | number | bigint;
                ReadDeleted: string | number | bigint;
                Cancelled: string | number | bigint;
                PerEpochConfig: boolean | object | null;
            }>]> & {
                length: number;
            }, string>;
            auxDataDigest: import("@mysten/bcs").BcsType<string | null, string | null | undefined, "Option<ObjectDigest>">;
        }, string>;
    }, "TransactionEffects">;
    TransactionExpiration: import("@mysten/bcs").BcsEnum<{
        None: null;
        Epoch: import("@mysten/bcs").BcsType<number, string | number, "u64">;
    }, "TransactionExpiration">;
    TransactionKind: import("@mysten/bcs").BcsEnum<{
        ProgrammableTransaction: import("@mysten/bcs").BcsStruct<{
            inputs: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
                Pure: {
                    bytes: string;
                };
                Object: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                    ImmOrOwnedObject: {
                        objectId: string;
                        version: string;
                        digest: string;
                    };
                    SharedObject: {
                        objectId: string;
                        initialSharedVersion: string;
                        mutable: boolean;
                    };
                    Receiving: {
                        objectId: string;
                        version: string;
                        digest: string;
                    };
                }, "ImmOrOwnedObject" | "SharedObject" | "Receiving">;
            }, "Pure" | "Object">[], Iterable<import("@mysten/bcs").EnumInputShape<{
                Pure: {
                    bytes: string | Uint8Array<ArrayBufferLike>;
                };
                Object: import("@mysten/bcs").EnumInputShape<{
                    ImmOrOwnedObject: {
                        objectId: string | Uint8Array<ArrayBufferLike>;
                        version: string | number | bigint;
                        digest: string;
                    };
                    SharedObject: {
                        objectId: string | Uint8Array<ArrayBufferLike>;
                        initialSharedVersion: string | number | bigint;
                        mutable: boolean;
                    };
                    Receiving: {
                        objectId: string | Uint8Array<ArrayBufferLike>;
                        version: string | number | bigint;
                        digest: string;
                    };
                }>;
            }>> & {
                length: number;
            }, string>;
            commands: import("@mysten/bcs").BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
                MoveCall: {
                    package: string;
                    module: string;
                    function: string;
                    typeArguments: string[];
                    arguments: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        GasCoin: true;
                        Input: number;
                        Result: number;
                        NestedResult: [number, number];
                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                };
                TransferObjects: {
                    objects: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        GasCoin: true;
                        Input: number;
                        Result: number;
                        NestedResult: [number, number];
                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                    address: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        GasCoin: true;
                        Input: number;
                        Result: number;
                        NestedResult: [number, number];
                    }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                };
                SplitCoins: {
                    coin: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        GasCoin: true;
                        Input: number;
                        Result: number;
                        NestedResult: [number, number];
                    }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                    amounts: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        GasCoin: true;
                        Input: number;
                        Result: number;
                        NestedResult: [number, number];
                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                };
                MergeCoins: {
                    destination: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        GasCoin: true;
                        Input: number;
                        Result: number;
                        NestedResult: [number, number];
                    }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                    sources: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        GasCoin: true;
                        Input: number;
                        Result: number;
                        NestedResult: [number, number];
                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                };
                Publish: {
                    modules: string[];
                    dependencies: string[];
                };
                MakeMoveVec: {
                    type: string | null;
                    elements: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        GasCoin: true;
                        Input: number;
                        Result: number;
                        NestedResult: [number, number];
                    }, "GasCoin" | "Input" | "Result" | "NestedResult">[];
                };
                Upgrade: {
                    modules: string[];
                    dependencies: string[];
                    package: string;
                    ticket: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                        GasCoin: true;
                        Input: number;
                        Result: number;
                        NestedResult: [number, number];
                    }, "GasCoin" | "Input" | "Result" | "NestedResult">;
                };
            }, "MoveCall" | "TransferObjects" | "SplitCoins" | "MergeCoins" | "Publish" | "MakeMoveVec" | "Upgrade">[], Iterable<import("@mysten/bcs").EnumInputShape<{
                MoveCall: {
                    package: string | Uint8Array<ArrayBufferLike>;
                    module: string;
                    function: string;
                    typeArguments: Iterable<string | import("./types.js").TypeTag> & {
                        length: number;
                    };
                    arguments: Iterable<import("@mysten/bcs").EnumInputShape<{
                        GasCoin: boolean | object | null;
                        Input: number;
                        Result: number;
                        NestedResult: readonly [number, number];
                    }>> & {
                        length: number;
                    };
                };
                TransferObjects: {
                    objects: Iterable<import("@mysten/bcs").EnumInputShape<{
                        GasCoin: boolean | object | null;
                        Input: number;
                        Result: number;
                        NestedResult: readonly [number, number];
                    }>> & {
                        length: number;
                    };
                    address: import("@mysten/bcs").EnumInputShape<{
                        GasCoin: boolean | object | null;
                        Input: number;
                        Result: number;
                        NestedResult: readonly [number, number];
                    }>;
                };
                SplitCoins: {
                    coin: import("@mysten/bcs").EnumInputShape<{
                        GasCoin: boolean | object | null;
                        Input: number;
                        Result: number;
                        NestedResult: readonly [number, number];
                    }>;
                    amounts: Iterable<import("@mysten/bcs").EnumInputShape<{
                        GasCoin: boolean | object | null;
                        Input: number;
                        Result: number;
                        NestedResult: readonly [number, number];
                    }>> & {
                        length: number;
                    };
                };
                MergeCoins: {
                    destination: import("@mysten/bcs").EnumInputShape<{
                        GasCoin: boolean | object | null;
                        Input: number;
                        Result: number;
                        NestedResult: readonly [number, number];
                    }>;
                    sources: Iterable<import("@mysten/bcs").EnumInputShape<{
                        GasCoin: boolean | object | null;
                        Input: number;
                        Result: number;
                        NestedResult: readonly [number, number];
                    }>> & {
                        length: number;
                    };
                };
                Publish: {
                    modules: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                        length: number;
                    };
                    dependencies: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                        length: number;
                    };
                };
                MakeMoveVec: {
                    type: string | null;
                    elements: Iterable<import("@mysten/bcs").EnumInputShape<{
                        GasCoin: boolean | object | null;
                        Input: number;
                        Result: number;
                        NestedResult: readonly [number, number];
                    }>> & {
                        length: number;
                    };
                };
                Upgrade: {
                    modules: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                        length: number;
                    };
                    dependencies: Iterable<string | Uint8Array<ArrayBufferLike>> & {
                        length: number;
                    };
                    package: string | Uint8Array<ArrayBufferLike>;
                    ticket: import("@mysten/bcs").EnumInputShape<{
                        GasCoin: boolean | object | null;
                        Input: number;
                        Result: number;
                        NestedResult: readonly [number, number];
                    }>;
                };
            }>> & {
                length: number;
            }, string>;
        }, string>;
        ChangeEpoch: null;
        Genesis: null;
        ConsensusCommitPrologue: null;
    }, "TransactionKind">;
    TypeTag: import("@mysten/bcs").BcsType<string, string | import("./types.js").TypeTag, string>;
    u8(options?: import("@mysten/bcs").BcsTypeOptions<number>): import("@mysten/bcs").BcsType<number, number, "u8">;
    u16(options?: import("@mysten/bcs").BcsTypeOptions<number>): import("@mysten/bcs").BcsType<number, number, "u16">;
    u32(options?: import("@mysten/bcs").BcsTypeOptions<number>): import("@mysten/bcs").BcsType<number, number, "u32">;
    u64(options?: import("@mysten/bcs").BcsTypeOptions<string, number | bigint | string>): import("@mysten/bcs").BcsType<string, string | number | bigint, "u64">;
    u128(options?: import("@mysten/bcs").BcsTypeOptions<string, number | bigint | string>): import("@mysten/bcs").BcsType<string, string | number | bigint, "u128">;
    u256(options?: import("@mysten/bcs").BcsTypeOptions<string, number | bigint | string>): import("@mysten/bcs").BcsType<string, string | number | bigint, "u256">;
    bool(options?: import("@mysten/bcs").BcsTypeOptions<boolean>): import("@mysten/bcs").BcsType<boolean, boolean, "bool">;
    uleb128(options?: import("@mysten/bcs").BcsTypeOptions<number>): import("@mysten/bcs").BcsType<number, number, string>;
    bytes<T extends number>(size: T, options?: import("@mysten/bcs").BcsTypeOptions<Uint8Array, Iterable<number>>): import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, `bytes[${T}]`>;
    byteVector(options?: import("@mysten/bcs").BcsTypeOptions<Uint8Array, Iterable<number>>): import("@mysten/bcs").BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
    string(options?: import("@mysten/bcs").BcsTypeOptions<string>): import("@mysten/bcs").BcsType<string, string, "string">;
    fixedArray: {
        <T extends import("@mysten/bcs").BcsType<any>, Name extends string = string>(size: number, type: T, options?: import("@mysten/bcs").BcsTypeOptions<import("@mysten/bcs").InferBcsType<T>[], Iterable<import("@mysten/bcs").InferBcsInput<T>> & {
            length: number;
        }, Name>): import("@mysten/bcs").BcsType<import("@mysten/bcs").InferBcsType<T>[], Iterable<import("@mysten/bcs").InferBcsInput<T>> & {
            length: number;
        }, Name>;
        <T, Input, Name extends string = string>(size: number, type: import("@mysten/bcs").BcsType<T, Input>, options?: import("@mysten/bcs").BcsTypeOptions<T[], Iterable<Input> & {
            length: number;
        }, Name>): import("@mysten/bcs").BcsType<T[], Iterable<Input> & {
            length: number;
        }, Name>;
    };
    option: {
        <T extends import("@mysten/bcs").BcsType<any>>(type: T): import("@mysten/bcs").BcsType<import("@mysten/bcs").InferBcsType<T> | null, import("@mysten/bcs").InferBcsInput<T> | null | undefined, `Option<${T["name"]}>`>;
        <T, Input, Name extends string = string>(type: import("@mysten/bcs").BcsType<T, Input, Name>): import("@mysten/bcs").BcsType<T | null, Input | null | undefined>;
    };
    vector: {
        <T extends import("@mysten/bcs").BcsType<any>, Name extends string = `vector<${T["name"]}>`>(type: T, options?: import("@mysten/bcs").BcsTypeOptions<import("@mysten/bcs").InferBcsType<T>[], Iterable<import("@mysten/bcs").InferBcsInput<T>> & {
            length: number;
        }, Name>): import("@mysten/bcs").BcsType<import("@mysten/bcs").InferBcsType<T>[], Iterable<import("@mysten/bcs").InferBcsInput<T>> & {
            length: number;
        }, Name>;
        <T, Input, Name extends string = string>(type: import("@mysten/bcs").BcsType<T, Input, Name>, options?: import("@mysten/bcs").BcsTypeOptions<T[], Iterable<Input> & {
            length: number;
        }, `vector<${Name}>`>): import("@mysten/bcs").BcsType<T[], Iterable<Input> & {
            length: number;
        }, `vector<${Name}>`>;
    };
    tuple<const T extends readonly import("@mysten/bcs").BcsType<any, any>[], const Name extends string = `(${import("@mysten/bcs/dist/cjs/types.js").JoinString<{ [K in keyof T]: T[K] extends import("@mysten/bcs").BcsType<any, any, infer T_1 extends string> ? T_1 : never; }, ", ">})`>(fields: T, options?: import("@mysten/bcs").BcsTypeOptions<{ -readonly [K_1 in keyof T]: T[K_1] extends import("@mysten/bcs").BcsType<infer T_1, any> ? T_1 : never; }, { [K_1 in keyof T]: T[K_1] extends import("@mysten/bcs").BcsType<any, infer T_1> ? T_1 : never; }, Name>): import("@mysten/bcs").BcsTuple<T, Name>;
    struct<T extends Record<string, import("@mysten/bcs").BcsType<any>>, const Name extends string = string>(name: Name, fields: T, options?: Omit<import("@mysten/bcs").BcsTypeOptions<{ [K in keyof T]: T[K] extends import("@mysten/bcs").BcsType<infer U, any> ? U : never; }, { [K in keyof T]: T[K] extends import("@mysten/bcs").BcsType<any, infer U> ? U : never; }>, "name">): import("@mysten/bcs").BcsStruct<T, string>;
    enum<T extends Record<string, import("@mysten/bcs").BcsType<any> | null>, const Name extends string = string>(name: Name, fields: T, options?: Omit<import("@mysten/bcs").BcsTypeOptions<import("@mysten/bcs").EnumOutputShape<{ [K in keyof T]: T[K] extends import("@mysten/bcs").BcsType<infer U, any, any> ? U : true; }>, import("@mysten/bcs").EnumInputShape<{ [K in keyof T]: T[K] extends import("@mysten/bcs").BcsType<any, infer U, any> ? U : boolean | object | null; }>, Name>, "name">): import("@mysten/bcs").BcsEnum<T, Name>;
    map: {
        <K extends import("@mysten/bcs").BcsType<any>, V extends import("@mysten/bcs").BcsType<any>>(keyType: K, valueType: V): import("@mysten/bcs").BcsType<Map<import("@mysten/bcs").InferBcsType<K>, import("@mysten/bcs").InferBcsType<V>>, Map<import("@mysten/bcs").InferBcsInput<K>, import("@mysten/bcs").InferBcsInput<V>>, `Map<${K["name"]}, ${V["name"]}>`>;
        <K, V, InputK = K, InputV = V>(keyType: import("@mysten/bcs").BcsType<K, InputK>, valueType: import("@mysten/bcs").BcsType<V, InputV>): import("@mysten/bcs").BcsType<Map<K, V>, Map<InputK, InputV>, `Map<${string}, ${string}>`>;
    };
    lazy<T extends import("@mysten/bcs").BcsType<any>>(cb: () => T): T;
};
export { pureBcsSchemaFromTypeName, type ShapeFromPureTypeName, type PureTypeName, } from './pure.js';
export { suiBcs as bcs };
