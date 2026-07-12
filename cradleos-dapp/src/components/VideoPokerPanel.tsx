/**
 * VideoPokerPanel — interactive two-tx Video Poker on CradleOS Casino.
 *
 * Game flow:
 *   1. DEAL — 5 cards dealt on-chain. Player sees them.
 *   2. Click cards to toggle HOLD (green border = held).
 *   3. DRAW — unrevealed cards replaced, hand evaluated, payout sent.
 *
 * Card glyphs: uses rank labels + suit glyphs (monospace-safe, no emoji).
 * Paytable: Jacks or Better (1x) through Royal Flush (250x).
 */
import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { translateTxError } from "../lib/txError";
import { fetchEveCoins, fetchHouseState, withGas, betPresets } from "../lib/casino";
import { CASINO_HOUSE } from "../constants";
import {
  buildVideoPokerDealTx, buildVideoPokerDrawTx,
  fetchActiveVideoPokerHand, resolveVideoPokerDealByDigest, resolveVideoPokerDrawByDigest,
  POKER_HAND_RANKS, decodeVPCard,
  type VideoPokerSettleResult,
} from "../lib/casinoVideoPoker";

const ACCENT = "#FF4700";
const GOLD   = "#E8B84B";
const GREEN  = "#3FCF6A";

// ── one-time keyframe injection (Video Poker) ─────────────────────────────────
let vpKeyframesInjected = false;
function useVPKeyframes() {
  useEffect(() => {
    if (vpKeyframesInjected) return;
    vpKeyframesInjected = true;
    const el = document.createElement("style");
    el.textContent = `
      @keyframes vp-card-deal { 0% { transform: translateX(-24px) translateY(-10px) rotate(-8deg); opacity: 0; } 70% { transform: translateX(2px) rotate(1deg); } 100% { transform: translateX(0) rotate(0deg); opacity: 1; } }
      @keyframes vp-card-draw { 0% { transform: rotateY(0deg); } 50% { transform: rotateY(90deg); } 100% { transform: rotateY(0deg); } }
      @keyframes vp-held-glow { 0%,100% { box-shadow: 0 0 8px rgba(63,207,106,0.35), inset 0 0 10px rgba(63,207,106,0.12); } 50% { box-shadow: 0 0 20px rgba(63,207,106,0.7), inset 0 0 18px rgba(63,207,106,0.22); } }
      @keyframes vp-win-pulse { 0%,100% { transform: scale(1) translateY(0); } 30% { transform: scale(1.06) translateY(-2px); } 60% { transform: scale(1.03) translateY(-1px); } }
      @keyframes vp-hand-reveal { 0% { transform: translateY(8px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
    `;
    document.head.appendChild(el);
  }, []);
}

type VPPhase = "idle" | "dealing" | "hold" | "drawing" | "done";

function txDigestOf(result: any): string {
  return (
    result?.Transaction?.digest ??
    result?.FailedTransaction?.digest ??
    result?.digest ??
    result?.effects?.transactionDigest ??
    ""
  );
}
function fmtEve(n: number): string { return n.toLocaleString(undefined, { maximumFractionDigits: 3 }); }

