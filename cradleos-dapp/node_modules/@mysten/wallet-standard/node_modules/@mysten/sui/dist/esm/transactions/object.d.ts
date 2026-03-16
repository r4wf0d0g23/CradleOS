import type { Transaction, TransactionObjectInput } from './Transaction.js';
export declare function createObjectMethods<T>(makeObject: (value: TransactionObjectInput) => T): {
    (value: TransactionObjectInput): T;
    system(options?: {
        mutable?: boolean;
    }): T;
    clock(): T;
    random(): T;
    denyList(options?: {
        mutable?: boolean;
    }): T;
    option({ type, value }: {
        type: string;
        value: TransactionObjectInput | null;
    }): (tx: Transaction) => import("./Transaction.js").TransactionResult;
};
