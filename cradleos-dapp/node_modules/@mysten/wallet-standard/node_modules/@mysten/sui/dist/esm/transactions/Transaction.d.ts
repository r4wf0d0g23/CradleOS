import type { SerializedBcs } from '@mysten/bcs';
import type { InferInput } from 'valibot';
import type { SignatureWithBytes, Signer } from '../cryptography/index.js';
import type { TransactionArgument } from './Commands.js';
import type { CallArg, Command, Argument, ObjectRef } from './data/internal.js';
import { ArgumentSchema, TransactionExpiration } from './data/internal.js';
import { Inputs } from './Inputs.js';
import type { BuildTransactionOptions, SerializeTransactionOptions, TransactionPlugin } from './resolve.js';
import { createObjectMethods } from './object.js';
import { createPure } from './pure.js';
import type { ClientWithCoreApi } from '../experimental/core.js';
export type TransactionObjectArgument = Exclude<InferInput<typeof ArgumentSchema>, {
    Input: unknown;
    type?: 'pure';
}> | ((tx: Transaction) => Exclude<InferInput<typeof ArgumentSchema>, {
    Input: unknown;
    type?: 'pure';
}>) | AsyncTransactionThunk<TransactionResultArgument>;
export type TransactionResult = Extract<Argument, {
    Result: unknown;
}> & Extract<Argument, {
    NestedResult: unknown;
}>[];
export type TransactionResultArgument = Extract<Argument, {
    Result: unknown;
}> | readonly Extract<Argument, {
    NestedResult: unknown;
}>[];
export type AsyncTransactionThunk<T extends TransactionResultArgument | void = TransactionResultArgument | void> = (tx: Transaction) => Promise<T | void>;
declare const TRANSACTION_BRAND: never;
interface SignOptions extends BuildTransactionOptions {
    signer: Signer;
}
export declare function isTransaction(obj: unknown): obj is TransactionLike;
export type TransactionObjectInput = string | CallArg | TransactionObjectArgument;
type TransactionLike = {
    getData(): unknown;
};
/**
 * Transaction Builder
 */