// ── Card rendering ────────────────────────────────────────────────────────────
function CardTile({
  index,
  held,
  onClick,
  dimmed,
  final,
  dealDelay,
  isDrawn,
  isWinner,
}: {
  index?: number;
  held?: boolean;
  onClick?: () => void;
  dimmed?: boolean;
  final?: boolean;
  dealDelay?: number;
  isDrawn?: boolean;
  isWinner?: boolean;
}) {
  useVPKeyframes();
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (isDrawn) {
      // Brief flip animation on draw
      setDrawn(true);
      const t = setTimeout(() => setDrawn(false), 450);
      return () => clearTimeout(t);
    }
  }, [isDrawn]);

  if (index === undefined) {
    return (
      <div style={{ ...cardShell("#1a1a1a", "#333"), opacity: 0.4 }}>
        <div style={{ color: "#555", fontSize: 16 }}>▣</div>
      </div>
    );
  }
  const card = decodeVPCard(index);
  const border = held
    ? `2px solid ${GREEN}`
    : isWinner
    ? `2px solid ${GOLD}`
    : final
    ? `2px solid ${ACCENT}55`
    : `1px solid #333`;

  const dealDelayMs = dealDelay ?? 0;
  return (
    <div
      onClick={onClick}
      style={{
        ...cardShell(held ? "#0a2015" : isWinner ? "#1a1408" : "#161616", border),
        cursor: onClick ? "pointer" : "default",
        opacity: dimmed ? 0.45 : 1,
        transition: "background 0.15s, border-color 0.15s",
        boxShadow: held
          ? `inset 0 0 10px ${GREEN}22`
          : isWinner
          ? `0 0 14px ${GOLD}66`
          : "none",
        animation: drawn
          ? "vp-card-draw 0.45s ease"
          : isWinner
          ? "vp-win-pulse 1s ease infinite"
          : held
          ? "vp-held-glow 1.2s ease infinite"
          : `vp-card-deal 0.35s ease ${dealDelayMs}ms both`,
      }}
    >
      <div style={{ color: card.suitColor, fontSize: 13, fontWeight: 900, lineHeight: 1.1, textAlign: "center" }}>
        {card.rankLabel}
        <div style={{ fontSize: 11 }}>{card.suitGlyph}</div>
      </div>
      {held && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, textAlign: "center", fontSize: 9, color: GREEN, fontWeight: 800, letterSpacing: "0.06em", paddingTop: 3 }}>
          HOLD
        </div>
      )}
      {isWinner && (
        <div style={{ position: "absolute", bottom: 2, left: 0, right: 0, textAlign: "center", fontSize: 8, color: GOLD, fontWeight: 800, letterSpacing: "0.04em" }}>
          ◆
        </div>
      )}
    </div>
  );
}

