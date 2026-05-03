/**
 * Keeper canonical alphabet — sprite metadata + helpers.
 *
 * Source: Keeper video releases (CCP), permission granted for use in CradleOS.
 * 36 glyphs cover A-Z and 0-9. Glyphs marked `unconfirmed` are derived from
 * imagery where the source had a red border around the cell, indicating the
 * mapping is reasonable-but-not-fully-verified.
 *
 * Asset path: each glyph is a 61x61 PNG under /CradleOS/glyphs/. Vite serves
 * `/public/*` at the configured base URL, so the production path resolves to
 * `${import.meta.env.BASE_URL}glyphs/<file>.png`.
 */

export interface GlyphMeta {
  /** The Latin character this glyph maps to (uppercase A-Z, or 0-9). */
  char: string;
  /** Relative file path under /public. */
  file: string;
  /** True iff source imagery flagged this mapping as not-fully-confirmed. */
  unconfirmed: boolean;
}

/** Resolve the public URL for a glyph file. */
export function glyphUrl(meta: GlyphMeta): string {
  // Vite injects BASE_URL at build time. For CradleOS the base is "/CradleOS/".
  const base = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
  return `${base}${meta.file}`;
}

/** Generated from the source PNG slicer; do not edit by hand. */
export const GLYPHS: GlyphMeta[] = [
  // Row 1 (A-F) — all confirmed (green-bordered in source)
  { char: "A", file: "glyphs/letter_A.png", unconfirmed: false },
  { char: "B", file: "glyphs/letter_B.png", unconfirmed: false },
  { char: "C", file: "glyphs/letter_C.png", unconfirmed: false },
  { char: "D", file: "glyphs/letter_D.png", unconfirmed: false },
  { char: "E", file: "glyphs/letter_E.png", unconfirmed: false },
  { char: "F", file: "glyphs/letter_F.png", unconfirmed: false },
  // Row 2 (G-P)
  { char: "G", file: "glyphs/letter_G.png", unconfirmed: true },
  { char: "H", file: "glyphs/letter_H.png", unconfirmed: false },
  { char: "I", file: "glyphs/letter_I.png", unconfirmed: false },
  { char: "J", file: "glyphs/letter_J.png", unconfirmed: false },
  { char: "K", file: "glyphs/letter_K.png", unconfirmed: true },
  { char: "L", file: "glyphs/letter_L.png", unconfirmed: true },
  { char: "M", file: "glyphs/letter_M.png", unconfirmed: false },
  { char: "N", file: "glyphs/letter_N.png", unconfirmed: true },
  { char: "O", file: "glyphs/letter_O.png", unconfirmed: false },
  { char: "P", file: "glyphs/letter_P.png", unconfirmed: true },
  // Row 3 (Q-Z)
  { char: "Q", file: "glyphs/letter_Q.png", unconfirmed: true },
  { char: "R", file: "glyphs/letter_R.png", unconfirmed: false },
  { char: "S", file: "glyphs/letter_S.png", unconfirmed: false },
  { char: "T", file: "glyphs/letter_T.png", unconfirmed: false },
  { char: "U", file: "glyphs/letter_U.png", unconfirmed: false },
  { char: "V", file: "glyphs/letter_V.png", unconfirmed: false },
  { char: "W", file: "glyphs/letter_W.png", unconfirmed: true },
  { char: "X", file: "glyphs/letter_X.png", unconfirmed: false },
  { char: "Y", file: "glyphs/letter_Y.png", unconfirmed: true },
  { char: "Z", file: "glyphs/letter_Z.png", unconfirmed: false },
  // Row 4 (1-0)
  { char: "1", file: "glyphs/digit_1.png", unconfirmed: false },
  { char: "2", file: "glyphs/digit_2.png", unconfirmed: false },
  { char: "3", file: "glyphs/digit_3.png", unconfirmed: false },
  { char: "4", file: "glyphs/digit_4.png", unconfirmed: false },
  { char: "5", file: "glyphs/digit_5.png", unconfirmed: false },
  { char: "6", file: "glyphs/digit_6.png", unconfirmed: true },
  { char: "7", file: "glyphs/digit_7.png", unconfirmed: true },
  { char: "8", file: "glyphs/digit_8.png", unconfirmed: true },
  { char: "9", file: "glyphs/digit_9.png", unconfirmed: true },
  { char: "0", file: "glyphs/digit_0.png", unconfirmed: false },
];

/** Lookup map for fast char → glyph-meta resolution. */
export const GLYPH_BY_CHAR: Map<string, GlyphMeta> = new Map(
  GLYPHS.map(g => [g.char, g])
);

/** Decompose a plaintext into a list of "tokens" — each token is either
 *  a glyph reference, a literal character (space, punctuation), or a
 *  newline marker. Used by the renderer to produce the glyph stream. */
export type GlyphToken =
  | { type: "glyph"; meta: GlyphMeta }
  | { type: "literal"; char: string }
  | { type: "space" }
  | { type: "newline" };

export function tokenize(plaintext: string): GlyphToken[] {
  const out: GlyphToken[] = [];
  for (const c of plaintext.toUpperCase()) {
    if (c === " ") {
      out.push({ type: "space" });
    } else if (c === "\n") {
      out.push({ type: "newline" });
    } else {
      const meta = GLYPH_BY_CHAR.get(c);
      if (meta) out.push({ type: "glyph", meta });
      else out.push({ type: "literal", char: c });
    }
  }
  return out;
}
