/**
 * GraphQL queries for fetching Sui objects
 */

// ============================================================================
// Core Object Queries
// ============================================================================

/**
 * Query for fetching a specific object by address with BCS-encoded contents
 * Use this for low-level object access with raw BCS data
 *
 * @category GraphQL Queries
 */
export const GET_OBJECT_BY_ADDRESS = `
  query GetObjectByAddress($address: SuiAddress!) {
    object(address: $address) {
      address
      version
      digest
      asMoveObject {
        contents {
          type {
            repr
          }
          bcs
        }
      }
    }
  }
`;

/**
 * Object by address with JSON contents and dynamic fields (nodes).
 *
 * @category GraphQL Queries
 */
export const GET_OBJECT_WITH_DYNAMIC_FIELDS = `
  query GetObjectWithDynamicFields($objectId: SuiAddress!) {
    object(address: $objectId) {
      asMoveObject {
        contents {
          json
        }
        dynamicFields {
          nodes {
            contents {
              json
              type {
                layout
              }
            }
            name {
              json
              type {
                repr
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Assembly object with owner/character extract and character-owned objects (e.g. inventory).
 *
 * @category GraphQL Queries
 */
export const GET_OBJECT_DYNAMICFIELD_CHARACTER_WITH_JSON = `
query GetObjectOwnerCharacterOwnerAndInventory(
  $objectId: SuiAddress!
  $characterOwnerType: String!
) {
  object(address: $objectId) {
    asMoveObject {
      contents {
        json
        type { repr }
        bcs
        extract(path: "owner_cap_id") {
          asAddress {
            asObject {
              asMoveObject {
                owner {
                  ... on AddressOwner {
                    address {
                      objects(filter: { type: $characterOwnerType }, last: 1) {
                        nodes {
                          contents {
                            authorizedObj: extract(path: "authorized_object_id") {
                              asAddress {
                                asObject {
                                  asMoveObject {
                                    contents { bcs json }
                                    
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
       energySource: extract(path: "energy_source_id") {
          asAddress {
            asObject {
              asMoveObject {
                contents { bcs json }
              }
            }
          }
        }
        destinationGate: extract(path: "linked_gate_id") {
          asAddress {
            asObject {
              asMoveObject {
                contents { bcs json }
              }
            }
          }
        }
      }
      dynamicFields {
          nodes {
            contents {
              json
              extract(path: "id") {
              asAddress {
                asObject {
                    asMoveObject {
                    contents { bcs json }
                    }
                }
                }      
              }
            }
            name {
              json
              type {
                repr
              }
            }
          }
        }
    }
  }
}
`;

// ============================================================================
// Owner & Ownership Queries
// ============================================================================

/**
 * Query to get an object's owner and their owned objects of a specific type
 * Useful for finding related objects (e.g., getting a character's assemblies)
 * Returns BCS-encoded data only
 *
 * @category GraphQL Queries
 */
export const GET_OBJECT_OWNER_AND_OWNED_OBJECTS_BY_TYPE = `
  query GetObjectOwnerAndOwnedObjectByType($object: SuiAddress!, $owned_object_type: String) {
    object(address: $object) {
      owner {
        ... on AddressOwner {
          address {
            address
            objects(
              filter: {
                type: $owned_object_type
              }
            ) {
              nodes {
                contents {
                  bcs
                }
                previousTransaction {
                  effects {
                    timestamp
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Query to get an object's owner and their owned objects of a specific type
 * Returns both BCS and JSON-decoded data for easier consumption
 *
 * @category GraphQL Queries
 */
export const GET_OBJECT_OWNER_AND_OWNED_OBJECTS_WITH_JSON = `
  query GetObjectOwnerAndOwnedObjectWithJson($object: SuiAddress!, $owned_object_type: String) {
    object(address: $object) {
      owner {
        ... on AddressOwner {
          address {
            address
            objects(
              filter: {
                type: $owned_object_type
              }
            ) {
              nodes {
                address
                contents {
                  json
                  bcs
                }
                previousTransaction {
                  effects {
                    timestamp
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Query to get full object details with JSON contents
 * Used to fetch character details after getting the character ID from OwnerCap
 *
 * @category GraphQL Queries
 */
export const GET_OBJECT_WITH_JSON = `
  query GetObjectWithJson($address: SuiAddress!) {
    object(address: $address) {
      address
      version
      digest
      asMoveObject {
        contents {
          type {
            repr
          }
          json
          bcs
        }
      }
    }
  }
`;

/**
 * Query to get all objects of a specific type owned by an address
 * Returns object addresses only (lightweight)
 *
 * @category GraphQL Queries
 */
export const GET_OWNED_OBJECTS_BY_TYPE = `
  query GetOwnedObjectsByType($owner: SuiAddress!, $object_type: String) {
    address(address: $owner) {
      objects(
        filter: {
          type: $object_type
        }
      ) {
        nodes {
          address
        }
      }
    }
  }
`;

/**
 * Query for fetching objects owned by an address filtered by package
 * Returns full object data with dynamic fields
 *
 * @category GraphQL Queries
 */
export const GET_OWNED_OBJECTS_BY_PACKAGE = `
  query GetOwnedObjectsByPackage($owner: SuiAddress!, $packageId: SuiAddress!) {
    objects(
      filter: {
        owner: $owner
        type: { package: $packageId }
      }
    ) {
      nodes {
        address
        version
        asMoveObject {
          contents {
            json
          }
          dynamicFields {
            nodes {
              contents {
                json
                type {
                  layout
                }
              }
              name {
                json
                type {
                  repr
                }
              }
            }
          }
        }
      }
    }
  }
`;

// ============================================================================
// Character Queries
// ============================================================================

/**
 * Query to get all characters owned by a wallet
 * Returns the characters owned by the wallet
 *
 * @category GraphQL Queries
 */
export const GET_WALLET_CHARACTERS = `
  query GetWalletCharacters($owner: SuiAddress!, $characterPlayerProfileType: String!) {
    address(
        address: $owner
    ) {
        objects(
            last: 1
            filter: {
                type: $characterPlayerProfileType
            }
        ) {
            nodes {
                contents {
                    extract(path: "character_id") {
                        asAddress {
                            asObject {
                                asMoveObject {
                                    contents {
                                        type {
                                            repr
                                        }
                                        json
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
`;

/**
 * Query to get character owned by a wallet and objects owned by the character
 * Returns the character and objects owned by the character
 *
 * @category GraphQL Queries
 */
export const GET_CHARACTER_AND_OWNED_OBJECTS = `
query GetCharacterAndOwnedObjects($owner: SuiAddress!, $characterPlayerProfileType: String!) {
    address(
        address: $owner
    ) {
        objects(
            last: 1
            filter: {
                type: $characterPlayerProfileType
            }
        ) {
            nodes {
                contents {
                    extract(path: "character_id") {
                        asAddress {
                            asObject {
                                asMoveObject {
                                    contents {
                                        type {
                                            repr
                                        }
                                        json
                                    }
                                }
                            }
                            objects {
                                nodes {
                                    contents {
                                        extract(path: "authorized_object_id") {
                                            asAddress {
                                                asObject {
                                                    asMoveObject {
                                                        contents {
                                                            type {
                                                                repr
                                                            }
                                                            json
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
`;

// ============================================================================
// Singleton & Type-based Queries
// ============================================================================

/**
 * Query to get a singleton object by its type
 * Returns the first object of the specified type (useful for global/singleton objects)
 *
 * @category GraphQL Queries
 */
export const GET_SINGLETON_OBJECT_BY_TYPE = `
  query GetSingletonObjectByType($object_type: String) {
    objects(
      filter: {
        type: $object_type
      }
      first: 1
    ) {
      nodes {
        address
      }
    }
  }
`;

/**
 * Query to get a singleton config object by its type
 *
 * @category GraphQL Queries
 */
export const GET_SINGLETON_CONFIG_OBJECT_BY_TYPE = `
  query GetSingletonConfigObjectByType($object_type: String!, $table_name: String!) {
    objects(filter: { type: $object_type }, first: 1) {
        nodes {
            address
            asMoveObject {
                contents {
                    extract(path: $table_name) {
                        extract(path: "id") {
                            asAddress {
                                addressAt {
                                    dynamicFields {
                                        pageInfo {
                                            hasNextPage
                                            endCursor
                                        }
                                        nodes {
                                            key: name {
                                                json
                                            }
                                            value: value {
                                                ... on MoveValue {
                                                    json
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
`;

/**
 * Query to get all objects of a specific type (global search)
 * Use with caution - may return many results
 *
 * @category GraphQL Queries
 */
export const GET_OBJECTS_BY_TYPE = `
  query GetObjectsByType($object_type: String, $first: Int, $after: String) {
    objects(
      filter: {
        type: $object_type
      }
      first: $first
      after: $after
    ) {
      nodes {
        address
        version
        asMoveObject {
          contents {
            json
            type {
              repr
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
