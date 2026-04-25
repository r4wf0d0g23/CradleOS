/**
 * keeperCites — RAG cite extraction + relevance gating
 *
 * Pure functions for turning raw RAG results into labeled, relevance-filtered
 * cites that get rendered as thumbnails beneath Keeper messages.
 *
 * Why a relevance gate? Top-k retrieval always returns SOMETHING. If the user
 * asks "what is a LAI" and the corpus has a LAI doc, retrieval returns LAI as
 * #1 — but it also returns LORHA/MAUL/REFLEX as #2-4 because they're nearby
 * in embedding space. Showing all four as visual cites tells the user the
 * Keeper thinks LORHA is also a relevant answer. That's wrong.
 *
 * The fix: only show a cite if we have positive evidence the result actually
 * relates to the user's query. Suppress everything else.
 */

export type RagCite = {
  url: string;
  label: string;
  entityType?: string;
};

export type CiteSource = {
  text: string;
  imageUrl: string | null;
  source?: string;
  consensusCount?: number;
  distance?: number;
  meta?: Record<string, unknown>;
};

/**
 * Extract a clean entity label (e.g. "LAI") from RAG result text/metadata.
 * Strategy:
 *   1. Prefer explicit metadata fields (name, ship_name, label).
 *   2. Else parse leading "Ship: NAME." or "Structure: NAME." patterns.
 *   3. Else fall back to inferring from the image filename (lai.png → LAI).
 *   4. Else return empty string — caller decides whether to show the cite.
 */
export function extractCiteLabel(r: CiteSource): { label: string; entityType?: string } {
  const m = r.meta ?? {};
  const metaName = (m.name || m.ship_name || m.label) as string | undefined;
  const metaType = (m.type || m.source) as string | undefined;
  if (metaName) {
    return { label: String(metaName).toUpperCase(), entityType: metaType };
  }
  // Pattern: "Ship: LAI." / "Structure: SSU." / "Module: MWD."
  const headMatch = r.text.match(/^\s*(Ship|Structure|Module|Item|Blueprint|Type)\s*:\s*([A-Z][A-Za-z0-9_\- ]{0,40}?)\s*[.,]/);
  if (headMatch) {
    return { label: headMatch[2].trim().toUpperCase(), entityType: headMatch[1].toLowerCase() };
  }
  // Fall back to image filename basename: "images/lai.png" → "LAI"
  if (r.imageUrl) {
    const base = r.imageUrl.split("/").pop()?.replace(/\.(png|jpg|jpeg|webp|gif)$/i, "");
    if (base) return { label: base.toUpperCase(), entityType: metaType };
  }
  return { label: "", entityType: metaType };
}

/**
 * Decide whether a RAG result is relevant enough to show as a visual cite.
 *
 * Heuristics (any one passing makes the cite show):
 *   1. The user query mentions the entity label (case-insensitive substring match).
 *      Strong signal: user asked "what is a LAI" → LAI is relevant.
 *   2. The chroma distance is below a tight threshold (< 0.45). With BGE-style
 *      embeddings on EVE-Frontier text, < 0.45 is roughly "right family of entity."
 *   3. Player-submitted with consensus >= 2 (community-confirmed).
 */
export function isCiteRelevant(
  r: CiteSource,
  label: string,
  userQuery: string,
): boolean {
  if (!label) return false;
  const q = userQuery.toLowerCase();
  const lbl = label.toLowerCase();
  // 1. Direct mention (label must be ≥2 chars to avoid spurious matches)
  if (lbl.length >= 2 && q.includes(lbl)) return true;
  // 2. Tight distance
  if (typeof r.distance === "number" && r.distance < 0.45) return true;
  // 3. Community-confirmed
  if (r.source === "player_submission" && (r.consensusCount ?? 0) >= 2) return true;
  return false;
}

/**
 * Build the final cite list from a batch of RAG results, applying both
 * label extraction and relevance gating, then deduping by URL.
 */
export function buildCites(
  results: CiteSource[],
  userQuery: string,
  maxCites = 3,
): RagCite[] {
  const seen = new Set<string>();
  const out: RagCite[] = [];
  for (const r of results) {
    if (!r.imageUrl) continue;
    const { label, entityType } = extractCiteLabel(r);
    if (!isCiteRelevant(r, label, userQuery)) continue;
    if (seen.has(r.imageUrl)) continue;
    seen.add(r.imageUrl);
    out.push({ url: r.imageUrl, label, entityType });
    if (out.length >= maxCites) break;
  }
  return out;
}
