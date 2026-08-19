/**
 * ComicsPanel — reader surface for CradleOS comic series.
 *
 * Fully data-driven: everything comes from `public/data/comics.json`
 * (schema `cradleos.comics.v1`). Publishing a chapter means editing that
 * manifest + dropping art in `public/comics/<seriesId>/ch<N>/` — no code
 * change, no rebuild of this component. See `public/comics/README.md`.
 *
 * Three views, one panel:
 *   library  → series cards
 *   chapters → chapter list for a series
 *   reader   → page-by-page (art) or scrolling script (text)
 *
 * Chapter state is DERIVED, never stored:
 *   pages[] non-empty              → image reader
 *   pages[] empty, script[] present → text reader, badged SCRIPT
 *   both empty                      → locked, badged COMING SOON
 * So placeholder chapters list correctly today and light up as art lands.
 *
 * Webview constraints (TOOLS.md, EVE Vault Mobile / Stillness embedded Chrome):
 *   - NO window.prompt/confirm/alert (silent no-op in that webview)
 *   - NO native <select> (option popout renders outside the iframe)
 *   - NO color emoji glyphs (render as empty boxes) — monospace-safe
 *     geometric Unicode only: ◀ ▶ ◆ ◇ ▣ ✦ ⊞ ≡ ⛨
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ACCENT = "#FF4700";
const ACCENT_BLUE = "#64b4ff";
const ACCENT_AMBER = "#ffc850";
const MUTED = "rgba(175,175,155,0.55)";
const TEXT = "#e0e0d0";

/** Manifest + art live under BASE_URL so gh-pages (/CradleOS/) and CF (/) both work. */
const BASE = import.meta.env.BASE_URL ?? "/";
const MANIFEST = `${BASE}data/comics.json`;
const asset = (p: string) => `${BASE}${p.replace(/^\/+/, "")}`;

// ── Types ──────────────────────────────────────────────────────────────────

type ScriptBlock = {
  heading?: string | null;
  body: string;
  /** Key into `Series.themes` — art is keyed by RECURRING MOTIF, not by chapter. */
  theme?: string;
};

/**
 * A theme plate: one piece of art authored once and referenced from any block
 * in any chapter. Raw 2026-08-19: "we can art for theme not just for chapter
 * titles". The Rift appears in ch1 and the Cradle in both ch2 and ch3 — keying
 * art to the motif means those look consistent every time they recur, and a
 * single re-render updates every appearance.
 */
type Theme = { title?: string; image: string; alt?: string };

type Chapter = {
  n: number;
  title: string;
  subtitle?: string | null;
  publishedAt?: string | null;
  layout?: "page" | "spread" | "scroll";
  pages?: string[];
  script?: ScriptBlock[];
};

type Series = {
  id: string;
  title: string;
  tagline?: string;
  author?: string;
  status?: "ongoing" | "complete" | "hiatus";
  synopsis?: string;
  cover?: string | null;
  /** Reusable art registry, keyed by motif. Referenced via `ScriptBlock.theme`. */
  themes?: Record<string, Theme>;
  chapters: Chapter[];
};

type Manifest = { schema?: string; generatedAt?: string; series: Series[] };

type ChapterState = "art" | "script" | "pending";

function chapterState(c: Chapter): ChapterState {
  if (c.pages && c.pages.length > 0) return "art";
  if (c.script && c.script.length > 0) return "script";
  return "pending";
}

// ── Progress persistence ───────────────────────────────────────────────────
// Per-series furthest-read marker. localStorage only; no wallet, no chain —
// reading is public and anonymous by design.

const PROGRESS_KEY = "cradleos.comics.progress.v1";

type Progress = Record<string, { chapter: number; page: number }>;

function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as Progress) : {};
  } catch {
    return {};
  }
}

function saveProgress(seriesId: string, chapter: number, page: number) {
  try {
    const all = loadProgress();
    const prev = all[seriesId];
    // Only advance the marker — never rewind it when re-reading an early page.
    if (!prev || chapter > prev.chapter || (chapter === prev.chapter && page > prev.page)) {
      all[seriesId] = { chapter, page };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    }
  } catch {
    /* storage disabled — reading still works, just not resumable */
  }
}

