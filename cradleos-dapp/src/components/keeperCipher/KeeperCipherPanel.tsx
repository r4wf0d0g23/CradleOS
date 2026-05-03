/**
 * KeeperCipherPanel — daily Keeper transmission rendered in the canonical
 * Keeper alphabet, with optional in-game expeditions.
 *
 * v0.2 mechanic change (2026-05-02):
 *   The substitution cipher is gone. Fragments are now displayed as glyphs
 *   from the canonical Keeper alphabet (sourced from CCP video releases,
 *   used with permission). The puzzle is to READ the message — i.e., to
 *   internalize the alphabet over time. Reveal modes:
 *     - TRAINING: each glyph has its Latin letter underneath (full help)
 *     - SCAFFOLDED: hover or click a glyph to see its letter (one at a time)
 *     - RAW: glyphs only; no Latin reveal at all
 *   Player chooses the mode; harder modes unlock streak rewards in v1.
 *
 *   Unconfirmed glyphs (12 of 36) are rendered with a dashed orange border
 *   and a small "?" so we're transparent about which mappings are derived
 *   vs canonical. These are visible in TRAINING mode but the player should
 *   know the source ambiguity.
 *
 * Loop B (expeditions) unchanged — same on-chain verification path as
 * v0.1. See selectors.ts.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { findCharacterForWallet, fetchTribeInfo, type CharacterInfo } from "../../lib";
import { WORLD_API } from "../../constants";
import {
  FRAGMENTS,
  pickFragmentForSeed,
  type KeeperFragment,
  type KeeperExpedition,
} from "./fragments";
import {
  GLYPHS,
  glyphUrl,
  tokenize,
  type GlyphMeta,
  type GlyphToken,
} from "./glyphs";
import {
  buildDailySeed,
  selectBloodiestSystem,
  selectUnsettledSystem,
  selectAdjacentSystem,
  verifyExpeditionReveal,
  type LocationReveal,
} from "./selectors";

// ── CCP palette ───────────────────────────────────────────────────────────────
const C = {
  bg: "#0B0B0B",
  panel: "rgba(11, 11, 11, 0.96)",
  fg: "#FAFAE5",
  fgDim: "rgba(250, 250, 229, 0.55)",
  fgFaint: "rgba(250, 250, 229, 0.30)",
  accent: "#FF4700",
  accentDim: "rgba(255, 71, 0, 0.65)",
  accentFaint: "rgba(255, 71, 0, 0.30)",
  border: "rgba(107, 107, 94, 0.42)",
  divider: "rgba(107, 107, 94, 0.18)",
  green: "#00ff96",
  red: "#ff4444",
  amber: "rgba(255, 200, 0, 0.85)",
  secondary: "rgba(186, 185, 167, 0.95)",
  secondaryDim: "rgba(107, 107, 94, 0.85)",
  secondaryFaint: "rgba(107, 107, 94, 0.35)",
};

const G = {
  keeper: "⊕",
  fragment: "❖",
  intercept: "≡",
  cipher: "▣",
  expedition: "◉",
  link: "↗",
  bullet: "▪",
  unsolved: "◇",
  solved: "◆",
};

type ReadMode = "training" | "scaffolded" | "raw";
const READ_MODE_LABEL: Record<ReadMode, string> = {
  training: "TRAINING",
  scaffolded: "SCAFFOLDED",
  raw: "RAW",
};
const READ_MODE_DESC: Record<ReadMode, string> = {
  training: "Each glyph shown with its Latin letter beneath. Use to memorize the alphabet.",
  scaffolded: "Hover any glyph to peek its letter. Click to lock it open.",
  raw: "Glyphs only. Read the Keeper's tongue or do not.",
};

// ── localStorage state ────────────────────────────────────────────────────────
type CompletionRecord = {
  fragmentId: number;
  /** Which read mode the player solved/read it in (highest difficulty wins). */
  readMode: ReadMode;
  archivedAtMs: number;
  /** txDigest of the LocationRevealedEvent that proved the optional expedition. */
  expeditionProofTx?: string;
};

interface ActiveExpedition {
  fragmentId: number;
  expeditionId: string;
  targetSystemId: number;
  targetSystemName?: string;
  issuedAtMs: number;
  proofTxDigest?: string;
  completedAtMs?: number;
}

