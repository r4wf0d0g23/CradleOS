import {
  getCharacterOwnerCapType,
  getCharacterPlayerProfileType,
  getSuiGraphqlEndpoint,
} from "../utils/constants";
import type {
  GraphQLResponse,
  GetObjectByAddressResponse,
  GetObjectOwnerAndOwnedObjectsResponse,
  GetObjectOwnerAndOwnedObjectsWithJsonResponse,
  GetOwnedObjectsByTypeResponse,
  GetOwnedObjectsByPackageResponse,
  GetSingletonObjectByTypeResponse,
  GetObjectsByTypeResponse,
  GetObjectResponse,
  GetObjectWithJsonResponse,
  CharacterInfo,
  GetObjectAndCharacterOwnerResponse,
  DynamicFieldNode,
  RawSuiObjectData,
  GetSingletonConfigObjectByTypeResponse,
  GetWalletCharactersResponse,
  GetCharacterAndOwnedObjectsResponse,
} from "./types";
import { parseCharacterFromJson } from "../utils/character";
import {
  GET_OBJECT_BY_ADDRESS,
  GET_OBJECT_WITH_DYNAMIC_FIELDS,
  GET_OBJECT_OWNER_AND_OWNED_OBJECTS_BY_TYPE,
  GET_OBJECT_DYNAMICFIELD_CHARACTER_WITH_JSON,
  GET_OBJECT_OWNER_AND_OWNED_OBJECTS_WITH_JSON,
  GET_OWNED_OBJECTS_BY_TYPE,
  GET_OWNED_OBJECTS_BY_PACKAGE,
  GET_WALLET_CHARACTERS,
  GET_CHARACTER_AND_OWNED_OBJECTS,
  GET_SINGLETON_OBJECT_BY_TYPE,
  GET_OBJECTS_BY_TYPE,
  GET_OBJECT_WITH_JSON,
  GET_SINGLETON_CONFIG_OBJECT_BY_TYPE,
} from "./queries";

/**
 * Execute a GraphQL query against the Sui blockchain endpoint.
 *
 * This is the low-level function used by all other GraphQL helper functions.
 * Use this when you need to execute custom queries not covered by the helper functions.
 *
 * @category GraphQL Client
 * @typeParam T - The expected response data type
 * @param query - The GraphQL query string
 * @param variables - Variables to pass to the query
 * @returns Promise resolving to the GraphQL response
 * @throws {Error} If the HTTP request fails
 *
 * @example Custom query
 * ```typescript
 * const result = await executeGraphQLQuery<MyResponseType>(
 *   `query GetObject($address: SuiAddress!) {
 *     object(address: $address) {
 *       asMoveObject { contents { json } }
 *     }
 *   }`,
 *   { address: "0x123..." }
 * );
 * console.log(result.data?.object?.asMoveObject?.contents?.json);
 * ```
 */
