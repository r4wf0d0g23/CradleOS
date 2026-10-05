/** Wire format shared with cradleos_turret::turret. Settings live on the turret. */
export const TURRET_MARKER = "\n[cradleos-turret:v1:";
export type TurretSettings = {
  mode: number;
  priority: number;
  shipClass: number;
  strictClass: boolean;
  stopOnDisengage: boolean;
  friends: number[];
  hostiles: number[];
  friendlyTribes: number[];
  hostileTribes: number[];
};
export const DEFAULT_TURRET_SETTINGS: TurretSettings = {
  mode: 1,
  priority: 0,
  shipClass: 0,
  strictClass: false,
  stopOnDisengage: true,
  friends: [],
  hostiles: [],
  friendlyTribes: [],
  hostileTribes: [],
};
export function parsePilotIds(text: string): number[] {
  if (!text.trim()) return [];
  const parts = text.trim().split(/[\s,]+/);
  if (parts.some((p) => !/^[0-9]+$/.test(p)))
    throw new Error(
      "Use numeric game IDs separated by commas, not wallet addresses.",
    );
  const ids = parts.map(Number);
  validateIds(ids);
  return ids;
}
function validateIds(ids: number[]) {
  if (ids.length > 16) throw new Error("Use at most 16 IDs per list.");
  if (ids.some((n) => !Number.isInteger(n) || n < 1 || n > 4294967295))
    throw new Error("Game IDs must be between 1 and 4294967295.");
  if (new Set(ids).size !== ids.length)
    throw new Error("Remove duplicate IDs.");
}
export function encodeTurretSettings(s: TurretSettings): number[] {
  for (const [n, max] of [
    [s.mode, 3],
    [s.priority, 3],
    [s.shipClass, 4],
  ])
    if (!Number.isInteger(n) || n < 0 || n > max)
      throw new Error("Unsupported turret setting.");
  const lists = [s.friends, s.hostiles, s.friendlyTribes, s.hostileTribes];
  lists.forEach(validateIds);
  if (
    s.friends.some((n) => s.hostiles.includes(n)) ||
    s.friendlyTribes.some((n) => s.hostileTribes.includes(n))
  )
    throw new Error("An ID cannot be both friendly and hostile.");
  const bytes = [
    s.mode,
    s.priority,
    s.shipClass,
    (s.strictClass ? 1 : 0) | (s.stopOnDisengage ? 2 : 0),
  ];
  for (const ids of lists) {
    bytes.push(ids.length);
    for (const n of ids)
      bytes.push(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24);
  }
  return bytes;
}
export function decodeTurretSettings(bytes: number[]): TurretSettings | null {
  if (
    bytes.length < 8 ||
    bytes.length > 264 ||
    bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255) ||
    bytes[3] > 3
  )
    return null;
  let pos = 4;
  const lists: number[][] = [];
  for (let l = 0; l < 4; l++) {
    if (pos >= bytes.length) return null;
    const n = bytes[pos++];
    if (n > 16 || pos + n * 4 > bytes.length) return null;
    const ids: number[] = [];
    for (let i = 0; i < n; i++) {
      ids.push(
        bytes[pos] +
          bytes[pos + 1] * 256 +
          bytes[pos + 2] * 65536 +
          bytes[pos + 3] * 16777216,
      );
      pos += 4;
    }
    lists.push(ids);
  }
  if (pos !== bytes.length) return null;
  const s: TurretSettings = {
    mode: bytes[0],
    priority: bytes[1],
    shipClass: bytes[2],
    strictClass: !!(bytes[3] & 1),
    stopOnDisengage: !!(bytes[3] & 2),
    friends: lists[0],
    hostiles: lists[1],
    friendlyTribes: lists[2],
    hostileTribes: lists[3],
  };
  try {
    encodeTurretSettings(s);
    return s;
  } catch {
    return null;
  }
}
export function readTurretSettings(description: string): TurretSettings | null {
  if (new TextEncoder().encode(description).length > 8192) return null;
  const i = description.lastIndexOf(TURRET_MARKER);
  if (i < 0 || !description.endsWith("]")) return null;
  const hex = description.slice(i + TURRET_MARKER.length, -1);
  if (!/^(?:[0-9a-f]{2}){8,264}$/.test(hex)) return null;
  return decodeTurretSettings(hex.match(/../g)!.map((x) => parseInt(x, 16)));
}