// ── Shared bits ────────────────────────────────────────────────────────────

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontFamily: "monospace",
        letterSpacing: "0.12em",
        color,
        background: `${color}14`,
        border: `1px solid ${color}44`,
        padding: "2px 7px",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

const STATE_BADGE: Record<ChapterState, { text: string; color: string }> = {
  art: { text: "READ", color: ACCENT },
  script: { text: "SCRIPT", color: ACCENT_AMBER },
  pending: { text: "COMING SOON", color: MUTED },
};

function Loading({ label }: { label: string }) {
  return <div style={{ padding: "48px 16px", textAlign: "center", color: MUTED, fontSize: 12 }}>{label}</div>;
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        border: "1px solid rgba(255,71,0,0.35)",
        background: "rgba(255,71,0,0.06)",
        color: "#ff9d7a",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  accent = ACCENT,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  accent?: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        fontFamily: "inherit",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        padding: "7px 13px",
        background: disabled ? "rgba(255,255,255,0.03)" : `${accent}14`,
        border: `1px solid ${disabled ? "rgba(255,255,255,0.08)" : `${accent}55`}`,
        color: disabled ? "rgba(255,255,255,0.2)" : accent,
        cursor: disabled ? "default" : "pointer",
        transition: "background 0.12s, color 0.12s, border-color 0.12s",
      }}
    >
      {children}
    </button>
  );
}

// ── Library view ───────────────────────────────────────────────────────────

function SeriesCard({
  series,
  progress,
  onOpen,
}: {
  series: Series;
  progress?: { chapter: number; page: number };
  onOpen: () => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  const readable = series.chapters.filter((c) => chapterState(c) !== "pending").length;
  const total = series.chapters.length;
  const statusColor =
    series.status === "complete" ? ACCENT_BLUE : series.status === "hiatus" ? MUTED : ACCENT;

  return (
    <div
      onClick={onOpen}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,71,0,0.18)",
        borderLeft: `2px solid ${ACCENT}`,
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          aspectRatio: "3 / 4",
          background: "rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {series.cover && imgOk ? (
          <img
            src={asset(series.cover)}
            alt={series.title}
            loading="lazy"
            onError={() => setImgOk(false)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <span style={{ fontSize: 34, color: "rgba(255,71,0,0.25)" }}>▣</span>
        )}
      </div>

      <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span style={{ color: TEXT, fontWeight: 700, fontSize: 13, letterSpacing: "0.04em" }}>
            {series.title}
          </span>
          {series.status && <Badge text={series.status.toUpperCase()} color={statusColor} />}
        </div>

        {series.tagline && (
          <div style={{ fontSize: 11, color: "rgba(220,220,200,0.72)", lineHeight: 1.45 }}>
            {series.tagline}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 10, color: MUTED, fontFamily: "monospace" }}>
          {series.author && <span>by {series.author}</span>}
          <span>
            {readable}/{total} ch
          </span>
          {progress && <span style={{ color: ACCENT_AMBER }}>◆ ch{progress.chapter}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Chapter list view ──────────────────────────────────────────────────────

function ChapterList({
  series,
  progress,
  onBack,
  onOpen,
}: {
  series: Series;
  progress?: { chapter: number; page: number };
  onBack: () => void;
  onOpen: (n: number) => void;
}) {
  const resumable = progress && series.chapters.some((c) => c.n === progress.chapter && chapterState(c) !== "pending");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Btn onClick={onBack}>◀ Library</Btn>
        <span style={{ color: ACCENT, fontWeight: 700, fontSize: 15, letterSpacing: "0.05em" }}>
          {series.title}
        </span>
        {series.author && (
          <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>by {series.author}</span>
        )}
        {resumable && (
          <div style={{ marginLeft: "auto" }}>
            <Btn accent={ACCENT_AMBER} onClick={() => onOpen(progress!.chapter)}>
              ▶ Resume ch{progress!.chapter}
            </Btn>
          </div>
        )}
      </div>

      {series.synopsis && (
        <div
          style={{
            fontSize: 12,
            color: "rgba(220,220,200,0.75)",
            lineHeight: 1.6,
            maxWidth: 760,
            borderLeft: `2px solid ${ACCENT}44`,
            paddingLeft: 12,
          }}
        >
          {series.synopsis}
        </div>
      )}

      <div style={{ display: "grid", gap: 6 }}>
        {series.chapters
          .slice()
          .sort((a, b) => a.n - b.n)
          .map((c) => {
            const st = chapterState(c);
            const badge = STATE_BADGE[st];
            const locked = st === "pending";
            const isCurrent = progress?.chapter === c.n;
            return (
              <div
                key={c.n}
                onClick={() => !locked && onOpen(c.n)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 13px",
                  background: locked ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderLeft: `2px solid ${locked ? "rgba(255,255,255,0.1)" : isCurrent ? ACCENT_AMBER : ACCENT}`,
                  cursor: locked ? "default" : "pointer",
                  opacity: locked ? 0.55 : 1,
                }}
              >
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: locked ? MUTED : ACCENT,
                    minWidth: 34,
                    fontWeight: 700,
                  }}
                >
                  {String(c.n).padStart(2, "0")}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ color: TEXT, fontSize: 12, fontWeight: 700 }}>{c.title}</span>
                  {c.subtitle && <span style={{ color: MUTED, fontSize: 10 }}>{c.subtitle}</span>}
                </div>
                {c.pages && c.pages.length > 0 && (
                  <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>
                    {c.pages.length}p
                  </span>
                )}
                {c.publishedAt && (
                  <span style={{ fontSize: 10, color: MUTED, fontFamily: "monospace" }}>{c.publishedAt}</span>
                )}
                <Badge text={badge.text} color={badge.color} />
              </div>
            );
          })}
      </div>

      <div style={{ fontSize: 10, color: MUTED, lineHeight: 1.6, maxWidth: 700 }}>
        ⛨ Chapters marked COMING SOON are placeholders — they light up automatically once pages are
        added to the manifest. Nothing here is on-chain; reading is public and anonymous, and your
        place is saved locally in this browser only.
      </div>
    </div>
  );
}

