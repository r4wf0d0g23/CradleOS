import type { BcsType } from '@mysten/bcs';
import type { TypeTag as TypeTagType } from './types.js';
export declare const Address: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
export declare const ObjectDigest: BcsType<string, string, "ObjectDigest">;
export declare const SuiObjectRef: import("@mysten/bcs").BcsStruct<{
    objectId: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
    version: BcsType<string, string | number | bigint, "u64">;
    digest: BcsType<string, string, "ObjectDigest">;
}, string>;
export declare const SharedObjectRef: import("@mysten/bcs").BcsStruct<{
    objectId: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
    initialSharedVersion: BcsType<string, string | number | bigint, "u64">;
    mutable: BcsType<boolean, boolean, "bool">;
}, string>;
export declare const ObjectArg: import("@mysten/bcs").BcsEnum<{
    ImmOrOwnedObject: import("@mysten/bcs").BcsStruct<{
        objectId: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        version: BcsType<string, string | number | bigint, "u64">;
        digest: BcsType<string, string, "ObjectDigest">;
    }, string>;
    SharedObject: import("@mysten/bcs").BcsStruct<{
        objectId: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        initialSharedVersion: BcsType<string, string | number | bigint, "u64">;
        mutable: BcsType<boolean, boolean, "bool">;
    }, string>;
    Receiving: import("@mysten/bcs").BcsStruct<{
        objectId: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        version: BcsType<string, string | number | bigint, "u64">;
        digest: BcsType<string, string, "ObjectDigest">;
    }, string>;
}, "ObjectArg">;
export declare const Owner: import("@mysten/bcs").BcsEnum<{
    AddressOwner: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
    ObjectOwner: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
    Shared: import("@mysten/bcs").BcsStruct<{
        initialSharedVersion: BcsType<string, string | number | bigint, "u64">;
    }, string>;
    Immutable: null;
    ConsensusAddressOwner: import("@mysten/bcs").BcsStruct<{
        owner: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        startVersion: BcsType<string, string | number | bigint, "u64">;
    }, string>;
}, "Owner">;
export declare const CallArg: import("@mysten/bcs").BcsEnum<{
    Pure: import("@mysten/bcs").BcsStruct<{
        bytes: BcsType<string, string | Uint8Array<ArrayBufferLike>, string>;
    }, string>;
    Object: import("@mysten/bcs").BcsEnum<{
        ImmOrOwnedObject: import("@mysten/bcs").BcsStruct<{
            objectId: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
            version: BcsType<string, string | number | bigint, "u64">;
            digest: BcsType<string, string, "ObjectDigest">;
        }, string>;
        SharedObject: import("@mysten/bcs").BcsStruct<{
            objectId: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
            initialSharedVersion: BcsType<string, string | number | bigint, "u64">;
            mutable: BcsType<boolean, boolean, "bool">;
        }, string>;
        Receiving: import("@mysten/bcs").BcsStruct<{
            objectId: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
            version: BcsType<string, string | number | bigint, "u64">;
            digest: BcsType<string, string, "ObjectDigest">;
        }, string>;
    }, "ObjectArg">;
}, "CallArg">;
export declare const TypeTag: BcsType<string, string | TypeTagType, string>;
export declare const Argument: import("@mysten/bcs").BcsEnum<{
    GasCoin: null;
    Input: BcsType<number, number, "u16">;
    Result: BcsType<number, number, "u16">;
    NestedResult: import("@mysten/bcs").BcsTuple<readonly [BcsType<number, number, "u16">, BcsType<number, number, "u16">], string>;
}, "Argument">;
export declare const ProgrammableMoveCall: import("@mysten/bcs").BcsStruct<{
    package: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
    module: BcsType<string, string, "string">;
    function: BcsType<string, string, "string">;
    typeArguments: BcsType<string[], Iterable<string | TypeTagType> & {
        length: number;
    }, string>;
    arguments: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
export declare const Command: import("@mysten/bcs").BcsEnum<{
    /**
     * A Move Call - any public Move function can be called via
     * this transaction. The results can be used that instant to pass
     * into the next transaction.
     */
    MoveCall: import("@mysten/bcs").BcsStruct<{
        package: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        module: BcsType<string, string, "string">;
        function: BcsType<string, string, "string">;
        typeArguments: BcsType<string[], Iterable<string | TypeTagType> & {
            length: number;
        }, string>;
        arguments: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
    /**
     * Transfer vector of objects to a receiver.
     */
    TransferObjects: import("@mysten/bcs").BcsStruct<{
        objects: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
            Input: BcsType<number, number, "u16">;
            Result: BcsType<number, number, "u16">;
            NestedResult: import("@mysten/bcs").BcsTuple<readonly [BcsType<number, number, "u16">, BcsType<number, number, "u16">], string>;
        }, "Argument">;
    }, string>;
    SplitCoins: import("@mysten/bcs").BcsStruct<{
        coin: import("@mysten/bcs").BcsEnum<{
            GasCoin: null;
            Input: BcsType<number, number, "u16">;
            Result: BcsType<number, number, "u16">;
            NestedResult: import("@mysten/bcs").BcsTuple<readonly [BcsType<number, number, "u16">, BcsType<number, number, "u16">], string>;
        }, "Argument">;
        amounts: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
            Input: BcsType<number, number, "u16">;
            Result: BcsType<number, number, "u16">;
            NestedResult: import("@mysten/bcs").BcsTuple<readonly [BcsType<number, number, "u16">, BcsType<number, number, "u16">], string>;
        }, "Argument">;
        sources: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
        modules: BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
            length: number;
        }, string>;
        dependencies: BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
            length: number;
        }, string>;
    }, string>;
    MakeMoveVec: import("@mysten/bcs").BcsStruct<{
        type: BcsType<string | null, string | null, string>;
        elements: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
        modules: BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
            length: number;
        }, string>;
        dependencies: BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
            length: number;
        }, string>;
        package: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        ticket: import("@mysten/bcs").BcsEnum<{
            GasCoin: null;
            Input: BcsType<number, number, "u16">;
            Result: BcsType<number, number, "u16">;
            NestedResult: import("@mysten/bcs").BcsTuple<readonly [BcsType<number, number, "u16">, BcsType<number, number, "u16">], string>;
        }, "Argument">;
    }, string>;
}, "Command">;
export declare const ProgrammableTransaction: import("@mysten/bcs").BcsStruct<{
    inputs: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
    commands: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
            typeArguments: Iterable<string | TypeTagType> & {
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
export declare const TransactionKind: import("@mysten/bcs").BcsEnum<{
    ProgrammableTransaction: import("@mysten/bcs").BcsStruct<{
        inputs: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
        commands: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
                typeArguments: Iterable<string | TypeTagType> & {
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
export declare const TransactionExpiration: import("@mysten/bcs").BcsEnum<{
    None: null;
    Epoch: BcsType<number, string | number, "u64">;
}, "TransactionExpiration">;
export declare const StructTag: import("@mysten/bcs").BcsStruct<{
    address: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
    module: BcsType<string, string, "string">;
    name: BcsType<string, string, "string">;
    typeParams: BcsType<TypeTagType[], Iterable<TypeTagType> & {
        length: number;
    }, string>;
}, string>;
export declare const GasData: import("@mysten/bcs").BcsStruct<{
    payment: BcsType<{
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
    owner: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
    price: BcsType<string, string | number | bigint, "u64">;
    budget: BcsType<string, string | number | bigint, "u64">;
}, string>;
export declare const TransactionDataV1: import("@mysten/bcs").BcsStruct<{
    kind: import("@mysten/bcs").BcsEnum<{
        ProgrammableTransaction: import("@mysten/bcs").BcsStruct<{
            inputs: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
            commands: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
                    typeArguments: Iterable<string | TypeTagType> & {
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
    sender: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
    gasData: import("@mysten/bcs").BcsStruct<{
        payment: BcsType<{
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
        owner: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        price: BcsType<string, string | number | bigint, "u64">;
        budget: BcsType<string, string | number | bigint, "u64">;
    }, string>;
    expiration: import("@mysten/bcs").BcsEnum<{
        None: null;
        Epoch: BcsType<number, string | number, "u64">;
    }, "TransactionExpiration">;
}, string>;
export declare const TransactionData: import("@mysten/bcs").BcsEnum<{
    V1: import("@mysten/bcs").BcsStruct<{
        kind: import("@mysten/bcs").BcsEnum<{
            ProgrammableTransaction: import("@mysten/bcs").BcsStruct<{
                inputs: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
                commands: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
                        typeArguments: Iterable<string | TypeTagType> & {
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
        sender: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
        gasData: import("@mysten/bcs").BcsStruct<{
            payment: BcsType<{
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
            owner: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
            price: BcsType<string, string | number | bigint, "u64">;
            budget: BcsType<string, string | number | bigint, "u64">;
        }, string>;
        expiration: import("@mysten/bcs").BcsEnum<{
            None: null;
            Epoch: BcsType<number, string | number, "u64">;
        }, "TransactionExpiration">;
    }, string>;
}, "TransactionData">;
export declare const IntentScope: import("@mysten/bcs").BcsEnum<{
    TransactionData: null;
    TransactionEffects: null;
    CheckpointSummary: null;
    PersonalMessage: null;
}, "IntentScope">;
export declare const IntentVersion: import("@mysten/bcs").BcsEnum<{
    V0: null;
}, "IntentVersion">;
export declare const AppId: import("@mysten/bcs").BcsEnum<{
    Sui: null;
}, "AppId">;
export declare const Intent: import("@mysten/bcs").BcsStruct<{
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
export declare function IntentMessage<T extends BcsType<any>>(T: T): import("@mysten/bcs").BcsStruct<{
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
    value: T;
}, string>;
export declare const CompressedSignature: import("@mysten/bcs").BcsEnum<{
    ED25519: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[64]">;
    Secp256k1: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[64]">;
    Secp256r1: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[64]">;
    ZkLogin: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
    Passkey: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
}, "CompressedSignature">;
export declare const PublicKey: import("@mysten/bcs").BcsEnum<{
    ED25519: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[32]">;
    Secp256k1: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[33]">;
    Secp256r1: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[33]">;
    ZkLogin: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
    Passkey: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[33]">;
}, "PublicKey">;
export declare const MultiSigPkMap: import("@mysten/bcs").BcsStruct<{
    pubKey: import("@mysten/bcs").BcsEnum<{
        ED25519: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[32]">;
        Secp256k1: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[33]">;
        Secp256r1: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[33]">;
        ZkLogin: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
        Passkey: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "bytes[33]">;
    }, "PublicKey">;
    weight: BcsType<number, number, "u8">;
}, string>;
export declare const MultiSigPublicKey: import("@mysten/bcs").BcsStruct<{
    pk_map: BcsType<{
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
    threshold: BcsType<number, number, "u16">;
}, string>;
export declare const MultiSig: import("@mysten/bcs").BcsStruct<{
    sigs: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
    bitmap: BcsType<number, number, "u16">;
    multisig_pk: import("@mysten/bcs").BcsStruct<{
        pk_map: BcsType<{
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
        threshold: BcsType<number, number, "u16">;
    }, string>;
}, string>;
export declare const base64String: BcsType<string, string | Uint8Array<ArrayBufferLike>, "vector<u8>">;
export declare const SenderSignedTransaction: import("@mysten/bcs").BcsStruct<{
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
                        inputs: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
                        commands: BcsType<import("@mysten/bcs").EnumOutputShapeWithKeys<{
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
                                typeArguments: Iterable<string | TypeTagType> & {
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
                sender: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                gasData: import("@mysten/bcs").BcsStruct<{
                    payment: BcsType<{
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
                    owner: BcsType<string, string | Uint8Array<ArrayBufferLike>, "bytes[32]">;
                    price: BcsType<string, string | number | bigint, "u64">;
                    budget: BcsType<string, string | number | bigint, "u64">;
                }, string>;
                expiration: import("@mysten/bcs").BcsEnum<{
                    None: null;
                    Epoch: BcsType<number, string | number, "u64">;
                }, "TransactionExpiration">;
            }, string>;
        }, "TransactionData">;
    }, string>;
    txSignatures: BcsType<string[], Iterable<string | Uint8Array<ArrayBufferLike>> & {
        length: number;
    }, string>;
}, string>;
export declare const SenderSignedData: BcsType<{
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
                                typeArguments: Iterable<string | TypeTagType> & {
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
export declare const PasskeyAuthenticator: import("@mysten/bcs").BcsStruct<{
    authenticatorData: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
    clientDataJson: BcsType<string, string, "string">;
    userSignature: BcsType<Uint8Array<ArrayBufferLike>, Iterable<number>, "vector<u8>">;
}, string>;