const LS_COMPLETIONS = "cradleos:keeper-cipher:completions";
const LS_ACTIVE_EXPEDITION = "cradleos:keeper-cipher:active-expedition";
const LS_LAST_COMPLETED_SYSTEM = "cradleos:keeper-cipher:last-system";
const LS_READ_MODE = "cradleos:keeper-cipher:read-mode";

function loadCompletions(): CompletionRecord[] {
  try {
    const raw = localStorage.getItem(LS_COMPLETIONS);
    return raw ? (JSON.parse(raw) as CompletionRecord[]) : [];
  } catch { return []; }
}
function saveCompletions(list: CompletionRecord[]): void {
  try { localStorage.setItem(LS_COMPLETIONS, JSON.stringify(list)); } catch { /* quota */ }
}
function loadActiveExpedition(): ActiveExpedition | null {
  try {
    const raw = localStorage.getItem(LS_ACTIVE_EXPEDITION);
    return raw ? (JSON.parse(raw) as ActiveExpedition) : null;
  } catch { return null; }
}
function saveActiveExpedition(e: ActiveExpedition | null): void {
  try {
    if (e) localStorage.setItem(LS_ACTIVE_EXPEDITION, JSON.stringify(e));
    else localStorage.removeItem(LS_ACTIVE_EXPEDITION);
  } catch { /* quota */ }
}
function loadReadMode(): ReadMode {
  const raw = (() => { try { return localStorage.getItem(LS_READ_MODE); } catch { return null; } })();
  if (raw === "training" || raw === "scaffolded" || raw === "raw") return raw;
  return "training";
}
function saveReadMode(m: ReadMode): void {
  try { localStorage.setItem(LS_READ_MODE, m); } catch { /* quota */ }
}

// ── Section frame ─────────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        padding: "10px 12px 12px",
        marginBottom: 10,
        background: "rgba(107, 107, 94, 0.04)",
        border: `1px solid ${C.divider}`,
      }}
    >
      <span style={{ position: "absolute", top: -1, left: -1, width: 6, height: 6, borderTop: `1px solid ${C.secondary}`, borderLeft: `1px solid ${C.secondary}` }} />
      <span style={{ position: "absolute", top: -1, right: -1, width: 6, height: 6, borderTop: `1px solid ${C.secondary}`, borderRight: `1px solid ${C.secondary}` }} />
      <span style={{ position: "absolute", bottom: -1, left: -1, width: 6, height: 6, borderBottom: `1px solid ${C.secondary}`, borderLeft: `1px solid ${C.secondary}` }} />
      <span style={{ position: "absolute", bottom: -1, right: -1, width: 6, height: 6, borderBottom: `1px solid ${C.secondary}`, borderRight: `1px solid ${C.secondary}` }} />
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: C.secondaryDim, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ── Single glyph render ───────────────────────────────────────────────────────
const GLYPH_PX = 36; // base size; can be scaled via prop
const GLYPH_PX_LARGE = 44;

function GlyphSprite({
  meta,
  size = GLYPH_PX,
  showLatin,
  reveal,
  onPeek,
  isLocked,
}: {
  meta: GlyphMeta;
  size?: number;
  /** TRAINING mode: always show Latin letter beneath. */
  showLatin: boolean;
  /** SCAFFOLDED mode: this glyph is currently being peeked at. */
  reveal: boolean;
  /** SCAFFOLDED mode: click handler to toggle lock-open. */
  onPeek?: (locked: boolean) => void;
  /** SCAFFOLDED mode: this glyph has been clicked to stay revealed. */
  isLocked?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const showLetter = showLatin || reveal || hover || isLocked;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onPeek ? () => onPeek(!isLocked) : undefined}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: onPeek ? "pointer" : "default",
        margin: "0 2px",
      }}
      title={onPeek ? `${meta.char}${meta.unconfirmed ? " (unconfirmed)" : ""} — click to ${isLocked ? "hide" : "lock open"}` : meta.char}
    >
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          background: "rgba(255, 71, 0, 0.04)",
          border: meta.unconfirmed
            ? `1px dashed rgba(255, 71, 0, 0.45)`
            : `1px solid rgba(107, 107, 94, 0.32)`,
          padding: 2,
          imageRendering: "pixelated", // keep the angular character of the source art
        }}
      >
        <img
          src={glyphUrl(meta)}
          alt={meta.char}
          draggable={false}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "contain",
            // The source PNG is amber on near-black; the panel background is
            // already near-black so it composites cleanly. No filter applied
            // so we preserve the canonical look.
          }}
        />
        {meta.unconfirmed && (
          <span
            style={{
              position: "absolute",
              top: 1,
              right: 2,
              fontSize: 8,
              color: C.accent,
              fontFamily: "ui-monospace, monospace",
              fontWeight: 700,
            }}
          >
            ?
          </span>
        )}
      </div>
      {showLetter && (
        <span
          style={{
            fontSize: 9,
            color: showLatin ? C.fgDim : C.accent,
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.06em",
            marginTop: 2,
            fontWeight: 700,
            minHeight: 12,
          }}
        >
          {meta.char}
        </span>
      )}
      {!showLetter && (
        <span style={{ minHeight: 12 + 2 }} />
      )}
    </div>
  );
}

