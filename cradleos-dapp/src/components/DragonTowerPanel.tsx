/**
 * DragonTowerPanel — interactive multi-tx Dragon Tower game on CradleOS Casino.
 *
 * 9-row tower. Each row has N tiles (EASY=4, MEDIUM=3, HARD=2).
 * One tile per row hides a dragon; pick the safe tiles to climb.
 * Cash out any time to lock in your winnings.
 *
 * UI: rows stacked bottom-to-top, current row highlighted.
 * Tile glyphs (monospace-safe, webview-compatible):
 *   ▣  unrevealed   ◉  safe   ◆  dragon   ◇  pending
 */
import { useState, useCallback, useEffect } from "react";
import { TableVideoBackdrop } from "./TableVideoBackdrop";
import { useQuery } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { translateTxError } from "../lib/txError";
import { findLatestCharacterForWallet } from "../lib";
import { fetchEveCoins, fetchHouseState, withGas, betPresets } from "../lib/casino";
import { CASINO_HOUSE } from "../constants";
import {
  buildTowerStartTx, buildTowerPickTx, buildTowerCashoutTx,
  fetchActiveTowerGame, resolveTowerStartByDigest,
  resolveTowerPickByDigest, resolveTowerCashoutByDigest,
  computeTowerMultBps,
  TOWER_ROWS, TOWER_TILES, TOWER_DIFFICULTY_LABEL,
} from "../lib/casinoDragonTower";

const ACCENT = "#FF4700";
const GOLD   = "#E8B84B";
const GREEN  = "#3FCF6A";

// ── one-time keyframe injection (DragonTower-specific) ───────────────────────
let towerKeyframesInjected = false;
function useTowerKeyframes() {
  useEffect(() => {
    if (towerKeyframesInjected) return;
    towerKeyframesInjected = true;
    const el = document.createElement("style");
    el.textContent = `
      @keyframes tower-tile-safe { 0% { transform: scale(0.7) rotateY(90deg); opacity: 0; } 60% { transform: scale(1.18) rotateY(0deg); } 100% { transform: scale(1) rotateY(0deg); opacity: 1; } }
      @keyframes tower-tile-dragon { 0% { transform: scale(0.6); opacity: 0; } 40% { transform: scale(1.35) rotate(-5deg); } 70% { transform: scale(1.1) rotate(3deg); } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
      @keyframes tower-row-ascend { 0% { transform: translateY(12px); opacity: 0.2; } 100% { transform: translateY(0); opacity: 1; } }
      @keyframes tower-mult-up { 0% { transform: translateY(6px) scale(0.9); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
      @keyframes tower-current-row-glow { 0%,100% { box-shadow: inset 2px 0 0 #FF470088; } 50% { box-shadow: inset 2px 0 0 #FF4700, 0 0 10px #FF470033; } }
      @keyframes tower-screen-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-7px) rotate(-1deg); } 40% { transform: translateX(7px) rotate(1deg); } 60% { transform: translateX(-5px); } 80% { transform: translateX(4px); } }
      @keyframes tower-bust-dragon { 0% { transform: scale(0.5) rotate(-10deg); opacity: 0; } 50% { transform: scale(1.3) rotate(5deg); } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
    `;
    document.head.appendChild(el);
  }, []);
}

type TowerPhase = "idle" | "starting" | "playing" | "settling" | "done";

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

