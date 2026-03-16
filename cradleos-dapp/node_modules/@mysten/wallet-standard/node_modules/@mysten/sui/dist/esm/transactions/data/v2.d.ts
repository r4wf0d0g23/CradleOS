import type { EnumInputShape } from '@mysten/bcs';
import type { GenericSchema, InferOutput } from 'valibot';
export declare const SerializedTransactionDataV2Schema: import("valibot").ObjectSchema<{
    readonly version: import("valibot").LiteralSchema<2, undefined>;
    readonly sender: import("valibot").NullishSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").TransformAction<string, string>, import("valibot").CheckAction<string, undefined>]>, undefined>;
    readonly expiration: import("valibot").NullishSchema<GenericSchema<EnumInputShape<{
        None: true;
        Epoch: string | number;
    }>>, undefined>;
    readonly gasData: import("valibot").ObjectSchema<{
        readonly budget: import("valibot").NullableSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").UnionSchema<[import("valibot").StringSchema<undefined>, import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>]>], undefined>, import("valibot").CheckAction<string | number, "Invalid u64">]>, undefined>;
        readonly price: import("valibot").NullableSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").UnionSchema<[import("valibot").StringSchema<undefined>, import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>]>], undefined>, import("valibot").CheckAction<string | number, "Invalid u64">]>, undefined>;
        readonly owner: import("valibot").NullableSchema<import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").TransformAction<string, string>, import("valibot").CheckAction<string, undefined>]>, undefined>;
        readonly payment: import("valibot").NullableSchema<import("valibot").ArraySchema<import("valibot").ObjectSchema<{
            readonly objectId: import("valibot").SchemaWithPipe<readonly [import("valibot").StringSchema<undefined>, import("valibot").TransformAction<string, string>, import("valibot").CheckAction<string, undefined>]>;
            readonly version: import("valibot").SchemaWithPipe<readonly [import("valibot").UnionSchema<[import("valibot").StringSchema<undefined>, import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>]>], undefined>, import("valibot").CheckAction<string | number, "Invalid u64">]>;
            readonly digest: import("valibot").StringSchema<undefined>;
        }, undefined>, undefined>, undefined>;
    }, undefined>;
    readonly inputs: import("valibot").ArraySchema<GenericSchema<EnumInputShape<{
        Object: EnumInputShape<{
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
        }>;
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
    }>>, undefined>;
    readonly commands: import("valibot").ArraySchema<GenericSchema<EnumInputShape<{
        MoveCall: {
            package: string;
            module: string;
            function: string;
            typeArguments: string[];
            arguments: EnumInputShape<{
                GasCoin: true;
                Input: number;
                Result: number;
                NestedResult: [number, number];
            }>[];
        };
        TransferObjects: {
            objects: EnumInputShape<{
                GasCoin: true;
                Input: number;
                Result: number;
                NestedResult: [number, number];
            }>[];
            address: EnumInputShape<{
                GasCoin: true;
                Input: number;
                Result: number;
                NestedResult: [number, number];
            }>;
        };
        SplitCoins: {
            coin: EnumInputShape<{
                GasCoin: true;
                Input: number;
                Result: number;
                NestedResult: [number, number];
            }>;
            amounts: EnumInputShape<{
                GasCoin: true;
                Input: number;
                Result: number;
                NestedResult: [number, number];
            }>[];
        };
        MergeCoins: {
            destination: EnumInputShape<{
                GasCoin: true;
                Input: number;
                Result: number;
                NestedResult: [number, number];
            }>;
            sources: EnumInputShape<{
                GasCoin: true;
                Input: number;
                Result: number;
                NestedResult: [number, number];
            }>[];
        };
        Publish: {
            modules: string[];
            dependencies: string[];
        };
        MakeMoveVec: {
            type: string | null;
            elements: EnumInputShape<{
                GasCoin: true;
                Input: number;
                Result: number;
                NestedResult: [number, number];
            }>[];
        };
        Upgrade: {
            modules: string[];
            dependencies: string[];
            package: string;
            ticket: EnumInputShape<{
                GasCoin: true;
                Input: number;
                Result: number;
                NestedResult: [number, number];
            }>;
        };
        $Intent: {
            name: string;
            inputs: {
                [x: string]: EnumInputShape<{
                    GasCoin: true;
                    Input: number;
                    Result: number;
                    NestedResult: [number, number];
                }> | EnumInputShape<{
                    GasCoin: true;
                    Input: number;
                    Result: number;
                    NestedResult: [number, number];
                }>[];
            };
            data: {
                [x: string]: unknown;
            };
        };
    }>>, undefined>;
    readonly digest: import("valibot").OptionalSchema<import("valibot").NullableSchema<import("valibot").StringSchema<undefined>, undefined>, undefined>;
}, undefined>;
export type SerializedTransactionDataV2 = InferOutput<typeof SerializedTransactionDataV2Schema>;