// ── Glyph stream renderer ─────────────────────────────────────────────────────
function GlyphStream({
  tokens,
  mode,
  glyphSize = GLYPH_PX,
  lockedGlyphs,
  onToggleLock,
}: {
  tokens: GlyphToken[];
  mode: ReadMode;
  glyphSize?: number;
  lockedGlyphs: Set<string>;
  onToggleLock: (char: string, locked: boolean) => void;
}) {
  const showLatin = mode === "training";
  // group tokens into words for wrapping
  const words: GlyphToken[][] = [];
  let buf: GlyphToken[] = [];
  for (const t of tokens) {
    if (t.type === "space") {
      if (buf.length) { words.push(buf); buf = []; }
      words.push([{ type: "space" }]);
    } else if (t.type === "newline") {
      if (buf.length) { words.push(buf); buf = []; }
      words.push([{ type: "newline" }]);
    } else {
      buf.push(t);
    }
  }
  if (buf.length) words.push(buf);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "4px 0", lineHeight: 1.2 }}>
      {words.map((w, wi) => {
        if (w.length === 1 && w[0].type === "space") {
          return <span key={wi} style={{ display: "inline-block", width: glyphSize * 0.4, minHeight: glyphSize }} />;
        }
        if (w.length === 1 && w[0].type === "newline") {
          return <div key={wi} style={{ flexBasis: "100%", height: 8 }} />;
        }
        return (
          <span key={wi} style={{ display: "inline-flex", alignItems: "flex-start", marginRight: 2 }}>
            {w.map((t, ti) => {
              if (t.type === "literal") {
                return (
                  <span
                    key={ti}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: glyphSize / 2,
                      height: glyphSize,
                      color: C.fgDim,
                      fontFamily: "ui-monospace, monospace",
                      fontSize: glyphSize * 0.5,
                    }}
                  >
                    {t.char}
                  </span>
                );
              }
              if (t.type === "glyph") {
                const isLocked = lockedGlyphs.has(t.meta.char);
                return (
                  <GlyphSprite
                    key={ti}
                    meta={t.meta}
                    size={glyphSize}
                    showLatin={showLatin}
                    reveal={false}
                    isLocked={mode === "scaffolded" && isLocked}
                    onPeek={mode === "scaffolded" ? (locked) => onToggleLock(t.meta.char, locked) : undefined}
                  />
                );
              }
              return null;
            })}
          </span>
        );
      })}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function KeeperCipherPanel() {
  const account = useCurrentAccount();
  const wallet = account?.address ?? null;

  const [playerChar, setPlayerChar] = useState<CharacterInfo | null>(null);
  const [playerTribeName, setPlayerTribeName] = useState<string | null>(null);
  useEffect(() => {
    if (!wallet) { setPlayerChar(null); setPlayerTribeName(null); return; }
    let cancelled = false;
    findCharacterForWallet(wallet)
      .then(async info => {
        if (cancelled) return;
        setPlayerChar(info);
        if (info?.tribeId) {
          const tribe = await fetchTribeInfo(info.tribeId);
          if (!cancelled && tribe) setPlayerTribeName(tribe.nameShort || tribe.name);
        }
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [wallet]);

  const [seed, setSeed] = useState<string | null>(null);
  const [fragment, setFragment] = useState<KeeperFragment | null>(null);
  const [loading, setLoading] = useState(true);
  const [completions, setCompletions] = useState<CompletionRecord[]>(() => loadCompletions());
  const [activeExpedition, setActiveExpedition] = useState<ActiveExpedition | null>(() => loadActiveExpedition());
  const [readMode, setReadMode] = useState<ReadMode>(() => loadReadMode());
  const [lockedGlyphs, setLockedGlyphs] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    buildDailySeed()
      .then(s => {
        if (cancelled) return;
        setSeed(s);
        const completedIds = completions.map(c => c.fragmentId);
        setFragment(pickFragmentForSeed(s, completedIds));
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []); // mount-only

  const tokens = useMemo(() => fragment ? tokenize(fragment.plaintext) : [], [fragment]);
  const isPreviouslyArchived = fragment ? completions.some(c => c.fragmentId === fragment.id) : false;

  // ── Mark current fragment archived once the player has read it (any mode) ──
  // We define "read" as: the player has spent at least 5 seconds with the fragment open
  // AND has either selected a non-default mode, peeked a glyph, or solved an expedition.
  // Simpler v0.2: treat opening the fragment as reading; archive on first view if not
  // already archived. The streak/scoring system can refine this in v1.
  useEffect(() => {
    if (!fragment) return;
    if (completions.some(c => c.fragmentId === fragment.id)) return;
    const t = setTimeout(() => {
      const next = [
        ...completions,
        {
          fragmentId: fragment.id,
          readMode,
          archivedAtMs: Date.now(),
        },
      ];
      setCompletions(next);
      saveCompletions(next);
    }, 5000); // 5s grace period
    return () => clearTimeout(t);
  }, [fragment, readMode, completions]);

  const handleToggleLock = (ch: string, locked: boolean) => {
    setLockedGlyphs(prev => {
      const next = new Set(prev);
      if (locked) next.add(ch);
      else next.delete(ch);
      return next;
    });
  };

  // ── Expedition flow (unchanged from v0.1) ────────────────────────────────
  const [issuingExpedition, setIssuingExpedition] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const issueExpedition = async (frag: KeeperFragment, exp: KeeperExpedition) => {
    setIssuingExpedition(true);
    try {
      let target: number | null = null;
      switch (exp.targetSelector.kind) {
        case "fixed": target = exp.targetSelector.systemId; break;
        case "bloodiest_24h": target = await selectBloodiestSystem(86400, 30); break;
        case "bloodiest_7d": target = await selectBloodiestSystem(7 * 86400, 60); break;
        case "unsettled": target = await selectUnsettledSystem(40); break;
        case "adjacent_to_previous": {
          const last = parseInt(localStorage.getItem(LS_LAST_COMPLETED_SYSTEM) ?? "0", 10);
          if (last > 0) target = await selectAdjacentSystem(last);
          else target = await selectBloodiestSystem(86400, 30);
          break;
        }
      }
      if (!target) {
        setVerifyError("Lattice silent. No target candidate available right now.");
        return;
      }
      let name: string | undefined;
      try {
        const res = await fetch(`${WORLD_API}/v2/solarsystems/${target}`);
        if (res.ok) { const j = (await res.json()) as { name?: string }; if (j.name) name = j.name; }
      } catch { /* ignore */ }

      const newExp: ActiveExpedition = {
        fragmentId: frag.id,
        expeditionId: exp.id,
        targetSystemId: target,
        targetSystemName: name,
        issuedAtMs: Date.now(),
      };
      setActiveExpedition(newExp);
      saveActiveExpedition(newExp);
      setVerifyError(null);
    } finally {
      setIssuingExpedition(false);
    }
  };

  const verifyExpedition = async () => {
    if (!activeExpedition || !playerChar) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      const reveal: LocationReveal | null = await verifyExpeditionReveal({
        targetSystemId: activeExpedition.targetSystemId,
        issuedAtMs: activeExpedition.issuedAtMs,
        playerCharacterObjectId: playerChar.characterId,
      });
      if (!reveal) {
        setVerifyError("No matching reveal found. Anchor a sentinel in the target system AFTER the mission was issued, then try again.");
        return;
      }
      const completed: ActiveExpedition = { ...activeExpedition, proofTxDigest: reveal.txDigest, completedAtMs: Date.now() };
      setActiveExpedition(completed);
      saveActiveExpedition(completed);

      const updated = completions
        .filter(c => c.fragmentId !== activeExpedition.fragmentId)
        .concat({
          fragmentId: activeExpedition.fragmentId,
          readMode,
          archivedAtMs: Date.now(),
          expeditionProofTx: reveal.txDigest,
        });
      setCompletions(updated);
      saveCompletions(updated);
      try { localStorage.setItem(LS_LAST_COMPLETED_SYSTEM, String(activeExpedition.targetSystemId)); } catch { /* quota */ }

      // Reward: skip to next fragment
      if (seed) {
        const completedIds = updated.map(c => c.fragmentId);
        const next = pickFragmentForSeed(seed + ":" + activeExpedition.fragmentId, completedIds);
        setFragment(next);
        setLockedGlyphs(new Set());
      }
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setVerifying(false);
    }
  };

  const abandonExpedition = () => {
    setActiveExpedition(null);
    saveActiveExpedition(null);
  };

  // ── Render ────────────────────────────────────────────────────────────
  if (loading || !fragment) {
    return (
      <div style={{ padding: 16, color: C.fgDim, fontFamily: "ui-monospace, monospace" }}>
        [ resolving lattice signal… ]
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", color: C.fg, maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <Section label={`${G.keeper}  KEEPER TRANSMISSION  \u2014  FRAGMENT #${fragment.id}`}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
          <span style={{ color: C.accent, fontWeight: 700, letterSpacing: "0.06em", fontSize: 13 }}>
            {fragment.intercept_label}
          </span>
          <span style={{ fontSize: 10, color: C.secondaryDim, letterSpacing: "0.1em" }}>
            {completions.length} / {FRAGMENTS.length} ARCHIVED
          </span>
          {playerTribeName && (
            <span style={{ fontSize: 10, color: C.secondaryDim, letterSpacing: "0.1em" }}>
              SENTINEL · {playerTribeName}
            </span>
          )}
          {isPreviouslyArchived && (
            <span style={{ fontSize: 10, color: C.amber, letterSpacing: "0.06em" }}>
              {G.solved} ARCHIVED
            </span>
          )}
        </div>
      </Section>

      {/* Read mode picker */}
      <Section label={`${G.cipher}  READ MODE`}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {(["training", "scaffolded", "raw"] as ReadMode[]).map(m => {
            const active = readMode === m;
            return (
              <button
                key={m}
                onClick={() => { setReadMode(m); saveReadMode(m); setLockedGlyphs(new Set()); }}
                style={{
                  padding: "4px 10px",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  background: active ? "rgba(255,71,0,0.12)" : "rgba(107,107,94,0.06)",
                  border: `1px solid ${active ? C.accent : C.secondaryFaint}`,
                  color: active ? C.accent : C.secondary,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {READ_MODE_LABEL[m]}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: C.fgDim, lineHeight: 1.5 }}>
          {READ_MODE_DESC[readMode]}
        </div>
      </Section>

      {/* The transmission itself */}
      <Section label={`${G.intercept}  INTERCEPT`}>
        <div
          style={{
            background: "rgba(0,0,0,0.55)",
            padding: "14px 14px",
            border: `1px solid ${C.accentFaint}`,
            minHeight: 80,
          }}
        >
          <GlyphStream
            tokens={tokens}
            mode={readMode}
            glyphSize={GLYPH_PX_LARGE}
            lockedGlyphs={lockedGlyphs}
            onToggleLock={handleToggleLock}
          />
        </div>
        {readMode === "scaffolded" && (
          <div style={{ fontSize: 9, color: C.fgFaint, marginTop: 6, letterSpacing: "0.08em" }}>
            HOVER TO PEEK · CLICK TO LOCK OPEN · {lockedGlyphs.size} GLYPH{lockedGlyphs.size === 1 ? "" : "S"} REVEALED
          </div>
        )}
      </Section>

      {/* Expedition */}
      {fragment.expedition && (
        <Section label={`${G.expedition}  EXPEDITION ORDER`}>
          <ExpeditionBlock
            fragment={fragment}
            expedition={fragment.expedition}
            activeExpedition={activeExpedition}
            issuingExpedition={issuingExpedition}
            verifying={verifying}
            verifyError={verifyError}
            playerCharResolved={!!playerChar}
            walletConnected={!!wallet}
            onIssue={() => issueExpedition(fragment, fragment.expedition!)}
            onVerify={verifyExpedition}
            onAbandon={abandonExpedition}
          />
        </Section>
      )}

      {/* Alphabet reference */}
      <Section label={`${G.cipher}  ALPHABET REFERENCE`}>
        <div style={{ fontSize: 10, color: C.fgDim, marginBottom: 8 }}>
          {GLYPHS.filter(g => !g.unconfirmed).length} confirmed glyphs · {" "}
          {GLYPHS.filter(g => g.unconfirmed).length} unconfirmed (dashed border, marked with ?)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(50px, 1fr))", gap: 4 }}>
          {GLYPHS.map(g => (
            <GlyphSprite key={g.char} meta={g} size={36} showLatin={true} reveal={false} />
          ))}
        </div>
      </Section>

      {/* Archive */}
      {completions.length > 0 && (
        <Section label={`${G.solved}  ARCHIVE  \u2014  ${completions.length} FRAGMENT${completions.length === 1 ? "" : "S"}`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {completions.map(c => {
              const f = FRAGMENTS.find(ff => ff.id === c.fragmentId);
              const label = f?.intercept_label ?? `#${c.fragmentId}`;
              return (
                <div
                  key={c.fragmentId}
                  style={{
                    padding: "4px 8px",
                    border: `1px solid ${C.secondaryFaint}`,
                    background: "rgba(107,107,94,0.04)",
                    fontSize: 10,
                    color: C.fg,
                    letterSpacing: "0.04em",
                    display: "flex",
                    gap: 6,
                    alignItems: "baseline",
                  }}
                  title={`Archived ${new Date(c.archivedAtMs).toUTCString()} · mode ${c.readMode}${c.expeditionProofTx ? ` · expedition proof ${c.expeditionProofTx.slice(0, 10)}…` : ""}`}
                >
                  <span style={{ color: c.expeditionProofTx ? C.green : C.amber }}>
                    {c.expeditionProofTx ? G.solved : G.unsolved}
                  </span>
                  <span>#{c.fragmentId} {label}</span>
                  <span style={{ color: C.fgFaint, fontSize: 8 }}>
                    {c.readMode.slice(0, 4).toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <div style={{ marginTop: 12, fontSize: 9, color: C.fgFaint, letterSpacing: "0.1em", textAlign: "center" }}>
        DAILY SEED REFRESHES AT 00:00 UTC · CANONICAL KEEPER ALPHABET (CCP, USED WITH PERMISSION)
      </div>
    </div>
  );
}

// ── Expedition block ──────────────────────────────────────────────────────────
function ExpeditionBlock({
  fragment,
  expedition,
  activeExpedition,
  issuingExpedition,
  verifying,
  verifyError,
  playerCharResolved,
  walletConnected,
  onIssue,
  onVerify,
  onAbandon,
}: {
  fragment: KeeperFragment;
  expedition: KeeperExpedition;
  activeExpedition: ActiveExpedition | null;
  issuingExpedition: boolean;
  verifying: boolean;
  verifyError: string | null;
  playerCharResolved: boolean;
  walletConnected: boolean;
  onIssue: () => void;
  onVerify: () => void;
  onAbandon: () => void;
}) {
  const isThisExpedition =
    activeExpedition !== null &&
    activeExpedition.fragmentId === fragment.id &&
    activeExpedition.expeditionId === expedition.id;
  const isCompleted = isThisExpedition && activeExpedition.completedAtMs !== undefined;

  return (
    <div>
      <div style={{ fontSize: 12, color: C.fg, lineHeight: 1.6, marginBottom: 10, fontStyle: "italic" }}>
        {expedition.brief}
      </div>

      {!walletConnected && (
        <div style={{ fontSize: 11, color: C.amber, marginBottom: 8 }}>
          Connect a wallet to receive expedition orders. The Keeper requires a thread to follow.
        </div>
      )}

      {walletConnected && !isThisExpedition && (
        <div>
          {activeExpedition && activeExpedition.fragmentId !== fragment.id && (
            <div style={{ fontSize: 10, color: C.amber, marginBottom: 6 }}>
              Another expedition is active (Fragment #{activeExpedition.fragmentId}). Resolve or abandon it first.
            </div>
          )}
          <button
            onClick={onIssue}
            disabled={issuingExpedition || (activeExpedition !== null && activeExpedition.fragmentId !== fragment.id)}
            style={{
              padding: "6px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
              background: "rgba(255, 71, 0, 0.1)", border: `1px solid ${C.accent}`, color: C.accent,
              fontFamily: "inherit", cursor: issuingExpedition ? "wait" : "pointer", opacity: issuingExpedition ? 0.5 : 1,
            }}
          >
            {issuingExpedition ? "CONSULTING THE LATTICE…" : "RECEIVE TARGET"}
          </button>
        </div>
      )}

      {isThisExpedition && !isCompleted && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", marginBottom: 12, fontSize: 11 }}>
            <span style={{ color: C.secondaryDim, letterSpacing: "0.12em", fontSize: 9 }}>TARGET SYSTEM</span>
            <span style={{ color: C.accent, fontWeight: 700 }}>
              {activeExpedition.targetSystemName ?? `sys-${activeExpedition.targetSystemId}`}
              <span style={{ color: C.fgFaint, marginLeft: 8, fontWeight: 400 }}>#{activeExpedition.targetSystemId}</span>
            </span>
            <span style={{ color: C.secondaryDim, letterSpacing: "0.12em", fontSize: 9 }}>ISSUED</span>
            <span style={{ color: C.fgDim }}>{new Date(activeExpedition.issuedAtMs).toUTCString()}</span>
          </div>
          <div style={{ fontSize: 10, color: C.secondaryDim, marginBottom: 10, lineHeight: 1.6 }}>
            {G.bullet} Travel to the target system in EVE Frontier.<br />
            {G.bullet} Anchor a Network Node there (deploy fresh, or move + redeploy).<br />
            {G.bullet} Return here and verify. Verification scans on-chain LocationRevealedEvents
            after {new Date(activeExpedition.issuedAtMs).toUTCString()}.
          </div>

          {verifyError && (
            <div style={{ fontSize: 11, color: C.red, marginBottom: 8, padding: "6px 8px", background: "rgba(255, 68, 68, 0.08)", border: "1px solid rgba(255, 68, 68, 0.4)" }}>
              {verifyError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onVerify}
              disabled={verifying || !playerCharResolved}
              style={{
                padding: "6px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                background: "rgba(255, 71, 0, 0.12)", border: `1px solid ${C.accent}`, color: C.accent,
                fontFamily: "inherit", cursor: verifying ? "wait" : playerCharResolved ? "pointer" : "not-allowed",
                opacity: verifying ? 0.5 : playerCharResolved ? 1 : 0.5,
              }}
              title={playerCharResolved ? "Scan on-chain LocationRevealedEvents for proof" : "Resolving your character — wait a moment"}
            >
              {verifying ? "SCANNING THE LATTICE…" : "VERIFY EXPEDITION"}
            </button>
            <button
              onClick={onAbandon}
              style={{
                padding: "6px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                background: "transparent", border: `1px solid ${C.secondaryFaint}`, color: C.secondaryDim,
                fontFamily: "inherit", cursor: "pointer",
              }}
            >
              ABANDON
            </button>
          </div>
        </div>
      )}

      {isThisExpedition && isCompleted && (
        <div>
          <div style={{ fontSize: 11, color: C.green, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8 }}>
            {G.solved} EXPEDITION CONFIRMED
          </div>
          <div style={{ fontSize: 12, color: C.fg, lineHeight: 1.6, fontStyle: "italic", marginBottom: 8 }}>
            {expedition.outro}
          </div>
          {activeExpedition.proofTxDigest && (
            <a
              href={`https://suiscan.xyz/testnet/tx/${activeExpedition.proofTxDigest}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.accent, fontSize: 10, fontFamily: "inherit", letterSpacing: "0.06em" }}
            >
              PROOF · {activeExpedition.proofTxDigest.slice(0, 10)}… {G.link}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
