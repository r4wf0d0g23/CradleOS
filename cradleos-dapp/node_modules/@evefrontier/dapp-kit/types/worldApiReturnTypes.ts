import { MoveObjectData, RawSuiObjectData } from "../graphql/types";
import { TransformOptions } from "../utils";
import { State, Assemblies, type DatahubGameInfo } from "./types";

// =========================================
// Inventory Related Types
// =========================================

/** @category Types */
export interface InventoryItem {
  id: string;
  item_id: string;
  location: { location_hash: string };
  quantity: number;
  tenant: string;
  type_id: number;
  name: string;
}

/** @category Types */
export interface EphemeralInventory {
  ownerId: string;
  ownerName: string;
  storageCapacity: bigint;
  usedCapacity: bigint;
  ephemeralInventoryItems: InventoryItem[];
}

// =========================================
// Module Types
// =========================================

/** @category Types */
export interface StorageModule {
  mainInventory: {
    capacity: string;
    usedCapacity: string;
    items: InventoryItem[];
  };
  ephemeralInventories: EphemeralInventory[];
}

/** @category Types */
export interface TurretModule {}

/** @category Types */
export interface ManufacturingModule {}

/** @category Types */
export interface RefineryModule {}

/** @category Types */
export interface GateModule {
  destinationId: string | undefined;
  destinationGate: RawSuiObjectData | null;
}

/** @category Types */
export interface NetworkNodeModule {
  fuel: FuelResponse;
  energyProduction: number;
  energyMaxCapacity: number;
  totalReservedEnergy: number;
  linkedAssemblies: SmartAssemblyResponse[];
}

// =========================================
// Fuel Related Types
// =========================================

/** @category Types @internal */
export interface FuelResponse {
  quantity: number;
  burnTimeInMs: number;
  burnStartTime: number;
  isBurning: boolean;
  lastUpdated: number;
  maxCapacity: number;
  previousCycleElapsedTime: number;
  unitVolume: number;
  typeId: number;
}

/** @category Types @internal */
export interface BurnResponse {
  isBurning: boolean;
  startTime: string;
}

// =========================================
// Location Related Types
// =========================================

/** @category Types @internal */
export interface SolarSystem {
  id: number;
  name: string;
  location: {
    x: number;
    y: number;
    z: number;
  };
}

// =========================================
// Character Related Types
// =========================================

/** @category Types @internal */
export interface SmartCharacterResponse {
  address: string;
  id: string;
  name: string;
  tribeId: number;
  characterId: number;
}

// =========================================
// Assembly Related Types
// =========================================

/** @category Types */
export interface SmartAssemblyResponse {
  id: string;
  item_id: number;
  type: Assemblies;
  typeDetails?: DatahubGameInfo;
  name: string;
  state: State;
  character?: SmartCharacterResponse;
  solarSystem?: SolarSystem;
  isParentNodeOnline?: boolean;
  energySourceId?: string;
  energyUsage: number;
  typeId: number;
  _raw?: MoveObjectData;
  _options?: TransformOptions;
}

/** @category Types */
export interface DetailedAssemblyResponse extends SmartAssemblyResponse {
  description: string;
  dappURL: string;
}
