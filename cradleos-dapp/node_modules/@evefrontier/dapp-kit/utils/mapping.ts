import { bcs } from "@mysten/sui/bcs";
import { Assemblies, State } from "../types";
import { deriveObjectID } from "@mysten/sui/utils";
import { getEveWorldPackageId, getObjectRegistryType } from "./constants";
import { getSingletonObjectByType } from "../graphql/client";

/**
 * Convert raw status variant string to State enum
 *
 * @category Utilities - Mapping
 */
export function parseStatus(statusVariant: string | undefined): State {
  if (!statusVariant) return State.NULL;

  switch (statusVariant.toUpperCase()) {
    case "ONLINE":
      return State.ONLINE;
    case "OFFLINE":
      return State.ANCHORED;
    case "ANCHORED":
      return State.ANCHORED;
    case "UNANCHORED":
      return State.UNANCHORED;
    case "DESTROYED":
      return State.DESTROYED;
    default:
      return State.NULL;
  }
}

/**
 * Get assembly type from Move object type tag
 * @param typeRepr - The Move object type tag
 * @returns The assembly type as an enum
 *
 * @category Utilities - Mapping
 */
export function getAssemblyType(typeRepr: string): Assemblies {
  if (typeRepr.includes("::storage_unit::StorageUnit")) {
    return Assemblies.SmartStorageUnit;
  }
  if (typeRepr.includes("::turret::Turret")) {
    return Assemblies.SmartTurret;
  }
  if (typeRepr.includes("::gate::Gate")) {
    return Assemblies.SmartGate;
  }
  if (typeRepr.includes("::network_node::NetworkNode")) {
    return Assemblies.NetworkNode;
  }
  if (typeRepr.includes("::manufacturing::Manufacturing")) {
    return Assemblies.Manufacturing;
  }
  if (typeRepr.includes("::refinery::Refinery")) {
    return Assemblies.Refinery;
  }
  if (typeRepr.includes("::assembly::Assembly")) {
    return Assemblies.Assembly;
  }

  // Assembly type not found, return default Assembly
  return Assemblies.Assembly;
}

// Cache for the Registry address
let objectRegistryAddress: string | null = null;
/**
 * Fetches the AssemblyRegistry singleton address from the chain
 * Caches the result to avoid repeated queries
 *
 * @category Utilities - Mapping
 */
export async function getRegistryAddress(): Promise<string> {
  if (objectRegistryAddress) {
    return objectRegistryAddress;
  }

  const registryType = getObjectRegistryType();
  const result = await getSingletonObjectByType(registryType);

  const address = result.data?.objects?.nodes?.[0]?.address;
  if (!address) {
    throw new Error(`ObjectRegistry not found for type: ${registryType}`);
  }

  objectRegistryAddress = address;
  return address;
}

/**
 * Derives an object ID from an in-game item ID using the AssemblyRegistry
 * @param itemId - The in-game item ID
 * @returns The derived Sui object ID
 *
 * @category Utilities - Mapping
 */
export async function getObjectId(
  itemId: string,
  selectedTenant: string,
): Promise<string> {
  const registryAddress = await getRegistryAddress();

  const bcsType = bcs.struct("TenantItemId", {
    id: bcs.u64(),
    tenant: bcs.string(),
  });
  const key = bcsType
    .serialize({ id: BigInt(itemId), tenant: selectedTenant })
    .toBytes();

  const objectId = deriveObjectID(
    registryAddress,
    `${getEveWorldPackageId()}::in_game_id::TenantItemId`,
    key,
  );

  return objectId;
}
