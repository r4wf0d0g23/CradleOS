#!/usr/bin/env node
/**
 * refresh-comics.mjs — rebuild the comics manifest's `pages` arrays from disk.
 *
 * Scans public/comics/<seriesId>/ch<N>/ for page images and rewrites each
 * chapter's `pages` array to match what actually exists on disk, while
 * PRESERVING every hand-authored field (title, subtitle, synopsis, author,
 * status, cover, layout, publishedAt, script blocks).
 *
 * New series/chapter folders found on disk are appended as stubs for you to
 * title. Chapters declared in the manifest with no folder on disk are left
 * alone (they stay as COMING SOON placeholders in the reader).
 *
 * Usage:
 *   node scripts/refresh-comics.mjs            # write
 *   node scripts/refresh-comics.mjs --dry-run  # report only
 *
 * Idempotent. Safe to re-run.
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const COMICS_DIR = path.join(ROOT, "public", "comics");
const MANIFEST = path.join(ROOT, "public", "data", "comics.json");
const DRY = process.argv.includes("--dry-run");

const IMG_RE = /\.(webp|avif|png|jpe?g)$/i;
const CH_RE = /^ch(\d+)$/i;

/** Natural sort so page-2 < page-10 even without zero-padding. */
function natCmp(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

async function listDirs(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function listPages(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && IMG_RE.test(e.name))
    .map((e) => e.name)
    .sort(natCmp);
}

async function findCover(seriesDir) {
  if (!existsSync(seriesDir)) return null;
  const entries = await readdir(seriesDir, { withFileTypes: true });
  const hit = entries.find((e) => e.isFile() && /^cover\.(webp|avif|png|jpe?g)$/i.test(e.name));
  return hit ? hit.name : null;
}

async function main() {
  const raw = await readFile(MANIFEST, "utf8");
  const manifest = JSON.parse(raw);
  if (!Array.isArray(manifest.series)) throw new Error("manifest.series is not an array");

  const diskSeries = await listDirs(COMICS_DIR);
  const changes = [];

  // ── Update declared series from disk ────────────────────────────────────
  for (const series of manifest.series) {
    const seriesDir = path.join(COMICS_DIR, series.id);
    if (!existsSync(seriesDir)) {
      changes.push(`· ${series.id}: no folder on disk (public/comics/${series.id}/) — left as declared`);
      continue;
    }

    // Cover: only auto-fill when the manifest has none.
    if (!series.cover) {
      const cover = await findCover(seriesDir);
      if (cover) {
        series.cover = `comics/${series.id}/${cover}`;
        changes.push(`✎ ${series.id}: cover → ${series.cover}`);
      }
    }

    if (!Array.isArray(series.chapters)) series.chapters = [];

    // Refresh pages for declared chapters.
    for (const ch of series.chapters) {
      const chDir = path.join(seriesDir, `ch${ch.n}`);
      const files = await listPages(chDir);
      const next = files.map((f) => `comics/${series.id}/ch${ch.n}/${f}`);
      const prev = Array.isArray(ch.pages) ? ch.pages : [];
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        ch.pages = next;
        changes.push(`✎ ${series.id} ch${ch.n}: ${prev.length} → ${next.length} pages`);
      }
      if (!Array.isArray(ch.script)) ch.script = [];
    }

    // Append chapter folders present on disk but absent from the manifest.
    const declared = new Set(series.chapters.map((c) => Number(c.n)));
    for (const d of await listDirs(seriesDir)) {
      const m = CH_RE.exec(d);
      if (!m) continue;
      const n = Number(m[1]);
      if (declared.has(n)) continue;
      const files = await listPages(path.join(seriesDir, d));
      series.chapters.push({
        n,
        title: `Chapter ${n}`,
        subtitle: null,
        publishedAt: null,
        layout: "page",
        pages: files.map((f) => `comics/${series.id}/ch${n}/${f}`),
        script: [],
      });
      changes.push(`+ ${series.id} ch${n}: new chapter stub (${files.length} pages) — set the title`);
    }

    series.chapters.sort((a, b) => a.n - b.n);
  }

  // ── Append series folders present on disk but absent from the manifest ──
  const declaredSeries = new Set(manifest.series.map((s) => s.id));
  for (const id of diskSeries) {
    if (declaredSeries.has(id)) continue;
    const seriesDir = path.join(COMICS_DIR, id);
    const cover = await findCover(seriesDir);
    const chapters = [];
    for (const d of (await listDirs(seriesDir)).sort(natCmp)) {
      const m = CH_RE.exec(d);
      if (!m) continue;
      const n = Number(m[1]);
      const files = await listPages(path.join(seriesDir, d));
      chapters.push({
        n,
        title: `Chapter ${n}`,
        subtitle: null,
        publishedAt: null,
        layout: "page",
        pages: files.map((f) => `comics/${id}/ch${n}/${f}`),
        script: [],
      });
    }
    chapters.sort((a, b) => a.n - b.n);
    manifest.series.push({
      id,
      title: id,
      tagline: "",
      author: "",
      status: "ongoing",
      synopsis: "",
      cover: cover ? `comics/${id}/${cover}` : null,
      chapters,
    });
    changes.push(`+ ${id}: new series stub (${chapters.length} chapters) — set title/tagline/synopsis`);
  }

  manifest.schema = manifest.schema ?? "cradleos.comics.v1";
  manifest.generatedAt = new Date().toISOString();

  // Report
  const totalPages = manifest.series.reduce(
    (a, s) => a + s.chapters.reduce((b, c) => b + (c.pages?.length ?? 0), 0),
    0,
  );
  console.log(`comics: ${manifest.series.length} series, ` +
    `${manifest.series.reduce((a, s) => a + s.chapters.length, 0)} chapters, ${totalPages} pages`);
  if (changes.length === 0) {
    console.log("no changes — manifest already matches disk");
  } else {
    changes.forEach((c) => console.log("  " + c));
  }

  if (DRY) {
    console.log("(--dry-run: manifest not written)");
    return;
  }
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`wrote ${path.relative(ROOT, MANIFEST)}`);
}

main().catch((e) => {
  console.error("refresh-comics failed:", e.message);
  process.exit(1);
});
