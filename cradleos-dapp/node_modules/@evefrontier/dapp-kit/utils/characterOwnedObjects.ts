import { getCharacterAndOwnedObjects } from "../graphql/client";
import type { GetCharacterAndOwnedObjectsResponse } from "../graphql/types";

/**
 * Extracts the JSON payloads from the first character's owned objects
 * (from getCharacterAndOwnedObjects response data).
 *
 * @param data - Response data from getCharacterAndOwnedObjects
 * @returns Array of contents.json for each owned object, or undefined if missing
 *
 * @category Character Helpers
 */
export function getCharacterOwnedObjectsJson(
  data: GetCharacterAndOwnedObjectsResponse | undefined,
): Record<string, unknown>[] | undefined {
  const objects =
    data?.address?.objects?.nodes?.[0]?.contents?.extract?.asAddress?.objects;
  if (!objects?.nodes?.length) return undefined;
  return objects.nodes.map(
    (node) =>
      node.contents.extract.asAddress.asObject.asMoveObject.contents.json,
  );
}

/**
 * Fetches the character and owned objects for an address, then returns the JSON
 * payloads of the first character's owned objects.
 *
 * @param address - Wallet/signer address to query
 * @returns Promise resolving to an array of contents.json per owned object, or undefined if none
 *
 * @category Character Helpers
 */
export async function getCharacterOwnedObjects(
  address: string,
): Promise<Record<string, unknown>[] | undefined> {
  const response = await getCharacterAndOwnedObjects(address).then(
    (response) => {
      const data = response.data;
      if (!data) {
        console.warn(
          "[Dapp] No data returned from getCharacterAndOwnedObjects",
        );
        return;
      }
      const ownedObjectsJson = getCharacterOwnedObjectsJson(data);
      return ownedObjectsJson;
    },
  );

  return response;
}
