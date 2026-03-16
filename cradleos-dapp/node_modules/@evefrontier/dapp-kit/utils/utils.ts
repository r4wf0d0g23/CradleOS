/* eslint-disable @typescript-eslint/no-explicit-any */
import { SuiChain } from "@mysten/wallet-standard";
import {
  Assemblies,
  DetailedAssemblyResponse,
  SmartAssemblyResponse,
  AssemblyType,
} from "../types";

import { ONE_M3 } from "./constants";

/**
 * Abbreviate a Sui address or hex string for display.
 *
 * Shortens long addresses to show only the beginning and end characters
 * with ellipsis in the middle.
 *
 * @category Utilities - Formatting
 * @param string - The address or hex string to abbreviate
 * @param precision - Number of characters to show on each end (default: 5)
 * @param expanded - If true, returns the full string without abbreviation
 * @returns The abbreviated string (e.g., "0x123...abc")
 *
 * @example
 * ```typescript
 * abbreviateAddress("0x1234567890abcdef1234567890abcdef"); // "0x123...cdef"
 * abbreviateAddress("0x1234567890abcdef", 3);              // "0x1...def"
 * abbreviateAddress("0x1234567890abcdef", 5, true);        // Full address
 * ```
 */
export const abbreviateAddress = (
  string?: `0x${string}` | string,
  precision = 5,
  expanded = false,
): string => {
  if (!string) return "";
  if (expanded) return string;
  if (string.length <= precision * 2) return string;
  return `${string.slice(0, precision)}...${string.slice(-precision)}`;
};

/**
 * Check if an account is the owner of a smart assembly.
 *
 * Compares the assembly's owner address with the provided account address
 * to determine ownership.
 *
 * @category Utilities - Assembly
 * @param assembly - The assembly object to check ownership of
 * @param account - The account address to check against
 * @returns True if the account owns the assembly, false otherwise
 *
 * @example
 * ```typescript
 * const { assembly } = useSmartObject();
 * const { currentAccount } = useConnection();
 *
 * if (isOwner(assembly, currentAccount?.address)) {
 *   // Show owner-only actions
 * }
 * ```
 */
export const isOwner = (
  assembly: DetailedAssemblyResponse | SmartAssemblyResponse | null,
  account?: `0x${string}` | string,
): boolean => {
  if (!assembly?.character?.address || account == "0x") return false;
  return assembly.character.address === (account ?? "");
};

/**
 * Generate a Suiscan transaction URL for a given transaction hash.
 *
 * @category Utilities - Assembly
 * @param suiChain - The Sui chain identifier (e.g., "sui:testnet", "sui:mainnet")
 * @param txHash - The transaction digest hash
 * @returns Full Suiscan URL to view the transaction
 *
 * @example
 * ```typescript
 * const url = getTxUrl("sui:testnet", "ABC123...");
 * // Returns: "https://suiscan.xyz/testnet/tx/ABC123..."
 * ```
 */
export const getTxUrl = (suiChain: SuiChain, txHash: string): string => {
  const network = suiChain.split(":")[1];

  return `https://suiscan.xyz/${network}/tx/${txHash}`;
};

/** Strips protocol (e.g. https://) from a URL and returns the rest. @category Utilities - Formatting */
export const parseURL = (string: string): string => {
  if (string.includes("://")) {
    return string.split("://")[1];
  }
  return string;
};

/** Copies the given string to the clipboard. @category Utilities - Formatting */
export const clickToCopy = (string: string) => {
  return navigator.clipboard.writeText(string);
};

/** Returns elements that appear in both arrays. @category Utilities - Formatting */
export const getCommonItems = (array1: any[], array2: any[]) => {
  const commonItems: any[] = [];
  const set: Set<any> = new Set([]);

  for (let i = 0; i < array1.length; i++) {
    const value = array1[i];
    if (!set.has(value)) set.add(value);
  }
  for (let i = 0; i < array2.length; i++) {
    const value = array2[i];
    if (set.has(value)) commonItems.push(value);
  }
  return commonItems;
};

/** Removes trailing zeros after the last significant decimal. @category Utilities - Formatting */
export const removeTrailingZeros = (number: string) => {
  return number.replace(/(\.\d*?[1-9])0+$|\.0*$/, "$1");
};

/** Returns the env value or fallback if empty. @category Utilities - Config */
export const getEnv = (env: string, fallback: string): string => {
  if (!env) return fallback;
  return env;
};

