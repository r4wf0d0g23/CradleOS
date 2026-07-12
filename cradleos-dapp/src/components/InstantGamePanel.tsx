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
import { fetchEveCoins, fetchHouseState, withGas, betPresets } from "../lib/casino";
import { getPaytable } from "../lib/casinoPaytables";
import { CASINO_HOUSE } from "../constants";
import {
  buildCoinflipTx, buildDiceTx, buildRouletteTx, buildSlotsTx, buildWheelTx,
  buildLimboTx, buildHiLoStartTx, buildHiLoSettleTx, buildPlinkoTx, buildPlinkoModeTx, PLINKO_MODES, buildKenoTx, buildSicBoTx,
  buildCrashTx, buildDiamondsTx, buildDoubleDiceTx, buildWarTx, buildBaccaratTx, buildThreeCardTx,
  buildDragonTigerTx, buildUnderOver7Tx, buildOreRefineTx,
  resolveInstantByDigest, resolveHiLoStartByDigest, fetchOpenHiLoGame, hiloCallMultiplier,
  fetchRecentInstantPlays, rouletteColor,
  ROULETTE_KINDS, HILO_RANKS, SICBO_KINDS, KENO_MAX_MULT,
  DIAMOND_GEMS, WAR_RANKS, DOUBLE_DICE_KINDS, doubleDiceExactMult, BACCARAT_KINDS, THREE_CARD_RANKS, SLOT_SYMBOLS,
  DRAGON_TIGER_BET_LABELS, ORE_REFINE_TIER_LABELS, ORE_REFINE_OUTCOME_LABELS, WAR_RANKS_13,
  type InstantGameKey, type InstantResult, type HiLoLiveGame,
} from "../lib/casinoGames";
import {
  CoinFlipStage, DiceRollStage, RouletteStage, SlotsStage, WheelStage, ResultFlash,
  CrashStage, LimboStage, DiamondsStage, DoubleDiceStage, WarStage,
  BaccaratStage, ThreeCardStage, HiLoStage, PlinkoStage, KenoStage, SicBoStage,
  DragonTigerStage, UnderOver7Stage, OreRefineStage,
  useCasinoKeyframes,
} from "./CasinoAnimations";

const ACCENT = "#FF4700";
const GOLD   = "#E8B84B";
const GREEN  = "#3FCF6A";
const BLUE   = "#7FC8FF";

function txDigestOf(result: any): string {
  return result?.Transaction?.digest ?? result?.FailedTransaction?.digest
    ?? result?.digest ?? result?.effects?.transactionDigest ?? "";
}
function fmtEve(n: number): string { return n.toLocaleString(undefined, { maximumFractionDigits: 3 }); }

// ── Slots paytable ────────────────────────────────────────────────────────────
// Mirrors slots.move exactly (source of truth): TRIPLE_BPS per symbol + a flat
// TWO_MATCH_BPS for any two matching. Reel strip weights the 7 symbols:
//   [0×4, 1×3, 2×3, 3×2, 4×2, 5×1, 6×1]  (16 stops, same for all 3 reels)
// If slots.move's TRIPLE_BPS / TWO_MATCH_BPS / strip() ever change, update here.
const SLOTS_TRIPLE_MULT = [3.6, 5, 6, 12, 18, 36, 60];      // x, per symbol idx 0..6
const SLOTS_STRIP_WEIGHT = [4, 3, 3, 2, 2, 1, 1];           // reel stops per symbol (of 16)
const SLOTS_TWO_MATCH_MULT = 1.8;                            // x, any two matching

// ── Generic paytable (all instant games except slots, which has its own richer
//    glyph renderer below). Data lives in casinoPaytables.ts (mirrors contracts).
function GamePaytable({ game }: { game: string }) {
  const pt = getPaytable(game);
  if (!pt) return null;
  return (
    <div style={{ marginTop: 12, background: "#0d0d0d", border: `1px solid ${ACCENT}22`, padding: "12px 14px" }}>
      <div style={{ color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", marginBottom: 8 }}>▦ PAYTABLE · multiplier on your bet</div>
      {pt.rows.map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #1c1c1c", gap: 10 }}>
          <span style={{ fontSize: 12, color: r.top ? GOLD : "#ccc", lineHeight: 1.3 }}>{r.label}</span>
          <span style={{ display: "flex", gap: 12, alignItems: "baseline", flexShrink: 0 }}>
            {r.prob && <span style={{ color: "#666", fontSize: 10 }}>{r.prob}</span>}
            <span style={{ color: r.top ? GOLD : GREEN, fontSize: 13, fontWeight: 800, minWidth: 54, textAlign: "right" }}>{r.mult}</span>
          </span>
        </div>
      ))}
      {pt.note && <div style={{ color: "#888", fontSize: 11, marginTop: 8, lineHeight: 1.5 }}>{pt.note}</div>}
      <div style={{ color: "#555", fontSize: 10, marginTop: 6 }}>
        return to player <b style={{ color: "#888" }}>{pt.rtp}</b> · house edge <b style={{ color: "#888" }}>{pt.edge}</b>
      </div>
    </div>
  );
}

