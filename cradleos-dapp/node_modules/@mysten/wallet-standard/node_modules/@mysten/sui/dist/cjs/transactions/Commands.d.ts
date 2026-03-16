import type { InferInput } from 'valibot';
import type { Argument, CallArg, Command } from './data/internal.js';
import { ArgumentSchema } from './data/internal.js';
import type { AsyncTransactionThunk, Transaction } from './Transaction.js';
export type TransactionArgument = InferInput<typeof ArgumentSchema> | ((tx: Transaction) => InferInput<typeof ArgumentSchema>) | AsyncTransactionThunk;
export type TransactionInput = CallArg;
export declare enum UpgradePolicy {
    COMPATIBLE = 0,
    ADDITIVE = 128,
    DEP_ONLY = 192
}
type TransactionShape<T extends Command['$kind']> = {
    $kind: T;
} & {
    [K in T]: Extract<Command, {
        [K in T]: any;
    }>[T];
};
/**
 * Simple helpers used to construct transactions:
 */
export declare const Commands: {
    MoveCall(input: {
        package: string;
        module: string;
        function: string;
        arguments?: Argument[];
        typeArguments?: string[];
    } | {
        target: string;
        arguments?: Argument[];
        typeArguments?: string[];
    }): TransactionShape<"MoveCall">;
    TransferObjects(objects: InferInput<typeof ArgumentSchema>[], address: InferInput<typeof ArgumentSchema>): TransactionShape<"TransferObjects">;
    SplitCoins(coin: InferInput<typeof ArgumentSchema>, amounts: InferInput<typeof ArgumentSchema>[]): TransactionShape<"SplitCoins">;
    MergeCoins(destination: InferInput<typeof ArgumentSchema>, sources: InferInput<typeof ArgumentSchema>[]): TransactionShape<"MergeCoins">;
    Publish({ modules, dependencies, }: {
        modules: number[][] | string[];
        dependencies: string[];
    }): TransactionShape<"Publish">;
    Upgrade({ modules, dependencies, package: packageId, ticket, }: {
        modules: number[][] | string[];
        dependencies: string[];
        package: string;
        ticket: InferInput<typeof ArgumentSchema>;
    }): TransactionShape<"Upgrade">;
    MakeMoveVec({ type, elements, }: {
        type?: string;
        elements: InferInput<typeof ArgumentSchema>[];
    }): TransactionShape<"MakeMoveVec">;
    Intent({ name, inputs, data, }: {
        name: string;
        inputs?: Record<string, InferInput<typeof ArgumentSchema> | InferInput<typeof ArgumentSchema>[]>;
        data?: Record<string, unknown>;
    }): TransactionShape<"$Intent">;
};
export {};
