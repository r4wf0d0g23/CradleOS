/**
 * Family-clustered sort for PlayerStructure[].
 *
 * Groups structures so same-family kinds end up adjacent — Mini Printer
 * next to Printer next to Heavy Printer, etc. — without inserting visual
 * group separators. Within a family, ordering is by size rank (mini <
 * standard < heavy) then by display name.
 *
 * Family stem extraction: lowercase typeName, strip leading "smart" /
 * "crude" branding adjective, strip leading size adjective (mini / heavy)
 * — what remains is the family stem ("printer", "storage", "berth").
 *
 * Falls back to `kind` when typeName isn't available.
 */

import type { PlayerStructure } from "../../lib";

const SIZE_PATTERNS: Array<{ re: RegExp; rank: number }> = [
  { re: /\bmini\b/i,    rank: 0 },
  { re: /\bsmall\b/i,   rank: 0 },
  { re: /\bheavy\b/i,   rank: 2 },
  { re: /\blarge\b/i,   rank: 2 },
];

// Canonical ordering of family stems — power & networking first,
// logistics next, production, then habitation/specialty.
const FAMILY_ORDER = [
  "tether",
  "relay",
  "node",
  "gate",
  "turret",
  "storage",
  "silo",
  "hangar",
  "berth",
  "shipyard",
  "printer",
  "refinery",
  "assembly",
  "assembler",
];

function extractFamilyAndRank(s: PlayerStructure): { family: string; rank: number } {
  const raw = (s.typeName ?? s.label ?? s.kind ?? "").toLowerCase();
  let rank = 1;
  for (const p of SIZE_PATTERNS) {
    if (p.re.test(raw)) { rank = p.rank; break; }
  }
  // Strip branding adjectives and size adjectives, then collapse to a
  // single noun. We pick the LAST word as the family stem because EVE
  // Frontier names follow "[adjective...] noun" order
  // ("Smart Storage Unit" → "unit"; "Heavy Berth" → "berth").
  // Special case: "Storage Unit" should family as "storage", not "unit".
  const cleaned = raw
    .replace(/\b(smart|crude|mini|heavy|small|large)\b/g, "")
    .replace(/\bunit\b/g, "")  // "storage unit" → "storage"
    .replace(/\bline\b/g, "")  // "assembly line" → "assembly"
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const family = tokens.length > 0 ? tokens[tokens.length - 1] : "~";
  return { family, rank };
}

export function sortByFamily(structures: PlayerStructure[]): PlayerStructure[] {
  return [...structures].sort((a, b) => {
    const fa = extractFamilyAndRank(a);
    const fb = extractFamilyAndRank(b);
    const ai = FAMILY_ORDER.indexOf(fa.family);
    const bi = FAMILY_ORDER.indexOf(fb.family);
    const aRank = ai === -1 ? FAMILY_ORDER.length : ai;
    const bRank = bi === -1 ? FAMILY_ORDER.length : bi;
    if (aRank !== bRank) return aRank - bRank;
    // Same family — same family but unknown both: alphabetic by family stem
    if (ai === -1 && bi === -1 && fa.family !== fb.family) {
      return fa.family.localeCompare(fb.family);
    }
    if (fa.rank !== fb.rank) return fa.rank - fb.rank;
    return (a.displayName ?? "").localeCompare(b.displayName ?? "")
        || a.objectId.localeCompare(b.objectId);
  });
}
