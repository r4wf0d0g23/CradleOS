#!/usr/bin/env node
/**
 * check-comics-canon.mjs — guard deliberate story elements against "helpful" fixes.
 *
 * WHY THIS EXISTS
 * Some strings in the comic are intentionally wrong-looking. The archive
 * authority hex in Part II decodes to "Alord of Stillness" — 'Alord', one word.
 * Raw ruled 2026-08-19: leave it, it's a live plot hook. A future session,
 * subagent, spell-check, or tidy-up pass would look at that and "correct" it,
 * silently destroying story material. A prose note in CANON_NOTES.md documents
 * the intent but cannot ENFORCE it. This can.
 *
 * Run it in CI / pre-deploy. Exits non-zero if a protected invariant broke.
 *
 * Usage:
 *   node scripts/check-comics-canon.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MANIFEST = path.join(ROOT, "public", "data", "comics.json");
const NOTES = path.join(ROOT, "public", "comics", "CANON_NOTES.md");

let failures = [];
let checks = 0;

function check(name, fn) {
  checks++;
  try {
    const problem = fn();
    if (problem) failures.push(`${name}: ${problem}`);
  } catch (e) {
    failures.push(`${name}: threw ${e.message}`);
  }
}

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const series = manifest.series?.[0];
const allText = JSON.stringify(manifest);

// ── PROTECTED: the Alord hex (Raw, 2026-08-19 — intentionally unresolved) ────
const ALORD_HEX = "416C6F7264206F66205374696C6C6E657373";
check("alord-hex-intact", () => {
  if (!allText.includes(ALORD_HEX)) {
    return `the protected archive-authority hex 0x${ALORD_HEX} is GONE from comics.json. ` +
      `It decodes to "Alord of Stillness" and is a DELIBERATE plot hook, not a typo. ` +
      `If someone "corrected" it to "A lord"/"Warlord"/"Lord", revert that change. ` +
      `See public/comics/CANON_NOTES.md → DO NOT CORRECT.`;
  }
  return null;
});

// Guard against the specific likely "fixes" appearing.
check("alord-not-silently-fixed", () => {
  const bad = [
    "41206C6F7264206F66205374696C6C6E657373",   // "A lord of Stillness"
    "5761726C6F7264206F66205374696C6C6E657373", // "Warlord of Stillness"
    "4C6F7264206F66205374696C6C6E657373",       // "Lord of Stillness"
  ];
  const hit = bad.find((h) => allText.includes(h));
  return hit
    ? `a "corrected" variant of the Alord hex (0x${hit}) appeared. Raw ruled this stays as "Alord" until he decides otherwise.`
    : null;
});

// ── Structural invariants ────────────────────────────────────────────────────
check("series-ongoing", () => {
  // Raw 2026-08-19: "Not complete, this will be ongoing as I muse."
  return series?.status === "ongoing"
    ? null
    : `series.status is "${series?.status}" — Raw directed it stay "ongoing". Do not flip to complete without his say.`;
});

check("part-chapter-1to1", () => {
  const subs = (series?.chapters ?? [])
    .map((c) => c.subtitle)
    .filter((s) => s && /^Part /i.test(s));
  const dupes = subs.filter((s, i) => subs.indexOf(s) !== i);
  return dupes.length
    ? `duplicate Part labels: ${[...new Set(dupes)].join(", ")}. Parts must map 1:1 to chapters (this broke once already).`
    : null;
});

check("no-empty-published-chapter", () => {
  const bad = (series?.chapters ?? []).filter(
    (c) => c.publishedAt && !(c.pages?.length || c.script?.length),
  );
  return bad.length
    ? `chapter(s) ${bad.map((c) => c.n).join(", ")} have publishedAt but no content — they'd render as COMING SOON despite claiming a date.`
    : null;
});

check("script-blocks-have-bodies", () => {
  const empty = [];
  for (const c of series?.chapters ?? []) {
    (c.script ?? []).forEach((b, i) => {
      if (!b.body || !b.body.trim()) empty.push(`ch${c.n}#${i}`);
    });
  }
  return empty.length ? `empty script bodies: ${empty.join(", ")}` : null;
});

// ── Canon-ledger presence ────────────────────────────────────────────────────
check("canon-notes-present", () => {
  if (!existsSync(NOTES)) return "public/comics/CANON_NOTES.md is missing — the canon ledger is the record future sessions trust.";
  const txt = readFileSync(NOTES, "utf8");
  return txt.includes("DO NOT CORRECT") ? null : "CANON_NOTES.md lost its DO NOT CORRECT section.";
});

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error(`\n✗ comics canon guard FAILED (${failures.length}/${checks})\n`);
  failures.forEach((f) => console.error("  • " + f + "\n"));
  process.exit(1);
}
console.log(`✓ comics canon guard clean (${checks} checks)`);
console.log(`  protected: Alord hex, series=ongoing, 1:1 Part mapping, no hollow chapters`);
