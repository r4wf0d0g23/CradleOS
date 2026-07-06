/**
 * CasinoPanel — CradleOS Casino. Flagship: interactive on-chain Blackjack ($EVE).
 *
 * Real Hit / Stand / Double buttons via commit-reveal:
 *   Tx1 `deal` consumes on-chain randomness ONCE and commits the full shuffled
 *   deck inside a player-owned Hand (only your cards + dealer upcard shown).
 *   Hit/Stand/Double are subsequent txs that advance a cursor over that fixed
 *   deck — no new randomness, so the player genuinely reacts to each card but
 *   can't re-roll a loss, and the house can't cheat. The full deck is revealed
 *   in the settlement event for provably-fair audit.
 *
 * House edge is MEASURED (scripts/edge_sim.py), not invented.
 * Cards use real EVE Frontier art (ship hulls, structure icons) — see casinoTheme.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { translateTxError } from "../lib/txError";
import { CASINO_AVAILABLE } from "../constants";
import {
  fetchEveCoins, fetchHouseState,
  buildDealTx, buildHitTx, buildStandTx, buildDoubleTx,
  buildSplitTx, buildSplitHitTx, buildSplitStandTx,
  fetchLiveHand, resolveDealByDigest, resolveSettleByDigest, fetchRecentLiveHands,
  fetchLiveSplitHand, resolveSplitByDigest, resolveSplitSettleByDigest,
  decodeCard, outcomeLabel, handTotal,
  OUT_WIN, OUT_BLACKJACK, OUT_PUSH,
  type LiveHand, type LiveSettlement, type LiveSplitHand, type SplitSettlement,
} from "../lib/casino";
import { SUIT_THEME, RANK_LABEL, RANK_SHIP, CARD_BACK, isFace } from "../lib/casinoTheme";

const ACCENT = "#FF4700";
const GOLD = "#E8B84B";
const GREEN = "#3FCF6A";

// dApp-kit CurrentAccountSigner returns a discriminated union:
//   { $kind:'Transaction', Transaction:{digest,effects,...} } on success
//   { $kind:'FailedTransaction', FailedTransaction:{digest,...} } on failure
// The digest is NOT at result.digest — it's nested. Handle every shape.
function txDigestOf(result: any): string {
  return (
    result?.Transaction?.digest ??
    result?.FailedTransaction?.digest ??
    result?.digest ??
    result?.effects?.transactionDigest ??
    ""
  );
}

function shortAddr(a: string): string { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"; }
function fmtEve(n: number): string { return n.toLocaleString(undefined, { maximumFractionDigits: 3 }); }

// ── Playing card with real EVE Frontier art ───────────────────────────────────
function CardView({ index, hidden, dealDelay = 0 }: { index?: number; hidden?: boolean; dealDelay?: number }) {
  const [shown, setShown] = useState(dealDelay === 0);
  useEffect(() => { if (dealDelay > 0) { const t = setTimeout(() => setShown(true), dealDelay); return () => clearTimeout(t); } }, [dealDelay]);

  if (hidden || index === undefined) {
    return (
      <div style={cardShell(false)}>
        <img src={CARD_BACK} alt="" style={{ width: "68%", height: "68%", objectFit: "contain", opacity: 0.55, filter: "drop-shadow(0 0 4px rgba(255,71,0,0.5))" }} />
      </div>
    );
  }
  const card = decodeCard(index);
  const suit = SUIT_THEME[card.suit];
  const face = isFace(card.rank);
  return (
    <div style={{ ...cardShell(true), transform: shown ? "rotateY(0deg)" : "rotateY(90deg)", transition: "transform 0.28s ease" }}>
      {/* corner rank + suit */}
      <div style={{ position: "absolute", top: 4, left: 5, color: suit.color, fontSize: 14, fontWeight: 900, lineHeight: 1, textAlign: "center" }}>
        {RANK_LABEL[card.rank]}
        <div style={{ fontSize: 10 }}>{suit.glyph}</div>
      </div>
      {/* center art */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        {face
          ? <img src={RANK_SHIP[card.rank]} alt="" style={{ width: "70%", height: "70%", objectFit: "contain", filter: card.suit < 2 ? "hue-rotate(0deg) drop-shadow(0 0 3px rgba(255,71,0,0.4))" : "hue-rotate(160deg) drop-shadow(0 0 3px rgba(127,200,255,0.4))" }} />
          : <img src={suit.icon} alt="" style={{ width: "52%", height: "52%", objectFit: "contain", opacity: 0.9 }} />}
      </div>
      <div style={{ position: "absolute", bottom: 4, right: 5, color: suit.color, fontSize: 14, fontWeight: 900, transform: "rotate(180deg)", lineHeight: 1, textAlign: "center" }}>
        {RANK_LABEL[card.rank]}
        <div style={{ fontSize: 10 }}>{suit.glyph}</div>
      </div>
    </div>
  );
}
function cardShell(face: boolean): React.CSSProperties {
  return {
    position: "relative", width: 62, height: 88,
    background: face ? "linear-gradient(160deg,#1c1712,#0d0b08)" : "linear-gradient(160deg,#241009,#120906)",
    borderRadius: 6, border: `1px solid ${face ? ACCENT + "55" : ACCENT + "33"}`,
    boxShadow: "0 4px 10px rgba(0,0,0,0.6)", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
}

function HandRow({ label, cards, total, hideHole }: { label: string; cards: number[]; total: number; hideHole?: boolean }) {
  const shownTotal = hideHole && cards.length >= 1 ? handTotal([cards[0]]) : total;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: "#999", fontSize: 11, letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}{cards.length > 0 && <span style={{ color: GOLD, marginLeft: 8 }}>{hideHole ? `${shownTotal} +?` : shownTotal}</span>}
      </div>
      <div style={{ display: "flex", gap: 8, minHeight: 88 }}>
        {cards.length === 0 && <div style={{ color: "#555", fontSize: 12, alignSelf: "center" }}>—</div>}
        {cards.map((idx, i) => <CardView key={`${idx}-${i}`} index={idx} hidden={hideHole && i === 1} />)}
      </div>
    </div>
  );
}