export function DragonTowerPanel() {
  const dAppKit = useDAppKit();
  const { account } = useVerifiedAccountContext();
  const addr = account?.address ?? "";
  const signer = () => new CurrentAccountSigner(dAppKit);
  useTowerKeyframes();

  // ── Config state (idle) ────────────────────────────────────────────────────
  const [difficulty, setDifficulty] = useState(0);
  const [betEve, setBetEve] = useState("10");

  // ── Active game state ──────────────────────────────────────────────────────
  const [phase, setPhase] = useState<TowerPhase>("idle");
  const [gameId, setGameId] = useState<string | null>(null);
  const [wager, setWager] = useState(0);
  const [gameDifficulty, setGameDifficulty] = useState(0);
  const [rowsClimbed, setRowsClimbed] = useState(0);
  const [multiplierBps, setMultiplierBps] = useState(10000);
  const [multAnimating, setMultAnimating] = useState(false);
  const [picks, setPicks] = useState<number[]>([]);  // cell picked per row
  const [pendingCell, setPendingCell] = useState<number | null>(null);

  // ── End-of-game state ──────────────────────────────────────────────────────
  const [dragonPos, setDragonPos] = useState<number[]>([]);
  const [busted, setBusted] = useState(false);
  const [payout, setPayout] = useState(0);
  const [finalWager, setFinalWager] = useState(0);
  const [finalMult, setFinalMult] = useState(10000);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);

  const tiles = TOWER_TILES[gameDifficulty] ?? 4;

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
  // Exposure mirror: full-climb multiplier at the chosen difficulty (contract guard).
  const towerTopMult = computeTowerMultBps(difficulty, TOWER_ROWS) / 10000;

  // ── Resume active game on mount / addr change ──────────────────────────────
  useEffect(() => {
    if (!addr || phase !== "idle") return;
    let cancelled = false;
    setResumeLoading(true);
    fetchActiveTowerGame(addr).then((g) => {
      if (cancelled || !g) return;
      setGameId(g.gameId);
      setWager(g.wager);
      setGameDifficulty(g.difficulty);
      setRowsClimbed(g.rowsClimbed);
      setMultiplierBps(g.multiplierBps);
      setPicks(g.picks);
      setPhase("playing");
    }).finally(() => {
      if (!cancelled) setResumeLoading(false);
    });
    return () => { cancelled = true; };
  }, [addr]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset helper ──────────────────────────────────────────────────────────
  function resetGame() {
    setPhase("idle"); setGameId(null); setWager(0); setGameDifficulty(difficulty);
    setRowsClimbed(0); setMultiplierBps(10000); setPicks([]);
    setPendingCell(null); setDragonPos([]); setBusted(false); setPayout(0);
    setFinalWager(0); setFinalMult(10000); setErr(null);
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  const startGame = useCallback(async () => {
    if (!addr) { setErr("Connect a wallet."); return; }
    const wagerNum = Number(betEve);
    if (!(wagerNum > 0)) { setErr("Enter a positive bet."); return; }
    setBusy(true); setErr(null);
    setRowsClimbed(0); setMultiplierBps(10000); setPicks([]);
    setDragonPos([]); setBusted(false); setPayout(0); setGameId(null);
    setPhase("starting");
    try {
      const raw = BigInt(Math.floor(wagerNum * 1e9));
      const buildTx = async () => {
        const charInfo = await findLatestCharacterForWallet(addr);
        if (!charInfo?.characterId) throw new Error("No live Character found for this wallet. Create or select a Character in EVE Frontier, then try again.");
        const { ids } = await fetchEveCoins(addr);
        if (!ids.length) throw new Error("No $EVE in wallet.");
        return withGas(buildTowerStartTx(ids, raw, charInfo.characterId, difficulty), addr);
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
      const started = await resolveTowerStartByDigest(digest);
      if (!started) throw new Error("Could not read game start — check the feed.");
      setGameId(started.gameId);
      setWager(wagerNum);
      setGameDifficulty(started.difficulty);
      setFinalWager(wagerNum);
      setPhase("playing");
      balQ.refetch();
    } catch (e: any) {
      setErr(translateTxError(e));
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  }, [addr, betEve, difficulty, dAppKit]);

  // ── Pick cell ─────────────────────────────────────────────────────────────
  const pickCell = useCallback(async (cell: number) => {
    if (!gameId || busy || phase !== "playing") return;
    setBusy(true); setErr(null); setPendingCell(cell);
    try {
      const tx = await withGas(await buildTowerPickTx(gameId, cell), addr);
      let res: any;
      try {
        res = await signer().signAndExecuteTransaction({ transaction: tx });
      } catch (e: any) {
        if (/not found|notexists|deleted|invalid.*object|version.*match|not available for consumption|InsufficientGas|GasBalanceTooLow/i.test(String(e?.message ?? e))) {
          await new Promise((r) => setTimeout(r, 1500));
          const tx2 = await withGas(await buildTowerPickTx(gameId, cell), addr);
          res = await signer().signAndExecuteTransaction({ transaction: tx2 });
        } else { throw e; }
      }
      const digest = txDigestOf(res);
      if (!digest) throw new Error("No tx digest returned.");
      const outcome = await resolveTowerPickByDigest(digest);
      if (!outcome) throw new Error("Could not read pick result — check the feed.");
      if (outcome.kind === "climbed") {
        const r = outcome.row;
        setPicks((prev) => { const next = [...prev]; next[r.row] = r.cell; return next; });
        setRowsClimbed(r.rowsClimbed);
        setMultiplierBps(r.multiplierBps);
        setMultAnimating(true);
        setTimeout(() => setMultAnimating(false), 500);
      } else {
        // Game settled on this pick. Two cases:
        //   busted=true  → dragon hit (loss, payout 0)
        //   busted=false → final (top) row cleared → contract auto-settles a WIN
        //                   (settle_win in dragon_tower.move emits TowerSettled
        //                    busted:false, payout>0 alongside RowClimbed). Do NOT
        //                    hardcode a loss here — honor the on-chain event.
        const s = outcome.settle;
        setDragonPos(s.dragonPos);
        setBusted(s.busted);
        setPayout(s.busted ? 0 : s.payout);
        setFinalWager(s.wager);
        setFinalMult(s.multiplierBps);
        setRowsClimbed(s.rowsClimbed);
        setMultiplierBps(s.multiplierBps);
        setPhase("done");
      }
      balQ.refetch();
    } catch (e: any) {
      setErr(translateTxError(e));
    } finally {
      setBusy(false);
      setPendingCell(null);
    }
  }, [gameId, busy, phase, addr, dAppKit]);

  // ── Cashout ───────────────────────────────────────────────────────────────
  const cashout = useCallback(async () => {
    if (!gameId || busy || phase !== "playing") return;
    setBusy(true); setErr(null); setPhase("settling");
    try {
      const tx = await withGas(await buildTowerCashoutTx(gameId), addr);
      const res: any = await signer().signAndExecuteTransaction({ transaction: tx });
      const digest = txDigestOf(res);
      if (!digest) throw new Error("No tx digest returned.");
      const settle = await resolveTowerCashoutByDigest(digest);
      if (!settle) throw new Error("Could not read cashout result — check the feed.");
      setDragonPos(settle.dragonPos);
      setBusted(false);
      setPayout(settle.payout);
      setFinalWager(settle.wager);
      setFinalMult(settle.multiplierBps);
      setRowsClimbed(settle.rowsClimbed);
      setMultiplierBps(settle.multiplierBps);
      setPhase("done");
      balQ.refetch();
    } catch (e: any) {
      setErr(translateTxError(e));
      setPhase("playing");
    } finally {
      setBusy(false);
    }
  }, [gameId, busy, phase, addr, dAppKit]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (resumeLoading) {
    return <div style={{ color: "#888", padding: 24, textAlign: "center" }}>◇ checking for active game…</div>;
  }

  const isDone = phase === "done";
  const net = isDone ? (busted ? -finalWager : payout - finalWager) : 0;
  // current row = rows climbed (0-indexed, 0 = bottom row)
  const currentRow = rowsClimbed;
  // next multiplier preview
  const nextMultBps = computeTowerMultBps(gameDifficulty, rowsClimbed + 1);

  // Build rows from bottom (row 0) to top (row 8)
  const rowIndices = Array.from({ length: TOWER_ROWS }, (_, i) => TOWER_ROWS - 1 - i); // top-to-bottom rendering

  function getTileState(row: number, cell: number): "unrevealed" | "pending" | "safe" | "dragon" {
    if (pendingCell === cell && row === currentRow && phase === "playing") return "pending";
    if (picks[row] === cell) return "safe"; // we picked this cell and it was safe
    if (isDone && dragonPos[row] === cell) return "dragon";
    return "unrevealed";
  }

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {/* Main panel */}
      <div style={{ flex: "1 1 440px", minWidth: 340 }}>
        {/* Header */}
        <div style={{ background: "radial-gradient(ellipse at 50% 10%, #1a0a02 0%, #0c0c0c 55%, #060606 100%)", border: `2px solid ${ACCENT}44`, borderRadius: 12, padding: "18px 20px", boxShadow: "inset 0 0 60px rgba(0,0,0,0.7)", position: "relative", isolation: "isolate", overflow: "hidden" }}>
          <TableVideoBackdrop tint="radial-gradient(ellipse at 50% 10%, rgba(26,10,2,0.32) 0%, rgba(12,12,12,0.48) 55%, rgba(6,6,6,0.70) 100%)" />
          <div style={{ color: ACCENT, fontSize: 16, fontWeight: 800, letterSpacing: "0.1em" }}>◆ DRAGON TOWER</div>
          <div style={{ color: "#9a9a8a", fontSize: 11, marginTop: 2 }}>
            Climb 9 rows avoiding the dragon. Each row you clear multiplies your bet. Cash out anytime.
          </div>

          {/* Multiplier / status bar */}
          {(phase === "playing" || phase === "settling" || phase === "done") && (
            <div style={{ marginTop: 14, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.06em" }}>CURRENT</div>
                <div key={multiplierBps} style={{ color: GOLD, fontSize: 24, fontWeight: 900, animation: multAnimating ? "tower-mult-up 0.4s ease" : undefined }}>{fmtMult(multiplierBps)}</div>
              </div>
              {!isDone && rowsClimbed > 0 && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.06em" }}>NEXT</div>
                  <div style={{ color: "#888", fontSize: 18, fontWeight: 700 }}>{fmtMult(nextMultBps)}</div>
                </div>
              )}
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.06em" }}>ROW</div>
                <div style={{ color: GREEN, fontSize: 18, fontWeight: 700 }}>{rowsClimbed} / {TOWER_ROWS}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.06em" }}>DIFFICULTY</div>
                <div style={{ color: "#888", fontSize: 12, fontWeight: 700 }}>{TOWER_DIFFICULTY_LABEL[gameDifficulty] ?? "?"}</div>
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
                {busted ? "◆ DRAGON FOUND YOU" : (rowsClimbed >= TOWER_ROWS ? "◉ TOWER CLEARED — DRAGON SLAIN" : "◉ CASHED OUT")}
              </div>
              <div style={{ color: net > 0 ? GREEN : ACCENT, fontSize: 16, marginTop: 4, fontWeight: 800 }}>
                {net > 0 ? `+${fmtEve(net)}` : `${fmtEve(net)}`} EVE
              </div>
              {!busted && payout > 0 && (
                <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>
                  gross payout {fmtEve(payout)} EVE · {fmtMult(finalMult)} multiplier
                </div>
              )}
              {busted && (
                <div style={{ color: "#666", fontSize: 11, marginTop: 2 }}>
                  {rowsClimbed > 0 ? `${rowsClimbed} row${rowsClimbed > 1 ? "s" : ""} climbed before the dragon` : "first row was the dragon"}
                </div>
              )}
            </div>
          )}

          {(phase === "settling" || phase === "starting") && (
            <div style={{ color: GOLD, fontSize: 12, textAlign: "center", marginTop: 12, letterSpacing: "0.1em" }}>
              ◇ {phase === "settling" ? "settling cashout on-chain…" : "starting game on-chain…"}
            </div>
          )}
        </div>

        {/* Tower grid — rows stacked bottom-to-top */}
        {(phase === "playing" || phase === "settling" || phase === "done") && (
          <div style={{ marginTop: 12, background: "#0d0d0d", border: `1px solid ${ACCENT}22`, padding: 14, borderRadius: 8, animation: isDone && busted ? "tower-screen-shake 0.5s ease" : undefined }}>
            {rowIndices.map((row) => {
              const isCurrentRow = row === currentRow && phase === "playing";
              const isFuture = row > currentRow;
              const isJustClimbed = !isFuture && row === currentRow - 1 && phase === "playing";
              return (
                <div
                  key={row}
                  style={{
                    display: "flex", gap: 5, marginBottom: 5,
                    opacity: isFuture ? 0.4 : 1,
                    padding: "4px 0",
                    background: isCurrentRow ? `${ACCENT}11` : "transparent",
                    borderLeft: isCurrentRow ? `2px solid ${ACCENT}` : "2px solid transparent",
                    paddingLeft: isCurrentRow ? 10 : undefined,
                    transition: "background 0.2s, border-color 0.2s",
                    animation: isJustClimbed ? "tower-row-ascend 0.4s ease both" : undefined,
                  }}
                >
                  <div style={{ color: isCurrentRow ? ACCENT + "aa" : "#444", fontSize: 10, width: 20, textAlign: "right", alignSelf: "center", flexShrink: 0, marginRight: 4 }}>
                    {row + 1}
                  </div>
                  {Array.from({ length: tiles }, (_, cell) => {
                    const state = getTileState(row, cell);
                    const clickable = isCurrentRow && state === "unrevealed" && !busy;
                    const bg =
                      state === "safe"    ? "#0a2015" :
                      state === "dragon"  ? "#2a0808" :
                      state === "pending" ? "#1a1500" :
                      "#141414";
                    const borderColor =
                      state === "safe"    ? GREEN + "99" :
                      state === "dragon"  ? ACCENT + "99" :
                      state === "pending" ? GOLD + "88" :
                      clickable           ? "#555" : "#222";
                    const glyph =
                      state === "safe"    ? "\u25C9" :
                      state === "dragon"  ? "\u25C6" :
                      state === "pending" ? "\u25C7" :
                      "\u25A3";
                    const color =
                      state === "safe"    ? GREEN :
                      state === "dragon"  ? ACCENT :
                      state === "pending" ? GOLD :
                      clickable           ? "#888" : "#3a3a3a";
                    const tileAnim =
                      state === "safe"   ? "tower-tile-safe 0.4s ease both" :
                      state === "dragon" ? "tower-bust-dragon 0.4s ease both" :
                      undefined;
                    return (
                      <button
                        key={cell}
                        disabled={!clickable}
                        onClick={() => pickCell(cell)}
                        style={{
                          flex: 1, height: 44,
                          background: bg,
                          border: `1px solid ${borderColor}`,
                          color, fontSize: 18, fontWeight: 700,
                          cursor: clickable ? "pointer" : "default",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "background 0.15s, border-color 0.15s",
                          boxShadow: state === "safe" ? `inset 0 0 10px ${GREEN}22` : state === "dragon" ? `inset 0 0 14px ${ACCENT}44` : "none",
                          animation: tileAnim,
                        }}
                      >
                        {glyph}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            {phase === "playing" && busy && pendingCell !== null && (
              <div style={{ color: GOLD, fontSize: 11, textAlign: "center", marginTop: 8, letterSpacing: "0.1em" }}>
                ◇ checking row {currentRow + 1}…
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div style={{ marginTop: 14, background: "#111", border: `1px solid ${ACCENT}22`, padding: 18 }}>
          {phase === "idle" || phase === "starting" ? (
            <>
              {/* Difficulty selector */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 6 }}>DIFFICULTY</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[0, 1, 2].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      style={{
                        flex: "1 1 100px",
                        background: difficulty === d ? "#1a0808" : "#161616",
                        border: `1px solid ${difficulty === d ? ACCENT : "#333"}`,
                        color: difficulty === d ? ACCENT : "#888",
                        fontSize: 12, fontWeight: 800,
                        padding: "9px 4px", cursor: "pointer",
                      }}
                    >
                      {TOWER_DIFFICULTY_LABEL[d]}
                    </button>
                  ))}
                </div>
                <div style={{ color: "#666", fontSize: 10, marginTop: 4 }}>
                  {TOWER_ROWS} rows · max {fmtMult(computeTowerMultBps(difficulty, TOWER_ROWS))} at full clear
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
                  {betPresets({ bank: houseQ.data?.bankBalance, grossMult: towerTopMult, maxBet: houseQ.data?.maxBet, minBet: houseQ.data?.minBet, walletEve: myEve }).map((v, i, arr) => (
                    <button key={v} onClick={() => setBetEve(String(v))} style={{ background: "#1a1a1a", border: `1px solid ${i === arr.length - 1 ? GOLD : ACCENT}44`, color: i === arr.length - 1 ? GOLD : ACCENT, fontSize: 12, padding: "8px 12px", cursor: "pointer" }}>
                      {i === arr.length - 1 ? `MAX ${fmtEve(v)}` : fmtEve(v)}
                    </button>
                  ))}
                </div>
              </label>

              <button
                disabled={busy || !addr || phase === "starting"}
                onClick={startGame}
                style={{ marginTop: 14, width: "100%", background: `linear-gradient(180deg, ${ACCENT}, #b83400)`, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "0.1em", padding: "13px", cursor: busy || !addr ? "default" : "pointer", opacity: busy || !addr ? 0.5 : 1 }}
              >
                {busy ? "SIGNING…" : "▲ LAUNCH TOWER"}
              </button>
            </>
          ) : phase === "playing" ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button
                disabled={busy || rowsClimbed === 0}
                onClick={cashout}
                style={{
                  flex: 1, minWidth: 140,
                  background: rowsClimbed > 0 && !busy ? "#0a2015" : "#141414",
                  border: `2px solid ${rowsClimbed > 0 ? GREEN : "#333"}`,
                  color: rowsClimbed > 0 ? GREEN : "#666",
                  fontSize: 15, fontWeight: 800, letterSpacing: "0.08em", padding: "13px",
                  cursor: rowsClimbed > 0 && !busy ? "pointer" : "default",
                }}
              >
                {busy && pendingCell === null ? "◇ SETTLING…" : `◉ CASH OUT ${rowsClimbed > 0 ? fmtMult(multiplierBps) : ""}`}
              </button>
              <div style={{ color: "#666", fontSize: 11, textAlign: "center", flex: "0 0 auto" }}>
                {busy && pendingCell !== null ? "◇ picking…" : "click a tile in the highlighted row"}
              </div>
            </div>
          ) : phase === "settling" ? (
            <div style={{ color: GOLD, fontSize: 13, textAlign: "center", padding: 8, letterSpacing: "0.1em" }}>◇ settling…</div>
          ) : (
            <button
              onClick={resetGame}
              style={{ width: "100%", background: `linear-gradient(180deg, ${ACCENT}, #b83400)`, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "0.1em", padding: "13px", cursor: "pointer" }}
            >
              ◈ NEW GAME
            </button>
          )}

          {err && <div style={{ color: ACCENT, fontSize: 12, marginTop: 10 }}>{err}</div>}
          <div style={{ color: "#666", fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>
            multi-tx · 9 rows · 97% return · dragon position revealed on game end
          </div>
        </div>
      </div>

      {/* Info panel */}
      <div style={{ flex: "0 0 260px", minWidth: 220 }}>
        <div style={{ color: "#888", fontSize: 11, letterSpacing: "0.08em", marginBottom: 8 }}>◇ TOWER PAYOUT TABLE</div>
        <div style={{ background: "#111", border: "1px solid #222", padding: "12px 14px" }}>
          <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.06em", marginBottom: 8 }}>MULTIPLIER AT EACH ROW</div>
          {[0, 1, 2].map((d) => (
            <div key={d} style={{ marginBottom: 12 }}>
              <div style={{ color: ACCENT, fontSize: 11, fontWeight: 800, marginBottom: 4 }}>{TOWER_DIFFICULTY_LABEL[d]}</div>
              {[1, 3, 5, 7, 9].map((row) => (
                <div key={row} style={{ display: "flex", justifyContent: "space-between", color: "#888", fontSize: 11, marginBottom: 2 }}>
                  <span>row {row}</span>
                  <span style={{ color: computeTowerMultBps(d, row) >= 20000 ? GOLD : "#aaa", fontWeight: computeTowerMultBps(d, row) >= 20000 ? 800 : 400 }}>
                    {fmtMult(computeTowerMultBps(d, row))}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div style={{ color: "#555", fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>
            Higher difficulty = higher multiplier per row. Cash out any time to secure your winnings.
          </div>
        </div>
      </div>
    </div>
  );
}