// ── Reader: art pages ──────────────────────────────────────────────────────

function PageReader({
  series,
  chapter,
  onExit,
  onChapterChange,
}: {
  series: Series;
  chapter: Chapter;
  onExit: () => void;
  onChapterChange: (n: number) => void;
}) {
  const pages = chapter.pages ?? [];
  const [i, setI] = useState(0);
  const [fit, setFit] = useState<"height" | "width">("height");
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  // Reset to page 1 when the chapter changes.
  useEffect(() => {
    setI(0);
  }, [chapter.n]);

  const clamp = useCallback(
    (n: number) => Math.max(0, Math.min(pages.length - 1, n)),
    [pages.length],
  );

  const go = useCallback(
    (delta: number) => {
      setI((prev) => {
        const next = clamp(prev + delta);
        saveProgress(series.id, chapter.n, next + 1);
        return next;
      });
    },
    [clamp, series.id, chapter.n],
  );

  // Preload the next two pages so forward paging feels instant without
  // eagerly pulling an entire chapter on mount (lazy-load-on-intent, per
  // the InventoryPanel lesson).
  useEffect(() => {
    [1, 2].forEach((d) => {
      const p = pages[i + d];
      if (p) {
        const img = new Image();
        img.src = asset(p);
      }
    });
  }, [i, pages]);

  useEffect(() => {
    saveProgress(series.id, chapter.n, i + 1);
  }, [series.id, chapter.n, i]);

  // Keyboard paging. Arrows/space are the expected controls for a comic reader.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Escape") {
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onExit]);

  // Touch swipe — the in-game webview is touch-first on mobile.
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  const chapters = series.chapters.slice().sort((a, b) => a.n - b.n);
  const idx = chapters.findIndex((c) => c.n === chapter.n);
  const nextCh = chapters.slice(idx + 1).find((c) => chapterState(c) !== "pending");
  const prevCh = chapters
    .slice(0, Math.max(0, idx))
    .reverse()
    .find((c) => chapterState(c) !== "pending");

  const atEnd = i === pages.length - 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Reader chrome */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Btn onClick={onExit}>◀ Chapters</Btn>
        <span style={{ color: ACCENT, fontWeight: 700, fontSize: 13 }}>
          {series.title} — {chapter.title}
        </span>
        {chapter.subtitle && <span style={{ fontSize: 10, color: MUTED }}>{chapter.subtitle}</span>}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: MUTED }}>
            {i + 1} / {pages.length}
          </span>
          <Btn
            accent={ACCENT_BLUE}
            onClick={() => setFit((f) => (f === "height" ? "width" : "height"))}
            title="Toggle fit-to-height / fit-to-width"
          >
            {fit === "height" ? "⊞ Fit width" : "⊞ Fit height"}
          </Btn>
        </div>
      </div>

      {/* Page stage */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position: "relative",
          background: "rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,71,0,0.15)",
          minHeight: 320,
          maxHeight: fit === "height" ? "calc(100vh - 300px)" : undefined,
          overflow: fit === "width" ? "auto" : "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {failed[i] ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: MUTED, fontSize: 12 }}>
            <div style={{ fontSize: 28, opacity: 0.4, marginBottom: 8 }}>▣</div>
            Page {i + 1} artwork is missing.
            <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 10 }}>{pages[i]}</div>
          </div>
        ) : (
          <img
            src={asset(pages[i])}
            alt={`${chapter.title} — page ${i + 1}`}
            onError={() => setFailed((f) => ({ ...f, [i]: true }))}
            style={{
              display: "block",
              maxHeight: fit === "height" ? "calc(100vh - 302px)" : undefined,
              width: fit === "width" ? "100%" : "auto",
              maxWidth: "100%",
              objectFit: "contain",
              margin: "0 auto",
            }}
          />
        )}

        {/* Click-to-page hot zones (left third back, right two-thirds forward) */}
        <div
          onClick={() => go(-1)}
          style={{ position: "absolute", inset: "0 66% 0 0", cursor: i > 0 ? "w-resize" : "default" }}
          aria-label="Previous page"
        />
        <div
          onClick={() => go(1)}
          style={{ position: "absolute", inset: "0 0 0 34%", cursor: atEnd ? "default" : "e-resize" }}
          aria-label="Next page"
        />
      </div>

      {/* Paging controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Btn onClick={() => go(-1)} disabled={i === 0}>
          ◀ Prev
        </Btn>
        <Btn onClick={() => go(1)} disabled={atEnd}>
          Next ▶
        </Btn>

        {/* Page dots — compact scrubber, capped so long chapters don't overflow */}
        {pages.length <= 40 && (
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
            {pages.map((_, p) => (
              <button
                key={p}
                onClick={() => {
                  setI(p);
                  saveProgress(series.id, chapter.n, p + 1);
                }}
                title={`Page ${p + 1}`}
                style={{
                  width: 9,
                  height: 9,
                  padding: 0,
                  border: "none",
                  cursor: "pointer",
                  background: p === i ? ACCENT : "rgba(255,255,255,0.16)",
                }}
              />
            ))}
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {prevCh && (
            <Btn accent={ACCENT_BLUE} onClick={() => onChapterChange(prevCh.n)}>
              ◀ Ch{prevCh.n}
            </Btn>
          )}
          {nextCh && (
            <Btn accent={atEnd ? ACCENT_AMBER : ACCENT_BLUE} onClick={() => onChapterChange(nextCh.n)}>
              Ch{nextCh.n} ▶
            </Btn>
          )}
        </div>
      </div>

      {atEnd && (
        <div
          style={{
            padding: "12px 14px",
            border: `1px solid ${ACCENT_AMBER}33`,
            background: `${ACCENT_AMBER}0d`,
            fontSize: 12,
            color: "rgba(230,220,190,0.85)",
          }}
        >
          ✦ End of {chapter.title}.{" "}
          {nextCh ? `Continue to ${nextCh.title}.` : "Next chapter is not published yet."}
        </div>
      )}
    </div>
  );
}