type Phase = "idle" | "dealing" | "player" | "resolving" | "settled";

export function CasinoPanel() {
  const dAppKit = useDAppKit();
  const { account } = useVerifiedAccountContext();
  const addr = account?.address ?? "";

  const [betEve, setBetEve] = useState("10");
  const [phase, setPhase] = useState<Phase>("idle");
  const [hand, setHand] = useState<LiveHand | null>(null);
  const [settlement, setSettlement] = useState<LiveSettlement | null>(null);
  const [splitHand, setSplitHand] = useState<LiveSplitHand | null>(null);
  const [splitSettlement, setSplitSettlement] = useState<SplitSettlement | null>(null);
  const [busy, setBusy] = useState(false);
  const [drawing, setDrawing] = useState(false); // polling for the freshly-drawn card
  const [err, setErr] = useState<string | null>(null);

  const dealSfx = useRef<HTMLAudioElement | null>(null);
  const bustSfx = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    dealSfx.current = new Audio("sounds/power-on.mp3"); if (dealSfx.current) dealSfx.current.volume = 0.35;
    bustSfx.current = new Audio("sounds/power-off.mp3"); if (bustSfx.current) bustSfx.current.volume = 0.35;
  }, []);

  const houseState = useQuery({ queryKey: ["casinoHouseLive"], queryFn: () => fetchHouseStateLive(), refetchInterval: 15000 });
  const feedQ = useQuery({ queryKey: ["casinoLiveFeed"], queryFn: () => fetchRecentLiveHands(20), refetchInterval: 15000 });
  const balQ = useQuery({ queryKey: ["casinoEve", addr], queryFn: () => fetchEveCoins(addr), enabled: !!addr, refetchInterval: 20000 });

  const house = houseState.data ?? null;
  const myEve = balQ.data ? Number(balQ.data.totalRaw) / 1e9 : 0;
  const signer = () => new CurrentAccountSigner(dAppKit);

  const refreshAll = () => { houseState.refetch(); feedQ.refetch(); balQ.refetch(); };

  // ── Deal ──
  const deal = useCallback(async () => {
    if (!addr) { setErr("Connect a wallet."); return; }
    const wager = Number(betEve);
    if (!(wager > 0)) { setErr("Enter a positive bet."); return; }
    setBusy(true); setErr(null); setSettlement(null); setHand(null); setPhase("dealing");
    try {
      const { ids } = await fetchEveCoins(addr);
      if (!ids.length) throw new Error("No $EVE in wallet.");
      const tx = buildDealTx(ids, BigInt(Math.floor(wager * 1e9)));
      dealSfx.current?.play().catch(() => {});
      const result: any = await signer().signAndExecuteTransaction({ transaction: tx });
      const digest = txDigestOf(result);
      if (!digest) throw new Error("No tx digest returned.");
      // AUTHORITATIVE: resolve THIS tx by its digest (not "latest event").
      const resolved = await resolveDealByDigest(digest);
      if (!resolved) throw new Error("Could not read hand result — check the feed.");
      if (resolved.kind === "live") {
        const h = await fetchLiveHand(resolved.handId);
        if (h) { setHand(h); setPhase("player"); }
        else { setErr("Hand vanished before load — refresh."); setPhase("idle"); }
      } else {
        finishSettle(resolved.settlement); // natural blackjack, auto-settled
      }
      refreshAll();
    } catch (e) { setErr(translateTxError(e)); setPhase("idle"); }
    finally { setBusy(false); }
  }, [addr, betEve, dAppKit]);

  const act = useCallback(async (kind: "hit" | "stand" | "double") => {
    if (!hand) return;
    setBusy(true); setErr(null);
    try {
      let tx;
      if (kind === "hit") tx = buildHitTx(hand.handId);
      else if (kind === "stand") tx = buildStandTx(hand.handId);
      else {
        const { ids } = await fetchEveCoins(addr);
        tx = buildDoubleTx(hand.handId, ids, BigInt(Math.floor(hand.wager * 1e9)));
      }
      const result: any = await signer().signAndExecuteTransaction({ transaction: tx });
      const digest = txDigestOf(result);

      // ── HIT: poll-until-changed ─────────────────────────────────────────────
      // The fullnode read pool (via our caching proxy) lags the write by 1-3s,
      // so a single fixed-delay read returns the OLD 2-card state (or null
      // mid-mutation). Poll fetchLiveHand until the card count grows (drew a
      // card, still playing) OR the hand is consumed (bust/21 -> settled).
      // Same eventual-consistency pattern as waitForStructureStatus() in lib.ts.
      if (kind === "hit") {
        const prevCount = hand.playerCards.length;
        setDrawing(true);
        try {
          const MAX_TRIES = 20;          // hard runaway guard
          const DEADLINE = Date.now() + 10_000;
          for (let i = 0; i < MAX_TRIES && Date.now() < DEADLINE; i++) {
            await new Promise((r) => setTimeout(r, 500));
            let still: LiveHand | null = null;
            try { still = await fetchLiveHand(hand.handId); } catch { /* RPC blip — retry */ }
            if (still && still.playerCards.length > prevCount) {
              // New card landed and hand is still live -> stay in player phase.
              setHand(still); refreshAll(); return;
            }
            if (still === null) {
              // Hand consumed (bust or 21) -> it settled. Resolve by digest.
              setPhase("resolving");
              const s = digest ? await resolveSettleByDigest(digest) : null;
              if (s) { finishSettle(s); refreshAll(); return; }
              break; // fall through to the generic settle read below
            }
            // else: still old state (read lag) OR a card that didn't grow count -> keep polling
          }
          // Timed out without a definitive change. Try one settle read, else
          // surface whatever live hand we can so the UI isn't stuck.
          const s = digest ? await resolveSettleByDigest(digest) : null;
          if (s) { finishSettle(s); refreshAll(); return; }
          const last = await fetchLiveHand(hand.handId).catch(() => null);
          if (last) { setHand(last); refreshAll(); return; }
          setErr("Card is taking a moment to appear — the tx landed; refreshing…");
          refreshAll();
          return;
        } finally { setDrawing(false); }
      }

      // ── STAND / DOUBLE: hand always settles. Poll the settle read too. ───────
      setPhase("resolving");
      let s: LiveSettlement | null = digest ? await resolveSettleByDigest(digest) : null;
      if (!s && digest) {
        // Settlement event can lag the same 1-3s. Retry a few times before failing.
        const DEADLINE = Date.now() + 8_000;
        while (!s && Date.now() < DEADLINE) {
          await new Promise((r) => setTimeout(r, 500));
          s = await resolveSettleByDigest(digest).catch(() => null);
        }
      }
      if (s) finishSettle(s);
      else { setErr("Could not read result — check the feed."); setPhase("idle"); }
      refreshAll();
    } catch (e) { setErr(translateTxError(e)); }
    finally { setBusy(false); }
  }, [hand, addr, dAppKit]);

  const finishSettle = (s: LiveSettlement) => {
    setSettlement(s); setHand(null); setPhase("settled");
    const won = s.outcome === OUT_WIN || s.outcome === OUT_BLACKJACK;
    if (!won && s.outcome !== OUT_PUSH) bustSfx.current?.play().catch(() => {});
  };
  const finishSplitSettle = (s: SplitSettlement) => {
    setSplitSettlement(s); setSplitHand(null); setHand(null); setPhase("settled");
    if (s.payout === 0) bustSfx.current?.play().catch(() => {});
  };
  const newHand = () => { setSettlement(null); setHand(null); setSplitHand(null); setSplitSettlement(null); setPhase("idle"); };

  // ── Split a same-rank pair ──
  const actSplit = useCallback(async () => {
    if (!hand) return;
    setBusy(true); setErr(null);
    try {
      const { ids } = await fetchEveCoins(addr);
      if (!ids.length) throw new Error("No $EVE for the split stake.");
      const tx = buildSplitTx(hand.handId, ids, BigInt(Math.floor(hand.wager * 1e9)));
      const result: any = await signer().signAndExecuteTransaction({ transaction: tx });
      const digest = txDigestOf(result);
      setPhase("resolving");
      const resolved = digest ? await resolveSplitByDigest(digest) : null;
      if (!resolved) {
        setErr("Could not read split result — check the feed."); setHand(null); setPhase("idle");
      } else if (resolved.kind === "live") {
        const sh = await fetchLiveSplitHand(resolved.splitId);
        if (sh) { setHand(null); setSplitHand(sh); setPhase("player"); }
        else {
          // Consumed between reads (auto-settled) — resolve by this same digest.
          const s = digest ? await resolveSplitSettleByDigest(digest) : null;
          if (s) finishSplitSettle(s);
          else { setErr("Split hand vanished — refresh."); setHand(null); setPhase("idle"); }
        }
      } else {
        finishSplitSettle(resolved.settlement); // split aces auto-settle
      }
      refreshAll();
    } catch (e) { setErr(translateTxError(e)); setPhase("player"); }
    finally { setBusy(false); }
  }, [hand, addr, dAppKit]);

  // ── Hit/stand on the active split hand (poll-until-changed, direct fullnode) ──
  const actSplitMove = useCallback(async (kind: "hit" | "stand") => {
    if (!splitHand) return;
    setBusy(true); setErr(null);
    try {
      const tx = kind === "hit" ? buildSplitHitTx(splitHand.splitId) : buildSplitStandTx(splitHand.splitId);
      const result: any = await signer().signAndExecuteTransaction({ transaction: tx });
      const digest = txDigestOf(result);
      const prevActive = splitHand.active;
      const prevLen = prevActive === 0 ? splitHand.handA.length : splitHand.handB.length;
      if (kind === "hit") setDrawing(true);
      try {
        const DEADLINE = Date.now() + 10_000;
        for (let i = 0; i < 20 && Date.now() < DEADLINE; i++) {
          await new Promise((r) => setTimeout(r, 500));
          let still: LiveSplitHand | null = null;
          try { still = await fetchLiveSplitHand(splitHand.splitId); } catch { /* RPC blip — retry */ }
          if (still) {
            const nowLen = prevActive === 0 ? still.handA.length : still.handB.length;
            if (still.active !== prevActive || (kind === "hit" && nowLen > prevLen)) {
              setSplitHand(still); refreshAll(); return;
            }
            // unchanged = read lag → keep polling
          } else {
            // Object consumed → the whole split settled in this action.
            setPhase("resolving");
            const s = digest ? await resolveSplitSettleByDigest(digest) : null;
            if (s) { finishSplitSettle(s); refreshAll(); return; }
            break;
          }
        }
        const s = digest ? await resolveSplitSettleByDigest(digest) : null;
        if (s) { finishSplitSettle(s); refreshAll(); return; }
        const last = await fetchLiveSplitHand(splitHand.splitId).catch(() => null);
        if (last) { setSplitHand(last); refreshAll(); return; }
        setErr("Result is taking a moment — the tx landed; refreshing…");
        refreshAll();
      } finally { setDrawing(false); }
    } catch (e) { setErr(translateTxError(e)); }
    finally { setBusy(false); }
  }, [splitHand, addr, dAppKit]);

  if (!CASINO_AVAILABLE) return <div style={{ color: "#888", padding: 24 }}>Casino is only available on Stillness.</div>;

  const canDouble = hand && hand.playerCards.length === 2;
  const canSplit = !!hand && hand.playerCards.length === 2
    && hand.playerCards[0] % 13 === hand.playerCards[1] % 13
    && myEve >= hand.wager;
  const playerCards = settlement?.playerCards ?? hand?.playerCards ?? [];
  const dealerCards = settlement?.dealerCards ?? (hand ? [hand.dealerUpcard] : []);
  const hideHole = phase === "player" || phase === "dealing";
  const inSplit = !!splitHand || !!splitSettlement;
  const splitA = splitSettlement?.handA ?? splitHand?.handA ?? [];
  const splitB = splitSettlement?.handB ?? splitHand?.handB ?? [];
  const splitDealer = splitSettlement?.dealerCards ?? (splitHand ? [splitHand.dealerUpcard] : []);
  const activeLabel = splitHand?.active === 1 ? "B" : "A";

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(180deg, rgba(20,8,4,0.92), rgba(10,10,10,0.96)), url(banner-battle.png)`, backgroundSize: "cover", backgroundPosition: "center", border: `1px solid ${ACCENT}33`, padding: "18px 22px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ color: ACCENT, fontSize: 22, fontWeight: 800, letterSpacing: "0.12em" }}>◈ CRADLE CASINO</div>
            <div style={{ color: "#9a9a8a", fontSize: 11, marginTop: 2 }}>INTERACTIVE BLACKJACK · PROVABLY FAIR · SETTLED IN $EVE</div>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <Stat label="HOUSE BANK" value={house ? `${fmtEve(house.bankBalance)} EVE` : "—"} />
            <Stat label="HANDS" value={house ? String(house.betsSettled) : "—"} />
            <Stat label="YOUR $EVE" value={addr ? fmtEve(myEve) : "connect"} color={GOLD} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Table */}
        <div style={{ flex: "1 1 440px", minWidth: 340 }}>
          <div style={{ background: `radial-gradient(ellipse at 50% 15%, #14351f 0%, #0c1c12 55%, #060a08 100%)`, border: `2px solid ${ACCENT}44`, borderRadius: 12, padding: "22px 24px", boxShadow: "inset 0 0 70px rgba(0,0,0,0.65)" }}>
            {inSplit ? (
              <>
                <HandRow label="DEALER" cards={splitDealer} total={splitSettlement?.dealerTotal ?? 0} hideHole={!!splitHand} />
                <div style={{ height: 1, background: `${ACCENT}22`, margin: "4px 0 12px" }} />
                <HandRow
                  label={splitHand && splitHand.active === 0 ? "HAND A ▸ PLAYING" : "HAND A"}
                  cards={splitA}
                  total={splitSettlement?.totalA ?? splitHand?.totalA ?? 0}
                />
                <HandRow
                  label={splitHand && splitHand.active === 1 ? "HAND B ▸ PLAYING" : "HAND B"}
                  cards={splitB}
                  total={splitSettlement?.totalB ?? splitHand?.totalB ?? 0}
                />
              </>
            ) : (
              <>
                <HandRow label="DEALER" cards={dealerCards} total={settlement?.dealerTotal ?? 0} hideHole={hideHole} />
                <div style={{ height: 1, background: `${ACCENT}22`, margin: "4px 0 12px" }} />
                <HandRow label="YOU" cards={playerCards} total={settlement?.playerTotal ?? hand?.playerTotal ?? 0} />
              </>
            )}

            {phase === "dealing" && <Center text="◇ shuffling on-chain…" color={GOLD} />}
            {phase === "resolving" && <Center text="◇ dealer playing…" color={GOLD} />}
            {phase === "settled" && settlement && <OutcomeBadge s={settlement} />}
            {phase === "settled" && splitSettlement && <SplitOutcomeBadge s={splitSettlement} />}
          </div>

          {/* Controls */}
          <div style={{ marginTop: 16, background: "#111", border: `1px solid ${ACCENT}22`, padding: 18 }}>
            {phase === "player" && splitHand ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button disabled={busy} onClick={() => actSplitMove("hit")} style={actionBtn(ACCENT)}>{drawing ? "◆ DRAWING…" : `◆ HIT ${activeLabel}`}</button>
                <button disabled={busy} onClick={() => actSplitMove("stand")} style={actionBtn("#666")}>■ STAND {activeLabel}</button>
              </div>
            ) : phase === "player" ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button disabled={busy} onClick={() => act("hit")} style={actionBtn(ACCENT)}>{drawing ? "◆ DRAWING…" : "◆ HIT"}</button>
                <button disabled={busy} onClick={() => act("stand")} style={actionBtn("#666")}>■ STAND</button>
                <button disabled={busy || !canDouble || myEve < (hand?.wager ?? 0)} onClick={() => act("double")} style={actionBtn(GOLD)}>✦ DOUBLE</button>
                {canSplit && <button disabled={busy} onClick={actSplit} style={actionBtn("#7FC8FF")}>◫ SPLIT</button>}
              </div>
            ) : phase === "settled" ? (
              <button onClick={newHand} style={dealBtn}>◈ NEW HAND</button>
            ) : (
              <>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <label style={{ flex: "1 1 160px" }}>
                    <div style={lbl}>BET ($EVE)</div>
                    <input value={betEve} onChange={(e) => setBetEve(e.target.value)} inputMode="decimal" style={input} />
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      {[5, 10, 25, 100].map((v) => <button key={v} onClick={() => setBetEve(String(v))} style={chip}>{v}</button>)}
                    </div>
                  </label>
                </div>
                <button disabled={busy || phase === "dealing" || !addr} onClick={deal} style={{ ...dealBtn, opacity: busy || !addr ? 0.5 : 1 }}>
                  {busy ? "SIGNING…" : "◈ DEAL"}
                </button>
              </>
            )}
            {house?.paused && <div style={{ color: ACCENT, fontSize: 12, marginTop: 8 }}>⚠ House paused.</div>}
            {err && <div style={{ color: ACCENT, fontSize: 12, marginTop: 8 }}>{err}</div>}
            {house && phase !== "player" && (
              <div style={{ color: "#666", fontSize: 10, marginTop: 8 }}>
                min {fmtEve(house.minBet)} · max {fmtEve(house.maxBet)} EVE · blackjack pays 3:2 · dealer stands on 17 · split same-rank pairs (aces: one card each)
              </div>
            )}
          </div>
        </div>

        {/* Feed */}
        <div style={{ flex: "1 1 300px", minWidth: 280 }}>
          <div style={{ color: "#888", fontSize: 11, letterSpacing: "0.08em", marginBottom: 8 }}>◇ PROVABLY-FAIR FEED</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 560, overflowY: "auto" }}>
            {(feedQ.data ?? []).length === 0 && <div style={{ color: "#555", fontSize: 12 }}>No hands yet. Deal the first.</div>}
            {(feedQ.data ?? []).map((h, i) => <FeedRow key={h.txDigest + i} h={h} me={addr} />)}
          </div>
          <div style={{ color: "#555", fontSize: 10, marginTop: 10, lineHeight: 1.5 }}>
            Each hand shuffles once via Sui on-chain randomness (0x8); your hit/stand/double replays that fixed deck. No re-rolls, no house cheating — the full deck is published on settlement for anyone to verify.
          </div>
        </div>
      </div>
    </div>
  );
}