export async function executeGraphQLQuery<T = unknown>(
  query: string,
  variables: Record<string, unknown>,
): Promise<GraphQLResponse<T>> {
  const response = await fetch(getSuiGraphqlEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Helper Functions for Common Queries
// ============================================================================

/**
 * Fetch a Sui object by its address with BCS-encoded contents.
 *
 * Use this for low-level object access when you need raw BCS data.
 * For JSON-decoded data, use {@link getObjectWithJson} instead.
 *
 * @category GraphQL Client
 * @param address - The Sui object address (0x...)
 * @returns Promise resolving to object with BCS contents
 *
 * @example
 * ```typescript
 * const result = await getObjectByAddress("0x123...");
 * const bcsData = result.data?.object?.asMoveObject?.contents?.bcs;
 * ```
 */
export async function getObjectByAddress(address: string) {
  return executeGraphQLQuery<GetObjectByAddressResponse>(
    GET_OBJECT_BY_ADDRESS,
    { address },
  );
}

/**
 * Fetch a Sui object with its dynamic fields in JSON format.
 *
 * Retrieves the object's contents and all associated dynamic fields,
 * which is useful for assemblies that store data in dynamic fields
 * (e.g., inventory items, configuration).
 *
 * @category GraphQL Client
 * @param objectId - The Sui object ID
 * @returns Promise resolving to object with dynamic fields
 *
 * @example
 * ```typescript
 * const result = await getObjectWithDynamicFields("0x123...");
 * const dynamicFields = result.data?.object?.asMoveObject?.dynamicFields?.nodes;
 * dynamicFields?.forEach(field => {
 *   console.log(field.name.json, field.contents.json);
 * });
 * ```
 */
export async function getObjectWithDynamicFields(objectId: string) {
  return executeGraphQLQuery<GetObjectResponse>(
    GET_OBJECT_WITH_DYNAMIC_FIELDS,
    { objectId },
  );
}

/**
 * Fetch a Sui object with JSON-decoded contents.
 *
 * This is the most common way to fetch object data when you need
 * to read the object's fields as JavaScript objects.
 *
 * @category GraphQL Client
 * @param address - The Sui object address
 * @returns Promise resolving to object with JSON contents
 *
 * @example
 * ```typescript
 * const result = await getObjectWithJson("0x123...");
 * const json = result.data?.object?.asMoveObject?.contents?.json;
 * console.log(json); // { id: "...", name: "...", ... }
 * ```
 */
export async function getObjectWithJson(address: string) {
  return executeGraphQLQuery<GetObjectWithJsonResponse>(GET_OBJECT_WITH_JSON, {
    address,
  });
}

/**
 * Get an object's owner and their owned objects of a specific type.
 *
 * Useful for traversing ownership chains, e.g., finding all assemblies
 * owned by a specific character.
 *
 * @category GraphQL Client
 * @param objectAddress - The Sui object address to query owner of
 * @param ownedObjectType - Optional type filter for owned objects
 * @returns Promise resolving to owner info and owned objects (BCS format)
 *
 * @example
 * ```typescript
 * const result = await getObjectOwnerAndOwnedObjectsByType(
 *   "0x123...",
 *   "0xpackage::module::MyType"
 * );
 * const ownerAddress = result.data?.object?.owner?.address?.address;
 * ```
 */
export async function getObjectOwnerAndOwnedObjectsByType(
  objectAddress: string,
  ownedObjectType?: string,
) {
  return executeGraphQLQuery<GetObjectOwnerAndOwnedObjectsResponse>(
    GET_OBJECT_OWNER_AND_OWNED_OBJECTS_BY_TYPE,
    {
      object: objectAddress,
      owned_object_type: ownedObjectType,
    },
  );
}

/**
 * Get an object's owner and their owned objects with JSON data.
 *
 * Similar to {@link getObjectOwnerAndOwnedObjectsByType} but returns
 * JSON-decoded contents for easier consumption.
 *
 * @category GraphQL Client
 * @param objectAddress - The Sui object address
 * @param ownedObjectType - Optional type filter for owned objects
 * @returns Promise resolving to owner info and owned objects (JSON format)
 */
export async function getObjectOwnerAndOwnedObjectsWithJson(
  objectAddress: string,
  ownedObjectType?: string,
) {
  return executeGraphQLQuery<GetObjectOwnerAndOwnedObjectsWithJsonResponse>(
    GET_OBJECT_OWNER_AND_OWNED_OBJECTS_WITH_JSON,
    {
      object: objectAddress,
      owned_object_type: ownedObjectType,
    },
  );
}

/**
 * Get an assembly object and resolve its owner character.
 *
 * This is a specialized query for EVE Frontier assemblies that
 * follows the owner_cap_id to resolve the owning character.
 *
 * @category GraphQL Client
 * @param objectAddress - The assembly object address
 * @returns Promise resolving to assembly and character data
 * @internal
 */
export async function getObjectAndCharacterOwner(objectAddress: string) {
  return executeGraphQLQuery<GetObjectAndCharacterOwnerResponse>(
    GET_OBJECT_DYNAMICFIELD_CHARACTER_WITH_JSON,
    {
      objectId: objectAddress,
      characterOwnerType: getCharacterOwnerCapType(),
    },
  );
}

/**
 * Get all objects of a specific type owned by an address.
 *
 * Returns only object addresses (lightweight). Use this when you need
 * to find objects and will fetch their details separately.
 *
 * @category GraphQL Client
 * @param owner - The owner's Sui address
 * @param objectType - Optional Move type filter (e.g., "0xpkg::module::Type")
 * @returns Promise resolving to list of owned object addresses
 *
 * @example
 * ```typescript
 * const result = await getOwnedObjectsByType(
 *   "0xowner...",
 *   "0xworld::smart_storage_unit::SmartStorageUnit"
 * );
 * const addresses = result.data?.address?.objects?.nodes.map(n => n.address);
 * ```
 */
export async function getOwnedObjectsByType(
  owner: string,
  objectType?: string,
) {
  return executeGraphQLQuery<GetOwnedObjectsByTypeResponse>(
    GET_OWNED_OBJECTS_BY_TYPE,
    {
      owner,
      object_type: objectType,
    },
  );
}

/**
 * Get all objects owned by an address filtered by package.
 *
 * Returns full object data with dynamic fields. Use this when you need
 * all objects from a specific package (e.g., all EVE Frontier objects).
 *
 * @category GraphQL Client
 * @param owner - The owner's Sui address
 * @param packageId - The Move package ID to filter by
 * @returns Promise resolving to full object data including dynamic fields
 *
 * @example
 * ```typescript
 * const result = await getOwnedObjectsByPackage(
 *   "0xowner...",
 *   "0xworld_package_id..."
 * );
 * const objects = result.data?.objects?.nodes;
 * ```
 */
export async function getOwnedObjectsByPackage(
  owner: string,
  packageId: string,
) {
  return executeGraphQLQuery<GetOwnedObjectsByPackageResponse>(
    GET_OWNED_OBJECTS_BY_PACKAGE,
    {
      owner,
      packageId,
    },
  );
}

/**
 * Get all characters owned by a wallet
 * Returns the most recent character owned by the wallet
 *
 * @category GraphQL Client
 */
export async function getWalletCharacters(wallet: string) {
  return executeGraphQLQuery<GetWalletCharactersResponse>(
    GET_WALLET_CHARACTERS,
    {
      owner: wallet,
      characterPlayerProfileType: getCharacterPlayerProfileType(),
    },
  );
}

/**
 * Get all characters owned by a wallet
 * Returns the characters owned by the wallet
 *
 * @category GraphQL Client
 */
export async function getCharacterAndOwnedObjects(wallet: string) {
  return executeGraphQLQuery<GetCharacterAndOwnedObjectsResponse>(
    GET_CHARACTER_AND_OWNED_OBJECTS,
    {
      owner: wallet,
      characterPlayerProfileType: getCharacterPlayerProfileType(),
    },
  );
}

/**
 * Get a singleton object by its Move type.
 *
 * Useful for global/singleton objects where there's only one instance
 * of a particular type on-chain.
 *
 * @category GraphQL Client
 * @param objectType - The full Move type string
 * @returns Promise resolving to the singleton object address
 *
 * @example
 * ```typescript
 * const result = await getSingletonObjectByType("0xpkg::config::GlobalConfig");
 * const address = result.data?.objects?.nodes[0]?.address;
 * ```
 */
export async function getSingletonObjectByType(objectType: string) {
  return executeGraphQLQuery<GetSingletonObjectByTypeResponse>(
    GET_SINGLETON_OBJECT_BY_TYPE,
    {
      object_type: objectType,
    },
  );
}

/**
 * Get a singleton config object by its Move type and table name, with dynamic fields.
 *
 * Used for on-chain config singletons (e.g. EnergyConfig, FuelConfig) that expose
 * a table of key/value entries via dynamic fields. Returns the first object's full
 * response including contents.extract...addressAt.dynamicFields.nodes.
 *
 * @category GraphQL Client
 * @param objectType - The full Move type string (e.g. from getEnergyConfigType())
 * @param tableName - The table path for extract (e.g. "assembly_energy", "fuel_efficiency")
 * @returns Promise resolving to the GraphQL response with objects.nodes[0] and dynamicFields.nodes
 *
 * @example
 * ```typescript
 * const result = await getSingletonConfigObjectByType(getEnergyConfigType(), "assembly_energy");
 * const nodes = result.data?.objects?.nodes[0]?.asMoveObject?.contents?.extract?.extract?.asAddress?.addressAt?.dynamicFields?.nodes;
 * ```
 */
export async function getSingletonConfigObjectByType(
  objectType: string,
  tableName: string,
) {
  return executeGraphQLQuery<GetSingletonConfigObjectByTypeResponse>(
    GET_SINGLETON_CONFIG_OBJECT_BY_TYPE,
    {
      object_type: objectType,
      table_name: tableName,
    },
  );
}

/**
 * Get all objects of a specific type with pagination.
 *
 * Use with caution as this may return many results. Supports cursor-based
 * pagination for iterating through large result sets.
 *
 * @category GraphQL Client
 * @param objectType - The full Move type string
 * @param options - Pagination options
 * @param options.first - Number of results per page (default: 50)
 * @param options.after - Cursor for next page
 * @returns Promise resolving to paginated object list
 *
 * @example Paginated fetch
 * ```typescript
 * let cursor: string | undefined;
 * do {
 *   const result = await getObjectsByType("0xpkg::module::Type", {
 *     first: 50,
 *     after: cursor
 *   });
 *   const objects = result.data?.objects?.nodes;
 *   cursor = result.data?.objects?.pageInfo?.hasNextPage
 *     ? result.data?.objects?.pageInfo?.endCursor
 *     : undefined;
 * } while (cursor);
 * ```
 */
export async function getObjectsByType(
  objectType: string,
  options?: { first?: number; after?: string },
) {
  return executeGraphQLQuery<GetObjectsByTypeResponse>(GET_OBJECTS_BY_TYPE, {
    object_type: objectType,
    first: options?.first ?? 50,
    after: options?.after,
  });
}

/**
 * Fetch an EVE Frontier assembly and its owner character in one call.
 *
 * This is the primary function for loading assembly data in dApps.
 * It fetches the assembly's Move object data, dynamic fields, and
 * resolves the owner character through the ownership chain.
 *
 * @category GraphQL Client
 * @param assemblyId - The assembly's Sui object ID
 * @returns Promise resolving to:
 *   - `moveObject` - The assembly's Move object data with JSON contents and dynamic fields
 *   - `character` - The owner character info (id, name, address, tribeId, characterId)
 *
 * @example Basic usage
 * ```typescript
 * const { moveObject, character } = await getAssemblyWithOwner("0x123...");
 *
 * if (moveObject) {
 *   console.log("Assembly data:", moveObject.contents.json);
 *   console.log("Dynamic fields:", moveObject.dynamicFields?.nodes);
 * }
 *
 * if (character) {
 *   console.log("Owner:", character.name);
 * }
 * ```
 *
 * @example Transform to typed Assembly
 * ```typescript
 * import { transformToAssembly } from '@evefrontier/dapp-kit';
 *
 * const { moveObject, character } = await getAssemblyWithOwner(assemblyId);
 * const assembly = await transformToAssembly(assemblyId, moveObject, { character });
 * console.log(assembly.name, assembly.type, assembly.state);
 * ```
 *
 * @see {@link transformToAssembly} for converting raw data to typed Assembly
 */
export async function getAssemblyWithOwner(assemblyId: string): Promise<{
  moveObject: {
    contents: {
      json: Record<string, unknown>;
      type?: { repr: string };
    };
    dynamicFields?: {
      nodes: DynamicFieldNode[];
    };
  } | null;
  assemblyOwner: CharacterInfo | null;
  energySource: RawSuiObjectData | null;
  destinationGate: RawSuiObjectData | null;
}> {
  try {
    const result = await getObjectAndCharacterOwner(assemblyId);

    if (!result.data?.object?.asMoveObject) {
      console.warn("[DappKit] getAssemblyWithOwner: Assembly not found");
      return {
        moveObject: null,
        assemblyOwner: null,
        energySource: null,
        destinationGate: null,
      };
    }

    const moveObject = result.data.object.asMoveObject;

    const dynamicFields = moveObject.dynamicFields;

    // Extract character info from the owner chain
    let characterInfo: CharacterInfo | null = null;

    const characterMoveObject =
      moveObject.contents.extract?.asAddress?.asObject?.asMoveObject?.owner
        ?.address?.objects?.nodes[0]?.contents?.authorizedObj?.asAddress
        ?.asObject?.asMoveObject;

    if (!characterMoveObject?.contents?.json) {
      console.warn("[DappKit] getAssemblyWithOwner: Character not found");
      return {
        moveObject: result.data?.object?.asMoveObject,
        assemblyOwner: null,
        energySource: null,
        destinationGate: null,
      };
    }

    const characterJson = characterMoveObject?.contents.json;
    characterInfo = parseCharacterFromJson(characterJson);
    if (!characterInfo) {
      console.warn(
        "[DappKit] getAssemblyWithOwner: Could not extract character JSON from owner chain",
      );
    }

    const energySourceMoveObject =
      moveObject.contents.energySource?.asAddress?.asObject?.asMoveObject;

    if (!energySourceMoveObject?.contents?.json) {
      console.warn("[DappKit] getAssemblyWithOwner: Energy source not found");
    }

    const destinationGateMoveObject =
      moveObject.contents.destinationGate?.asAddress?.asObject?.asMoveObject;

    const energySourceJson = energySourceMoveObject?.contents
      ?.json as unknown as RawSuiObjectData | null;
    const destinationGateJson = destinationGateMoveObject?.contents
      ?.json as unknown as RawSuiObjectData | null;

    if (!energySourceJson) {
      console.warn(
        "[DappKit] getAssemblyWithOwner: Energy source not found. Object might be a network node.",
      );
    }

    return {
      moveObject: {
        contents: {
          json: moveObject.contents.json,
          type: moveObject.contents.type,
        },
        dynamicFields: dynamicFields || undefined,
      },
      assemblyOwner: characterInfo,
      energySource: energySourceJson ?? null,
      destinationGate: destinationGateJson ?? null,
    };
  } catch (error) {
    console.error("[DappKit] getAssemblyWithOwner error:", error);
    return {
      moveObject: null,
      assemblyOwner: null,
      energySource: null,
      destinationGate: null,
    };
  }
}