// ── Script prose renderer ──────────────────────────────────────────────────
// 2026-08-19 readability fix (Raw: "the double spacing is not easy to read").
//
// The prose is written with a blank line between nearly every beat:
//
//     It did not come through a relay.\n\nIt did not propagate...
//
// Rendering that with `whiteSpace: "pre-wrap"` turns every \n\n into a FULL
// empty line, so a page of short staccato beats becomes a ladder of gaps and
// the eye loses the thread. Fixed at the renderer (the layer that owns the
// problem) rather than by rewriting Raw's text — the beat structure IS the
// voice, only the spacing was wrong.
//
// Rules:
//   - split on blank lines into real paragraphs, drop the literal gaps
//   - consecutive SHORT beats tighten up so they read as rhythm, not as
//     separate paragraphs; full paragraphs keep normal separation
//   - ALL-CAPS lines (DEPTH: NULL, THEY FOUND US., QUERY: CREATOR
//     IDENTIFICATION) render as terminal readouts — monospace amber. They are
//     machine speech in the fiction, so they should not look like prose.

const TERMINAL_RE = /^["'A-Z0-9 :.,!?()\u2014\u2013'-]+$/;

function isTerminalLine(p: string): boolean {
  if (p.includes("\n")) return false;
  if (p.length > 72) return false;
  if (/[a-z]/.test(p)) return false;              // any lowercase => prose
  if ((p.match(/[A-Z]/g) ?? []).length < 2) return false;
  return TERMINAL_RE.test(p);
}

/** A short single-line beat — tightened against its neighbours. */
function isBeat(p: string): boolean {
  return !p.includes("\n") && p.length <= 78;
}

function ScriptBody({ text }: { text: string }) {
  const paras = useMemo(
    () => text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean),
    [text],
  );

  return (
    <div style={{ fontSize: 15, lineHeight: 1.62, color: "rgba(232,232,214,0.92)" }}>
      {paras.map((p, i) => {
        const terminal = isTerminalLine(p);
        const tightPrev = i > 0 && isBeat(paras[i - 1]) && isBeat(p);
        const marginTop = i === 0 ? 0 : tightPrev ? "0.34em" : "0.78em";

        if (terminal) {
          return (
            <div
              key={i}
              style={{
                marginTop: i === 0 ? 0 : "0.9em",
                marginBottom: "0.2em",
                fontFamily: "monospace",
                fontSize: 13,
                letterSpacing: "0.14em",
                color: ACCENT_AMBER,
                borderLeft: `2px solid ${ACCENT_AMBER}55`,
                paddingLeft: 10,
                lineHeight: 1.5,
              }}
            >
              {p}
            </div>
          );
        }

        return (
          <p key={i} style={{ margin: 0, marginTop, whiteSpace: "pre-wrap" }}>
            {p}
          </p>
        );
      })}
    </div>
  );
}