// helper to read the hardcoded house
async function fetchHouseStateLive() {
  const { CASINO_HOUSE } = await import("../constants");
  return fetchHouseState(CASINO_HOUSE);
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (<div><div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em" }}>{label}</div><div style={{ color: color ?? ACCENT, fontSize: 18, fontWeight: 800 }}>{value}</div></div>);
}
function Center({ text, color }: { text: string; color: string }) {
  return <div style={{ color, fontSize: 13, textAlign: "center", padding: 10 }}>{text}</div>;
}
function SplitOutcomeBadge({ s }: { s: SplitSettlement }) {
  const net = s.payout - s.wager;
  const col = net > 0 ? GREEN : net === 0 ? "#9a9a8a" : ACCENT;
  return (
    <div style={{ textAlign: "center", padding: "8px 0 2px" }}>
      <div style={{ color: col, fontSize: 20, fontWeight: 900, letterSpacing: "0.08em" }}>
        A: {outcomeLabel(s.outcomeA)} · B: {outcomeLabel(s.outcomeB)}
      </div>
      <div style={{ color: col, fontSize: 14, marginTop: 2 }}>{net > 0 ? `+${fmtEve(net)}` : net < 0 ? fmtEve(net) : "±0"} EVE</div>
    </div>
  );
}
function OutcomeBadge({ s }: { s: LiveSettlement }) {
  const win = s.outcome === OUT_WIN || s.outcome === OUT_BLACKJACK;
  const push = s.outcome === OUT_PUSH;
  const col = s.outcome === OUT_BLACKJACK ? GOLD : win ? GREEN : push ? "#9a9a8a" : ACCENT;
  const net = s.payout - s.wager;
  return (
    <div style={{ textAlign: "center", padding: "8px 0 2px" }}>
      <div style={{ color: col, fontSize: 24, fontWeight: 900, letterSpacing: "0.1em" }}>{outcomeLabel(s.outcome)}{s.doubled ? " ×2" : ""}</div>
      <div style={{ color: col, fontSize: 14, marginTop: 2 }}>{net > 0 ? `+${fmtEve(net)}` : net < 0 ? fmtEve(net) : "±0"} EVE</div>
    </div>
  );
}
function FeedRow({ h, me }: { h: any; me: string }) {
  const win = h.outcome === OUT_WIN || h.outcome === OUT_BLACKJACK;
  const push = h.outcome === OUT_PUSH;
  const col = h.outcome === OUT_BLACKJACK ? GOLD : win ? GREEN : push ? "#9a9a8a" : ACCENT;
  const mine = h.player === me;
  return (
    <div style={{ background: mine ? "#1a0f08" : "#111", border: `1px solid ${mine ? ACCENT + "44" : "#222"}`, padding: "7px 10px", fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><span style={{ color: mine ? GOLD : "#999" }}>{mine ? "YOU" : shortAddr(h.player)}</span><span style={{ color: "#555", marginLeft: 6 }}>{h.playerTotal} v {h.dealerTotal}</span></div>
      <div><span style={{ color: col, fontWeight: 700 }}>{outcomeLabel(h.outcome)}</span><span style={{ color: "#666", marginLeft: 6 }}>{fmtEve(h.wager)}</span></div>
    </div>
  );
}

const lbl: React.CSSProperties = { color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 4 };
const input: React.CSSProperties = { background: "#161616", border: `1px solid ${ACCENT}33`, color: ACCENT, fontSize: 14, padding: "9px 12px", outline: "none", width: "100%", boxSizing: "border-box" };
const chip: React.CSSProperties = { background: "#1a1a1a", border: `1px solid ${ACCENT}44`, color: ACCENT, fontSize: 12, padding: "8px 12px", cursor: "pointer" };
const dealBtn: React.CSSProperties = { marginTop: 14, width: "100%", background: `linear-gradient(180deg, ${ACCENT}, #b83400)`, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "0.1em", padding: "13px", cursor: "pointer" };
function actionBtn(color: string): React.CSSProperties {
  return { flex: 1, minWidth: 90, background: "#161616", border: `1px solid ${color}`, color, fontSize: 15, fontWeight: 800, letterSpacing: "0.08em", padding: "13px", cursor: "pointer" };
}
