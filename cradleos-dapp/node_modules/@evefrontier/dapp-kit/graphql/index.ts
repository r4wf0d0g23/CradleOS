// Client & Query Execution
export {
  executeGraphQLQuery,
  getObjectByAddress,
  getObjectWithDynamicFields,
  getObjectWithJson,
  getObjectOwnerAndOwnedObjectsByType,
  getObjectOwnerAndOwnedObjectsWithJson,
  getObjectAndCharacterOwner,
  getOwnedObjectsByType,
  getOwnedObjectsByPackage,
  getSingletonObjectByType,
  getObjectsByType,
  // Character/owner resolution
  getWalletCharacters,
  getAssemblyWithOwner,
  getCharacterAndOwnedObjects,
} from "./client";

// Query Strings
export {
  // Core object queries
  GET_OBJECT_BY_ADDRESS,
  GET_OBJECT_WITH_DYNAMIC_FIELDS,
  GET_OBJECT_WITH_JSON,
  // Owner & ownership queries
  GET_OBJECT_OWNER_AND_OWNED_OBJECTS_BY_TYPE,
  GET_OBJECT_OWNER_AND_OWNED_OBJECTS_WITH_JSON,
  GET_OWNED_OBJECTS_BY_TYPE,
  GET_OWNED_OBJECTS_BY_PACKAGE,
  GET_WALLET_CHARACTERS,
  // Singleton & type-based queries
  GET_SINGLETON_OBJECT_BY_TYPE,
  GET_SINGLETON_CONFIG_OBJECT_BY_TYPE,
  GET_OBJECTS_BY_TYPE,
} from "./queries";

// Types
export * from "./types";
