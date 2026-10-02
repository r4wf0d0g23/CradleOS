/** Sui object addresses are NOT EVE's u32 game IDs. */
export function characterGameId(fields: Record<string, unknown>): number {
  const key = fields.key as { fields?: { item_id?: unknown }; item_id?: unknown } | undefined;
  const id = Number(key?.fields?.item_id ?? key?.item_id);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 0xffffffff) throw new Error("Current character game ID is unavailable");
  return id;
}