function cardShell(bg: string, border: string): React.CSSProperties {
  return {
    position: "relative",
    width: 58, height: 82,
    background: bg,
    borderRadius: 6,
    border,
    boxShadow: "0 3px 8px rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
}

export function VideoPokerPanel() {
  const dAppKit = useDAppKit();
  const { account } = useVerifiedAccountContext();
  const addr = account?.address ?? "";
  const signer = () => new CurrentAccountSigner(dAppKit);

  const [betEve, setBetEve] = useState("10");
  const [phase, setPhase] = useState<VPPhase>("idle");
  const [handId, setHandId] = useState<string | null>(null);
  const [_wager, setWager] = useState(0);
  const [cards, setCards] = useState<number[]>([]);
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false]);
  const [settle, setSettle] = useState<VideoPokerSettleResult | null>(null);
  const [drawnCardSet, setDrawnCardSet] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);

  const balQ = useQuery({
    queryKey: ["casinoEve", addr],
    queryFn: () => fetchEveCoins(addr),
    enabled: !!addr,
    refetchInterval: 20000,
  });
  const myEve = balQ.data ? Number(balQ.data.totalRaw) / 1e9 : 0;

  const houseQ = useQuery({
    queryKey: ["casinoHouseLive"],
    queryFn: () => fetchHouseState(CASINO_HOUSE),
    refetchInterval: 15000,
  });

  // ── Resume active hand on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!addr || phase !== "idle") return;
    let cancelled = false;
    setResumeLoading(true);
    fetchActiveVideoPokerHand(addr).then((h) => {
      if (cancelled || !h) return;
      setHandId(h.handId);
      setWager(h.wager);
      setCards(h.cards);
      setHeld([false, false, false, false, false]);
      setPhase("hold");
    }).finally(() => {
      if (!cancelled) setResumeLoading(false);
    });
    return () => { cancelled = true; };
  }, [addr]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetGame() {
    setPhase("idle"); setHandId(null); setWager(0);
    setCards([]); setHeld([false, false, false, false, false]); setSettle(null); setErr(null);
  }

  // ── Deal ─────────────────────────────────────────────────────────────────
  const deal = useCallback(async () => {
    if (!addr) { setErr("Connect a wallet."); return; }
    const wagerNum = Number(betEve);
    if (!(wagerNum > 0)) { setErr("Enter a positive bet."); return; }
    setBusy(true); setErr(null); setSettle(null); setCards([]); setHeld([false, false, false, false, false]); setDrawnCardSet(new Set());
    setPhase("dealing");
    try {
      const raw = BigInt(Math.floor(wagerNum * 1e9));
      const buildTx = async () => {
        const { ids } = await fetchEveCoins(addr);
        if (!ids.length) throw new Error("No $EVE in wallet.");
        return withGas(buildVideoPokerDealTx(ids, raw), addr);
      };
      let res: any;
      try {
        res = await signer().signAndExecuteTransaction({ transaction: await buildTx() });
      } catch (e: any) {
        if (/not found|notexists|deleted|invalid.*object|InsufficientGas|GasBalanceTooLow/i.test(String(e?.message ?? e))) {
          await new Promise((r) => setTimeout(r, 1500));
          res = await signer().signAndExecuteTransaction({ transaction: await buildTx() });
        } else { throw e; }
      }
      const digest = txDigestOf(res);
      if (!digest) throw new Error("No tx digest returned.");
      const dealt = await resolveVideoPokerDealByDigest(digest);
      if (!dealt) throw new Error("Could not read deal result — check the feed.");
      setHandId(dealt.handId);
      setWager(dealt.wager);
      setCards(dealt.cards);
      setHeld([false, false, false, false, false]);
      setPhase("hold");
      balQ.refetch();
    } catch (e: any) {
      setErr(translateTxError(e));
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  }, [addr, betEve, dAppKit]);

  // ── Draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback(async () => {
    if (!handId || busy || phase !== "hold") return;
    setBusy(true); setErr(null); setPhase("drawing");
    try {
      // Build hold mask: bit i set = keep card i
      const holdMask = held.reduce((mask, h, i) => mask | (h ? (1 << i) : 0), 0);
      const tx = await withGas(await buildVideoPokerDrawTx(handId, holdMask), addr);
      let res: any;
      try {
        res = await signer().signAndExecuteTransaction({ transaction: tx });
      } catch (e: any) {
        if (/not found|notexists|deleted|invalid.*object|version.*match|not available for consumption|InsufficientGas|GasBalanceTooLow/i.test(String(e?.message ?? e))) {
          await new Promise((r) => setTimeout(r, 1500));
          const tx2 = await withGas(await buildVideoPokerDrawTx(handId, holdMask), addr);
          res = await signer().signAndExecuteTransaction({ transaction: tx2 });
        } else { throw e; }
      }
      const digest = txDigestOf(res);
      if (!digest) throw new Error("No tx digest returned.");
      const settled = await resolveVideoPokerDrawByDigest(digest);
      if (!settled) throw new Error("Could not read draw result — check the feed.");
      setSettle(settled);
      setCards(settled.finalCards);
      // Mark which positions were drawn (not held)
      const drawnSet = new Set<number>();
      held.forEach((h, i) => { if (!h) drawnSet.add(i); });
      setDrawnCardSet(drawnSet);
      setPhase("done");
      balQ.refetch();
    } catch (e: any) {
      setErr(translateTxError(e));
      setPhase("hold");
    } finally {
      setBusy(false);
    }
  }, [handId, busy, phase, held, addr, dAppKit]);

  function toggleHold(i: number) {
    if (phase !== "hold") return;
    setHeld((prev) => { const next = [...prev]; next[i] = !next[i]; return next; });
  }

  if (resumeLoading) {
    return <div style={{ color: "#888", padding: 24, textAlign: "center" }}>◇ checking for active hand…</div>;
  }

  const handRankDef = settle ? POKER_HAND_RANKS[settle.handRank] : null;
  const net = settle ? settle.payout - settle.wager : 0;

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 440px", minWidth: 340 }}>
        {/* Header */}
        <div style={{ background: "radial-gradient(ellipse at 50% 10%, #14190a 0%, #0c0c0c 55%, #060606 100%)", border: `2px solid ${ACCENT}44`, borderRadius: 12, padding: "18px 20px", boxShadow: "inset 0 0 60px rgba(0,0,0,0.7)" }}>
          <div style={{ color: ACCENT, fontSize: 16, fontWeight: 800, letterSpacing: "0.1em" }}>◈ VIDEO POKER</div>
          <div style={{ color: "#9a9a8a", fontSize: 11, marginTop: 2 }}>
            Jacks or Better. Deal 5 cards, choose which to hold, draw replacements. Best hand wins.
          </div>

          {/* Card area */}
          <div style={{ marginTop: 16 }}>
            {phase === "idle" ? (
              <div style={{ color: "#556", fontSize: 12, textAlign: "center", padding: "20px 0" }}>deal to begin</div>
            ) : phase === "dealing" ? (
              <div style={{ color: GOLD, fontSize: 12, textAlign: "center", padding: "20px 0", letterSpacing: "0.12em" }}>◇ dealing on-chain…</div>
            ) : phase === "drawing" ? (
              <div style={{ color: GOLD, fontSize: 12, textAlign: "center", padding: "8px 0 4px", letterSpacing: "0.12em" }}>◇ drawing replacements…</div>
            ) : null}

            {(phase === "hold" || phase === "drawing" || phase === "done") && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {[0, 1, 2, 3, 4].map((i) => {
                  const isWinCard = phase === "done" && settle !== null && settle.handRank > 0;
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <CardTile
                        index={cards[i]}
                        held={phase === "hold" && held[i]}
                        onClick={phase === "hold" ? () => toggleHold(i) : undefined}
                        dimmed={phase === "done" && settle !== null && !held[i] && settle.handRank === 0}
                        final={phase === "done"}
                        dealDelay={i * 100}
                        isDrawn={phase === "done" && drawnCardSet.has(i)}
                        isWinner={isWinCard}
                      />
                      {phase === "hold" && (
                        <div style={{ fontSize: 9, color: held[i] ? GREEN : "#444", fontWeight: 800, letterSpacing: "0.06em" }}>
                          {held[i] ? "HELD" : "discard"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Result */}
            {phase === "done" && settle && (
              <div style={{ textAlign: "center", marginTop: 14, animation: "vp-hand-reveal 0.5s ease both" }}>
                <div style={{ color: handRankDef && handRankDef.mult > 0 ? GOLD : ACCENT, fontSize: 22, fontWeight: 900, letterSpacing: "0.08em" }}>
                  {handRankDef?.label ?? "LOSS"}
                  {handRankDef && handRankDef.mult > 0 ? ` · ${handRankDef.mult}x` : ""}
                </div>
                {(() => {
                  const isWin = net > 0;
                  const isPush = settle.payout > 0 && net === 0;
                  const isPartial = settle.payout > 0 && net < 0;
                  const dColor = isWin ? GREEN : (isPartial || isPush) ? "#E8B84B" : ACCENT;
                  const dText = isWin ? `+${fmtEve(net)} EVE` : isPush ? "\u00B10 EVE" : `\u2212${fmtEve(Math.abs(net))} EVE`;
                  return <div style={{ color: dColor, fontSize: 18, fontWeight: 800, marginTop: 4 }}>{dText}</div>;
                })()}
                {net > 0 && (
                  <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>
                    gross payout {fmtEve(settle.payout)} EVE
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ marginTop: 14, background: "#111", border: `1px solid ${ACCENT}22`, padding: 18 }}>
          {phase === "idle" ? (
            <>
              <label>
                <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 4 }}>
                  BET ($EVE) · you have {fmtEve(myEve)}
                </div>
                <input
                  value={betEve}
                  onChange={(e) => setBetEve(e.target.value)}
                  inputMode="decimal"
                  style={{ background: "#161616", border: `1px solid ${ACCENT}33`, color: ACCENT, fontSize: 14, padding: "9px 12px", outline: "none", width: "100%", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  {betPresets({ bank: houseQ.data?.bankBalance, grossMult: 250, maxBet: houseQ.data?.maxBet, minBet: houseQ.data?.minBet, walletEve: myEve }).map((v, i, arr) => (
                    <button key={v} onClick={() => setBetEve(String(v))} style={{ background: "#1a1a1a", border: `1px solid ${i === arr.length - 1 ? GOLD : ACCENT}44`, color: i === arr.length - 1 ? GOLD : ACCENT, fontSize: 12, padding: "8px 12px", cursor: "pointer" }}>{i === arr.length - 1 ? `MAX ${fmtEve(v)}` : fmtEve(v)}</button>
                  ))}
                </div>
              </label>
              <button
                disabled={busy || !addr}
                onClick={deal}
                style={{ marginTop: 14, width: "100%", background: `linear-gradient(180deg, ${ACCENT}, #b83400)`, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "0.1em", padding: "13px", cursor: busy || !addr ? "default" : "pointer", opacity: busy || !addr ? 0.5 : 1 }}
              >
                {busy ? "SIGNING…" : "◈ DEAL"}
              </button>
            </>
          ) : phase === "hold" ? (
            <>
              <div style={{ color: "#888", fontSize: 11, marginBottom: 10 }}>
                Click cards to toggle HOLD. Held cards are kept; others are replaced on Draw.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => setHeld([true, true, true, true, true])}
                  style={{ flex: 1, background: "#161616", border: `1px solid ${GREEN}55`, color: GREEN, fontSize: 12, fontWeight: 700, padding: "10px 8px", cursor: "pointer" }}
                >
                  HOLD ALL
                </button>
                <button
                  onClick={() => setHeld([false, false, false, false, false])}
                  style={{ flex: 1, background: "#161616", border: "1px solid #333", color: "#888", fontSize: 12, fontWeight: 700, padding: "10px 8px", cursor: "pointer" }}
                >
                  DISCARD ALL
                </button>
              </div>
              <button
                disabled={busy}
                onClick={draw}
                style={{ marginTop: 12, width: "100%", background: `linear-gradient(180deg, ${ACCENT}, #b83400)`, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "0.1em", padding: "13px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 }}
              >
                {busy ? "SIGNING…" : `◆ DRAW (${held.filter(Boolean).length} held)`}
              </button>
            </>
          ) : phase === "done" ? (
            <button
              onClick={resetGame}
              style={{ width: "100%", background: `linear-gradient(180deg, ${ACCENT}, #b83400)`, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "0.1em", padding: "13px", cursor: "pointer" }}
            >
              ◈ NEW HAND
            </button>
          ) : (
            <div style={{ color: GOLD, fontSize: 13, textAlign: "center", padding: 8, letterSpacing: "0.1em" }}>◇ on-chain…</div>
          )}

          {err && <div style={{ color: ACCENT, fontSize: 12, marginTop: 10 }}>{err}</div>}
          <div style={{ color: "#666", fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>
            two-tx · Jacks or Better · deal then draw · payout by hand rank
          </div>
        </div>
      </div>

      {/* Paytable */}
      <div style={{ flex: "0 0 260px", minWidth: 220 }}>
        <div style={{ color: "#888", fontSize: 11, letterSpacing: "0.08em", marginBottom: 8 }}>◇ PAYTABLE</div>
        <div style={{ background: "#111", border: "1px solid #222", padding: "12px 14px" }}>
          {POKER_HAND_RANKS.slice().reverse().map((h) => (
            <div key={h.rank} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ color: h.rank === 9 ? GOLD : h.mult > 0 ? "#aaa" : "#555", fontSize: 11, fontWeight: h.rank >= 7 ? 800 : 400 }}>{h.label}</span>
              <span style={{ color: h.rank === 9 ? GOLD : h.mult > 0 ? GREEN : "#555", fontSize: 12, fontWeight: 800 }}>
                {h.mult > 0 ? `${h.mult}x` : "—"}
              </span>
            </div>
          ))}
          <div style={{ color: "#555", fontSize: 10, marginTop: 10, lineHeight: 1.5 }}>
            Cards: A=Ace, K=King, Q=Queen, J=Jack. Suits: ◆▣=red ❖◯=blue. Jacks or Better pays 1x.
          </div>
        </div>
      </div>
    </div>
  );
}
