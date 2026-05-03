/**
 * KeeperCipherPanel — the daily Keeper transmission decoder + expedition
 * verification surface.
 *
 * Two interleaved loops (see design doc in repo):
 *   Loop A (sedentary): decode today's Keeper fragment using a substitution
 *           cipher whose seed is derived from the UTC date plus the latest
 *           killmail tx digest. Solve = unlock the plaintext.
 *   Loop B (active): if the fragment carries an expedition, the Keeper
 *           issues a target system. Player must travel there in-game and
 *           reveal a NetworkNode at that location. Verification is a
 *           client-side scan of LocationRevealedEvents that match the
 *           target system + post-issue timestamp + the player's character.
 *
 * Visual language mirrors KillCardModal/PlayerCardModal — CCP palette
 * (Crude / Neutral / Martian Red / Secondary olive), corner brackets,
 * monospace, all glyphs webview-safe.
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
  encryptFragment,
  scoreAttempt,
  previewDecryption,
  type CipherPuzzle,
} from "./cipher";
import {
  buildDailySeed,
  selectBloodiestSystem,
  selectUnsettledSystem,
  selectAdjacentSystem,
  verifyExpeditionReveal,
  type LocationReveal,
} from "./selectors";

// ── CCP palette (mirror KillCardModal) ────────────────────────────────────────
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
  hint: "✦",
  expedition: "◉",
  sentinel: "▲",
  link: "↗",
  bullet: "▪",
  unsolved: "◇",
  solved: "◆",
  refresh: "↻",
};

// ── localStorage state ────────────────────────────────────────────────────────
type CompletionRecord = {
  fragmentId: number;
  solvedAtMs: number;
  /** Optional: txDigest of the LocationRevealedEvent that proved the
   *  expedition. Absent for fragments without an expedition or where the
   *  expedition was skipped. */
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

