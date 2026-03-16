import type { SuiMoveNormalizedType } from '../client/index.js';
import type { Argument, CallArg, Command } from './data/internal.js';
export declare function extractMutableReference(normalizedType: SuiMoveNormalizedType): SuiMoveNormalizedType | undefined;
export declare function extractReference(normalizedType: SuiMoveNormalizedType): SuiMoveNormalizedType | undefined;
export declare function extractStructTag(normalizedType: SuiMoveNormalizedType): Extract<SuiMoveNormalizedType, {
    Struct: unknown;
}> | undefined;
export declare function getIdFromCallArg(arg: string | CallArg): string | undefined;
export declare function isArgument(value: unknown): value is Argument;
export declare function remapCommandArguments(command: Command, inputMapping: Map<number, number>, commandMapping: Map<number, number>): void;