export declare class Transaction {
    #private;
    [TRANSACTION_BRAND]: boolean;
    /**
     * Converts from a serialize transaction kind (built with `build({ onlyTransactionKind: true })`) to a `Transaction` class.
     * Supports either a byte array, or base64-encoded bytes.
     */
    static fromKind(serialized: string | Uint8Array): Transaction;
    /**
     * Converts from a serialized transaction format to a `Transaction` class.
     * There are two supported serialized formats:
     * - A string returned from `Transaction#serialize`. The serialized format must be compatible, or it will throw an error.
     * - A byte array (or base64-encoded bytes) containing BCS transaction data.
     */
    static from(transaction: string | Uint8Array | TransactionLike): Transaction;
    /** @deprecated global plugins should be registered with a name */
    static registerGlobalSerializationPlugin(step: TransactionPlugin): void;
    static registerGlobalSerializationPlugin(name: string, step: TransactionPlugin): void;
    static unregisterGlobalSerializationPlugin(name: string): void;
    /** @deprecated global plugins should be registered with a name */
    static registerGlobalBuildPlugin(step: TransactionPlugin): void;
    static registerGlobalBuildPlugin(name: string, step: TransactionPlugin): void;
    static unregisterGlobalBuildPlugin(name: string): void;
    addSerializationPlugin(step: TransactionPlugin): void;
    addBuildPlugin(step: TransactionPlugin): void;
    addIntentResolver(intent: string, resolver: TransactionPlugin): void;
    setSender(sender: string): void;
    /**
     * Sets the sender only if it has not already been set.
     * This is useful for sponsored transaction flows where the sender may not be the same as the signer address.
     */
    setSenderIfNotSet(sender: string): void;
    setExpiration(expiration?: InferInput<typeof TransactionExpiration> | null): void;
    setGasPrice(price: number | bigint): void;
    setGasBudget(budget: number | bigint): void;
    setGasBudgetIfNotSet(budget: number | bigint): void;
    setGasOwner(owner: string): void;
    setGasPayment(payments: ObjectRef[]): void;
    /** @deprecated Use `getData()` instead. */
    get blockData(): {
        version: 1;
        sender?: string | undefined;
        expiration?: {
            Epoch: number;
        } | {
            None: true | null;
        } | null | undefined;
        gasConfig: {
            budget?: string | number | bigint | undefined;
            price?: string | number | bigint | undefined;
            payment?: {
                digest: string;
                objectId: string;
                version: string | number | bigint;
            }[] | undefined;
            owner?: string | undefined;
        };
        inputs: ({
            kind: "Input";
            index: number;
            value: unknown;
            type?: "object" | undefined;
        } | {
            kind: "Input";
            index: number;
            value: unknown;
            type: "pure";
        })[];
        transactions: ({
            kind: "MoveCall";
            target: `${string}::${string}::${string}`;
            typeArguments: string[];
            arguments: ({
                kind: "Input";
                index: number;
                value: unknown;
                type?: "object" | undefined;
            } | {
                kind: "Input";
                index: number;
                value: unknown;
                type: "pure";
            } | {
                kind: "GasCoin";
            } | {
                kind: "Result";
                index: number;
            } | {
                kind: "NestedResult";
                index: number;
                resultIndex: number;
            })[];
        } | {
            kind: "TransferObjects";
            objects: ({
                kind: "Input";
                index: number;
                value: unknown;
                type?: "object" | undefined;
            } | {
                kind: "Input";
                index: number;
                value: unknown;
                type: "pure";
            } | {
                kind: "GasCoin";
            } | {
                kind: "Result";
                index: number;
            } | {
                kind: "NestedResult";
                index: number;
                resultIndex: number;
            })[];
            address: {
                kind: "Input";
                index: number;
                value: unknown;
                type?: "object" | undefined;
            } | {
                kind: "Input";
                index: number;
                value: unknown;
                type: "pure";
            } | {
                kind: "GasCoin";
            } | {
                kind: "Result";
                index: number;
            } | {
                kind: "NestedResult";
                index: number;
                resultIndex: number;
            };
        } | {
            kind: "SplitCoins";
            coin: {
                kind: "Input";
                index: number;
                value: unknown;
                type?: "object" | undefined;
            } | {
                kind: "Input";
                index: number;
                value: unknown;
                type: "pure";
            } | {
                kind: "GasCoin";
            } | {
                kind: "Result";
                index: number;
            } | {
                kind: "NestedResult";
                index: number;
                resultIndex: number;
            };
            amounts: ({
                kind: "Input";
                index: number;
                value: unknown;
                type?: "object" | undefined;
            } | {
                kind: "Input";
                index: number;
                value: unknown;
                type: "pure";
            } | {
                kind: "GasCoin";
            } | {
                kind: "Result";
                index: number;
            } | {
                kind: "NestedResult";
                index: number;
                resultIndex: number;
            })[];
        } | {
            kind: "MergeCoins";
            destination: {
                kind: "Input";
                index: number;
                value: unknown;
                type?: "object" | undefined;
            } | {
                kind: "Input";
                index: number;
                value: unknown;
                type: "pure";
            } | {
                kind: "GasCoin";
            } | {
                kind: "Result";
                index: number;
            } | {
                kind: "NestedResult";
                index: number;
                resultIndex: number;
            };
            sources: ({
                kind: "Input";
                index: number;
                value: unknown;
                type?: "object" | undefined;
            } | {
                kind: "Input";
                index: number;
                value: unknown;
                type: "pure";
            } | {
                kind: "GasCoin";
            } | {
                kind: "Result";
                index: number;
            } | {
                kind: "NestedResult";
                index: number;
                resultIndex: number;
            })[];
        } | {
            kind: "MakeMoveVec";
            type: {
                Some: import("../bcs/types.js").TypeTag;
            } | {
                None: true | null;
            };
            objects: ({
                kind: "Input";
                index: number;
                value: unknown;
                type?: "object" | undefined;
            } | {
                kind: "Input";
                index: number;
                value: unknown;
                type: "pure";
            } | {
                kind: "GasCoin";
            } | {
                kind: "Result";
                index: number;
            } | {
                kind: "NestedResult";
                index: number;
                resultIndex: number;
            })[];
        } | {
            kind: "Publish";
            modules: number[][];
            dependencies: string[];
        } | {
            kind: "Upgrade";
            modules: number[][];
            dependencies: string[];
            packageId: string;
            ticket: {
                kind: "Input";
                index: number;
                value: unknown;
                type?: "object" | undefined;
            } | {
                kind: "Input";
                index: number;
                value: unknown;
                type: "pure";
            } | {
                kind: "GasCoin";
            } | {
                kind: "Result";
                index: number;
            } | {
                kind: "NestedResult";
                index: number;
                resultIndex: number;
            };
        })[];
    };
    /** Get a snapshot of the transaction data, in JSON form: */
    getData(): {
        version: 2;
        sender?: string | null | undefined;
        expiration?: import("@mysten/bcs").EnumOutputShapeWithKeys<{
            None: true;
            Epoch: string | number;
        }, "None" | "Epoch"> | null | undefined;
        gasData: {
            budget: string | number | null;
            price: string | number | null;
            owner: string | null;
            payment: {
                objectId: string;
                version: string | number;
                digest: string;
            }[] | null;
        };
        inputs: import("@mysten/bcs").EnumOutputShapeWithKeys<{
            Object: import("@mysten/bcs").EnumOutputShapeWithKeys<{
                ImmOrOwnedObject: {
                    objectId: string;
                    version: string | number;
                    digest: string;
                };
                SharedObject: {
                    objectId: string;
                    initialSharedVersion: string | number;
                    mutable: boolean;
                };
                Receiving: {
                    objectId: string;
                    version: string | number;
                    digest: string;
                };
            }, "ImmOrOwnedObject" | "SharedObject" | "Receiving">;
            Pure: {
                bytes: string;
            };
            UnresolvedPure: {
                value: unknown;
            };
            UnresolvedObject: {
                objectId: string;
                version?: string | number | null | undefined;
                digest?: string | null | undefined;
                initialSharedVersion?: string | number | null | undefined;
                mutable?: boolean | null | undefined;
            };
        }, "Pure" | "Object" | "UnresolvedPure" | "UnresolvedObject">[];
        commands: import("@mysten/bcs").EnumOutputShapeWithKeys<{
            MoveCall: {
                package: string;
                module: string;
                function: string;
                typeArguments: string[];
                arguments: ({
                    $kind: "GasCoin";
                    GasCoin: true;
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "pure";
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "object";
                } | {
                    $kind: "Result";
                    Result: number;
                } | {
                    $kind: "NestedResult";
                    NestedResult: [number, number];
                })[];
                _argumentTypes?: {
                    ref: "&" | "&mut" | null;
                    body: import("./data/internal.js").OpenMoveTypeSignatureBody;
                }[] | null | undefined;
            };
            TransferObjects: {
                objects: ({
                    $kind: "GasCoin";
                    GasCoin: true;
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "pure";
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "object";
                } | {
                    $kind: "Result";
                    Result: number;
                } | {
                    $kind: "NestedResult";
                    NestedResult: [number, number];
                })[];
                address: {
                    $kind: "GasCoin";
                    GasCoin: true;
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "pure";
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "object";
                } | {
                    $kind: "Result";
                    Result: number;
                } | {
                    $kind: "NestedResult";
                    NestedResult: [number, number];
                };
            };
            SplitCoins: {
                coin: {
                    $kind: "GasCoin";
                    GasCoin: true;
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "pure";
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "object";
                } | {
                    $kind: "Result";
                    Result: number;
                } | {
                    $kind: "NestedResult";
                    NestedResult: [number, number];
                };
                amounts: ({
                    $kind: "GasCoin";
                    GasCoin: true;
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "pure";
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "object";
                } | {
                    $kind: "Result";
                    Result: number;
                } | {
                    $kind: "NestedResult";
                    NestedResult: [number, number];
                })[];
            };
            MergeCoins: {
                destination: {
                    $kind: "GasCoin";
                    GasCoin: true;
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "pure";
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "object";
                } | {
                    $kind: "Result";
                    Result: number;
                } | {
                    $kind: "NestedResult";
                    NestedResult: [number, number];
                };
                sources: ({
                    $kind: "GasCoin";
                    GasCoin: true;
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "pure";
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "object";
                } | {
                    $kind: "Result";
                    Result: number;
                } | {
                    $kind: "NestedResult";
                    NestedResult: [number, number];
                })[];
            };
            Publish: {
                modules: string[];
                dependencies: string[];
            };
            MakeMoveVec: {
                type: string | null;
                elements: ({
                    $kind: "GasCoin";
                    GasCoin: true;
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "pure";
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "object";
                } | {
                    $kind: "Result";
                    Result: number;
                } | {
                    $kind: "NestedResult";
                    NestedResult: [number, number];
                })[];
            };
            Upgrade: {
                modules: string[];
                dependencies: string[];
                package: string;
                ticket: {
                    $kind: "GasCoin";
                    GasCoin: true;
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "pure";
                } | {
                    $kind: "Input";
                    Input: number;
                    type?: "object";
                } | {
                    $kind: "Result";
                    Result: number;
                } | {
                    $kind: "NestedResult";
                    NestedResult: [number, number];
                };
            };
            $Intent: {
                name: string;
                inputs: {
                    [x: string]: {
                        $kind: "GasCoin";
                        GasCoin: true;
                    } | {
                        $kind: "Input";
                        Input: number;
                        type?: "pure";
                    } | {
                        $kind: "Input";
                        Input: number;
                        type?: "object";
                    } | {
                        $kind: "Result";
                        Result: number;
                    } | {
                        $kind: "NestedResult";
                        NestedResult: [number, number];
                    } | ({
                        $kind: "GasCoin";
                        GasCoin: true;
                    } | {
                        $kind: "Input";
                        Input: number;
                        type?: "pure";
                    } | {
                        $kind: "Input";
                        Input: number;
                        type?: "object";
                    } | {
                        $kind: "Result";
                        Result: number;
                    } | {
                        $kind: "NestedResult";
                        NestedResult: [number, number];
                    })[];
                };
                data: {
                    [x: string]: unknown;
                };
            };
        }, "MoveCall" | "TransferObjects" | "SplitCoins" | "MergeCoins" | "Publish" | "MakeMoveVec" | "Upgrade" | "$Intent">[];
    };
    get pure(): ReturnType<typeof createPure<Argument>>;
    constructor();
    /** Returns an argument for the gas coin, to be used in a transaction. */
    get gas(): {
        $kind: "GasCoin";
        GasCoin: true;
    };
    /**
     * Add a new object input to the transaction.
     */
    object: ReturnType<typeof createObjectMethods<{
        $kind: 'Input';
        Input: number;
        type?: 'object';
    }>>;
    /**
     * Add a new object input to the transaction using the fully-resolved object reference.
     * If you only have an object ID, use `builder.object(id)` instead.
     */
    objectRef(...args: Parameters<(typeof Inputs)['ObjectRef']>): {
        $kind: "Input";
        Input: number;
        type?: "object";
    };
    /**
     * Add a new receiving input to the transaction using the fully-resolved object reference.
     * If you only have an object ID, use `builder.object(id)` instead.
     */
    receivingRef(...args: Parameters<(typeof Inputs)['ReceivingRef']>): {
        $kind: "Input";
        Input: number;
        type?: "object";
    };
    /**
     * Add a new shared object input to the transaction using the fully-resolved shared object reference.
     * If you only have an object ID, use `builder.object(id)` instead.
     */
    sharedObjectRef(...args: Parameters<(typeof Inputs)['SharedObjectRef']>): {
        $kind: "Input";
        Input: number;
        type?: "object";
    };
    /** Add a transaction to the transaction */
    add<T extends Command>(command: T): TransactionResult;
    add<T extends void | TransactionResultArgument | TransactionArgument | Command>(thunk: (tx: Transaction) => T): T;
    add<T extends TransactionResultArgument | void>(asyncTransactionThunk: AsyncTransactionThunk<T>): T;
    splitCoins<const Amounts extends (TransactionArgument | SerializedBcs<any> | number | string | bigint)[]>(coin: TransactionObjectArgument | string, amounts: Amounts): Extract<Argument, {
        Result: unknown;
    }> & { [K in keyof Amounts]: Extract<Argument, {
        NestedResult: unknown;
    }>; };
    mergeCoins(destination: TransactionObjectArgument | string, sources: (TransactionObjectArgument | string)[]): TransactionResult;
    publish({ modules, dependencies }: {
        modules: number[][] | string[];
        dependencies: string[];
    }): TransactionResult;
    upgrade({ modules, dependencies, package: packageId, ticket, }: {
        modules: number[][] | string[];
        dependencies: string[];
        package: string;
        ticket: TransactionObjectArgument | string;
    }): TransactionResult;
    moveCall({ arguments: args, ...input }: {
        package: string;
        module: string;
        function: string;
        arguments?: (TransactionArgument | SerializedBcs<any>)[];
        typeArguments?: string[];
    } | {
        target: string;
        arguments?: (TransactionArgument | SerializedBcs<any>)[];
        typeArguments?: string[];
    }): TransactionResult;
    transferObjects(objects: (TransactionObjectArgument | string)[], address: TransactionArgument | SerializedBcs<any> | string): TransactionResult;
    makeMoveVec({ type, elements, }: {
        elements: (TransactionObjectArgument | string)[];
        type?: string;
    }): TransactionResult;
    /**
     * @deprecated Use toJSON instead.
     * For synchronous serialization, you can use `getData()`
     * */
    serialize(): string;
    toJSON(options?: SerializeTransactionOptions): Promise<string>;
    /** Build the transaction to BCS bytes, and sign it with the provided keypair. */
    sign(options: SignOptions): Promise<SignatureWithBytes>;
    /**
     *  Ensures that:
     *  - All objects have been fully resolved to a specific version
     *  - All pure inputs have been serialized to bytes
     *  - All async thunks have been fully resolved
     *  - All transaction intents have been resolved
     * 	- The gas payment, budget, and price have been set
     *  - The transaction sender has been set
     *
     *  When true, the transaction will always be built to the same bytes and digest (unless the transaction is mutated)
     */
    isFullyResolved(): boolean;
    /** Build the transaction to BCS bytes. */
    build(options?: BuildTransactionOptions): Promise<Uint8Array<ArrayBuffer>>;
    /** Derive transaction digest */
    getDigest(options?: {
        client?: ClientWithCoreApi;
    }): Promise<string>;
    prepareForSerialization(options: SerializeTransactionOptions): Promise<void>;
}
export {};