// ── Reader: script (text-only chapters) ────────────────────────────────────

/**
 * Theme plate rendered inline above the block it belongs to.
 * Fails soft: a missing registry entry or a broken file renders nothing rather
 * than an alt-text box — the chapter must stay readable as prose regardless.
 */
function ThemePlate({ theme }: { theme?: Theme }) {
  const [ok, setOk] = useState(true);
  if (!theme?.image || !ok) return null;
  return (
    <figure style={{ margin: "0 0 4px" }}>
      <img
        src={asset(theme.image)}
        alt={theme.alt ?? theme.title ?? ""}
        loading="lazy"
        onError={() => setOk(false)}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          border: "1px solid rgba(255,71,0,0.18)",
          filter: "saturate(0.96)",
        }}
      />
      {theme.title && (
        <figcaption
          style={{
            marginTop: 5,
            fontFamily: "monospace",
            fontSize: 9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          {theme.title}
        </figcaption>
      )}
    </figure>
  );
}

function ScriptReader({
  series,
  chapter,
  onExit,
  onChapterChange,
}: {
  series: Series;
  chapter: Chapter;
  onExit: () => void;
  onChapterChange: (n: number) => void;
}) {
  const blocks = chapter.script ?? [];

  useEffect(() => {
    saveProgress(series.id, chapter.n, 1);
  }, [series.id, chapter.n]);

  const chapters = series.chapters.slice().sort((a, b) => a.n - b.n);
  const idx = chapters.findIndex((c) => c.n === chapter.n);
  const nextCh = chapters.slice(idx + 1).find((c) => chapterState(c) !== "pending");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Btn onClick={onExit}>◀ Chapters</Btn>
        <span style={{ color: ACCENT, fontWeight: 700, fontSize: 13 }}>
          {series.title} — {chapter.title}
        </span>
        <Badge text="SCRIPT" color={ACCENT_AMBER} />
      </div>

      <div
        style={{
          maxWidth: 720,          // ~70 characters at 15px — comfortable measure
          display: "flex",
          flexDirection: "column",
          gap: 30,                // section separation now carries the rhythm
          padding: "22px 26px 26px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {blocks.map((b, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {b.theme && <ThemePlate theme={series.themes?.[b.theme]} />}
            {b.heading && (
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  color: ACCENT,
                  borderBottom: `1px solid ${ACCENT}33`,
                  paddingBottom: 6,
                }}
              >
                {b.heading.toUpperCase()}
              </div>
            )}
            <ScriptBody text={b.body} />
          </div>
        ))}
      </div>

      {nextCh && (
        <div>
          <Btn accent={ACCENT_AMBER} onClick={() => onChapterChange(nextCh.n)}>
            {nextCh.title} ▶
          </Btn>
        </div>
      )}
    </div>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────

