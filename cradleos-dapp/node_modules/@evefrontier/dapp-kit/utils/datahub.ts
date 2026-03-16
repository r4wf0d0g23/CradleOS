import { DATAHUB_BY_TENANT, DEFAULT_TENANT } from "./constants";
import { DatahubGameInfo, QueryParams } from "../types";

/**
 * Resolves tenant from a URL search string (e.g. window.location.search).
 * Trims the param value and falls back to DEFAULT_TENANT when missing or blank.
 * @internal
 */
export function resolveTenantFromSearch(search: string): string {
  const tenant =
    new URLSearchParams(search).get(QueryParams.TENANT)?.trim() ||
    DEFAULT_TENANT;
  return tenant;
}

/**
 * Resolves the datahub host for a tenant key. Falls back to DEFAULT_TENANT host for unknown tenants.
 * @internal
 */
export function resolveDatahubHost(tenant: string): string {
  return (
    DATAHUB_BY_TENANT[tenant as keyof typeof DATAHUB_BY_TENANT] ??
    DATAHUB_BY_TENANT[DEFAULT_TENANT]
  );
}

/**
 * Fetch game type information from the EVE Frontier Datahub API.
 *
 * Retrieves metadata about a game type by its ID, including display name,
 * description, icon URL, and physical properties. This data is used to
 * enrich on-chain objects with human-readable information.
 *
 * Resolves tenant from the window.location.search param.
 *
 * @category Utilities - Config
 * @param typeId - The numeric type ID (from on-chain type_id field)
 * @returns Promise resolving to the type's game info
 *
 * @example Fetch assembly type info
 * ```typescript
 * const typeInfo = await getDatahubGameInfo(83463);
 * console.log(typeInfo.name);        // "Smart Storage Unit"
 * console.log(typeInfo.iconUrl);     // URL to icon
 * console.log(typeInfo.description); // Description text
 * ```
 *
 * @example Enrich inventory items
 * ```typescript
 * const inventoryItem = { type_id: 12345, quantity: 100 };
 * const info = await getDatahubGameInfo(inventoryItem.type_id);
 * console.log(`${info.name} x${inventoryItem.quantity}`);
 * ```
 */
export async function getDatahubGameInfo(
  typeId: number,
): Promise<DatahubGameInfo> {
  const tenant = resolveTenantFromSearch(window.location.search);
  const host = resolveDatahubHost(tenant);

  const response = await fetch(`https://${host}/v2/types/${typeId}`);
  const data = await response.json();

  return data;
}
