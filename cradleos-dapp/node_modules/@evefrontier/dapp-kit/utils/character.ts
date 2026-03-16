import type { CharacterInfo, RawCharacterData } from "../graphql/types";

function parseOptionalInt(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/**
 * Normalize raw character JSON (from wallet/assembly GQL responses) into CharacterInfo.
 * Accepts varying shapes; returns null when input is not a usable object.
 *
 * @param json - Raw JSON (e.g. from contents.json or extract...contents.json)
 * @returns CharacterInfo or null
 * @category Character Helpers
 */
export function parseCharacterFromJson(json: unknown): CharacterInfo | null {
  if (json == null || typeof json !== "object" || Array.isArray(json)) {
    return null;
  }
  const obj = json as Record<string, unknown>;
  const metadata =
    obj.metadata != null &&
    typeof obj.metadata === "object" &&
    !Array.isArray(obj.metadata)
      ? (obj.metadata as Record<string, unknown>)
      : undefined;
  const key =
    obj.key != null && typeof obj.key === "object" && !Array.isArray(obj.key)
      ? (obj.key as Record<string, unknown>)
      : undefined;

  return {
    id: typeof obj.id === "string" ? obj.id : "",
    address:
      typeof obj.character_address === "string" ? obj.character_address : "",
    name: typeof metadata?.name === "string" ? metadata.name : "",
    tribeId: parseOptionalInt(obj.tribe_id),
    characterId: parseOptionalInt(key?.item_id),
    _raw: json as RawCharacterData,
  };
}
