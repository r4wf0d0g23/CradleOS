import type { TypeTag } from '../bcs/bcs.js';
/**
 * Derive the ID of an object that has been created through `derived_object`.
 */
export declare function deriveObjectID(parentId: string, typeTag: typeof TypeTag.$inferInput, key: Uint8Array): string;
