import {
  Assemblies,
  AssemblyType,
  State,
  DetailedSmartCharacterResponse,
  SmartAssemblyResponse,
  InventoryItem,
  DatahubGameInfo,
  DetailedAssemblyResponse,
} from "../types";
import type {
  MoveObjectData,
  RawSuiObjectData,
  CharacterInfo,
} from "../graphql/types";
import { getAssemblyType, parseStatus } from "./mapping";
import { getDatahubGameInfo } from "./datahub";
import { getEnergyConfig, getEnergyUsageForType } from "./config";
import { getObjectWithJson } from "../graphql";

/**
 * Transform CharacterInfo to DetailedSmartCharacterResponse
 *
 * @category Utilities - Transforms
 */
export function transformToCharacter(
  characterInfo: CharacterInfo,
): DetailedSmartCharacterResponse {
  return {
    id: characterInfo.id,
    address: characterInfo.address,
    name: characterInfo.name,
    tribeId: characterInfo.tribeId,
    smartAssemblies: [],
    portrait: "",
  };
}

/**
 * Additional options for transformToAssembly
 */
export interface TransformOptions {
  /** Character/owner information */
  character?: CharacterInfo | null;
  /** Pre-fetched datahub game info (name, description, image) */
  datahubInfo?: DatahubGameInfo | null;
  /** Energy source information */
  energySource?: RawSuiObjectData | null;
  /** Destination gate information, if Smart Gate */
  destinationGate?: RawSuiObjectData | null;
}

/**
 * Transform raw Sui Move object data to AssemblyType
 *
 * @param objectId - The Sui object address
 * @param moveObject - The Move object data from GraphQL
 * @param options - Optional transform options including character info
 *
 * @category Utilities - Transforms
 */
