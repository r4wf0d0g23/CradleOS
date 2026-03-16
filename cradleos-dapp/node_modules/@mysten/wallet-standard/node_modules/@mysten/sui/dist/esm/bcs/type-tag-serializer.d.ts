import type { TypeTag } from './types.js';
export declare class TypeTagSerializer {
    static parseFromStr(str: string, normalizeAddress?: boolean): TypeTag;
    static parseStructTypeArgs(str: string, normalizeAddress?: boolean): TypeTag[];
    static tagToString(tag: TypeTag): string;
}
export declare function normalizeTypeTag(type: string): string;
