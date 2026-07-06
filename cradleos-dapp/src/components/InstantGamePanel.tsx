/**
 * InstantGamePanel — config-driven UI for the single-tx casino games:
 * coinflip, dice, roulette, slots, wheel. One bet → one signature → result.
 * Result resolved by the play tx's own digest (standing rule).
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDAppKit } from "@mysten/dapp-kit-react";
import { CurrentAccountSigner } from "@mysten/dapp-kit-core";
import { useVerifiedAccountContext } from "../contexts/VerifiedAccountContext";
import { translateTxError } from "../lib/txError";
import { fetchEveCoins, fetchHouseState, withGas } from "../lib/casino";
import { CASINO_HOUSE } from "../constants";
import {
  buildCoinflipTx, buildDiceTx, buildRouletteTx, buildSlotsTx, buildWheelTx,
  resolveInstantByDigest, fetchRecentInstantPlays, rouletteColor,
  ROULETTE_KINDS,
  type InstantGameKey, type InstantResult,
} from "../lib/casinoGames";
import { CoinFlipStage, DiceRollStage, RouletteStage, SlotsStage, WheelStage, ResultFlash } from "./CasinoAnimations";

const ACCENT = "#FF4700";
const GOLD = "#E8B84B";
const GREEN = "#3FCF6A";
const BLUE = "#7FC8FF";

function txDigestOf(result: any): string {
  return result?.Transaction?.digest ?? result?.FailedTransaction?.digest
    ?? result?.digest ?? result?.effects?.transactionDigest ?? "";
}
function fmtEve(n: number): string { return n.toLocaleString(undefined, { maximumFractionDigits: 3 }); }
function shortAddr(a: string): string { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"; }

const GAME_TITLE: Record<InstantGameKey, string> = {
  coinflip: "◉ COINFLIP", dice: "⚄ DICE", roulette: "◎ ROULETTE", slots: "▦ SLOTS", wheel: "✦ WHEEL",
};
const GAME_BLURB: Record<InstantGameKey, string> = {
  coinflip: "Call it. Win pays 1.96x.",
  dice: "Roll 1–100. Pick your line — payout scales with the odds (98/chance).",
  roulette: "European single-zero wheel. Straight pays 36x.",
  slots: "Three reels of frontier iron. Match three to hit.",
  wheel: "Twenty segments. Top seat pays 10x.",
};

export function InstantGamePanel({ game }: { game: InstantGameKey }) {
  const dAppKit = useDAppKit();
  const { account } = useVerifiedAccountContext();
  const addr = account?.address ?? "";
  const signer = () => new CurrentAccountSigner(dAppKit);

  const [betEve, setBetEve] = useState("10");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<InstantResult | null>(null); // settled on-chain, animating
  const [result, setResult] = useState<InstantResult | null>(null);   // revealed
  const winSfx = useRef<HTMLAudioElement | null>(null);
  const lossSfx = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    winSfx.current = new Audio("sounds/power-on.mp3"); if (winSfx.current) winSfx.current.volume = 0.4;
    lossSfx.current = new Audio("sounds/power-off.mp3"); if (lossSfx.current) lossSfx.current.volume = 0.3;
  }, []);
  const reveal = useCallback((r: InstantResult) => {
    setResult(r);
    (r.payout > 0 ? winSfx : lossSfx).current?.play().catch(() => {});
  }, []);
  // game params
  const [choice, setChoice] = useState<0 | 1>(0);
  const [diceTarget, setDiceTarget] = useState(50);
  const [diceOver, setDiceOver] = useState(true);
  const [rKind, setRKind] = useState(1);
  const [rTarget, setRTarget] = useState(0);

  const feedQ = useQuery({ queryKey: ["casinoInstantFeed"], queryFn: () => fetchRecentInstantPlays(20), refetchInterval: 15000 });
  const balQ = useQuery({ queryKey: ["casinoEve", addr], queryFn: () => fetchEveCoins(addr), enabled: !!addr, refetchInterval: 20000 });
  const houseQ = useQuery({ queryKey: ["casinoHouseLive"], queryFn: () => fetchHouseState(CASINO_HOUSE), refetchInterval: 15000 });
  const myEve = balQ.data ? Number(balQ.data.totalRaw) / 1e9 : 0;
  const bank = houseQ.data?.bankBalance ?? 0;

  const play = useCallback(async () => {
    if (!addr) { setErr("Connect a wallet."); return; }
    const wager = Number(betEve);
    if (!(wager > 0)) { setErr("Enter a positive bet."); return; }
    setBusy(true); setErr(null); setResult(null); setPending(null);
    try {
      const raw = BigInt(Math.floor(wager * 1e9));
      const buildTx = async () => {
        const { ids } = await fetchEveCoins(addr);
        if (!ids.length) throw new Error("No $EVE in wallet.");
        const t =
          game === "coinflip" ? buildCoinflipTx(ids, raw, choice) :
          game === "dice" ? buildDiceTx(ids, raw, diceTarget, diceOver) :
          game === "roulette" ? buildRouletteTx(ids, raw, rKind, rTarget) :
          game === "slots" ? buildSlotsTx(ids, raw) :
          buildWheelTx(ids, raw);
        // Explicit gas (fresh refs + fixed budget) — see withGas in casino.ts;
        // fixes wallet-side "InsufficientGas" on back-to-back plays.
        return withGas(t, addr);
      };
      let res: any;
      try {
        res = await signer().signAndExecuteTransaction({ transaction: await buildTx() });
      } catch (e: any) {
        // Coin objects mutate on every play; if the node handed us a just-spent
        // coin/gas ref (read lag), wait a beat, refetch fresh state, retry ONCE.
        if (/not found|notexists|deleted|invalid.*object|not available for consumption|InsufficientGas|GasBalanceTooLow/i.test(String(e?.message ?? e))) {
          await new Promise((r) => setTimeout(r, 1500));
          res = await signer().signAndExecuteTransaction({ transaction: await buildTx() });
        } else { throw e; }
      }
      const digest = txDigestOf(res);
      if (!digest) throw new Error("No tx digest returned.");
      const r = await resolveInstantByDigest(game, digest);
      if (!r) throw new Error("Could not read result — check the feed.");
      setPending(r); // stage animates to this outcome, then reveals
      feedQ.refetch(); balQ.refetch();
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "");
      if (/MoveAbort/.test(msg) && /(coinflip|dice|roulette|slots|wheel)::play/.test(msg) && /code:?\s*1\b/.test(msg)) {
        setErr(`BET BLOCKED — payout risk cap. Your ${fmtEve(betNum)} EVE bet could win up to ${fmtEve(betNum * grossMult)} EVE (${grossMult}x), but the house only risks ${fmtEve(exposureBudget)} EVE (3% of its ${fmtEve(bank)} EVE bank) on any single play. Bet ${fmtEve(Math.floor(maxBetForExposure))} EVE or less on this game, or pick shorter odds.`);
      } else {
        setErr(translateTxError(e));
      }
    }
    finally { setBusy(false); }
  }, [addr, betEve, game, choice, diceTarget, diceOver, rKind, rTarget, dAppKit]);

  const diceChance = diceOver ? 100 - diceTarget : diceTarget - 1;
  const diceMult = diceChance >= 2 && diceChance <= 96 ? (98 / diceChance) : 0;
  const rDef = ROULETTE_KINDS[rKind];

  // ── On-chain exposure rule mirror: max payout ≤ 3% of house bank. ──
  // Pre-check here so players never sign a tx that will abort with EMaxExposure.
  const EXPOSURE_PCT = 0.03;
  const grossMult =
    game === "coinflip" ? 1.96
    : game === "dice" ? (diceMult || 49)
    : game === "roulette" ? (rKind === 0 ? 36 : rKind >= 4 ? 3 : 2)
    : game === "slots" ? 60
    : 10; // wheel
  const exposureBudget = bank * EXPOSURE_PCT;
  const maxBetForExposure = bank > 0 ? exposureBudget / grossMult : Infinity;
  const betNum = Number(betEve) || 0;
  const overExposure = bank > 0 && betNum > maxBetForExposure;

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 440px", minWidth: 340 }}>
        <div style={{ background: `radial-gradient(ellipse at 50% 15%, #14351f 0%, #0c1c12 55%, #060a08 100%)`, border: `2px solid ${ACCENT}44`, borderRadius: 12, padding: "22px 24px", minHeight: 150, boxShadow: "inset 0 0 70px rgba(0,0,0,0.65)" }}>
          <div style={{ color: ACCENT, fontSize: 16, fontWeight: 800, letterSpacing: "0.1em" }}>{GAME_TITLE[game]}</div>
          <div style={{ color: "#9a9a8a", fontSize: 11, marginTop: 4 }}>{GAME_BLURB[game]}</div>

          <div style={{ position: "relative" }}>
            {pending ? (
              <>
                {game === "coinflip" && <CoinFlipStage key={pending.txDigest} result={Number(pending.fields.result)} onDone={() => reveal(pending)} />}
                {game === "dice" && <DiceRollStage key={pending.txDigest} roll={Number(pending.fields.roll)} target={Number(pending.fields.target)} over={Boolean(pending.fields.over)} onDone={() => reveal(pending)} />}
                {game === "roulette" && <RouletteStage key={pending.txDigest} spin={Number(pending.fields.spin)} onDone={() => reveal(pending)} />}
                {game === "slots" && <SlotsStage key={pending.txDigest} s1={Number(pending.fields.s1)} s2={Number(pending.fields.s2)} s3={Number(pending.fields.s3)} onDone={() => reveal(pending)} />}
                {game === "wheel" && <WheelStage key={pending.txDigest} segment={Number(pending.fields.segment)} onDone={() => reveal(pending)} />}
                {result && <ResultFlash key={`flash-${result.txDigest}`} win={result.payout > 0} />}
                {result ? (
                  <div style={{ textAlign: "center", padding: "4px 0 6px" }}>
                    <div style={{ color: "#ccc", fontSize: 13 }}>{result.detail}</div>
                    <div style={{ color: result.payout > 0 ? GREEN : ACCENT, fontSize: 26, fontWeight: 900, marginTop: 4 }}>
                      {result.payout > 0 ? `WIN +${fmtEve(result.payout - result.wager)} EVE` : `LOSS −${fmtEve(result.wager)} EVE`}
                    </div>
                    {result.payout > 0 && <div style={{ color: "#888", fontSize: 11 }}>gross payout {fmtEve(result.payout)} EVE</div>}
                  </div>
                ) : (
                  <div style={{ color: GOLD, fontSize: 11, textAlign: "center", letterSpacing: "0.15em", paddingBottom: 6 }}>◇ · · ·</div>
                )}
              </>
            ) : (
              <div style={{ color: "#556", fontSize: 12, textAlign: "center", padding: "26px 0" }}>{busy ? "◇ rolling on-chain…" : "place a bet"}</div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ marginTop: 16, background: "#111", border: `1px solid ${ACCENT}22`, padding: 18 }}>
          {game === "coinflip" && (
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              {([0, 1] as const).map((c) => (
                <button key={c} onClick={() => setChoice(c)} style={pick(choice === c)}>{c === 0 ? "◉ HEADS" : "◎ TAILS"}</button>
              ))}
            </div>
          )}
          {game === "dice" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                <button onClick={() => setDiceOver(false)} style={pick(!diceOver)}>UNDER {diceTarget}</button>
                <button onClick={() => setDiceOver(true)} style={pick(diceOver)}>OVER {diceTarget}</button>
              </div>
              <input type="range" min={3} max={98} value={diceTarget} onChange={(e) => setDiceTarget(Number(e.target.value))} style={{ width: "100%", accentColor: ACCENT }} />
              <div style={{ color: "#888", fontSize: 11, marginTop: 4 }}>
                win chance {diceChance}% · pays {diceMult ? diceMult.toFixed(2) : "—"}x
              </div>
            </div>
          )}
          {game === "roulette" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {ROULETTE_KINDS.map((k, i) => (
                  <button key={k.kind} onClick={() => { setRKind(i); setRTarget(0); }} style={pick(rKind === i)}>{k.label} <span style={{ color: "#777" }}>{k.pays}</span></button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxHeight: 120, overflowY: "auto" }}>
                {Array.from({ length: rDef.targets }, (_, t) => (
                  <button key={t} onClick={() => setRTarget(t)} style={{ ...numChip(rTarget === t), color: rKind === 0 ? (rouletteColor(t) === "RED" ? "#ff6a5a" : rouletteColor(t) === "BLACK" ? "#bbb" : GREEN) : undefined }}>
                    {rKind === 0 ? t
                      : rKind === 1 ? (t === 0 ? "RED" : "BLACK")
                      : rKind === 2 ? (t === 0 ? "EVEN" : "ODD")
                      : rKind === 3 ? (t === 0 ? "1–18" : "19–36")
                      : rKind === 4 ? ["1–12", "13–24", "25–36"][t]
                      : ["COL 1", "COL 2", "COL 3"][t]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 160px" }}>
              <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 4 }}>BET ($EVE) · you have {fmtEve(myEve)}</div>
              <input value={betEve} onChange={(e) => setBetEve(e.target.value)} inputMode="decimal" style={{ background: "#161616", border: `1px solid ${ACCENT}33`, color: ACCENT, fontSize: 14, padding: "9px 12px", outline: "none", width: "100%", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {[5, 10, 25, 100].map((v) => <button key={v} onClick={() => setBetEve(String(v))} style={{ background: "#1a1a1a", border: `1px solid ${ACCENT}44`, color: ACCENT, fontSize: 12, padding: "8px 12px", cursor: "pointer" }}>{v}</button>)}
              </div>
            </label>
          </div>
          <button disabled={busy || !addr || overExposure || (!!pending && !result)} onClick={play} style={{ marginTop: 14, width: "100%", background: `linear-gradient(180deg, ${ACCENT}, #b83400)`, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "0.1em", padding: "13px", cursor: "pointer", opacity: busy || !addr || overExposure ? 0.5 : 1 }}>
            {busy ? "SIGNING…" : game === "slots" || game === "wheel" ? "✦ SPIN" : "✦ PLAY"}
          </button>
          {overExposure && (
            <div style={{ color: GOLD, fontSize: 12, marginTop: 8, lineHeight: 1.6, background: "#1a1408", border: `1px solid ${GOLD}44`, padding: "10px 12px" }}>
              <div style={{ fontWeight: 800, letterSpacing: "0.06em" }}>⚠ BET TOO LARGE FOR THIS GAME'S TOP PAYOUT</div>
              <div style={{ marginTop: 4, color: "#c9b478" }}>
                Your {fmtEve(betNum)} EVE bet could win up to <b>{fmtEve(betNum * grossMult)} EVE</b> ({grossMult}x).
                The house risks at most <b>{fmtEve(exposureBudget)} EVE</b> per play — 3% of its {fmtEve(bank)} EVE bank — so it can always pay every winner.
              </div>
              <div style={{ marginTop: 4 }}>▸ Max bet here right now: <b>{fmtEve(Math.floor(maxBetForExposure))} EVE</b> — or switch to shorter odds. This limit rises as the bank grows.</div>
            </div>
          )}
          {err && <div style={{ color: ACCENT, fontSize: 12, marginTop: 8 }}>{err}</div>}
          <div style={{ color: "#666", fontSize: 10, marginTop: 8 }}>
            single-tx settle · randomness from Sui beacon (0x8) · max win per bet: 3% of house bank · full outcome in the result event
          </div>
        </div>
      </div>

      {/* Feed */}
      <div style={{ flex: "1 1 300px", minWidth: 280 }}>
        <div style={{ color: "#888", fontSize: 11, letterSpacing: "0.08em", marginBottom: 8 }}>◇ RECENT PLAYS (ALL GAMES)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 520, overflowY: "auto" }}>
          {(feedQ.data ?? []).length === 0 && <div style={{ color: "#555", fontSize: 12 }}>No plays yet. Be first.</div>}
          {(feedQ.data ?? []).map((r, i) => (
            <div key={r.txDigest + i} style={{ background: r.player === addr ? "#1a0f08" : "#111", border: `1px solid ${r.player === addr ? ACCENT + "44" : "#222"}`, padding: "7px 10px", fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ color: BLUE }}>{r.game.toUpperCase()}</span>
                <span style={{ color: r.player === addr ? GOLD : "#999", marginLeft: 6 }}>{r.player === addr ? "YOU" : shortAddr(r.player)}</span>
                <span style={{ color: "#555", marginLeft: 6 }}>{r.detail}</span>
              </div>
              <div>
                <span style={{ color: r.payout > 0 ? GREEN : ACCENT, fontWeight: 700 }}>{r.payout > 0 ? `+${fmtEve(r.payout - r.wager)}` : `−${fmtEve(r.wager)}`}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function pick(on: boolean): React.CSSProperties {
  return { flex: 1, minWidth: 80, background: on ? "#241009" : "#161616", border: `1px solid ${on ? ACCENT : "#333"}`, color: on ? ACCENT : "#888", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", padding: "10px 8px", cursor: "pointer" };
}
function numChip(on: boolean): React.CSSProperties {
  return { minWidth: 40, background: on ? "#241009" : "#161616", border: `1px solid ${on ? ACCENT : "#2a2a2a"}`, color: on ? ACCENT : "#999", fontSize: 11, fontWeight: 700, padding: "7px 6px", cursor: "pointer" };
}