/**
 * Volume in m³ from unit quantity and volume per unit (wei, 10^18).
 * @param quantity - Unit quantity of the item
 * @param volume - Volume per unit in wei (10^18)
 * @returns Volume in m³
 * @category Utilities - Formatting
 */
export const getVolumeM3 = (quantity: bigint, volume: bigint): number => {
  const totalVolume = Number(quantity) * Number(volume);
  return totalVolume;
};

/**
 * Format a raw volume value to cubic meters (m³).
 *
 * Converts from the on-chain representation (wei-like, 10^18) to m³.
 *
 * @category Utilities - Formatting
 * @param quantity - The raw volume value as string or bigint
 * @returns Volume in cubic meters
 *
 * @example
 * ```typescript
 * const m3 = formatM3(BigInt("1000000000000000000")); // 1.0 m³
 * ```
 */
export const formatM3 = (quantity: string | bigint): number => {
  return Number(quantity) / ONE_M3;
};

/**
 * Get the dApp URL for an assembly, ensuring it has a protocol prefix.
 *
 * @category Utilities - Assembly
 * @param assembly - The assembly object
 * @returns The full dApp URL with https:// prefix if needed
 *
 * @example
 * ```typescript
 * const { assembly } = useSmartObject();
 * const dappUrl = getDappUrl(assembly);
 * if (dappUrl) {
 *   window.open(dappUrl, '_blank');
 * }
 * ```
 */
export const getDappUrl = (assembly: AssemblyType<Assemblies>): string => {
  if (!assembly?.dappURL) return "";

  const pattern = /^((http|https|ftp):\/\/)/;

  let url = assembly.dappURL;
  if (!pattern.test(url)) {
    url = "https://" + url;
  }

  return url;
};

/**
 * Check if two addresses match.
 *
 * @category Utilities - Assembly
 * @param address1 - First address to compare
 * @param address2 - Second address to compare
 * @returns True if addresses match, false otherwise
 */
export const findOwnerByAddress = (
  address1: string | undefined,
  address2: string | undefined,
): boolean => {
  if (!address2 || !address1 || address1 == "" || address2 == "") return false;
  return address1 === address2;
};

/**
 * Type guard to check if an assembly is of a specific type.
 *
 * Use this to narrow the type of an assembly for type-safe property access.
 *
 * @category Utilities - Assembly
 * @param assembly - The assembly to check
 * @param assemblyType - The expected assembly type
 * @returns True if assembly matches the specified type
 *
 * @example
 * ```typescript
 * const { assembly } = useSmartObject();
 *
 * if (assertAssemblyType(assembly, Assemblies.SmartStorageUnit)) {
 *   // TypeScript knows assembly is SmartStorageUnit here
 *   console.log(assembly.storage.mainInventory);
 * }
 * ```
 */
export const assertAssemblyType = (
  assembly: AssemblyType<Assemblies> | null,
  assemblyType: Assemblies,
): assembly is AssemblyType<Assemblies> => {
  if (typeof assembly?.type === "string") {
    return assembly.type === assemblyType;
  }
  return false;
};

/**
 * Format a duration in seconds to a human-readable string.
 *
 * Displays the duration in days, hours, minutes, and seconds as appropriate.
 *
 * @category Utilities - Formatting
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "02d 05h 30m 15s")
 *
 * @example
 * ```typescript
 * formatDuration(3665);   // "01h 01m 05s"
 * formatDuration(90061);  // "01d 01h 01m 01s"
 * formatDuration(45);     // "45s"
 * ```
 */
export const formatDuration = (seconds: number): string => {
  if (seconds === 0) return "0m 0s";

  const days = Math.floor(seconds / (24 * 3600));
  seconds %= 24 * 3600;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  const formattedDays = String(days).padStart(2, "0");
  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(remainingSeconds.toFixed(0)).padStart(2, "0");

  if (days > 0) {
    return `${formattedDays}d ${formattedHours}h ${formattedMinutes}m ${formattedSeconds}s`;
  } else if (hours > 0) {
    return `${formattedHours}h ${formattedMinutes}m ${formattedSeconds}s`;
  } else if (minutes > 0) {
    return `${formattedMinutes}m ${formattedSeconds}s`;
  } else {
    return `${formattedSeconds}s`;
  }
};
