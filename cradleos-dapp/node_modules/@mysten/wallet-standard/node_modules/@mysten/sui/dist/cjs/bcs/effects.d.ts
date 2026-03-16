export declare const TransactionEffects: import("@mysten/bcs").BcsEnum<{
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
