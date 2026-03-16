import { SUI_GRAPHQL_NETWORKS } from "../utils";
import {
  DetailedAssemblyResponse,
  StorageModule,
  TurretModule,
  GateModule,
  RefineryModule,
  ManufacturingModule,
  NetworkNodeModule,
} from "./worldApiReturnTypes";

// =========================================
// Query Parameters
// =========================================

/** @category Types */
export enum QueryParams {
  ITEM_ID = "itemId",
  TENANT = "tenant",
}

/** @category Types */
export type SuiGraphqlNetwork = (typeof SUI_GRAPHQL_NETWORKS)[number];

// =========================================
// Assembly State and Actions
// =========================================

/** @category Types */
export enum State {
  NULL = "NULL",
  UNANCHORED = "UNANCHORED",
  ANCHORED = "anchored", // Anchored + offline
  ONLINE = "online", // Anchored + online
  DESTROYED = "destroyed",
}

/** @category Types */
export enum ActionTypes {
  UNANCHOR = "Unanchor",
  ANCHOR = "Anchor",
  BRING_ONLINE = "Online unit",
  BRING_OFFLINE = "Offline unit",
  DESTROY = "Destroy",
}

// =========================================
// UI Related Types
// =========================================

/** @category Types */
export enum Severity {
  Error = "error",
  Warning = "warning",
  Info = "info",
  Success = "success",
}

/** @category Types */
export interface Notify {
  type: Severity;
  message: string;
  name?: string;
  namespace?: string;
  namespaceLabel?: string;
}

// =========================================
// Assembly Types
// =========================================

/** @category Types */
export enum Assemblies {
  SmartStorageUnit = "SmartStorageUnit",
  SmartTurret = "SmartTurret",
  SmartGate = "SmartGate",
  NetworkNode = "NetworkNode",
  Manufacturing = "Manufacturing",
  Refinery = "Refinery",
  Assembly = "Assembly",
}

/** @category Types */
export interface AssemblyProperties<T extends Assemblies>
  extends DetailedAssemblyResponse {
  type: T;
}

/** @category Types */
export type AssemblyType<T extends Assemblies> = {
  [K in T]: K extends Assemblies.SmartStorageUnit
    ? AssemblyProperties<K> & { storage: StorageModule }
    : K extends Assemblies.SmartTurret
      ? AssemblyProperties<K> & { turret: TurretModule }
      : K extends Assemblies.SmartGate
        ? AssemblyProperties<K> & { gate: GateModule }
        : K extends Assemblies.NetworkNode
          ? AssemblyProperties<K> & { networkNode: NetworkNodeModule }
          : K extends Assemblies.Refinery
            ? AssemblyProperties<K> & { refinery: RefineryModule }
            : K extends Assemblies.Manufacturing
              ? AssemblyProperties<K> & { manufacturing: ManufacturingModule }
              : K extends Assemblies.Assembly
                ? AssemblyProperties<K>
                : never;
}[T];

// =========================================
// Character Related Types
// =========================================

/** @category Types */
export interface DetailedSmartCharacterResponse {
  address: string;
  name: string;
  id: string;
  tribeId: number;
  smartAssemblies: Assemblies[];
  portrait: string;
}

// =========================================
// Datahub Game Info
// =========================================

/**
 * Game item/type information from the EVE Frontier Datahub API.
 *
 * Contains metadata about items, assemblies, and other game objects
 * including display names, descriptions, icons, and physical properties.
 *
 * @category Types
 */
export interface DatahubGameInfo {
  /** The type ID (matches on-chain type_id) */
  id: number;
  /** Display name of the item/type */
  name: string;
  /** Description text */
  description: string;
  /** Mass in kg */
  mass: number;
  /** Radius in meters */
  radius: number;
  /** Volume in cubic meters */
  volume: number;
  /** Portion size for stacking */
  portionSize: number;
  /** Category group name (e.g., "Structures") */
  groupName: string;
  /** Category group ID */
  groupId: number;
  /** Top-level category name */
  categoryName: string;
  /** Top-level category ID */
  categoryId: number;
  /** URL to the item's icon image */
  iconUrl: string;
}