export async function transformToAssembly(
  objectId: string,
  moveObject: MoveObjectData,
  options?: TransformOptions,
): Promise<AssemblyType<Assemblies> | null> {
  const rawData = moveObject.contents?.json as unknown as RawSuiObjectData;

  if (!rawData) {
    console.warn("[DappKit] transformToAssembly: No raw data found");
    return null;
  }

  // Determine assembly type from Move object
  const typeId = rawData.type_id || rawData.status?.type_id || "0";
  const assemblyType = getAssemblyType(moveObject.contents.type?.repr || ""); // This is the Move object type tag, not the typeId

  // Parse dynamic fields for additional data (such as inventory)
  const dynamicFields: Record<string, unknown> = {};
  if (moveObject.dynamicFields?.nodes) {
    for (const field of moveObject.dynamicFields.nodes) {
      const fieldName =
        typeof field.name.json === "string"
          ? field.name.json
          : JSON.stringify(field.name.json);

      dynamicFields[fieldName] = field.contents.json;
    }
  }

  // Build base assembly properties
  const state = parseStatus(rawData.status?.status?.["@variant"]);

  // Use pre-fetched datahub info for defaults (name, description, image); energy from on-chain EnergyConfig
  const datahubInfo = options?.datahubInfo;
  const energySource = options?.energySource;
  const energyUsage = await getEnergyUsageForType(parseInt(typeId, 10) || 0);

  const parentState = parseStatus(energySource?.status?.status?.["@variant"]);

  const baseAssembly = {
    id: rawData.id || objectId,
    item_id: parseInt(rawData.key?.item_id || "0", 10) || 0,
    type: assemblyType,
    name: rawData.metadata?.name || "",
    description: rawData.metadata?.description || "",
    dappURL: rawData.metadata?.url || "",
    energySourceId:
      assemblyType === Assemblies.NetworkNode
        ? undefined
        : energySource?.id || rawData.energy_source_id || "", // Parent network node ID
    isParentNodeOnline:
      assemblyType === Assemblies.NetworkNode
        ? undefined
        : parentState === State.ONLINE, // Defined in all cases except network nodes
    state,
    typeId: parseInt(typeId, 10) || 0,
    energyUsage,
    typeDetails: datahubInfo,
    // Owner information
    character: options?.character || undefined,
    // Include raw data for debugging/extension
    _raw: moveObject,
    _options: options,
  } as DetailedAssemblyResponse;

  // Add module-specific data based on assembly type
  switch (assemblyType) {
    case Assemblies.SmartStorageUnit:
      const inventoryKey = rawData.inventory_keys?.[0];
      const inventoryData = dynamicFields[inventoryKey || ""] as
        | {
            key: string;
            value?: {
              max_capacity: string;
              used_capacity: string;
              items?: {
                contents?: Array<{ key: string; value: unknown }>;
              };
            };
          }
        | undefined;

      const inventoryItems = inventoryData?.value?.items?.contents?.map(
        (item) => {
          return item.value as InventoryItem;
        },
      );

      return {
        ...baseAssembly,
        storage: {
          mainInventory: {
            capacity: inventoryData?.value?.max_capacity,
            usedCapacity: inventoryData?.value?.used_capacity,
            items: inventoryItems,
          },
          ephemeralInventories: [],
        },
      } as AssemblyType<Assemblies.SmartStorageUnit>;

    case Assemblies.SmartTurret:
      return {
        ...baseAssembly,
        turret: {},
      } as AssemblyType<Assemblies.SmartTurret>;

    case Assemblies.SmartGate:
      return {
        ...baseAssembly,
        gate: {
          destinationId: rawData.linked_gate_id,
          destinationGate: options?.destinationGate,
        },
      } as AssemblyType<Assemblies.SmartGate>;

    case Assemblies.NetworkNode:
      const energyConfig = await getEnergyConfig();
      // TODO: Batch this call so that it can fetch all assemblies at once
      const linkedAssemblies: SmartAssemblyResponse[] = await Promise.all(
        (rawData.connected_assembly_ids || []).map(async (id) => {
          const assemblyResult = await getObjectWithJson(id);
          const assemblyJson = assemblyResult.data?.object?.asMoveObject
            ?.contents?.json as RawSuiObjectData | undefined;

          // TODO: Change this so that it doesn't need to be fetched for each assembly
          const typeDetails = await getDatahubGameInfo(
            parseInt(assemblyJson?.type_id || "0", 10),
          );

          const linkedTypeId = parseInt(assemblyJson?.type_id || "0", 10);
          return {
            id,
            item_id: parseInt(assemblyJson?.key?.item_id || "0", 10),
            state: parseStatus(assemblyJson?.status?.status?.["@variant"]),
            energyUsage: energyConfig[linkedTypeId] ?? 0,
            typeId: linkedTypeId,
            name: assemblyJson?.metadata?.name || "",
            type: getAssemblyType(assemblyJson?.type_id || ""),
            typeDetails: typeDetails,
          };
        }),
      );

      return {
        ...baseAssembly,
        networkNode: {
          fuel: {
            burnTimeInMs: parseInt(rawData.fuel?.burn_rate_in_ms || "0", 10),
            burnStartTime: parseInt(rawData.fuel?.burn_start_time || "0", 10),
            isBurning: rawData.fuel?.is_burning || false,
            lastUpdated: parseInt(rawData.fuel?.last_updated || "0", 10),
            maxCapacity: parseInt(rawData.fuel?.max_capacity || "0", 10),
            previousCycleElapsedTime: parseInt(
              rawData.fuel?.previous_cycle_elapsed_time || "0",
              10,
            ),
            quantity: parseInt(rawData.fuel?.quantity || "0", 10),
            typeId: parseInt(rawData.fuel?.type_id || "0", 10),
            unitVolume: parseInt(rawData.fuel?.unit_volume || "0", 10),
          },
          energyProduction: parseInt(
            rawData.energy_source?.current_energy_production || "0",
            10,
          ),
          energyMaxCapacity: parseInt(
            rawData.energy_source?.max_energy_production || "0",
            10,
          ),
          totalReservedEnergy: parseInt(
            rawData.energy_source?.total_reserved_energy || "0",
            10,
          ),
          linkedAssemblies: linkedAssemblies || [],
        },
      } as AssemblyType<Assemblies.NetworkNode>;

    case Assemblies.Manufacturing:
      return {
        ...baseAssembly,
        manufacturing: {
          isParentNodeOnline: state === State.ONLINE,
        },
      } as AssemblyType<Assemblies.Manufacturing>;

    case Assemblies.Refinery:
      return {
        ...baseAssembly,
        refinery: {
          isParentNodeOnline: state === State.ONLINE,
        },
      } as AssemblyType<Assemblies.Refinery>;

    default:
      // Default to Assembly
      return {
        ...baseAssembly,
      } as AssemblyType<Assemblies.Assembly>;
  }
}