type View =
  | { kind: "library" }
  | { kind: "chapters"; seriesId: string }
  | { kind: "reader"; seriesId: string; chapter: number };

export function ComicsPanel() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "library" });
  const [progress, setProgress] = useState<Progress>(() => loadProgress());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(MANIFEST, { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: Manifest) => {
        if (!cancelled) setManifest(j);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message ?? e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const seriesList = useMemo(() => manifest?.series ?? [], [manifest]);
  const current = useMemo(
    () => (view.kind === "library" ? null : seriesList.find((s) => s.id === view.seriesId) ?? null),
    [view, seriesList],
  );

  const openChapter = useCallback(
    (seriesId: string, n: number) => {
      setView({ kind: "reader", seriesId, chapter: n });
      setProgress(loadProgress());
    },
    [],
  );

  // Re-read the marker whenever we leave the reader so cards/lists show it.
  const backToChapters = useCallback((seriesId: string) => {
    setView({ kind: "chapters", seriesId });
    setProgress(loadProgress());
  }, []);

  if (loading) return <Loading label="Loading comics…" />;

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Header />
        <ErrorBox text={`Could not load the comics manifest (${error}). Expected at ${MANIFEST}.`} />
      </div>
    );
  }

  if (seriesList.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Header />
        <div style={{ padding: "48px 16px", textAlign: "center", color: MUTED, fontSize: 12 }}>
          <div style={{ fontSize: 32, opacity: 0.35, marginBottom: 10 }}>▣</div>
          No series published yet.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Header />

      {view.kind === "library" && (
        <>
          <div style={{ fontSize: 12, color: "rgba(220,220,200,0.7)", maxWidth: 720, lineHeight: 1.6 }}>
            Original comic series set in the EVE Frontier universe. Free to read, no wallet required.
          </div>
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            }}
          >
            {seriesList.map((s) => (
              <SeriesCard
                key={s.id}
                series={s}
                progress={progress[s.id]}
                onOpen={() => backToChapters(s.id)}
              />
            ))}
          </div>
        </>
      )}

      {view.kind === "chapters" && current && (
        <ChapterList
          series={current}
          progress={progress[current.id]}
          onBack={() => setView({ kind: "library" })}
          onOpen={(n) => openChapter(current.id, n)}
        />
      )}

      {view.kind === "reader" &&
        current &&
        (() => {
          const ch = current.chapters.find((c) => c.n === view.chapter);
          if (!ch) {
            return <ErrorBox text={`Chapter ${view.chapter} not found in ${current.title}.`} />;
          }
          const st = chapterState(ch);
          if (st === "art") {
            return (
              <PageReader
                series={current}
                chapter={ch}
                onExit={() => backToChapters(current.id)}
                onChapterChange={(n) => openChapter(current.id, n)}
              />
            );
          }
          if (st === "script") {
            return (
              <ScriptReader
                series={current}
                chapter={ch}
                onExit={() => backToChapters(current.id)}
                onChapterChange={(n) => openChapter(current.id, n)}
              />
            );
          }
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Btn onClick={() => backToChapters(current.id)}>◀ Chapters</Btn>
              <ErrorBox text={`${ch.title} is not published yet.`} />
            </div>
          );
        })()}
    </div>
  );
}

function Header() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ color: ACCENT, fontWeight: 700, fontSize: 16, letterSpacing: "0.06em" }}>
        ◈ COMICS
      </span>
      <span
        style={{
          fontSize: 10,
          color: MUTED,
          fontFamily: "monospace",
          background: "rgba(255,71,0,0.06)",
          border: "1px solid rgba(255,71,0,0.15)",
          padding: "2px 8px",
          letterSpacing: "0.1em",
        }}
      >
        READER
      </span>
    </div>
  );
}

export default ComicsPanel;
