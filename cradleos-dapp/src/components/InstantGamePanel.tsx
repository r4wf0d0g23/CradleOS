/**
 * InstantGamePanel — config-driven UI for single-tx casino games:
 * coinflip, dice, roulette, slots, wheel, limbo, hilo, plinko, keno, sicbo.
 * One bet → one signature → result (resolved by the play tx's own digest).
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
  buildLimboTx, buildHiLoTx, buildPlinkoTx, buildKenoTx, buildSicBoTx,
  resolveInstantByDigest, fetchRecentInstantPlays, rouletteColor,
  ROULETTE_KINDS, HILO_RANKS, SICBO_KINDS, KENO_MAX_MULT,
  type InstantGameKey, type InstantResult,
} from "../lib/casinoGames";
import { CoinFlipStage, DiceRollStage, RouletteStage, SlotsStage, WheelStage, ResultFlash } from "./CasinoAnimations";

const ACCENT = "#FF4700";
const GOLD   = "#E8B84B";
const GREEN  = "#3FCF6A";
const BLUE   = "#7FC8FF";

function txDigestOf(result: any): string {
  return result?.Transaction?.digest ?? result?.FailedTransaction?.digest
    ?? result?.digest ?? result?.effects?.transactionDigest ?? "";
}
function fmtEve(n: number): string { return n.toLocaleString(undefined, { maximumFractionDigits: 3 }); }
function shortAddr(a: string): string { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"; }

const GAME_TITLE: Record<InstantGameKey, string> = {
  coinflip: "◉ COINFLIP", dice: "⚄ DICE", roulette: "◎ ROULETTE", slots: "▦ SLOTS", wheel: "✦ WHEEL",
  limbo: "▲ LIMBO", hilo: "◆ HI-LO", plinko: "⬢ PLINKO", keno: "▣ KENO", sicbo: "⚙ SIC BO",
};
const GAME_BLURB: Record<InstantGameKey, string> = {
  coinflip: "Call it. Win pays 1.96x.",
  dice: "Roll 1–100. Pick your line — payout scales with the odds (98/chance).",
  roulette: "European single-zero wheel. Straight pays 36x.",
  slots: "Three reels of frontier iron. Match three to hit.",
  wheel: "Twenty segments. Top seat pays 10x.",
  limbo: "Set your target multiplier. The crash point is drawn on-chain — fly above it to win.",
  hilo: "A base card is dealt. Bet whether the next draw is higher or lower. Push on equal rank.",
  plinko: "Drop the disc. It bounces through 12 rows into one of 13 buckets — top bucket pays 130x.",
  keno: "Pick 1–6 numbers from 1–40. Six are drawn. More matches = bigger multiplier.",
  sicbo: "Three dice rolled on-chain. Bet Small (4–10), Big (11–17), Single face, Specific Triple, or Any Triple.",
};

export function InstantGamePanel({ game }: { game: InstantGameKey }) {
  const dAppKit = useDAppKit();
  const { account } = useVerifiedAccountContext();
  const addr = account?.address ?? "";
  const signer = () => new CurrentAccountSigner(dAppKit);

  const [betEve, setBetEve] = useState("10");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<InstantResult | null>(null);
  const [result, setResult] = useState<InstantResult | null>(null);
  const winSfx  = useRef<HTMLAudioElement | null>(null);
  const lossSfx = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    winSfx.current  = new Audio("sounds/power-on.mp3");  if (winSfx.current)  winSfx.current.volume  = 0.4;
    lossSfx.current = new Audio("sounds/power-off.mp3"); if (lossSfx.current) lossSfx.current.volume = 0.3;
  }, []);
  const reveal = useCallback((r: InstantResult) => {
    setResult(r);
    (r.payout > 0 ? winSfx : lossSfx).current?.play().catch(() => {});
  }, []);

  // ── Game params — original games ──────────────────────────────────────────
  const [choice, setChoice] = useState<0 | 1>(0);
  const [diceTarget, setDiceTarget] = useState(50);
  const [diceOver, setDiceOver] = useState(true);
  const [rKind, setRKind] = useState(1);
  const [rTarget, setRTarget] = useState(0);

  // ── Game params — new games ────────────────────────────────────────────────
  const [limboBps, setLimboBps] = useState(20000); // 2x default
  const [hiloHigher, setHiloHigher] = useState(true);
  const [kenoPicks, setKenoPicks] = useState<Set<number>>(new Set());
  const [sicboKind, setSicboKind] = useState(0);
  const [sicboTarget, setSicboTarget] = useState(1);

  // Log-scale limbo slider helpers (slider 0..10000 → 1.01x..1000x)
  const LIMBO_LOG_BASE = Math.log(10_000_000 / 101);
  const limboSliderToMult = (s: number) => Math.round(101 * Math.exp((s / 10000) * LIMBO_LOG_BASE));
  const limboMultToSlider = (bps: number) => Math.round(10000 * Math.log(Math.max(101, bps) / 101) / LIMBO_LOG_BASE);

  const feedQ = useQuery({ queryKey: ["casinoInstantFeed"], queryFn: () => fetchRecentInstantPlays(20), refetchInterval: 15000 });
  const balQ  = useQuery({ queryKey: ["casinoEve", addr],  queryFn: () => fetchEveCoins(addr), enabled: !!addr, refetchInterval: 20000 });
  const houseQ = useQuery({ queryKey: ["casinoHouseLive"], queryFn: () => fetchHouseState(CASINO_HOUSE), refetchInterval: 15000 });
  const myEve = balQ.data ? Number(balQ.data.totalRaw) / 1e9 : 0;
  const bank  = houseQ.data?.bankBalance ?? 0;

  const play = useCallback(async () => {
    if (!addr) { setErr("Connect a wallet."); return; }
    const wager = Number(betEve);
    if (!(wager > 0)) { setErr("Enter a positive bet."); return; }
    if (game === "keno" && (kenoPicks.size < 1 || kenoPicks.size > 6)) {
      setErr("Pick 1–6 numbers for Keno."); return;
    }
    setBusy(true); setErr(null); setResult(null); setPending(null);
    try {
      const raw = BigInt(Math.floor(wager * 1e9));
      const picksArr = Array.from(kenoPicks).sort((a, b) => a - b);
      const buildTx = async () => {
        const { ids } = await fetchEveCoins(addr);
        if (!ids.length) throw new Error("No $EVE in wallet.");
        const t =
          game === "coinflip"  ? buildCoinflipTx(ids, raw, choice) :
          game === "dice"      ? buildDiceTx(ids, raw, diceTarget, diceOver) :
          game === "roulette"  ? buildRouletteTx(ids, raw, rKind, rTarget) :
          game === "slots"     ? buildSlotsTx(ids, raw) :
          game === "limbo"     ? buildLimboTx(ids, raw, BigInt(limboBps)) :
          game === "hilo"      ? buildHiLoTx(ids, raw, hiloHigher) :
          game === "plinko"    ? buildPlinkoTx(ids, raw) :
          game === "keno"      ? buildKenoTx(ids, raw, picksArr) :
          game === "sicbo"     ? buildSicBoTx(ids, raw, sicboKind, sicboTarget) :
          buildWheelTx(ids, raw);
        return withGas(t, addr);
      };
      let res: any;
      try {
        res = await signer().signAndExecuteTransaction({ transaction: await buildTx() });
      } catch (e: any) {
        if (/not found|notexists|deleted|invalid.*object|not available for consumption|InsufficientGas|GasBalanceTooLow/i.test(String(e?.message ?? e))) {
          await new Promise((r) => setTimeout(r, 1500));
          res = await signer().signAndExecuteTransaction({ transaction: await buildTx() });
        } else { throw e; }
      }
      const digest = txDigestOf(res);
      if (!digest) throw new Error("No tx digest returned.");
      const r = await resolveInstantByDigest(game, digest);
      if (!r) throw new Error("Could not read result — check the feed.");
      // Text-only games reveal immediately (no animation component).
      const noAnim = ["limbo", "hilo", "plinko", "keno", "sicbo"].includes(game);
      if (noAnim) { setPending(r); setResult(r); }
      else        { setPending(r); }  // animation component calls reveal(pending)
      feedQ.refetch(); balQ.refetch();
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "");
      if (/MoveAbort/.test(msg) && /(coinflip|dice|roulette|slots|wheel|limbo|hilo|plinko|keno|sicbo)::play/.test(msg) && /code:?\s*1\b/.test(msg)) {
        setErr(`BET BLOCKED — payout risk cap. Your ${fmtEve(betNum)} EVE bet could win up to ${fmtEve(betNum * grossMult)} EVE (${grossMult.toFixed(2)}x), but the house only risks ${fmtEve(exposureBudget)} EVE (3% of its ${fmtEve(bank)} EVE bank) on any single play. Bet ${fmtEve(Math.floor(maxBetForExposure))} EVE or less on this game, or pick shorter odds.`);
      } else {
        setErr(translateTxError(e));
      }
    } finally { setBusy(false); }
  }, [addr, betEve, game, choice, diceTarget, diceOver, rKind, rTarget,
      limboBps, hiloHigher, kenoPicks, sicboKind, sicboTarget, dAppKit]);

  const diceChance = diceOver ? 100 - diceTarget : diceTarget - 1;
  const diceMult   = diceChance >= 2 && diceChance <= 96 ? (98 / diceChance) : 0;
  const rDef = ROULETTE_KINDS[rKind];

  // Limbo derived
  const limboMult = limboBps / 10000;
  const limboWinChancePct = (100 / limboMult).toFixed(1);

  // ── Exposure guard (mirrors house contract: max payout ≤ 3% of bank) ──────
  const EXPOSURE_PCT = 0.03;
  const grossMult =
    game === "coinflip"  ? 1.96
    : game === "dice"    ? (diceMult || 49)
    : game === "roulette" ? (rKind === 0 ? 36 : rKind >= 4 ? 3 : 2)
    : game === "slots"   ? 60
    : game === "wheel"   ? 10
    : game === "limbo"   ? Math.max(1.01, limboMult)
    : game === "hilo"    ? 13
    : game === "plinko"  ? 130
    : game === "keno"    ? (KENO_MAX_MULT[kenoPicks.size] ?? 970)
    : game === "sicbo"   ? (sicboKind === 3 ? 180 : sicboKind === 4 ? 30 : sicboKind === 2 ? 4 : 2)
    : 2;
  const exposureBudget    = bank * EXPOSURE_PCT;
  const maxBetForExposure = bank > 0 ? exposureBudget / grossMult : Infinity;
  const betNum      = Number(betEve) || 0;
  const overExposure = bank > 0 && betNum > maxBetForExposure;

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 440px", minWidth: 340 }}>

        {/* Result stage */}
        <div style={{ background: "radial-gradient(ellipse at 50% 15%, #14351f 0%, #0c1c12 55%, #060a08 100%)", border: `2px solid ${ACCENT}44`, borderRadius: 12, padding: "22px 24px", minHeight: 150, boxShadow: "inset 0 0 70px rgba(0,0,0,0.65)" }}>
          <div style={{ color: ACCENT, fontSize: 16, fontWeight: 800, letterSpacing: "0.1em" }}>{GAME_TITLE[game]}</div>
          <div style={{ color: "#9a9a8a", fontSize: 11, marginTop: 4 }}>{GAME_BLURB[game]}</div>

          <div style={{ position: "relative" }}>
            {pending ? (
              <>
                {/* Animated stages (original games only) */}
                {game === "coinflip" && <CoinFlipStage key={pending.txDigest} result={Number(pending.fields.result)} onDone={() => reveal(pending)} />}
                {game === "dice"     && <DiceRollStage key={pending.txDigest} roll={Number(pending.fields.roll)} target={Number(pending.fields.target)} over={Boolean(pending.fields.over)} onDone={() => reveal(pending)} />}
                {game === "roulette" && <RouletteStage key={pending.txDigest} spin={Number(pending.fields.spin)} onDone={() => reveal(pending)} />}
                {game === "slots"    && <SlotsStage key={pending.txDigest} s1={Number(pending.fields.s1)} s2={Number(pending.fields.s2)} s3={Number(pending.fields.s3)} onDone={() => reveal(pending)} />}
                {game === "wheel"    && <WheelStage key={pending.txDigest} segment={Number(pending.fields.segment)} onDone={() => reveal(pending)} />}

                {/* Text-only displays for new games — shown as soon as result is set */}
                {result && game === "limbo" && (
                  <div style={{ textAlign: "center", padding: "16px 0 4px" }}>
                    <div style={{ color: "#666", fontSize: 11, letterSpacing: "0.08em" }}>CRASH POINT</div>
                    <div style={{ color: result.payout > 0 ? GREEN : ACCENT, fontSize: 44, fontWeight: 900, letterSpacing: "0.04em" }}>
                      {(Number(result.fields.crash_bps) / 10000).toFixed(2)}x
                    </div>
                    <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>
                      target {(Number(result.fields.target_bps) / 10000).toFixed(2)}x
                      {result.payout > 0 ? " · FLEW ABOVE" : " · CRASHED BELOW"}
                    </div>
                  </div>
                )}
                {result && game === "hilo" && (
                  <div style={{ textAlign: "center", padding: "16px 0 4px" }}>
                    <div style={{ color: "#666", fontSize: 11, letterSpacing: "0.08em" }}>BASE → DRAWN</div>
                    <div style={{ color: GOLD, fontSize: 36, fontWeight: 900, letterSpacing: "0.12em" }}>
                      {HILO_RANKS[Number(result.fields.base)] ?? "?"}
                      <span style={{ color: "#555", fontSize: 22 }}> → </span>
                      {HILO_RANKS[Number(result.fields.drawn)] ?? "?"}
                    </div>
                    {result.fields.push ? (
                      <div style={{ color: "#888", fontSize: 12 }}>PUSH — equal rank, wager returned</div>
                    ) : (
                      <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>
                        {result.fields.higher ? "BET: HIGHER" : "BET: LOWER"} · {result.payout > 0 ? "CORRECT" : "WRONG"}
                      </div>
                    )}
                  </div>
                )}
                {result && game === "plinko" && (
                  <div style={{ textAlign: "center", padding: "16px 0 4px" }}>
                    <div style={{ color: "#666", fontSize: 11, letterSpacing: "0.08em" }}>BUCKET {Number(result.fields.bucket)} / 12</div>
                    <div style={{ color: Number(result.fields.multiplier_bps) >= 20000 ? GOLD : result.payout > 0 ? GREEN : "#888", fontSize: 40, fontWeight: 900 }}>
                      {(Number(result.fields.multiplier_bps) / 10000).toFixed(2)}x
                    </div>
                  </div>
                )}
                {result && game === "keno" && (
                  <div style={{ textAlign: "center", padding: "14px 0 4px" }}>
                    <div style={{ color: "#666", fontSize: 11, letterSpacing: "0.08em" }}>
                      {String(result.fields.matches)} / {Array.isArray(result.fields.picks) ? (result.fields.picks as number[]).length : kenoPicks.size} MATCHES
                    </div>
                    <div style={{ color: result.payout > 0 ? GREEN : "#888", fontSize: 32, fontWeight: 900 }}>
                      {(Number(result.fields.multiplier_bps) / 10000).toFixed(2)}x
                    </div>
                    <div style={{ color: "#555", fontSize: 11, marginTop: 4 }}>
                      drawn: {Array.isArray(result.fields.drawn) ? (result.fields.drawn as number[]).join(" · ") : "—"}
                    </div>
                  </div>
                )}
                {result && game === "sicbo" && (
                  <div style={{ textAlign: "center", padding: "14px 0 4px" }}>
                    <div style={{ color: "#666", fontSize: 11, letterSpacing: "0.08em" }}>THREE DICE</div>
                    <div style={{ color: GOLD, fontSize: 36, fontWeight: 900, letterSpacing: "0.25em" }}>
                      {String(result.fields.d1)} · {String(result.fields.d2)} · {String(result.fields.d3)}
                    </div>
                    <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>
                      sum {Number(result.fields.d1) + Number(result.fields.d2) + Number(result.fields.d3)}
                    </div>
                  </div>
                )}

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
              <div style={{ color: "#556", fontSize: 12, textAlign: "center", padding: "26px 0" }}>
                {busy ? "◇ rolling on-chain…" : "place a bet"}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ marginTop: 16, background: "#111", border: `1px solid ${ACCENT}22`, padding: 18 }}>

          {/* Coinflip */}
          {game === "coinflip" && (
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              {([0, 1] as const).map((c) => (
                <button key={c} onClick={() => setChoice(c)} style={pick(choice === c)}>
                  {c === 0 ? "◉ HEADS" : "◎ TAILS"}
                </button>
              ))}
            </div>
          )}

          {/* Dice */}
          {game === "dice" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                <button onClick={() => setDiceOver(false)} style={pick(!diceOver)}>UNDER {diceTarget}</button>
                <button onClick={() => setDiceOver(true)}  style={pick(diceOver)}>OVER {diceTarget}</button>
              </div>
              <input type="range" min={3} max={98} value={diceTarget} onChange={(e) => setDiceTarget(Number(e.target.value))} style={{ width: "100%", accentColor: ACCENT }} />
              <div style={{ color: "#888", fontSize: 11, marginTop: 4 }}>
                win chance {diceChance}% · pays {diceMult ? diceMult.toFixed(2) : "—"}x
              </div>
            </div>
          )}

          {/* Roulette */}
          {game === "roulette" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {ROULETTE_KINDS.map((k, i) => (
                  <button key={k.kind} onClick={() => { setRKind(i); setRTarget(0); }} style={pick(rKind === i)}>
                    {k.label} <span style={{ color: "#777" }}>{k.pays}</span>
                  </button>
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

          {/* Limbo */}
          {game === "limbo" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 6 }}>TARGET MULTIPLIER</div>
              <input
                type="range"
                min={0}
                max={10000}
                value={limboMultToSlider(limboBps)}
                onChange={(e) => setLimboBps(Math.max(101, Math.min(10_000_000, limboSliderToMult(Number(e.target.value)))))}
                style={{ width: "100%", accentColor: ACCENT }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <div style={{ color: ACCENT, fontSize: 20, fontWeight: 900 }}>{limboMult.toFixed(2)}x</div>
                <div style={{ color: "#888", fontSize: 11 }}>~{limboWinChancePct}% win chance</div>
                <div style={{ color: "#888", fontSize: 11 }}>pays ~{(limboMult * 0.97).toFixed(2)}x</div>
              </div>
              <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                {[1.5, 2, 3, 5, 10, 50, 100].map((m) => (
                  <button key={m} onClick={() => setLimboBps(Math.round(m * 10000))} style={{ ...numChip(Math.abs(limboBps / 10000 - m) < 0.05), fontSize: 10, padding: "5px 6px" }}>{m}x</button>
                ))}
              </div>
            </div>
          )}

          {/* HiLo */}
          {game === "hilo" && (
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <button onClick={() => setHiloHigher(true)}  style={pick(hiloHigher)}>▲ HIGHER</button>
              <button onClick={() => setHiloHigher(false)} style={pick(!hiloHigher)}>▼ LOWER</button>
            </div>
          )}

          {/* Keno */}
          {game === "keno" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 6 }}>
                PICK {kenoPicks.size === 0 ? "1–6 NUMBERS" : `${kenoPicks.size}/6 · MAX PAYOUT ${KENO_MAX_MULT[kenoPicks.size] ?? "—"}x`}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 3 }}>
                {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => {
                  const picked = kenoPicks.has(n);
                  return (
                    <button
                      key={n}
                      onClick={() => setKenoPicks((prev) => {
                        const next = new Set(prev);
                        if (next.has(n)) { next.delete(n); }
                        else if (next.size < 6) { next.add(n); }
                        return next;
                      })}
                      style={{
                        background: picked ? "#241009" : "#161616",
                        border: `1px solid ${picked ? ACCENT : "#2a2a2a"}`,
                        color: picked ? ACCENT : "#666",
                        fontSize: 10, fontWeight: picked ? 800 : 400,
                        padding: "5px 2px", cursor: "pointer",
                      }}
                    >{n}</button>
                  );
                })}
              </div>
              {kenoPicks.size > 0 && (
                <div style={{ color: "#666", fontSize: 10, marginTop: 4 }}>
                  selected: {Array.from(kenoPicks).sort((a, b) => a - b).join(", ")}
                </div>
              )}
            </div>
          )}

          {/* SicBo */}
          {game === "sicbo" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 6 }}>BET KIND</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {SICBO_KINDS.map((k) => (
                  <button key={k.kind} onClick={() => setSicboKind(k.kind)} style={pick(sicboKind === k.kind)}>
                    {k.label} <span style={{ color: "#777" }}>{k.mult}x</span>
                  </button>
                ))}
              </div>
              {(sicboKind === 2 || sicboKind === 3) && (
                <div>
                  <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 6 }}>TARGET FACE (1–6)</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[1, 2, 3, 4, 5, 6].map((f) => (
                      <button key={f} onClick={() => setSicboTarget(f)} style={numChip(sicboTarget === f)}>{f}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bet input (all games) */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 160px" }}>
              <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 4 }}>BET ($EVE) · you have {fmtEve(myEve)}</div>
              <input
                value={betEve}
                onChange={(e) => setBetEve(e.target.value)}
                inputMode="decimal"
                style={{ background: "#161616", border: `1px solid ${ACCENT}33`, color: ACCENT, fontSize: 14, padding: "9px 12px", outline: "none", width: "100%", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {[5, 10, 25, 100].map((v) => (
                  <button key={v} onClick={() => setBetEve(String(v))} style={{ background: "#1a1a1a", border: `1px solid ${ACCENT}44`, color: ACCENT, fontSize: 12, padding: "8px 12px", cursor: "pointer" }}>{v}</button>
                ))}
              </div>
            </label>
          </div>

          <button
            disabled={busy || !addr || overExposure || (!!pending && !result)}
            onClick={play}
            style={{ marginTop: 14, width: "100%", background: `linear-gradient(180deg, ${ACCENT}, #b83400)`, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "0.1em", padding: "13px", cursor: "pointer", opacity: busy || !addr || overExposure ? 0.5 : 1 }}
          >
            {busy ? "SIGNING…" : (game === "slots" || game === "plinko" || game === "wheel") ? "✦ SPIN" : "✦ PLAY"}
          </button>

          {overExposure && (
            <div style={{ color: GOLD, fontSize: 12, marginTop: 8, lineHeight: 1.6, background: "#1a1408", border: `1px solid ${GOLD}44`, padding: "10px 12px" }}>
              <div style={{ fontWeight: 800, letterSpacing: "0.06em" }}>⚠ BET TOO LARGE FOR THIS GAME'S TOP PAYOUT</div>
              <div style={{ marginTop: 4, color: "#c9b478" }}>
                Your {fmtEve(betNum)} EVE bet could win up to <b>{fmtEve(betNum * grossMult)} EVE</b> ({grossMult.toFixed(2)}x).
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