function loadCompletions(): CompletionRecord[] {
  try {
    const raw = localStorage.getItem(LS_COMPLETIONS);
    return raw ? (JSON.parse(raw) as CompletionRecord[]) : [];
  } catch {
    return [];
  }
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

// ── Section frame (re-used pattern) ───────────────────────────────────────────
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

// ── Main panel ────────────────────────────────────────────────────────────────
export function KeeperCipherPanel() {
  const account = useCurrentAccount();
  const wallet = account?.address ?? null;

  // ── Player character resolution (only needed for expedition verify) ─────
  const [playerChar, setPlayerChar] = useState<CharacterInfo | null>(null);
  const [playerTribeName, setPlayerTribeName] = useState<string | null>(null);
  useEffect(() => {
    if (!wallet) {
      setPlayerChar(null);
      setPlayerTribeName(null);
      return;
    }
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
      .catch(() => { /* leave null; expedition verify will warn */ });
    return () => { cancelled = true; };
  }, [wallet]);

  // ── Today's puzzle ────────────────────────────────────────────────────
  const [seed, setSeed] = useState<string | null>(null);
  const [fragment, setFragment] = useState<KeeperFragment | null>(null);
  const [puzzle, setPuzzle] = useState<CipherPuzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [completions, setCompletions] = useState<CompletionRecord[]>(() => loadCompletions());
  const [activeExpedition, setActiveExpedition] = useState<ActiveExpedition | null>(() => loadActiveExpedition());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    buildDailySeed()
      .then(s => {
        if (cancelled) return;
        setSeed(s);
        const completedIds = completions.map(c => c.fragmentId);
        const f = pickFragmentForSeed(s, completedIds);
        setFragment(f);
        setPuzzle(encryptFragment(f.plaintext, f.cipher_strength, s));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []); // intentionally only on mount; refresh button to retrigger

  // ── Player guesses (glyph → letter) ───────────────────────────────────
  const [guess, setGuess] = useState<Map<string, string>>(new Map());
  // Reset guess when fragment changes; pre-populate free hints.
  useEffect(() => {
    if (!puzzle) return;
    const initial = new Map<string, string>();
    for (const h of puzzle.freeHints) initial.set(h.glyph, h.letter);
    setGuess(initial);
  }, [puzzle]);

  const score = useMemo(() => {
    if (!puzzle) return null;
    return scoreAttempt(puzzle.decryptionMap, guess);
  }, [puzzle, guess]);

  const livePreview = useMemo(() => {
    if (!puzzle) return "";
    return previewDecryption(puzzle.ciphertext, puzzle.decryptionMap, guess);
  }, [puzzle, guess]);

  const isSolved = score?.isComplete ?? false;
  const isPreviouslySolved = fragment ? completions.some(c => c.fragmentId === fragment.id) : false;

  // ── Persist solve event ─────────────────────────────────────────────
  useEffect(() => {
    if (!isSolved || !fragment) return;
    if (completions.some(c => c.fragmentId === fragment.id)) return; // already recorded
    const next = [...completions, { fragmentId: fragment.id, solvedAtMs: Date.now() }];
    setCompletions(next);
    saveCompletions(next);
  }, [isSolved, fragment, completions]);

  // ── Glyph selection state for the cipher key ──────────────────────────
  const [activeGlyph, setActiveGlyph] = useState<string | null>(null);
  const setLetterFor = (glyph: string, letter: string) => {
    setGuess(prev => {
      const next = new Map(prev);
      if (letter === "") next.delete(glyph);
      else next.set(glyph, letter);
      return next;
    });
  };

  // ── Expedition flow ───────────────────────────────────────────────────
  const [issuingExpedition, setIssuingExpedition] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const issueExpedition = async (frag: KeeperFragment, exp: KeeperExpedition) => {
    setIssuingExpedition(true);
    try {
      let target: number | null = null;
      switch (exp.targetSelector.kind) {
        case "fixed":
          target = exp.targetSelector.systemId;
          break;
        case "bloodiest_24h":
          target = await selectBloodiestSystem(86400, 30);
          break;
        case "bloodiest_7d":
          target = await selectBloodiestSystem(7 * 86400, 60);
          break;
        case "unsettled":
          target = await selectUnsettledSystem(40);
          break;
        case "adjacent_to_previous": {
          const last = parseInt(localStorage.getItem(LS_LAST_COMPLETED_SYSTEM) ?? "0", 10);
          if (last > 0) target = await selectAdjacentSystem(last);
          else target = await selectBloodiestSystem(86400, 30);
          break;
        }
      }
      if (!target) {
        setVerifyError("Lattice silent. Selector returned no candidate. Try another fragment.");
        return;
      }
      // Resolve system name (best effort).
      let name: string | undefined;
      try {
        const res = await fetch(`${WORLD_API}/v2/solarsystems/${target}`);
        if (res.ok) {
          const j = (await res.json()) as { name?: string };
          if (j.name) name = j.name;
        }
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
        setVerifyError(
          "No matching reveal found. Ensure your sentinel is anchored in the target system AFTER the mission was issued.",
        );
        return;
      }
      const completed: ActiveExpedition = {
        ...activeExpedition,
        proofTxDigest: reveal.txDigest,
        completedAtMs: Date.now(),
      };
      setActiveExpedition(completed);
      saveActiveExpedition(completed);

      // Mark fragment completion with proof tx + remember last system.
      const updated = completions
        .filter(c => c.fragmentId !== activeExpedition.fragmentId)
        .concat({
          fragmentId: activeExpedition.fragmentId,
          solvedAtMs: Date.now(),
          expeditionProofTx: reveal.txDigest,
        });
      setCompletions(updated);
      saveCompletions(updated);
      try {
        localStorage.setItem(LS_LAST_COMPLETED_SYSTEM, String(activeExpedition.targetSystemId));
      } catch { /* quota */ }

      // Reward: pick next fragment immediately.
      if (seed) {
        const completedIds = updated.map(c => c.fragmentId);
        const next = pickFragmentForSeed(seed + ":" + activeExpedition.fragmentId, completedIds);
        setFragment(next);
        setPuzzle(encryptFragment(next.plaintext, next.cipher_strength, seed));
      }
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setVerifying(false);
    }
  };

  const abandonExpedition = () => {
    if (!confirmInline("Abandon this expedition?")) return;
    setActiveExpedition(null);
    saveActiveExpedition(null);
  };

  // ── Render ────────────────────────────────────────────────────────────
  if (loading || !fragment || !puzzle) {
    return (
      <div style={{ padding: 16, color: C.fgDim, fontFamily: "ui-monospace, monospace" }}>
        [ resolving lattice signal… ]
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", color: C.fg, maxWidth: 880, margin: "0 auto" }}>
      {/* Header */}
      <Section label={`${G.keeper}  KEEPER TRANSMISSION  \u2014  FRAGMENT #${fragment.id}`}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <span style={{ color: C.accent, fontWeight: 700, letterSpacing: "0.06em", fontSize: 13 }}>
            {fragment.intercept_label}
          </span>
          <span style={{ fontSize: 10, color: C.secondaryDim, letterSpacing: "0.1em" }}>
            CIPHER STRENGTH {fragment.cipher_strength}/5
          </span>
          <span style={{ fontSize: 10, color: C.secondaryDim, letterSpacing: "0.1em" }}>
            {completions.length} FRAGMENT{completions.length === 1 ? "" : "S"} ARCHIVED
            {" / "}
            {FRAGMENTS.length} KNOWN
          </span>
          {playerTribeName && (
            <span style={{ fontSize: 10, color: C.secondaryDim, letterSpacing: "0.1em" }}>
              SENTINEL · {playerTribeName}
            </span>
          )}
        </div>
        {isPreviouslySolved && (
          <div style={{ fontSize: 10, color: C.amber, marginTop: 4, letterSpacing: "0.06em" }}>
            {G.solved} You have already decoded this fragment. The transcript stands as your record.
          </div>
        )}
      </Section>

      {/* Encrypted payload + live preview */}
      <Section label={`${G.intercept}  ENCRYPTED PAYLOAD`}>
        <div
          style={{
            background: "rgba(0,0,0,0.55)",
            padding: "10px 12px",
            border: `1px solid ${C.divider}`,
            fontFamily: "ui-monospace, monospace",
            fontSize: 14,
            letterSpacing: "0.04em",
            wordBreak: "break-word",
            color: C.secondary,
            whiteSpace: "pre-wrap",
            marginBottom: 8,
          }}
        >
          {puzzle.ciphertext}
        </div>
        <div style={{ fontSize: 9, color: C.secondaryDim, letterSpacing: "0.1em", marginBottom: 4 }}>
          DECODED PREVIEW
        </div>
        <div
          style={{
            background: "rgba(255, 71, 0, 0.04)",
            padding: "10px 12px",
            border: `1px solid ${C.accentFaint}`,
            fontFamily: "ui-monospace, monospace",
            fontSize: 14,
            letterSpacing: "0.04em",
            wordBreak: "break-word",
            color: isSolved ? C.accent : C.fg,
            whiteSpace: "pre-wrap",
          }}
        >
          {livePreview}
        </div>
      </Section>

      {/* Cipher key */}
      <Section label={`${G.cipher}  CIPHER KEY  \u2014  ${score?.correctLetters ?? 0} / ${score?.totalLetters ?? 0} RESOLVED`}>
        <div style={{ fontSize: 10, color: C.secondaryDim, marginBottom: 8 }}>
          Click a glyph, then a letter. Free hints are pre-filled. Decoded text updates live.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {puzzle.glyphsInPuzzle.map(glyph => {
            const guessLetter = guess.get(glyph);
            const isCorrect = guessLetter && puzzle.decryptionMap.get(glyph) === guessLetter;
            const isFree = puzzle.freeHints.some(h => h.glyph === glyph);
            const isActive = activeGlyph === glyph;
            return (
              <div
                key={glyph}
                onClick={() => !isFree && setActiveGlyph(activeGlyph === glyph ? null : glyph)}
                style={{
                  cursor: isFree ? "default" : "pointer",
                  width: 56,
                  padding: "6px 4px",
                  textAlign: "center",
                  border: `1px solid ${
                    isActive ? C.accent : isCorrect ? C.green : isFree ? C.amber : C.secondaryFaint
                  }`,
                  background: isActive ? "rgba(255,71,0,0.08)" : "rgba(107,107,94,0.06)",
                  position: "relative",
                }}
                title={isFree ? "Free hint — confirmed by Keeper" : "Click to assign a letter"}
              >
                <div style={{ fontSize: 18, lineHeight: 1, color: isCorrect ? C.green : C.fg }}>
                  {glyph}
                </div>
                <div style={{ fontSize: 11, color: guessLetter ? (isCorrect ? C.green : C.accent) : C.fgFaint, marginTop: 4, fontWeight: 700, letterSpacing: "0.08em", minHeight: 14 }}>
                  {guessLetter ?? "_"}
                </div>
                {isFree && (
                  <div style={{ fontSize: 7, color: C.amber, position: "absolute", top: 2, right: 4, letterSpacing: "0.1em" }}>
                    HINT
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {activeGlyph && !puzzle.freeHints.some(h => h.glyph === activeGlyph) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "8px 6px", background: "rgba(255,71,0,0.04)", border: `1px dashed ${C.accentFaint}` }}>
            <div style={{ width: "100%", fontSize: 9, color: C.accentDim, letterSpacing: "0.12em", marginBottom: 6 }}>
              ASSIGN A LETTER TO {activeGlyph}
            </div>
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map(letter => {
              const isUsed = [...guess.values()].includes(letter) && guess.get(activeGlyph) !== letter;
              return (
                <button
                  key={letter}
                  disabled={isUsed}
                  onClick={() => {
                    setLetterFor(activeGlyph, letter);
                    setActiveGlyph(null);
                  }}
                  style={{
                    width: 26,
                    height: 26,
                    background: isUsed ? "rgba(0,0,0,0.3)" : "rgba(107,107,94,0.1)",
                    border: `1px solid ${C.secondaryFaint}`,
                    color: isUsed ? C.fgFaint : C.fg,
                    fontFamily: "inherit",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: isUsed ? "not-allowed" : "pointer",
                  }}
                  title={isUsed ? "Letter already assigned to another glyph" : `Assign ${letter}`}
                >
                  {letter}
                </button>
              );
            })}
            <button
              onClick={() => {
                setLetterFor(activeGlyph, "");
                setActiveGlyph(null);
              }}
              style={{
                marginLeft: "auto",
                padding: "0 8px",
                height: 26,
                background: "transparent",
                border: `1px solid ${C.accentFaint}`,
                color: C.accentDim,
                fontFamily: "inherit",
                fontSize: 10,
                cursor: "pointer",
                letterSpacing: "0.08em",
              }}
            >
              CLEAR
            </button>
          </div>
        )}
      </Section>

      {/* Solved transcript + expedition */}
      {isSolved && (
        <Section label={`${G.fragment}  TRANSCRIPT`}>
          <div
            style={{
              padding: "12px 14px",
              background: "rgba(255, 71, 0, 0.06)",
              border: `1px solid ${C.accent}`,
              fontSize: 14,
              lineHeight: 1.6,
              color: C.accent,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textShadow: "0 0 10px rgba(255, 71, 0, 0.25)",
            }}
          >
            {fragment.plaintext}
          </div>

          {fragment.expedition && (
            <ExpeditionSection
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
          )}
        </Section>
      )}

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
                  title={`Solved ${new Date(c.solvedAtMs).toUTCString()}${c.expeditionProofTx ? ` · expedition proof ${c.expeditionProofTx.slice(0, 10)}…` : ""}`}
                >
                  <span style={{ color: c.expeditionProofTx ? C.green : C.amber }}>
                    {c.expeditionProofTx ? G.solved : G.unsolved}
                  </span>
                  <span>#{c.fragmentId} {label}</span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Footer note */}
      <div style={{ marginTop: 12, fontSize: 9, color: C.fgFaint, letterSpacing: "0.1em", textAlign: "center" }}>
        DAILY SEED REFRESHES AT 00:00 UTC · CIPHER MAPPINGS ARE CLIENT-SIDE · EXPEDITIONS VERIFIED ON-CHAIN
      </div>
    </div>
  );
}

// ── Expedition section (split out for readability) ────────────────────────────
function ExpeditionSection({
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
  const isCompleted =
    isThisExpedition && activeExpedition.completedAtMs !== undefined;

  return (
    <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(255, 71, 0, 0.03)", border: `1px solid ${C.accentFaint}` }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: C.accent, marginBottom: 8 }}>
        {G.expedition}  EXPEDITION ORDER
      </div>
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
              padding: "6px 14px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              background: "rgba(255, 71, 0, 0.1)",
              border: `1px solid ${C.accent}`,
              color: C.accent,
              fontFamily: "inherit",
              cursor: issuingExpedition ? "wait" : "pointer",
              opacity: issuingExpedition ? 0.5 : 1,
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
            {G.bullet} Anchor a Network Node there (deploy fresh, or move + redeploy an existing one).<br />
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
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                background: "rgba(255, 71, 0, 0.12)",
                border: `1px solid ${C.accent}`,
                color: C.accent,
                fontFamily: "inherit",
                cursor: verifying ? "wait" : playerCharResolved ? "pointer" : "not-allowed",
                opacity: verifying ? 0.5 : playerCharResolved ? 1 : 0.5,
              }}
              title={playerCharResolved ? "Scan on-chain LocationRevealedEvents for proof" : "Resolving your character — wait a moment"}
            >
              {verifying ? "SCANNING THE LATTICE…" : "VERIFY EXPEDITION"}
            </button>
            <button
              onClick={onAbandon}
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                background: "transparent",
                border: `1px solid ${C.secondaryFaint}`,
                color: C.secondaryDim,
                fontFamily: "inherit",
                cursor: "pointer",
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

// ── Inline confirm (no native dialogs in webview per TOOLS.md) ────────────────
function confirmInline(_msg: string): boolean {
  // For v0 we just always allow abandon; a portal-mounted confirm modal can
  // be added in v1 if abuse becomes an issue. The action is reversible
  // (player can re-issue from the same fragment).
  return true;
}