function SlotsPaytable() {
  const row = (label: React.ReactNode, mult: string, prob: string, top?: boolean) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #1c1c1c" }}>
      <span style={{ fontSize: 15, letterSpacing: "0.12em", color: top ? GOLD : "#ccc" }}>{label}</span>
      <span style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
        <span style={{ color: "#666", fontSize: 10 }}>{prob}</span>
        <span style={{ color: top ? GOLD : GREEN, fontSize: 13, fontWeight: 800, minWidth: 46, textAlign: "right" }}>{mult}</span>
      </span>
    </div>
  );
  return (
    <div style={{ marginTop: 12, background: "#0d0d0d", border: `1px solid ${ACCENT}22`, padding: "12px 14px" }}>
      <div style={{ color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", marginBottom: 8 }}>▦ PAYTABLE · multiplier on your bet</div>
      {SLOTS_TRIPLE_MULT.map((m, i) => {
        const w = SLOTS_STRIP_WEIGHT[i];
        const p = Math.pow(w / 16, 3) * 100;
        return (
          <React.Fragment key={i}>
            {row(
              <>{SLOT_SYMBOLS[i]} {SLOT_SYMBOLS[i]} {SLOT_SYMBOLS[i]}{i === 6 ? "  JACKPOT" : ""}</>,
              `${m}x`,
              `${p < 0.1 ? p.toFixed(3) : p.toFixed(2)}%`,
              i === 6,
            )}
          </React.Fragment>
        );
      })}
      {row(<>any two matching</>, `${SLOTS_TWO_MATCH_MULT}x`, "41.6%", false)}
      <div style={{ color: "#555", fontSize: 10, marginTop: 8, lineHeight: 1.5 }}>
        Three reels, one 16-stop weighted strip. Rarer symbols pay more. ~95.96% return (≈4% house edge). Max win 60x.
      </div>
    </div>
  );
}
function shortAddr(a: string): string { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"; }

const GAME_TITLE: Record<InstantGameKey, string> = {
  coinflip: "◉ COINFLIP", dice: "⚄ DICE", roulette: "◎ ROULETTE", slots: "▦ SLOTS", wheel: "✦ WHEEL",
  limbo: "▲ LIMBO", hilo: "◆ HI-LO", plinko: "⬢ PLINKO", keno: "▣ KENO", sicbo: "⚙ SIC BO",
  crash: "▲ CRASH", diamonds: "◆ DIAMONDS", double_dice: "⚄ DOUBLE DICE", war: "⚔ WAR",
  baccarat: "◈ BACCARAT", three_card_poker: "◇ THREE CARD",
  dragon_tiger: "◎ DRAGON TIGER", under_over_7: "▣ UNDER/OVER 7", ore_refine: "⊞ ORE REFINE",
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
  crash: "Set your target multiplier. If the on-chain crash point flies at or above your target — you win. 1.01x–1000x.",
  diamonds: "Five gems drawn on-chain from 7 types. Three-of-a-kind 2.55x · Four 30x · Five 500x.",
  double_dice: "Two dice rolled on-chain. Bet Under 7, Over 7, Seven, Any Double, or an Exact sum (2–12).",
  war: "One card each — highest rank wins 2x. Tie returns half. No skill required, just pure frontier fortune.",
  baccarat: "Player vs Banker. Bet on who gets closest to 9. Tie pays 9x.",
  three_card_poker: "Three cards each. Beat the dealer — qualify with Q-high to unlock bonus payouts up to 6x.",
  dragon_tiger: "One card each. Dragon vs Tiger — highest rank wins 2x. Tie returns half. Tie side bet pays 9x.",
  under_over_7: "Two dice. Bet whether the sum falls Under 7 (2.32x), Exactly 7 (5.70x), or Over 7 (2.32x).",
  ore_refine: "Risk your stake through 5 refine intensities. BASIC (2x) → CRITICAL (20x). All tiers: 3% house edge.",
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
  // Live two-step hi-lo: set after `start` deals the base card; cleared at settle.
  const [hiloLive, setHiloLive] = useState<HiLoLiveGame | null>(null);
  const [plinkoMode, setPlinkoMode] = useState(-1); // -1 CLASSIC · 0 LOW · 1 MED · 2 HIGH
  const [plinkoDrops, _setPlinkoDrops] = useState(1); // multi-drop count (default 1 = classic single)
  const [kenoPicks, setKenoPicks] = useState<Set<number>>(new Set());
  const [sicboKind, setSicboKind] = useState(0);
  const [sicboTarget, setSicboTarget] = useState(1);

  // ── Game params — v7 games ─────────────────────────────────────────────────
  const [crashBps, setCrashBps] = useState(20000); // 2x default (same shape as limbo)
  const [doubleDiceKind, setDoubleDiceKind] = useState(0);
  const [doubleDiceTarget, setDoubleDiceTarget] = useState(7); // sum 2-12 for EXACT
  const [baccaratKind, setBaccaratKind] = useState(0); // 0=PLAYER 1=BANKER 2=TIE
  // ── Game params — v16 games (dragon_tiger / under_over_7 / ore_refine)
  const [dragonTigerBet, setDragonTigerBet] = useState<0|1|2>(0); // 0=Dragon 1=Tiger 2=Tie
  const [underOver7Kind, setUnderOver7Kind] = useState<0|1|2>(0); // 0=UNDER 1=EXACTLY7 2=OVER
  const [oreTier, setOreTier] = useState<1|2|3|4|5>(1);           // 1=BASIC..5=CRITICAL

  // Log-scale limbo slider helpers (slider 0..10000 → 1.01x..1000x)
  const LIMBO_LOG_BASE = Math.log(10_000_000 / 101);
  const limboSliderToMult = (s: number) => Math.round(101 * Math.exp((s / 10000) * LIMBO_LOG_BASE));
  const limboMultToSlider = (bps: number) => Math.round(10000 * Math.log(Math.max(101, bps) / 101) / LIMBO_LOG_BASE);

  useCasinoKeyframes(); // base-card flip animation on the hi-lo start step

  // Resume an abandoned live hi-lo hand (escrowed stake in an owned HiLoGame).
  useEffect(() => {
    if (game !== "hilo" || !addr) { return; }
    let dead = false;
    fetchOpenHiLoGame(addr).then((g) => { if (!dead && g) setHiloLive(g); });
    return () => { dead = true; };
  }, [game, addr]);

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
          game === "coinflip"        ? buildCoinflipTx(ids, raw, choice) :
          game === "dice"            ? buildDiceTx(ids, raw, diceTarget, diceOver) :
          game === "roulette"        ? buildRouletteTx(ids, raw, rKind, rTarget) :
          game === "slots"           ? buildSlotsTx(ids, raw) :
          game === "limbo"           ? buildLimboTx(ids, raw, BigInt(limboBps)) :
          game === "hilo"            ? buildHiLoStartTx(ids, raw) :
          game === "plinko"          ? (plinkoMode < 0 ? buildPlinkoTx(ids, raw) : buildPlinkoModeTx(ids, raw, plinkoMode)) :
          game === "keno"            ? buildKenoTx(ids, raw, picksArr) :
          game === "sicbo"           ? buildSicBoTx(ids, raw, sicboKind, sicboTarget) :
          game === "crash"           ? buildCrashTx(ids, raw, BigInt(crashBps)) :
          game === "diamonds"        ? buildDiamondsTx(ids, raw) :
          game === "double_dice"     ? buildDoubleDiceTx(ids, raw, doubleDiceKind, doubleDiceKind === 4 ? doubleDiceTarget : 0) :
          game === "war"             ? buildWarTx(ids, raw) :
          game === "baccarat"        ? buildBaccaratTx(ids, raw, baccaratKind) :
          game === "three_card_poker" ? buildThreeCardTx(ids, raw) :
          game === "dragon_tiger"       ? buildDragonTigerTx(ids, raw, dragonTigerBet) :
          game === "under_over_7"       ? buildUnderOver7Tx(ids, raw, underOver7Kind) :
          game === "ore_refine"         ? buildOreRefineTx(ids, raw, oreTier) :
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
      if (game === "hilo") {
        // Two-step flow: the start tx only deals the base card. The player now
        // calls HIGHER/LOWER with the base in view; settle happens in settleHiLo.
        const live = await resolveHiLoStartByDigest(digest);
        if (!live) throw new Error("Could not read the base card — if the bet left your wallet, reopen HI-LO to resume the hand.");
        setHiloLive(live);
        balQ.refetch();
        return;
      }
      const r = await resolveInstantByDigest(game, digest);
      if (!r) throw new Error("Could not read result — check the feed.");
      // All games now have animation stages — always use pending path.
      setPending(r);
      feedQ.refetch(); balQ.refetch();
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "");
      if (/MoveAbort/.test(msg) && /(coinflip|dice|roulette|slots|wheel|limbo|hilo|plinko|keno|sicbo|crash|diamonds|double_dice|war|baccarat|three_card_poker|dragon_tiger|under_over_7|ore_refine)::play/.test(msg) && /code:?\s*1\b/.test(msg)) {
        setErr(`BET BLOCKED — payout risk cap. Your ${fmtEve(betNum)} EVE bet could win up to ${fmtEve(betNum * grossMult)} EVE (${grossMult.toFixed(2)}x), but the house only risks ${fmtEve(exposureBudget)} EVE (3% of its ${fmtEve(bank)} EVE bank) on any single play. Bet ${fmtEve(Math.floor(maxBetForExposure))} EVE or less on this game, or pick shorter odds.`);
      } else {
        setErr(translateTxError(e));
      }
    } finally { setBusy(false); }
  }, [addr, betEve, game, choice, diceTarget, diceOver, rKind, rTarget,
      limboBps, kenoPicks, sicboKind, sicboTarget, plinkoMode,
      crashBps, doubleDiceKind, doubleDiceTarget, baccaratKind,
      dragonTigerBet, underOver7Kind, oreTier, dAppKit]);

  // Settle a live hi-lo hand: player has seen the base, calls a direction.
  const settleHiLo = useCallback(async (higher: boolean) => {
    if (!addr || !hiloLive) { return; }
    setBusy(true); setErr(null); setResult(null); setPending(null);
    try {
      const tx = await withGas(await buildHiLoSettleTx(hiloLive.gameId, higher), addr);
      const res = await signer().signAndExecuteTransaction({ transaction: tx });
      const digest = txDigestOf(res);
      if (!digest) throw new Error("No tx digest returned.");
      const r = await resolveInstantByDigest("hilo", digest);
      if (!r) throw new Error("Could not read result — check the feed.");
      setHiloLive(null);
      setPending(r);
      feedQ.refetch(); balQ.refetch();
    } catch (e: any) {
      setErr(translateTxError(e));
    } finally { setBusy(false); }
  }, [addr, hiloLive, dAppKit]);

  const diceChance = diceOver ? 100 - diceTarget : diceTarget - 1;
  const diceMult   = diceChance >= 2 && diceChance <= 96 ? (98 / diceChance) : 0;
  const rDef = ROULETTE_KINDS[rKind];

  // Limbo derived
  const limboMult = limboBps / 10000;
  const limboWinChancePct = (100 / limboMult).toFixed(1);

  // ── Exposure guard (mirrors house contract: max payout ≤ 3% of bank) ──────
  const EXPOSURE_PCT = 0.03;
  const crashMult = crashBps / 10000;
  const grossMult =
    game === "coinflip"  ? 1.96
    : game === "dice"    ? (diceMult || 49)
    : game === "roulette" ? (rKind === 0 ? 36 : rKind >= 4 ? 3 : 2)
    : game === "slots"   ? 60
    : game === "wheel"   ? 10
    : game === "limbo"   ? Math.max(1.01, limboMult)
    : game === "hilo"    ? 13
    : game === "plinko"  ? (PLINKO_MODES.find((m) => m.mode === plinkoMode)?.maxMult ?? 130)
    : game === "keno"    ? (KENO_MAX_MULT[kenoPicks.size] ?? 970)
    : game === "sicbo"   ? (sicboKind === 3 ? 180 : sicboKind === 4 ? 30 : sicboKind === 2 ? 4 : 2)
    : game === "crash"   ? Math.max(1.01, crashMult)
    : game === "diamonds" ? 500
    : game === "double_dice" ? (doubleDiceKind === 4 ? doubleDiceExactMult(doubleDiceTarget) : DOUBLE_DICE_KINDS[doubleDiceKind]?.grossMult ?? 2.3)
    : game === "war"     ? 2
    : game === "baccarat" ? (baccaratKind === 2 ? 9 : 2)
    : game === "three_card_poker" ? 6
    : game === "dragon_tiger"   ? (dragonTigerBet === 2 ? 9 : 2)
    : game === "under_over_7"   ? (underOver7Kind === 1 ? 5.7 : 2.32)
    : game === "ore_refine"     ? [2, 4, 6, 15, 20][oreTier - 1] ?? 2
    : 2;
  const exposureBudget    = bank * EXPOSURE_PCT;
  const maxBetForExposure = bank > 0 ? exposureBudget / grossMult : Infinity;
  const betNum      = Number(betEve) || 0;
  const overExposure = bank > 0 && betNum > maxBetForExposure;
  // For plinko multi-drop: house max_bet is PER-BALL. A per-ball bet > houseMaxBet aborts
  // take_wager_amount_multi (code 2). Cap is min(exposureDerived, houseMaxBet) per-ball.
  // Do NOT compare betNum×count against houseMaxBet — that’s the old (wrong) semantics.
  const houseMaxBetEve = houseQ.data?.maxBet ?? Infinity;
  const overHouseMaxBet = game === "plinko" && plinkoDrops > 1
    ? betNum > houseMaxBetEve   // per-ball exceeds house per-ball cap
    : false;                     // single-drop: already covered by overExposure

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
                {/* Animated stages — all games */}
                {game === "coinflip"         && <CoinFlipStage   key={pending.txDigest} result={Number(pending.fields.result)} onDone={() => reveal(pending)} />}
                {game === "dice"             && <DiceRollStage   key={pending.txDigest} roll={Number(pending.fields.roll)} target={Number(pending.fields.target)} over={Boolean(pending.fields.over)} onDone={() => reveal(pending)} />}
                {game === "roulette"         && <RouletteStage   key={pending.txDigest} spin={Number(pending.fields.spin)} onDone={() => reveal(pending)} />}
                {game === "slots"            && <SlotsStage      key={pending.txDigest} s1={Number(pending.fields.s1)} s2={Number(pending.fields.s2)} s3={Number(pending.fields.s3)} onDone={() => reveal(pending)} />}
                {game === "wheel"            && <WheelStage      key={pending.txDigest} segment={Number(pending.fields.segment)} onDone={() => reveal(pending)} />}
                {game === "crash"            && <CrashStage      key={pending.txDigest} crashBps={Number(pending.fields.crash_bps)} targetBps={Number(pending.fields.target_bps)} onDone={() => reveal(pending)} />}
                {game === "limbo"            && <LimboStage      key={pending.txDigest} crashBps={Number(pending.fields.crash_bps)} targetBps={Number(pending.fields.target_bps)} onDone={() => reveal(pending)} />}
                {game === "diamonds"         && <DiamondsStage   key={pending.txDigest} gems={Array.isArray(pending.fields.gems) ? (pending.fields.gems as number[]) : []} bestSet={Array.isArray(pending.fields.best_set) ? (pending.fields.best_set as number[]) : []} onDone={() => reveal(pending)} />}
                {game === "double_dice"      && <DoubleDiceStage key={pending.txDigest} d1={Number(pending.fields.d1)} d2={Number(pending.fields.d2)} kind={Number(pending.fields.kind)} target={Number(pending.fields.target)} onDone={() => reveal(pending)} />}
                {game === "war"              && <WarStage        key={pending.txDigest} playerCard={Number(pending.fields.player_card)} dealerCard={Number(pending.fields.dealer_card)} onDone={() => reveal(pending)} />}
                {game === "baccarat"         && <BaccaratStage   key={pending.txDigest} playerCards={Array.isArray(pending.fields.player_cards) ? (pending.fields.player_cards as number[]) : []} bankerCards={Array.isArray(pending.fields.banker_cards) ? (pending.fields.banker_cards as number[]) : []} playerScore={Number(pending.fields.player_score)} bankerScore={Number(pending.fields.banker_score)} result={Number(pending.fields.result)} onDone={() => reveal(pending)} />}
                {game === "three_card_poker" && <ThreeCardStage  key={pending.txDigest} playerCards={Array.isArray(pending.fields.player_cards) ? (pending.fields.player_cards as number[]) : []} dealerCards={Array.isArray(pending.fields.dealer_cards) ? (pending.fields.dealer_cards as number[]) : []} result={Number(pending.fields.result)} dealerQualified={Boolean(pending.fields.dealer_qualified)} onDone={() => reveal(pending)} />}
                {game === "dragon_tiger"    && <DragonTigerStage key={pending.txDigest} dragonRank={Number(pending.fields.dragon_rank)} tigerRank={Number(pending.fields.tiger_rank)} betType={Number(pending.fields.bet_type)} onDone={() => reveal(pending)} />}
                {game === "under_over_7"    && <UnderOver7Stage  key={pending.txDigest} d1={Number(pending.fields.d1)} d2={Number(pending.fields.d2)} kind={Number(pending.fields.kind)} onDone={() => reveal(pending)} />}
                {game === "ore_refine"      && <OreRefineStage   key={pending.txDigest} tier={Number(pending.fields.tier)} outcome={Number(pending.fields.outcome)} onDone={() => reveal(pending)} />}
                {game === "hilo"             && <HiLoStage       key={pending.txDigest} base={Number(pending.fields.base)} drawn={Number(pending.fields.drawn)} higher={Boolean(pending.fields.higher)} onDone={() => reveal(pending)} />}
                {game === "plinko"           && <PlinkoStage     key={pending.txDigest} path={Number(pending.fields.path)} bucket={Number(pending.fields.bucket)} mults={(PLINKO_MODES.find((m) => m.mode === (pending.fields.mode !== undefined ? Number(pending.fields.mode) : -1))?.mults ?? undefined) as number[] | undefined} onDone={() => reveal(pending)} />}
                {game === "keno"             && <KenoStage       key={pending.txDigest} picks={Array.isArray(pending.fields.picks) ? (pending.fields.picks as number[]) : []} drawn={Array.isArray(pending.fields.drawn) ? (pending.fields.drawn as number[]) : []} matches={Number(pending.fields.matches)} onDone={() => reveal(pending)} />}
                {game === "sicbo"            && <SicBoStage      key={pending.txDigest} d1={Number(pending.fields.d1)} d2={Number(pending.fields.d2)} d3={Number(pending.fields.d3)} kind={Number(pending.fields.kind ?? 0)} target={Number(pending.fields.target ?? 0)} onDone={() => reveal(pending)} />}

                {/* Per-game result detail overlays — shown after animation fires onDone */}
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

                {/* v7 game result displays */}
                {result && game === "crash" && (
                  <div style={{ textAlign: "center", padding: "16px 0 4px" }}>
                    <div style={{ color: "#666", fontSize: 11, letterSpacing: "0.08em" }}>CRASH POINT</div>
                    <div style={{ color: result.payout > 0 ? GREEN : ACCENT, fontSize: 44, fontWeight: 900, letterSpacing: "0.04em" }}>
                      {(Number(result.fields.crash_bps) / 10000).toFixed(2)}x
                    </div>
                    <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>
                      target {(Number(result.fields.target_bps) / 10000).toFixed(2)}x
                      {result.payout > 0 ? " · SOARED ABOVE" : " · CRASHED BELOW"}
                    </div>
                  </div>
                )}
                {result && game === "diamonds" && (
                  <div style={{ textAlign: "center", padding: "16px 0 4px" }}>
                    <div style={{ color: "#666", fontSize: 11, letterSpacing: "0.08em" }}>GEMS DRAWN</div>
                    <div style={{ color: GOLD, fontSize: 36, fontWeight: 900, letterSpacing: "0.2em" }}>
                      {Array.isArray(result.fields.gems)
                        ? (result.fields.gems as number[]).map((g) => DIAMOND_GEMS[g] ?? "?").join(" ")
                        : "?????"}
                    </div>
                    {Number(result.fields.multiplier_bps) > 10000 && (
                      <div style={{ color: GREEN, fontSize: 20, fontWeight: 900, marginTop: 4 }}>
                        {(Number(result.fields.multiplier_bps) / 10000).toFixed(2)}x
                      </div>
                    )}
                  </div>
                )}
                {result && game === "double_dice" && (
                  <div style={{ textAlign: "center", padding: "16px 0 4px" }}>
                    <div style={{ color: "#666", fontSize: 11, letterSpacing: "0.08em" }}>TWO DICE</div>
                    <div style={{ color: GOLD, fontSize: 40, fontWeight: 900, letterSpacing: "0.3em" }}>
                      {String(result.fields.d1)} · {String(result.fields.d2)}
                    </div>
                    <div style={{ color: "#888", fontSize: 13, marginTop: 4 }}>
                      sum {Number(result.fields.d1) + Number(result.fields.d2)}
                    </div>
                  </div>
                )}
                {result && game === "war" && (
                  <div style={{ textAlign: "center", padding: "16px 0 4px" }}>
                    <div style={{ display: "flex", gap: 32, justifyContent: "center", alignItems: "center" }}>
                      <div>
                        <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.08em", marginBottom: 4 }}>YOU</div>
                        <div style={{ color: GOLD, fontSize: 36, fontWeight: 900 }}>
                          {WAR_RANKS[Number(result.fields.player_card)] ?? "?"}
                        </div>
                      </div>
                      <div style={{ color: "#555", fontSize: 18 }}>VS</div>
                      <div>
                        <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.08em", marginBottom: 4 }}>DEALER</div>
                        <div style={{ color: result.payout > 0 ? ACCENT : BLUE, fontSize: 36, fontWeight: 900 }}>
                          {WAR_RANKS[Number(result.fields.dealer_card)] ?? "?"}
                        </div>
                      </div>
                    </div>
                    <div style={{ color: "#888", fontSize: 11, marginTop: 6 }}>
                      {Number(result.fields.player_card) > Number(result.fields.dealer_card)
                        ? "HIGHER — WIN"
                        : Number(result.fields.player_card) === Number(result.fields.dealer_card)
                        ? "TIE — HALF BACK"
                        : "LOWER — LOSS"}
                    </div>
                  </div>
                )}
                {result && game === "baccarat" && (() => {
                  const pCards = Array.isArray(result.fields.player_cards) ? (result.fields.player_cards as number[]) : [];
                  const bCards = Array.isArray(result.fields.banker_cards) ? (result.fields.banker_cards as number[]) : [];
                  // Contract baccarat.move result enum: 0=PLAYER win, 1=BANKER win, 2=TIE.
                  const resultNum = Number(result.fields.result);
                  const resultLabel = resultNum === 0 ? "PLAYER WINS" : resultNum === 1 ? "BANKER WINS" : "TIE";
                  const resultColor = resultNum === 2 ? GOLD : resultNum === 0 ? GREEN : ACCENT;
                  // Cards for baccarat use 0-51 encoding (rank=idx%13, suit=idx/13), ranks 0=Ace..12=K
                  const BACC_RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
                  const cardLabel = (c: number) => BACC_RANKS[c % 13] ?? "?";
                  return (
                    <div style={{ padding: "14px 0 4px" }}>
                      <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 8 }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.08em", marginBottom: 4 }}>PLAYER · {String(result.fields.player_score)}</div>
                          <div style={{ color: BLUE, fontSize: 22, fontWeight: 900, letterSpacing: "0.15em" }}>
                            {pCards.map(cardLabel).join(" ")}
                          </div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.08em", marginBottom: 4 }}>BANKER · {String(result.fields.banker_score)}</div>
                          <div style={{ color: ACCENT, fontSize: 22, fontWeight: 900, letterSpacing: "0.15em" }}>
                            {bCards.map(cardLabel).join(" ")}
                          </div>
                        </div>
                      </div>
                      <div style={{ color: resultColor, fontSize: 20, fontWeight: 900, textAlign: "center", letterSpacing: "0.08em" }}>
                        {resultLabel}
                      </div>
                    </div>
                  );
                })()}
                {result && game === "three_card_poker" && (() => {
                  const pCards = Array.isArray(result.fields.player_cards) ? (result.fields.player_cards as number[]) : [];
                  const dCards = Array.isArray(result.fields.dealer_cards) ? (result.fields.dealer_cards as number[]) : [];
                  const TCP_RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
                  const cardLabel = (c: number) => TCP_RANKS[c % 13] ?? "?";
                  const resNum = Number(result.fields.result);
                  const resLabel = resNum === 0 ? "LOSS" : resNum === 1 ? "PUSH" : "WIN";
                  const resColor = resNum === 0 ? ACCENT : resNum === 1 ? GOLD : GREEN;
                  return (
                    <div style={{ padding: "14px 0 4px" }}>
                      <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 8 }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.08em", marginBottom: 4 }}>
                            YOU · {THREE_CARD_RANKS[Number(result.fields.player_rank)] ?? "?"}
                          </div>
                          <div style={{ color: BLUE, fontSize: 22, fontWeight: 900, letterSpacing: "0.15em" }}>
                            {pCards.map(cardLabel).join(" ")}
                          </div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.08em", marginBottom: 4 }}>
                            DEALER · {THREE_CARD_RANKS[Number(result.fields.dealer_rank)] ?? "?"}
                            {result.fields.dealer_qualified ? " · Q+" : " · no qualify"}
                          </div>
                          <div style={{ color: ACCENT, fontSize: 22, fontWeight: 900, letterSpacing: "0.15em" }}>
                            {dCards.map(cardLabel).join(" ")}
                          </div>
                        </div>
                      </div>
                      <div style={{ color: resColor, fontSize: 20, fontWeight: 900, textAlign: "center", letterSpacing: "0.08em" }}>
                        {resLabel}
                      </div>
                    </div>
                  );
                })()}

                
                {result && game === "dragon_tiger" && (() => {
                  const dr = Number(result.fields.dragon_rank);
                  const tr = Number(result.fields.tiger_rank);
                  const bt = Number(result.fields.bet_type);
                  const isTie = dr === tr;
                  const betLabel = (DRAGON_TIGER_BET_LABELS as string[])[bt] ?? "?";
                  const payout = Number(result.fields.payout);
                  const resColor = payout > 0 ? GREEN : (isTie && bt !== 2) ? GOLD : ACCENT;
                  const resLabel = payout > 0 ? "WIN" : (isTie && bt !== 2) ? "HALF RETURNED" : "LOSS";
                  return (
                    <div style={{ padding: "14px 0 4px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 8 }}>
                        <div>
                          <div style={{ color: "#666", fontSize: 10, marginBottom: 4 }}>DRAGON</div>
                          <div style={{ color: dr >= tr ? GREEN : ACCENT, fontSize: 28, fontWeight: 900 }}>
                            {(WAR_RANKS_13 as string[])[dr] ?? "?"}
                          </div>
                        </div>
                        <div style={{ color: "#555", fontSize: 22, fontWeight: 900, paddingTop: 20 }}>VS</div>
                        <div>
                          <div style={{ color: "#666", fontSize: 10, marginBottom: 4 }}>TIGER</div>
                          <div style={{ color: tr >= dr ? GREEN : ACCENT, fontSize: 28, fontWeight: 900 }}>
                            {(WAR_RANKS_13 as string[])[tr] ?? "?"}
                          </div>
                        </div>
                      </div>
                      <div style={{ color: "#666", fontSize: 9, marginBottom: 4 }}>BET: {betLabel}</div>
                      <div style={{ color: resColor, fontSize: 20, fontWeight: 900 }}>{resLabel}</div>
                    </div>
                  );
                })()}

                {result && game === "under_over_7" && (() => {
                  const d1 = Number(result.fields.d1);
                  const d2 = Number(result.fields.d2);
                  const sum = d1 + d2;
                  const kind = Number(result.fields.kind);
                  const kindLabel = ["UNDER","EXACTLY 7","OVER"][kind] ?? "?";
                  const won = Number(result.fields.payout) > 0;
                  const zoneColor = sum === 7 ? GOLD : sum < 7 ? GREEN : ACCENT;
                  return (
                    <div style={{ padding: "14px 0 4px", textAlign: "center" }}>
                      <div style={{ color: "#666", fontSize: 10, marginBottom: 4 }}>BET: {kindLabel}</div>
                      <div style={{ fontSize: 10, color: "#666" }}>{d1} + {d2}</div>
                      <div style={{ color: zoneColor, fontSize: 36, fontWeight: 900 }}>{sum}</div>
                      <div style={{ color: won ? GREEN : ACCENT, fontSize: 18, fontWeight: 900, marginTop: 4 }}>
                        {won ? "WIN" : "LOSS"}
                      </div>
                    </div>
                  );
                })()}

                {result && game === "ore_refine" && (() => {
                  const outcome = Number(result.fields.outcome);
                  const tier = Number(result.fields.tier);
                  const tierLabel = (ORE_REFINE_TIER_LABELS as string[])[tier - 1] ?? "?";
                  const outcomeLabel = (ORE_REFINE_OUTCOME_LABELS as string[])[outcome] ?? "?";
                  const outcomeColor = ["#cc3333","#cc8833",GREEN,GOLD][outcome] ?? GOLD;
                  return (
                    <div style={{ padding: "14px 0 4px", textAlign: "center" }}>
                      <div style={{ color: "#666", fontSize: 10, marginBottom: 4 }}>
                        INTENSITY: <span style={{ color: GOLD }}>{tierLabel}</span>
                      </div>
                      <div style={{ color: outcomeColor, fontSize: 24, fontWeight: 900, letterSpacing: "0.06em" }}>
                        {outcomeLabel}
                      </div>
                    </div>
                  );
                })()}

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

          {/* HiLo — live two-step: base card dealt first, then the call */}
          {game === "hilo" && !hiloLive && (
            <div style={{ color: "#888", fontSize: 11, marginBottom: 12, lineHeight: 1.6 }}>
              Place your bet to deal the <span style={{ color: GOLD }}>base card</span> — then call
              HIGHER or LOWER with the card in view. Equal rank = push (stake returned).
            </div>
          )}
          {game === "hilo" && hiloLive && (() => {
            const hiMult = hiloCallMultiplier(hiloLive.base, true);
            const loMult = hiloCallMultiplier(hiloLive.base, false);
            const callBtn = (enabled: boolean): React.CSSProperties => ({
              flex: "1 1 120px", background: "#181828", border: `1px solid ${enabled ? GOLD : "#333"}`,
              color: enabled ? GOLD : "#555", fontSize: 13, fontWeight: 800, letterSpacing: "0.08em",
              padding: "12px 10px", cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.4,
            });
            return (
              <div style={{ marginBottom: 12, textAlign: "center" }}>
                <div style={{ color: "#666", fontSize: 9, letterSpacing: "0.1em", marginBottom: 6 }}>
                  BASE CARD · {fmtEve(hiloLive.wager)} EVE STAKED
                </div>
                <div style={{
                  width: 58, height: 76, margin: "0 auto 12px", background: "#181828",
                  border: `2px solid ${GOLD}`, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 14px ${GOLD}55`,
                  animation: "cas-card-flip 0.4s ease, cas-pop 0.3s ease 0.15s both",
                }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: GOLD }}>{HILO_RANKS[hiloLive.base] ?? "?"}</div>
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <button disabled={busy || hiMult <= 0} onClick={() => settleHiLo(true)} style={callBtn(!busy && hiMult > 0)}>
                    ▲ HIGHER {hiMult > 0 ? `· ${hiMult.toFixed(2)}x` : "· —"}
                  </button>
                  <button disabled={busy || loMult <= 0} onClick={() => settleHiLo(false)} style={callBtn(!busy && loMult > 0)}>
                    ▼ LOWER {loMult > 0 ? `· ${loMult.toFixed(2)}x` : "· —"}
                  </button>
                </div>
                <div style={{ color: "#666", fontSize: 10, marginTop: 6 }}>
                  {busy ? "SIGNING…" : "Same rank = push — stake returned."}
                </div>
              </div>
            );
          })()}

          {/* Plinko — risk mode selector */}
          {game === "plinko" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 6 }}>RISK MODE</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PLINKO_MODES.map((m) => (
                  <button key={m.mode} onClick={() => setPlinkoMode(m.mode)} style={pick(plinkoMode === m.mode)}>
                    {m.label} <span style={{ color: "#777" }}>{m.maxMult}x</span>
                  </button>
                ))}
              </div>
              <div style={{ color: "#666", fontSize: 10, marginTop: 6 }}>
                {plinkoMode === 0 ? "Grinder table — every bucket pays at least 0.85x, edges pay 5x."
                  : plinkoMode === 1 ? "Center pays nothing — edges hit 100x."
                  : plinkoMode === 2 ? "Boom or bust — center zone pays 0, edge jackpot 500x."
                  : "The original board — 130x edge jackpots, 0.49x center."}
              </div>
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

          {/* Crash */}
          {game === "crash" && (() => {
            const CRASH_LOG_BASE = Math.log(10_000_000 / 101);
            const crashSliderToMult = (s: number) => Math.round(101 * Math.exp((s / 10000) * CRASH_LOG_BASE));
            const crashMultToSlider = (bps: number) => Math.round(10000 * Math.log(Math.max(101, bps) / 101) / CRASH_LOG_BASE);
            const cMult = crashBps / 10000;
            const winChance = (100 / cMult).toFixed(1);
            return (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 6 }}>TARGET MULTIPLIER</div>
                <input
                  type="range" min={0} max={10000}
                  value={crashMultToSlider(crashBps)}
                  onChange={(e) => setCrashBps(Math.max(101, Math.min(10_000_000, crashSliderToMult(Number(e.target.value)))))}
                  style={{ width: "100%", accentColor: ACCENT }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <div style={{ color: ACCENT, fontSize: 20, fontWeight: 900 }}>{cMult.toFixed(2)}x</div>
                  <div style={{ color: "#888", fontSize: 11 }}>~{winChance}% win chance</div>
                  <div style={{ color: "#888", fontSize: 11 }}>pays ~{(cMult * 0.97).toFixed(2)}x</div>
                </div>
                <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                  {[1.5, 2, 3, 5, 10, 50, 100].map((m) => (
                    <button key={m} onClick={() => setCrashBps(Math.round(m * 10000))} style={{ ...numChip(Math.abs(crashBps / 10000 - m) < 0.05), fontSize: 10, padding: "5px 6px" }}>{m}x</button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Double Dice */}
          {game === "double_dice" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 6 }}>BET KIND</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {DOUBLE_DICE_KINDS.map((k) => (
                  <button key={k.kind} onClick={() => setDoubleDiceKind(k.kind)} style={pick(doubleDiceKind === k.kind)}>
                    {k.label}
                  </button>
                ))}
              </div>
              {doubleDiceKind === 4 && (
                <div>
                  <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 6 }}>
                    EXACT SUM · pays ~{doubleDiceExactMult(doubleDiceTarget).toFixed(2)}x
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => (
                      <button key={s} onClick={() => setDoubleDiceTarget(s)} style={numChip(doubleDiceTarget === s)}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {doubleDiceKind !== 4 && (
                <div style={{ color: "#666", fontSize: 11 }}>
                  pays ~{DOUBLE_DICE_KINDS[doubleDiceKind]?.grossMult ?? 2.3}x
                </div>
              )}
            </div>
          )}

          {/* Baccarat */}
          {game === "baccarat" && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 6 }}>BET ON</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {BACCARAT_KINDS.map((k) => (
                  <button key={k.kind} onClick={() => setBaccaratKind(k.kind)} style={pick(baccaratKind === k.kind)}>
                    {k.label} <span style={{ color: "#777" }}>{k.mult}x</span>
                  </button>
                ))}
              </div>
              <div style={{ color: "#666", fontSize: 10, marginTop: 6 }}>
                Closest to 9 wins. Face cards = 0. Natural 8/9 auto-wins.
              </div>
            </div>
          )}

          {/* Diamonds / War / Three Card Poker — no extra controls, just the bet */}
          {(game === "diamonds" || game === "war" || game === "three_card_poker") && null}

          {/* Dragon Tiger — bet type selector */}
          {game === "dragon_tiger" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {([["DRAGON", 0], ["TIGER", 1], ["TIE (9x)", 2]] as [string, 0|1|2][]).map(([label, v]) => (
                <button key={v} onClick={() => setDragonTigerBet(v)} style={{
                  flex: "1 1 80px", padding: "8px 4px", background: dragonTigerBet === v ? "#FF4700" : "#1a1a1a",
                  border: `1px solid ${dragonTigerBet === v ? "#FF4700" : "#333"}`,
                  color: dragonTigerBet === v ? "#fff" : "#aaa", borderRadius: 4, cursor: "pointer",
                  fontSize: 12, fontWeight: 700, letterSpacing: "0.06em",
                }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Under/Over 7 — kind selector */}
          {game === "under_over_7" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {([["UNDER (2.32x)", 0], ["EXACTLY 7 (5.7x)", 1], ["OVER (2.32x)", 2]] as [string, 0|1|2][]).map(([label, v]) => (
                <button key={v} onClick={() => setUnderOver7Kind(v)} style={{
                  flex: "1 1 80px", padding: "8px 4px", background: underOver7Kind === v ? "#FF4700" : "#1a1a1a",
                  border: `1px solid ${underOver7Kind === v ? "#FF4700" : "#333"}`,
                  color: underOver7Kind === v ? "#fff" : "#aaa", borderRadius: 4, cursor: "pointer",
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Ore Refine — tier selector */}
          {game === "ore_refine" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em" }}>REFINE INTENSITY</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {([
                  ["BASIC", 1, "2x", "#3FCF6A"],
                  ["STANDARD", 2, "4x", "#7FC8FF"],
                  ["ADVANCED", 3, "6x", "#E8B84B"],
                  ["INDUSTRIAL", 4, "15x", "#FF4700"],
                  ["CRITICAL", 5, "20x", "#cc3333"],
                ] as [string, 1|2|3|4|5, string, string][]).map(([label, v, mult, col]) => (
                  <button key={v} onClick={() => setOreTier(v)} style={{
                    flex: "1 1 60px", padding: "8px 4px",
                    background: oreTier === v ? col + "22" : "#1a1a1a",
                    border: `1px solid ${oreTier === v ? col : "#333"}`,
                    color: oreTier === v ? col : "#888", borderRadius: 4, cursor: "pointer",
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1.4,
                    textAlign: "center",
                  }}>
                    <div>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{mult}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bet input (all games; hidden mid-hand in live hi-lo — stake already escrowed) */}
          {!(game === "hilo" && hiloLive) && (<>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 160px" }}>
              <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.06em", marginBottom: 4 }}>BET ($EVE) · you have {fmtEve(myEve)}</div>
              <input
                value={betEve}
                onChange={(e) => setBetEve(e.target.value)}
                inputMode="decimal"
                style={{ background: "#161616", border: `1px solid ${ACCENT}33`, color: ACCENT, fontSize: 14, padding: "9px 12px", outline: "none", width: "100%", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {betPresets({ bank, grossMult, maxBet: houseQ.data?.maxBet, minBet: houseQ.data?.minBet, walletEve: myEve }).map((v, i, arr) => (
                  <button key={v} onClick={() => setBetEve(String(v))} style={{ background: "#1a1a1a", border: `1px solid ${i === arr.length - 1 ? GOLD : ACCENT}44`, color: i === arr.length - 1 ? GOLD : ACCENT, fontSize: 12, padding: "8px 12px", cursor: "pointer" }}>{i === arr.length - 1 ? `MAX ${fmtEve(v)}` : fmtEve(v)}</button>
                ))}
              </div>
            </label>
          </div>

          {/* Sticky action area — total cost + play button always visible */}
          <div style={{ position: "sticky", bottom: 0, zIndex: 5, background: "#111", paddingTop: 8, borderTop: "1px solid #1a1a1a" }}>
            {game === "plinko" && plinkoDrops > 1 && betNum > 0 && (
              <div style={{ marginBottom: 6, padding: "8px 12px", background: "#1a1408", border: `1px solid ${GOLD}55`, textAlign: "center", fontSize: 13, fontWeight: 800, letterSpacing: "0.05em", color: GOLD, fontFamily: "monospace" }}>
                {plinkoDrops} BALLS × {betEve} EVE = {fmtEve(betNum * plinkoDrops)} EVE TOTAL
              </div>
            )}
            <button
              disabled={busy || !addr || overExposure || overHouseMaxBet || (!!pending && !result)}
              onClick={play}
              style={{ marginTop: 4, width: "100%", background: `linear-gradient(180deg, ${ACCENT}, #b83400)`, border: "none", color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "0.1em", padding: "13px", cursor: "pointer", opacity: busy || !addr || overExposure || overHouseMaxBet ? 0.5 : 1 }}
            >
              {busy ? "SIGNING…" : (game === "slots" || game === "plinko" || game === "wheel") ? "✦ SPIN" : game === "hilo" ? "✦ DEAL BASE CARD" : "✦ PLAY"}
            </button>
          </div>
          </>)}

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
          {overHouseMaxBet && (
            <div style={{ color: GOLD, fontSize: 12, marginTop: 8, lineHeight: 1.6, background: "#1a1408", border: `1px solid ${GOLD}44`, padding: "10px 12px" }}>
              <div style={{ fontWeight: 800, letterSpacing: "0.06em" }}>⚠ BET TOO LARGE — HOUSE PER-BALL CAP</div>
              <div style={{ marginTop: 4, color: "#c9b478" }}>
                The house maximum is <b>{fmtEve(houseMaxBetEve)} EVE per ball</b>.
                Your per-ball bet of <b>{fmtEve(betNum)} EVE</b> exceeds this limit.
                Lower your per-ball bet to {fmtEve(Math.min(maxBetForExposure, houseMaxBetEve))} EVE or less.
              </div>
            </div>
          )}
          {game === "slots" ? <SlotsPaytable /> : <GamePaytable game={game} />}
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
