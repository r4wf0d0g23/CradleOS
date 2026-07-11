/**
 * MinesPanel — interactive multi-tx Mines game on CradleOS Casino.
 *
 * Game flow:
 *   1. Idle   : pick mine count + wager, press START
 *   2. Playing: 5x5 grid of 25 tiles; click to reveal one at a time
 *               — each reveal is a signed tx (mines::reveal)
 *               — safe tile  → ◉  (green), multiplier grows
 *               — mine hit   → ⛨  (red),  game over, mine map revealed
 *   3. CASH OUT at any time during playing → mines::cashout tx → payout
 *   4. Done   : show final result + NEW GAME button
 *
 * Tile glyphs (all monospace-safe, webview-compatible):
 *   ▣  unrevealed   ◉  safe   ⛨  mine   ◇  pending reveal
 *
 * Aesthetic: matches CasinoPanel dark EVE theme (ACCENT, GOLD, GREEN).
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
  buildMinesStartTx, buildMinesRevealTx, buildMinesCashoutTx,
  fetchActiveMinesGame, resolveMinesStartByDigest,
  resolveTileRevealOrBustByDigest, resolveMinesSettleByDigest,
  computeMinesMultiplierBps,
} from "../lib/casinoMines";

const ACCENT = "#FF4700";
const GOLD   = "#E8B84B";
const GREEN  = "#3FCF6A";

// ── one-time keyframe injection (Mines-specific additions) ────────────────────
let minesKeyframesInjected = false;
function useMinesKeyframes() {
  useEffect(() => {
    if (minesKeyframesInjected) return;
    minesKeyframesInjected = true;
    const el = document.createElement("style");
    el.textContent = `
      @keyframes mines-tile-safe { 0% { transform: scale(0.7) rotateY(90deg); opacity: 0; } 60% { transform: scale(1.15) rotateY(0deg); } 100% { transform: scale(1) rotateY(0deg); opacity: 1; } }
      @keyframes mines-tile-mine { 0% { transform: scale(0.7) rotateY(90deg); opacity: 0; } 50% { transform: scale(1.25) rotateY(0deg); } 70% { transform: scale(1.1) translateX(-4px); } 80% { transform: scale(1.1) translateX(4px); } 90% { transform: scale(1.05) translateX(-2px); } 100% { transform: scale(1) rotateY(0deg); opacity: 1; } }
      @keyframes mines-bust-cascade { 0% { transform: scale(0.6); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
      @keyframes mines-mult-pulse { 0%,100% { transform: scale(1); color: #E8B84B; } 50% { transform: scale(1.08); text-shadow: 0 0 12px #E8B84B88; } }
      @keyframes mines-screen-shake { 0%,100% { transform: translateX(0) translateY(0); } 10% { transform: translateX(-6px) translateY(-3px); } 30% { transform: translateX(6px) translateY(3px); } 50% { transform: translateX(-4px) translateY(2px); } 70% { transform: translateX(4px) translateY(-2px); } 90% { transform: translateX(-2px) translateY(1px); } }
      @keyframes mines-safe-glow { 0%,100% { box-shadow: inset 0 0 8px rgba(63,207,106,0.15); } 50% { box-shadow: inset 0 0 18px rgba(63,207,106,0.35), 0 0 10px rgba(63,207,106,0.2); } }
    `;
    document.head.appendChild(el);
  }, []);
}

const MINE_COUNT_OPTIONS = [1, 3, 5, 10, 15, 20, 24];

type MinesPhase = "idle" | "starting" | "playing" | "settling" | "done";

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
function fmtMult(bps: number): string { return (bps / 10000).toFixed(2) + "x"; }

export function MinesPanel() {
  const dAppKit  = useDAppKit();
  const { account } = useVerifiedAccountContext();
  const addr = account?.address ?? "";
  const signer = () => new CurrentAccountSigner(dAppKit);

  // ── Config state (idle) ────────────────────────────────────────────────────
  const [mineCount, setMineCount] = useState(3);
  const [betEve, setBetEve] = useState("10");

  // ── Active game state ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState<MinesPhase>("idle");
  const [gameId, setGameId] = useState<string | null>(null);
  const [wager, setWager] = useState(0);
  const [currentMines, setCurrentMines] = useState(3);
  const [revealedSafe, setRevealedSafe] = useState<Set<number>>(new Set());
  const [safeCount, setSafeCount] = useState(0);
  const [multiplierBps, setMultiplierBps] = useState(10000);
  const [multAnimating, setMultAnimating] = useState(false);
  const [pendingTile, setPendingTile] = useState<number | null>(null);

  // ── End-of-game state ──────────────────────────────────────────────────────
  const [mineMap, setMineMap] = useState<number | null>(null); // 25-bit bitmask
  const [busted, setBusted] = useState(false);
  const [payout, setPayout] = useState(0);
  const [finalWager, setFinalWager] = useState(0);

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
  const bank = houseQ.data?.bankBalance ?? 0;

  // ── Exposure guard mirror (house contract: full-clear payout ≤ 3% of bank;
  //    clear-all multiplier capped at 1000x — mines::start aborts code 6 past it) ──
  const clearAllBps = Math.min(computeMinesMultiplierBps(mineCount, 25 - mineCount), 10_000_000);
  const clearAllMult = clearAllBps / 10000;
  const exposureBudget = bank * 0.03;
  const maxBetForExposure = clearAllMult > 0 ? exposureBudget / clearAllMult : Infinity;
  const betNum = Number(betEve) || 0;
  const overExposure = bank > 0 && betNum > maxBetForExposure;

  // ── Resume active game on mount / addr change ──────────────────────────────
  useEffect(() => {
    if (!addr || phase !== "idle") return;
    let cancelled = false;
    setResumeLoading(true);
    fetchActiveMinesGame(addr).then((g) => {
      if (cancelled || !g) return;
      // Restore game state from on-chain object
      setGameId(g.gameId);
      setWager(g.wager);
      setCurrentMines(g.mines);
      setSafeCount(g.safeRevealed);
      setMultiplierBps(g.multiplierBps);
      // Decode revealedMap bitmask → Set<number>
      const safe = new Set<number>();
      for (let i = 0; i < 25; i++) { if ((g.revealedMap >> i) & 1) safe.add(i); }
      setRevealedSafe(safe);
      setPhase("playing");
    }).finally(() => {
      if (!cancelled) setResumeLoading(false);
    });
    return () => { cancelled = true; };
  }, [addr]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived tile state ─────────────────────────────────────────────────────
  function getTileState(tile: number): "unrevealed" | "pending" | "safe" | "mine" {
    if (pendingTile === tile) return "pending";
    if (revealedSafe.has(tile)) return "safe";
    if (mineMap !== null && ((mineMap >> tile) & 1)) return "mine";
    return "unrevealed";
  }

  // ── Next-reveal multiplier preview ────────────────────────────────────────
  const nextMultBps = computeMinesMultiplierBps(currentMines, safeCount + 1);

  // ── Reset helper ──────────────────────────────────────────────────────────
  function resetGame() {
    setPhase("idle"); setGameId(null); setWager(0); setCurrentMines(mineCount);
    setRevealedSafe(new Set()); setSafeCount(0); setMultiplierBps(10000);
    setPendingTile(null); setMineMap(null); setBusted(false); setPayout(0);
    setFinalWager(0); setErr(null);
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  const startGame = useCallback(async () => {
    if (!addr) { setErr("Connect a wallet."); return; }
    const wagerNum = Number(betEve);
    if (!(wagerNum > 0)) { setErr("Enter a positive bet."); return; }
    // Pre-check the house exposure guard so the wallet never signs a doomed tx.
    const bankNow = houseQ.data?.bankBalance ?? 0;
    const capBps = Math.min(computeMinesMultiplierBps(mineCount, 25 - mineCount), 10_000_000);
    const maxBet = bankNow > 0 ? (bankNow * 0.03) / (capBps / 10000) : Infinity;
    if (wagerNum > maxBet) {
      setErr(`BET BLOCKED — payout risk cap. Clearing all ${25 - mineCount} safe tiles at ${mineCount} mines pays up to ${(capBps / 10000).toFixed(0)}x, and the house only risks ${fmtEve(bankNow * 0.03)} EVE (3% of its ${fmtEve(bankNow)} EVE bank) on a single game. Bet ${fmtEve(Math.floor(maxBet * 1000) / 1000)} EVE or less, or pick fewer mines.`);
      return;
    }
    setBusy(true); setErr(null);
    // Clear previous game state before starting
    setRevealedSafe(new Set()); setSafeCount(0); setMultiplierBps(10000);
    setMineMap(null); setBusted(false); setPayout(0); setGameId(null);
    setPhase("starting");
    try {
      const raw = BigInt(Math.floor(wagerNum * 1e9));
      const buildTx = async () => {
        const { ids } = await fetchEveCoins(addr);
        if (!ids.length) throw new Error("No $EVE in wallet.");
        return withGas(buildMinesStartTx(ids, raw, mineCount), addr);
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
      const started = await resolveMinesStartByDigest(digest);
      if (!started) throw new Error("Could not read game start — check the feed.");
      setGameId(started.gameId);
      setWager(wagerNum);
      setCurrentMines(mineCount);
      setFinalWager(wagerNum);
      setPhase("playing");
      balQ.refetch();
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "");
      if (/MoveAbort/.test(msg) && /mines::start/.test(msg) && /code:?\s*6\b/.test(msg)) {
        const bankNow2 = houseQ.data?.bankBalance ?? 0;
        setErr(`BET BLOCKED — payout risk cap. Your ${fmtEve(wagerNum)} EVE bet at ${mineCount} mines could win up to ${(Math.min(computeMinesMultiplierBps(mineCount, 25 - mineCount), 10_000_000) / 10000).toFixed(0)}x, more than the house risks per game (3% of its ${fmtEve(bankNow2)} EVE bank). Lower the bet or pick fewer mines.`);
      } else {
        setErr(translateTxError(e));
      }
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  }, [addr, betEve, mineCount, dAppKit, houseQ.data]);

  // ── Reveal tile ───────────────────────────────────────────────────────────
  const revealTile = useCallback(async (tile: number) => {
    if (!gameId || busy || phase !== "playing") return;
    setBusy(true); setErr(null); setPendingTile(tile);
    try {
      const tx = await withGas(buildMinesRevealTx(gameId, tile), addr);
      let res: any;
      try {
        res = await signer().signAndExecuteTransaction({ transaction: tx });
      } catch (e: any) {
        if (/not found|notexists|deleted|invalid.*object|InsufficientGas|GasBalanceTooLow/i.test(String(e?.message ?? e))) {
          await new Promise((r) => setTimeout(r, 1500));
          const tx2 = await withGas(buildMinesRevealTx(gameId, tile), addr);
          res = await signer().signAndExecuteTransaction({ transaction: tx2 });
        } else { throw e; }
      }
      const digest = txDigestOf(res);
      if (!digest) throw new Error("No tx digest returned.");
      const outcome = await resolveTileRevealOrBustByDigest(digest);
      if (!outcome) throw new Error("Could not read reveal result — check the feed.");
      if (outcome.kind === "safe") {
        setRevealedSafe((prev) => new Set([...prev, tile]));
        setSafeCount(outcome.safeRevealed);
        setMultiplierBps(outcome.multiplierBps);
        setMultAnimating(true);
        setTimeout(() => setMultAnimating(false), 600);
      } else {
        // Bust — mine hit; game object consumed
        setMineMap(outcome.settle.mineMap);
        setBusted(true);
        setPayout(0);
        setFinalWager(outcome.settle.wager);
        setMultiplierBps(outcome.settle.multiplierBps);
        setSafeCount(outcome.settle.safeRevealed);
        setPhase("done");
      }
      balQ.refetch();
    } catch (e: any) {
      setErr(translateTxError(e));
    } finally {
      setBusy(false);
      setPendingTile(null);
    }
  }, [gameId, busy, phase, addr, dAppKit]);

  // ── Cashout ───────────────────────────────────────────────────────────────
  const cashout = useCallback(async () => {
    if (!gameId || busy || phase !== "playing") return;
    setBusy(true); setErr(null); setPhase("settling");
    try {
      const tx = await withGas(buildMinesCashoutTx(gameId), addr);
      const res: any = await signer().signAndExecuteTransaction({ transaction: tx });
      const digest = txDigestOf(res);
      if (!digest) throw new Error("No tx digest returned.");
      const settle = await resolveMinesSettleByDigest(digest);
      if (!settle) throw new Error("Could not read cashout result — check the feed.");
      setMineMap(settle.mineMap);
      setBusted(false);
      setPayout(settle.payout);
      setFinalWager(settle.wager);
      setMultiplierBps(settle.multiplierBps);
      setSafeCount(settle.safeRevealed);
      setPhase("done");
      balQ.refetch();
    } catch (e: any) {
      setErr(translateTxError(e));
      setPhase("playing");
    } finally {
      setBusy(false);
    }
  }, [gameId, busy, phase, addr, dAppKit]);

  // ── Tile render ───────────────────────────────────────────────────────────
  function TileButton({ idx }: { idx: number }) {
    useMinesKeyframes();
    const state = getTileState(idx);
    const clickable = phase === "playing" && state === "unrevealed" && !busy;
    const bg =
      state === "safe"    ? "#0a2015" :
      state === "mine"    ? "#2a0808" :
      state === "pending" ? "#1a1500" :
      "#141414";
    const borderColor =
      state === "safe"    ? GREEN + "99" :
      state === "mine"    ? ACCENT + "99" :
      state === "pending" ? GOLD + "88" :
      clickable           ? "#333" : "#222";
    const glyph =
      state === "safe"    ? "\u25C9" :
      state === "mine"    ? "\u26E8" :
      state === "pending" ? "\u25C7" :
      "\u25A3";
    const color =
      state === "safe"    ? GREEN :
      state === "mine"    ? ACCENT :
      state === "pending" ? GOLD :
      clickable           ? "#666" : "#3a3a3a";
    // Bust cascade: mines stagger in by position
    const isBustMine = state === "mine" && isDone && busted;
    const isRevealedSafe = state === "safe";
    const cascadeDelay = `${(idx % 5) * 60 + Math.floor(idx / 5) * 40}ms`;
    const animStyle = isBustMine
      ? `mines-bust-cascade 0.35s ease ${cascadeDelay} both`
      : isRevealedSafe
      ? "mines-tile-safe 0.35s ease both"
      : undefined;
    return (
      <button
        key={idx}
        disabled={!clickable}
        onClick={() => revealTile(idx)}
        style={{
          height: 54,
          background: bg,
          border: `1px solid ${borderColor}`,
          color,
          fontSize: 22,
          fontWeight: 700,
          cursor: clickable ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.15s, border-color 0.15s",
          boxShadow: state === "safe"
            ? `inset 0 0 8px ${GREEN}22`
            : state === "mine"
            ? `inset 0 0 12px ${ACCENT}44`
            : "none",
          animation: animStyle,
        }}
      >
        {glyph}
      </button>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (resumeLoading) {
    return <div style={{ color: "#888", padding: 24, textAlign: "center" }}>◇ checking for active game…</div>;
  }

  const safeLeft = 25 - currentMines - safeCount;
  const isDone = phase === "done";
  const net = isDone ? (busted ? -finalWager : payout - finalWager) : 0;

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {/* Main panel */}
      <div style={{ flex: "1 1 440px", minWidth: 340 }}>
        {/* Header */}
        <div style={{ background: "radial-gradient(ellipse at 50% 10%, #1a0a20 0%, #0c0c14 55%, #060608 100%)", border: `2px solid ${ACCENT}44`, borderRadius: 12, padding: "18px 20px", boxShadow: "inset 0 0 60px rgba(0,0,0,0.7)" }}>
          <div style={{ color: ACCENT, fontSize: 16, fontWeight: 800, letterSpacing: "0.1em" }}>
            ⛨ MINES
          </div>
          <div style={{ color: "#9a9a8a", fontSize: 11, marginTop: 2 }}>
            Avoid the mines. Cash out before they find you. Each safe reveal multiplies your bet.
          </div>

          {/* Multiplier / status bar */}
          {(phase === "playing" || phase === "settling" || phase === "done") && (
            <div style={{ marginTop: 14, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.06em" }}>CURRENT</div>
                <div key={multiplierBps} style={{ color: GOLD, fontSize: 24, fontWeight: 900, animation: multAnimating ? "mines-mult-pulse 0.5s ease" : undefined }}>{fmtMult(multiplierBps)}</div>
              </div>
              {!isDone && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.06em" }}>NEXT</div>
                  <div style={{ color: "#888", fontSize: 18, fontWeight: 700 }}>{fmtMult(nextMultBps)}</div>
                </div>
              )}
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.06em" }}>SAFE LEFT</div>
                <div style={{ color: GREEN, fontSize: 18, fontWeight: 700 }}>{isDone ? "—" : safeLeft}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.06em" }}>MINES</div>
                <div style={{ color: ACCENT, fontSize: 18, fontWeight: 700 }}>{currentMines}</div>
              </div>
              {wager > 0 && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.06em" }}>WAGER</div>
                  <div style={{ color: "#888", fontSize: 14 }}>{fmtEve(wager)} EVE</div>
                </div>
              )}
            </div>
          )}

          {/* Done result badge */}
          {isDone && (
            <div style={{ marginTop: 14, textAlign: "center", padding: "10px 0 4px" }}>
              <div style={{ color: busted ? ACCENT : GREEN, fontSize: 28, fontWeight: 900, letterSpacing: "0.08em" }}>
                {busted ? "⛨ BUSTED" : "◉ CASHED OUT"}
              </div>
              <div style={{ color: net > 0 ? GREEN : ACCENT, fontSize: 16, marginTop: 4, fontWeight: 800 }}>
                {net > 0 ? `+${fmtEve(net)}` : `${fmtEve(net)}`} EVE
              </div>
              {!busted && payout > 0 && (
                <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>
                  gross payout {fmtEve(payout)} EVE · {fmtMult(multiplierBps)} multiplier
                </div>
              )}
              {busted && (
                <div style={{ color: "#666", fontSize: 11, marginTop: 2 }}>
                  {safeCount > 0 ? `${safeCount} safe tiles revealed before the mine` : "first tile was a mine"}
                </div>
              )}
            </div>
          )}

          {/* Settling indicator */}
          {phase === "settling" && (
            <div style={{ color: GOLD, fontSize: 12, textAlign: "center", marginTop: 12, letterSpacing: "0.1em" }}>
              ◇ settling cashout on-chain…
            </div>
          )}
          {phase === "starting" && (
            <div style={{ color: GOLD, fontSize: 12, textAlign: "center", marginTop: 12, letterSpacing: "0.1em" }}>
              ◇ starting game on-chain…
            </div>
          )}
        </div>

        {/* 5×5 tile grid */}
        {(phase === "playing" || phase === "settling" || phase === "done") && (
          <div style={{ marginTop: 12, background: "#0d0d0d", border: `1px solid ${ACCENT}22`, padding: 14, borderRadius: 8, animation: isDone && busted ? "mines-screen-shake 0.45s ease" : undefined }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>
              {Array.from({ length: 25 }, (_, i) => <TileButton key={i} idx={i} />)}
            </div>
            {phase === "playing" && busy && pendingTile !== null && (
              <div style={{ color: GOLD, fontSize: 11, textAlign: "center", marginTop: 8, letterSpacing: "0.1em" }}>
                ◇ revealing tile {pendingTile + 1}…
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div style={{ marginTop: 14, background: "#111", border: `1px solid ${ACCENT}22`, padding: 18 }}>
          {phase === "idle" || phase === "starting" ? (
            <>
              {/* Mine count selector */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 6 }}>
                  MINES (out of 25 tiles)
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {MINE_COUNT_OPTIONS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMineCount(m)}
                      style={{
                        flex: "1 1 40px",
                        background: mineCount === m ? "#1a0808" : "#161616",
                        border: `1px solid ${mineCount === m ? ACCENT : "#333"}`,
                        color: mineCount === m ? ACCENT : "#888",
                        fontSize: 13, fontWeight: 800,
                        padding: "9px 4px", cursor: "pointer",
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div style={{ color: "#666", fontSize: 10, marginTop: 4 }}>
                  {25 - mineCount} safe tiles · next reveal at {fmtMult(computeMinesMultiplierBps(mineCount, 1))}
                  {bank > 0 && Number.isFinite(maxBetForExposure) && (
                    <> · max bet <span style={{ color: overExposure ? GOLD : "#888" }}>{fmtEve(Math.floor(maxBetForExposure * 1000) / 1000)} EVE</span> (house risk cap)</>
                  )}
                </div>
              </div>

              {/* Bet */}
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
                  {betPresets({ bank, grossMult: clearAllMult, maxBet: houseQ.data?.maxBet, minBet: houseQ.data?.minBet, walletEve: myEve }).map((v, i, arr) => (
                    <button key={v} onClick={() => setBetEve(String(v))} style={{ background: "#1a1a1a", border: `1px solid ${i === arr.length - 1 ? GOLD : ACCENT}44`, color: i === arr.length - 1 ? GOLD : ACCENT, fontSize: 12, padding: "8px 12px", cursor: "pointer" }}>
                      {i === arr.length - 1 ? `MAX ${fmtEve(v)}` : fmtEve(v)}
                    </button>
                  ))}
                </div>
              </label>

              <button
                disabled={busy || !addr || phase === "starting" || overExposure}
                onClick={startGame}
                style={{ marginTop: 14, width: "100%", background: `linear-gradient(180deg, ${ACCENT}, #b83400)`, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "0.1em", padding: "13px", cursor: busy || !addr || overExposure ? "default" : "pointer", opacity: busy || !addr || overExposure ? 0.5 : 1 }}
              >
                {busy ? "SIGNING…" : "▲ START GAME"}
              </button>
              {overExposure && (
                <div style={{ color: GOLD, fontSize: 12, marginTop: 8, lineHeight: 1.6, background: "#1a1408", border: `1px solid ${GOLD}44`, padding: "10px 12px" }}>
                  PAYOUT RISK CAP — clearing all {25 - mineCount} safe tiles at {mineCount} mines pays up to {clearAllMult.toFixed(0)}x,
                  and the house risks at most {fmtEve(exposureBudget)} EVE (3% of its {fmtEve(bank)} EVE bank) per game.
                  Bet {fmtEve(Math.floor(maxBetForExposure * 1000) / 1000)} EVE or less, or pick fewer mines.
                </div>
              )}
            </>
          ) : phase === "playing" ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                disabled={busy || safeCount === 0}
                onClick={cashout}
                style={{ flex: 1, minWidth: 140, background: safeCount > 0 && !busy ? "#0a2015" : "#141414", border: `2px solid ${safeCount > 0 ? GREEN : "#333"}`, color: safeCount > 0 ? GREEN : "#666", fontSize: 15, fontWeight: 800, letterSpacing: "0.08em", padding: "13px", cursor: safeCount > 0 && !busy ? "pointer" : "default" }}
              >
                {busy && pendingTile === null ? "◇ SETTLING…" : `◉ CASH OUT ${safeCount > 0 ? fmtMult(multiplierBps) : ""}`}
              </button>
              <div style={{ color: "#666", fontSize: 11, textAlign: "center", flex: "0 0 auto" }}>
                {busy && pendingTile !== null ? "◇ revealing…" : "click a tile to reveal"}
              </div>
            </div>
          ) : phase === "settling" ? (
            <div style={{ color: GOLD, fontSize: 13, textAlign: "center", padding: 8, letterSpacing: "0.1em" }}>
              ◇ settling…
            </div>
          ) : (
            /* done */
            <button
              onClick={resetGame}
              style={{ width: "100%", background: `linear-gradient(180deg, ${ACCENT}, #b83400)`, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "0.1em", padding: "13px", cursor: "pointer" }}
            >
              ◈ NEW GAME
            </button>
          )}

          {err && <div style={{ color: ACCENT, fontSize: 12, marginTop: 10 }}>{err}</div>}
          <div style={{ color: "#666", fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>
            multi-tx settle · 25 tiles · pick mine count · 97% return · mine map revealed on bust
          </div>
        </div>
      </div>

      {/* Info panel */}
      <div style={{ flex: "0 0 260px", minWidth: 220 }}>
        <div style={{ color: "#888", fontSize: 11, letterSpacing: "0.08em", marginBottom: 8 }}>◇ MINES PAYOUT TABLE</div>
        <div style={{ background: "#111", border: "1px solid #222", padding: "12px 14px" }}>
          <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.06em", marginBottom: 8 }}>
            REVEALS NEEDED FOR KEY MULTIPLIERS
          </div>
          {[1, 3, 5, 10, 15, 20, 24].map((m) => {
            const rows = [];
            for (const k of [1, 2, 3, 5, 10]) {
              const safe = 25 - m;
              if (k > safe) continue;
              rows.push({ k, bps: computeMinesMultiplierBps(m, k) });
            }
            return (
              <div key={m} style={{ marginBottom: 10 }}>
                <div style={{ color: ACCENT, fontSize: 11, fontWeight: 800, marginBottom: 3 }}>{m} mines</div>
                {rows.map(({ k, bps }) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", color: "#888", fontSize: 11, marginBottom: 1 }}>
                    <span>{k} reveal{k > 1 ? "s" : ""}</span>
                    <span style={{ color: bps >= 20000 ? GOLD : "#aaa", fontWeight: bps >= 20000 ? 800 : 400 }}>{fmtMult(bps)}</span>
                  </div>
                ))}
              </div>
            );
          })}
          <div style={{ color: "#555", fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>
            Higher mine count = higher multiplier per reveal. Cash out any time to lock in your winnings.
          </div>
        </div>
      </div>
    </div>
  );
}
