import { PRACTICE_CATALOG } from "../lib/casinoExperienceCatalog";
import { casinoLaunchGame } from "../lib/casinoStationSession";
import { CasinoCraps, CrapsTile } from "./CasinoCraps";
import { crapsEscrow, evaluateCraps } from "../lib/casinoCraps";
import { slotRevealMs, type SlotMotionRun } from "../lib/casinoSlotMotion";
import { slotAwaitingCollection } from "../lib/casinoSlotIdentity";
import { FleetBoard, FleetRules, FleetTile } from "./CasinoSlotFleet";
import { FLEET, isFleet } from "../lib/casinoSlotFleet";
import { CasinoPackControls } from "./CasinoPackControls";
import { CasinoScratchPack } from "./CasinoScratchPack";
import {
  SESSION_KEY,
  OPTIONS_KEY,
  restoreOptions,
  PROFILES,
  activeSession,
  pendingSlot,
  pendingClassicSpin,
  pendingScratch,
  pendingSpinRun,
  scratchRevealed,
  startSpinRun,
  advanceSpinRun,
  stopSpinRun,
  revealClassicSpin,
  revealScratch,
  spinRunTotals,
  wagerLabel,
  isSlotGame,
  revealSlot,
  actSession,
  playSession,
  restoreSession,
  initialSession,
  packTotal,
  sum,
  type Session,
  type Options,
} from "../lib/casinoSessions";
import {
  tableActionAllowed,
  type TableAction,
} from "../lib/casinoBlackjackTable";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HouseDonatePanel } from "./HouseDonatePanel";
import { CasinoPanel } from "./CasinoPanel";
import { CasinoRoundStage } from "./CasinoRoundStage";
import { CasinoRoundSummary, CasinoRoundHistory } from "./CasinoRoundSummary";
import { roundCue, type PayoutEvent } from "../lib/casinoResultFeedback";
import { ExpandedOptions } from "./CasinoExpandedOptions";
import {
  EXPANSION_RULES,
  TESTNET_QUARANTINE,
} from "../lib/casinoExpansionRules";
import { KENO_TABLE } from "../lib/casinoExpanded";
import { CasinoPlinko } from "./CasinoPlinko";
import { PLINKO_REVEAL_MS } from "../lib/plinkoMotion";
import { ItemIcon } from "./GameIcon";
import { CASINO_CATALOG, CATEGORY_LABELS } from "../lib/casinoCatalog";
import { CasinoFeedback, useCasinoFeedback } from "../lib/casinoFeedback";
import {
  CASINO_SYMBOLS,
  fetchLoungeHouse,
  LOUNGE_NAMES,
  testnetHouseReady,
} from "../lib/casinoLounge";
import {
  PRACTICE_GAMES,
  PRACTICE_KEY,
  cardTotal,
  chipLabel,
  practiceBet,
  SLOT_BPS,
  type PracticeGame,
  type Round,
} from "../lib/casinoPractice";
import "../styles/casino-lounge.css";
import "../styles/casino-table-motion.css";
import { useCasinoTimeline } from "./useCasinoTimeline";
import { CasinoBlackjackMotion } from "./CasinoBlackjackMotion";
import {
  tableDuration,
  blackjackPlan,
  STILL_RUN,
  type TableRun,
} from "../lib/casinoTableMotion";
const base = import.meta.env.BASE_URL;
const titles = (key: string) =>
  (isFleet(key)
    ? { title: FLEET[key].name, tag: "SLOT FLEET", icon: FLEET[key].icon }
    : LOUNGE_NAMES[key]) ?? {
    title: CASINO_CATALOG.find((g) => g.key === key)?.name ?? key,
    tag: "TABLE",
    icon: 72244,
  };
function initial() {
  try {
    return restoreSession(
      sessionStorage.getItem(SESSION_KEY),
      sessionStorage.getItem(PRACTICE_KEY),
    );
  } catch {
    return initialSession();
  }
}
function PlayingCard({
  value,
  hidden = false,
  war = false,
}: {
  value: number;
  hidden?: boolean;
  war?: boolean;
}) {
  const rank = war
    ? ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"][value]
    : ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][
        value % 13
      ];
  const suit = war ? 0 : Math.floor(value / 13),
    ship = war ? 87848 : [82425, 87848, 81611, 84955][suit];
  return (
    <div
      className={`lounge-playing-card ${hidden ? "card-back" : ""}`}
      aria-label={
        hidden
          ? "Hidden dealer card"
          : `${rank} ${["Frigates", "Raiders", "Freighters", "Gates"][suit]}`
      }
    >
      {hidden ? (
        <>
          <span>CRADLE</span>
          <ItemIcon typeId={72244} size={62} />
          <span>◇</span>
        </>
      ) : (
        <>
          <b>
            {rank}
            <small>{["◇", "✦", "◉", "▣"][suit]}</small>
          </b>
          <ItemIcon typeId={ship} size={74} />
          <b className="card-corner">{rank}</b>
        </>
      )}
    </div>
  );
}
function CardRow({
  label,
  cards,
  hidden = false,
  war = false,
}: {
  label: string;
  cards: number[];
  hidden?: boolean;
  war?: boolean;
}) {
  return (
    <div className="lounge-card-row">
      <span className="lounge-eyebrow">
        {label}{" "}
        {!war && cards.length > 0 && (
          <strong>{hidden ? "?" : cardTotal(cards)}</strong>
        )}
      </span>
      <div>
        {cards.map((c, i) => (
          <PlayingCard key={i} value={c} hidden={hidden && i === 1} war={war} />
        ))}
      </div>
    </div>
  );
}
function GameSurface({
  game,
  state,
  result,
  busy,
  reducedMotion,
  selectedProfile,
  slotRun,
  onNextSlot,
  tableRun,
  onScratchReveal,
}: {
  game: PracticeGame;
  state: Session;
  result: Round | null;
  busy: boolean;
  reducedMotion: boolean;
  selectedProfile: keyof typeof PROFILES;
  slotRun: SlotMotionRun;
  onNextSlot: () => void;
  tableRun: TableRun;
  onScratchReveal: (index?: number) => boolean;
}) {
  const pack = state.pack?.game === game ? state.pack : null;
  const [receiptTicket, setReceiptTicket] = useState(0);
  const { t: kenoT } = useCasinoTimeline(
    tableRun,
    busy && game === "keno",
    reducedMotion,
  );
  useEffect(() => setReceiptTicket(0), [pack]);
  if (isFleet(game))
    return (
      <FleetBoard
        game={game}
        receipt={pack?.slot}
        busy={busy}
        reduced={reducedMotion}
        run={slotRun}
        onNextSlot={onNextSlot}
      />
    );
  if (game === "keno" && pack) {
    const ticket = Math.min(receiptTicket, pack.rounds.length - 1),
      round = pack.rounds[ticket];
    return (
      <div className="casino-keno-pack">
        <div
          className="casino-option-row"
          role="group"
          aria-label="View ticket result"
        >
          {pack.rounds.map((r, i) => (
            <button
              key={r.id}
              aria-pressed={i === ticket}
              onClick={() => setReceiptTicket(i)}
            >
              Ticket {i + 1} ·{" "}
              {
                r.values
                  .slice(-10)
                  .slice(0, Math.min(10, Math.floor(kenoT * 11)))
                  .filter((n) => r.values.slice(1, 1 + r.values[0]).includes(n))
                  .length
              }
              /{r.values[0]}
            </button>
          ))}
        </div>
        <small className="casino-board-caption">
          Ticket {ticket + 1} outlined · same shared draw
        </small>
        <CasinoRoundStage
          game="keno"
          round={round}
          busy={busy}
          reduced={reducedMotion}
          run={tableRun}
        />
        {!busy && (
          <p className="casino-board-caption">
            {round.label} · Return {chipLabel(round.payout)} chips
          </p>
        )}
      </div>
    );
  }

  if (game === "scratch_cards" && pack)
    return (
      <CasinoScratchPack
        key={pack.rounds[0].id}
        rounds={pack.rounds}
        revealed={scratchRevealed(state)}
        busy={busy}
        onReveal={onScratchReveal}
      />
    );
  if (game === "blackjack" && (state.table || pack?.table))
    return (
      <CasinoBlackjackMotion
        state={state}
        run={tableRun}
        busy={busy}
        reduced={reducedMotion}
      />
    );
  if (game === "blackjack") {
    const values = result?.values ?? [],
      separator = values.indexOf(-1),
      cut = separator < 0 ? 2 : separator;
    const player = state.hand?.player ?? values.slice(0, cut),
      dealer = state.hand?.dealer ?? values.slice(separator < 0 ? 2 : cut + 1);
    return (
      <div className="lounge-blackjack">
        <CardRow label="Dealer" cards={dealer} hidden={activeSession(state)} />
        <div className="felt-line">
          <span>BLACKJACK PAYS 3:2</span>
        </div>
        <CardRow label="Your hand" cards={player} />
        {!player.length && (
          <div className="table-ready">
            <ItemIcon typeId={82425} size={110} />
            <span>Take a seat at the command deck.</span>
          </div>
        )}
      </div>
    );
  }
  if (game === "roulette" && pack)
    return (
      <>
        <CasinoRoundStage
          game={game}
          round={pack.rounds[0]}
          busy={busy}
          reduced={reducedMotion}
          run={tableRun}
        />
        {!busy && (
          <div
            className="roulette-settled-wagers"
            aria-label="Settled selections"
          >
            {pack.rounds.map((r, i) => (
              <span key={r.id} className={r.payout > 0 ? "wager-paid" : ""}>
                {wagerLabel(pack.wagers![i])} · {chipLabel(r.payout)} chips
              </span>
            ))}
          </div>
        )}
      </>
    );
  if (game === "plinko") {
    const previousProfile = pack?.profile ?? "Low";
    const preview =
      !busy &&
      (state.history[0]?.game !== "plinko" ||
        previousProfile !== selectedProfile);
    const profile = preview ? selectedProfile : (pack?.profile ?? "Low");
    return (
      <>
        <small className="casino-board-caption">
          {preview ? "Next drop preview" : "Last drop"} · {profile}
        </small>
        <CasinoPlinko
          round={
            preview
              ? null
              : state.history[0]?.game === "plinko"
                ? state.history[0]
                : null
          }
          rounds={preview ? undefined : pack?.rounds}
          profile={profile}
          payouts={PROFILES[profile]}
          busy={busy}
          reducedMotion={reducedMotion}
          run={tableRun}
        />
      </>
    );
  }
  return (
    <CasinoRoundStage
      game={game}
      round={
        pendingClassicSpin(state) && !busy
          ? null
          : state.history[0]?.game === game
            ? state.history[0]
            : null
      }
      busy={busy}
      reduced={reducedMotion}
      run={tableRun}
      choice={tableRun.choice}
    />
  );
}

function Rules({ game, picks }: { game: PracticeGame; picks: number[] }) {
  if (isFleet(game)) return <FleetRules game={game} />;
  const text: Partial<Record<PracticeGame, string>> = {
    ...EXPANSION_RULES,
    slots:
      "Three independent 16-stop reels. Symbol weights: 4, 3, 3, 2, 2, 1, 1. Exactly two matching symbols return 1.8×. Triple returns are shown below.",
    blackjack:
      "Single shuffled deck. Dealer stands on all 17s. Blackjack returns 2.5× (3:2 profit); a normal win 2×; a push returns your stake. Double on the first two cards. Up to 3 seats share one shoe and dealer. Split an exact-rank pair once per seat; no resplits. Split aces get one card each. Double only an unsplit first-two-card hand. All returns settle together. No insurance. Existing saved legacy hands keep their original no-split rules.",
    roulette:
      "European single-zero wheel. Combine number (36×), color, odd/even, high/low (2×), dozen and column bets (3×) on one spin. Zero loses all outside bets. Repeated chips merge up to 1,000 chips per selection. Repeat only copies selections; it never spins.",
    coinflip:
      "Heads and tails each have a 50% chance. A correct call returns 1.96× your stake.",
    dice: "Roll an integer from 1 to 100. Over and under are strict: matching the target loses. A win returns 98 ÷ win-chance-percent times your stake.",
    wheel:
      "20 equally likely sectors: twelve blanks, five 1.2×, two 1.6×, one 10×.",
    plinko:
      "Choose Classic, Low, Medium or High risk, with 1, 3, 5 or 10 balls. Twelve independent left/right bounces; the bucket is the number of right bounces. The landing multipliers are shown on the board.",
    war: "Two independent card ranks, 2 low through Ace high. Higher returns 2×; a tie returns only half your stake.",
  };
  return (
    <details className="lounge-rules">
      <summary>
        Rules &amp; payouts <span>＋</span>
      </summary>
      <p>{text[game]}</p>
      {game === "keno" && (
        <div className="lounge-paytable">
          {KENO_TABLE[(picks.length || 1) - 1].map((bps, i) => (
            <div key={i}>
              <span>{i} matches</span>
              <b>{bps / 10000}×</b>
            </div>
          ))}
        </div>
      )}
      {game === "slots" && (
        <div className="lounge-paytable">
          {CASINO_SYMBOLS.map((s, i) => (
            <div key={s.id}>
              <ItemIcon typeId={s.id} />
              <span>3 × {s.name}</span>
              <b>{SLOT_BPS[i] / 10000}×</b>
            </div>
          ))}
        </div>
      )}
      <p>
        All multipliers are total returns, including the stake. Practice uses
        local random draws, rounded down to 0.01 chip—not on-chain randomness.
        Free chips have no cash or $EVE value.
      </p>
    </details>
  );
}
function useLoungeHouse(enabled: boolean) {
  return useQuery({
    queryKey: ["casino-lounge-house"],
    queryFn: fetchLoungeHouse,
    enabled,
    refetchInterval: enabled ? 30000 : false,
    retry: 1,
  });
}
function TestnetStatus({ q }: { q: ReturnType<typeof useLoungeHouse> }) {
  const h = q.data,
    ready = testnetHouseReady(h) && !q.isError;
  return (
    <div className="lounge-chain-status" role="status">
      <div>
        <span className={`status-dot ${ready ? "ready" : ""}`} />
        <strong>
          {q.isPending
            ? "Checking testnet house"
            : q.isError
              ? "Testnet status unavailable"
              : ready
                ? "$EVE Testnet ready"
                : h?.paused
                  ? "$EVE Testnet · house paused"
                  : "$EVE Testnet · setup pending"}
        </strong>
        <p>
          {q.isError
            ? "Unable to verify the house. No wagers enabled."
            : h
              ? `Bankroll: ${(Number(h.bank) / 1e9).toLocaleString()} $EVE · Sui Testnet · Cycle 7`
              : "Reading the current-cycle house…"}
        </p>
        {h && !ready && (
          <p>
            Wagering is paused for contract security repairs and bankroll setup.
            Play Money is available now.
          </p>
        )}
      </div>
      <button onClick={() => void q.refetch()} disabled={q.isFetching}>
        Refresh status
      </button>
    </div>
  );
}
export function CasinoExperience({
  initialGame,
  onReturnToStation,
}: {
  initialGame?: string;
  onReturnToStation?: () => void;
} = {}) {
  const [state, setState] = useState(initial),
    current = useRef<Session>(state);
  const [mode, setMode] = useState<"practice" | "testnet" | "donate">(
    "practice",
  );
  const [game, setGame] = useState<string | null>(() =>
    casinoLaunchGame(state, initialGame),
  );
  const [category, setCategory] = useState("all"),
    [search, setSearch] = useState("");
  const [stake, setStake] = useState(() =>
      String((state.spinRun?.stake ?? 2500) / 100),
    ),
    [side, setSide] = useState(0),
    [target, setTarget] = useState(50),
    [over, setOver] = useState(true);
  const [options, setOptions] = useState<Options>(() => {
    try {
      return restoreOptions(sessionStorage.getItem(OPTIONS_KEY), state);
    } catch {
      return restoreOptions(null, state);
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
    } catch {
      /* Preferences cannot block or overwrite the ledger. */
    }
  }, [options]);
  const [picks, setPicks] = useState<number[]>([7, 17, 27]);
  const [busy, setBusy] = useState(false),
    busyRef = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotGeneration = useRef(0);
  const [slotRun, setSlotRun] = useState<SlotMotionRun>({ id: 0, started: 0 });
  const [tableRun, setTableRun] = useState<TableRun>(STILL_RUN);
  const tableGeneration = useRef(0);
  const [autoRun, setAutoRun] = useState(false),
    autoRef = useRef(false),
    autoGeneration = useRef(0);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function pauseRun() {
    autoRef.current = false;
    autoGeneration.current++;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    setAutoRun(false);
  }
  function resumeRun() {
    if (
      document.hidden ||
      !pendingSpinRun(current.current) ||
      pendingSlot(current.current) ||
      pendingClassicSpin(current.current)
    )
      return;
    autoRef.current = true;
    autoGeneration.current++;
    setAutoRun(true);
  }
  function stopRun() {
    pauseRun();
    try {
      commit(stopSpinRun(current.current));
      setError("");
    } catch {
      setError(
        "Run paused. Storage unavailable; retry Stop to save cancellation. No future spins will start.",
      );
    }
  }
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) pauseRun();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      autoRef.current = false;
      autoGeneration.current++;
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, []);
  const payoutGeneration = useRef(0);
  const [payoutEvent, setPayoutEvent] = useState<PayoutEvent | undefined>();
  const beginSlotMotion = () => {
    const run = { id: ++slotGeneration.current, started: performance.now() };
    setSlotRun(run);
    return run;
  };
  const chainBusyRef = useRef(false);
  const [chainBusy, setChainBusy] = useState(false),
    [error, setError] = useState(state.notice ?? ""),
    [resetConfirm, setResetConfirm] = useState(false);
  const [reduce, setReduce] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const feedback = useCasinoFeedback();
  const houseQuery = useLoungeHouse(mode === "testnet");
  const wageringReady =
    mode === "testnet" &&
    testnetHouseReady(houseQuery.data) &&
    !houseQuery.isError &&
    !houseQuery.isFetching;
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)"),
      change = () => setReduce(mq.matches);
    mq.addEventListener("change", change);
    return () => {
      mq.removeEventListener("change", change);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const locked = busy || chainBusy || activeSession(state);
  const commit = (next: Session) => {
    // Tab-scoped: simultaneous tabs never race to overwrite one shared balance.
    // Fail before changing UI if durable hand/outcome storage is unavailable.
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    current.current = next;
    setState(next);
  };
  function navigate(key: string | null) {
    if (locked || busyRef.current || activeSession(current.current)) return;
    setPayoutEvent(undefined);
    setGame(key);
    setTableRun(STILL_RUN);
    setOptions((o) => ({ ...o, count: 1 }));
    setSide(0);
    setTarget(
      key === "dice" ? 50 : key === "crash" || key === "limbo" ? 200 : 2,
    );
    setPicks([7, 17, 27]);
    setError("");
    feedback.play("select");
  }
  function changeMode(value: typeof mode) {
    if (locked || busyRef.current || activeSession(current.current)) return;
    setPayoutEvent(undefined);
    setMode(value);
    setGame(null);
    setCategory("all");
    setSearch("");
    setError("");
    feedback.play("select");
  }
  function presentRound(
    round: Pick<Round, "id" | "game" | "payout" | "stake">,
  ) {
    feedback.play(
      roundCue(round),
      isFleet(round.game) ? round.game : undefined,
    );
    setPayoutEvent(
      round.payout > 0 && !document.hidden
        ? {
            id: ++payoutGeneration.current,
            roundId: round.id,
            game: round.game,
            at: performance.now(),
          }
        : undefined,
    );
  }
  function slotDone(id: number, cursor: number, all = false) {
    const saved = current.current;
    if (
      !pendingSlot(saved) ||
      saved.pack?.rounds[0].id !== id ||
      saved.pack.slot?.cursor !== cursor
    )
      return;
    const next = revealSlot(saved, all);
    commit(next);
    const feature = next.pack!.slot!;
    const frame = feature.frames[feature.cursor - 1];
    if (
      feature.cursor < feature.frames.length &&
      feature.frames[feature.cursor].kind !== "cascade"
    )
      pauseRun();
    if (!pendingSpinRun(next) && !pendingSlot(next)) pauseRun();
    if (feature.cursor === feature.frames.length)
      presentRound({
        id,
        game: feature.key,
        payout: feature.payout,
        stake: feature.stake,
      });
    else if (frame.remaining > 0 && frame.kind === "spin")
      feedback.play("bonus", feature.key);
    else if (frame.kind === "free" && frame.award > 0)
      feedback.play("payout", feature.key);
    else
      feedback.play(
        frame.kind === "hold"
          ? "coin"
          : frame.kind === "cascade"
            ? "cascade"
            : "stop",
        feature.key,
      );
  }
  function nextSlot(all = false) {
    if (busyRef.current || !pendingSlot(current.current)) return;
    const saved = current.current,
      id = saved.pack!.rounds[0].id,
      cursor = saved.pack!.slot!.cursor;
    setError("");
    if (all) {
      try {
        slotDone(id, cursor, true);
      } catch {
        pauseRun();
        setError(
          "Browser storage is unavailable. Your saved round is unchanged; try revealing again.",
        );
      }
      return;
    }
    const motionRun = beginSlotMotion();
    busyRef.current = true;
    setBusy(true);
    feedback.play(
      saved.pack!.slot!.frames[cursor].kind === "cascade"
        ? "cascade"
        : saved.pack!.slot!.frames[cursor].kind === "free"
          ? "bonus_spin"
          : "spin",
      saved.pack!.slot!.key,
    );
    timer.current = setTimeout(
      () => {
        try {
          slotDone(id, cursor);
        } catch {
          pauseRun();
          setError(
            "Browser storage is unavailable. Your saved round is unchanged; try revealing again.",
          );
        } finally {
          setBusy(false);
          busyRef.current = false;
        }
      },
      reduce
        ? 40
        : Math.max(
            0,
            motionRun.started +
              slotRevealMs(saved.pack!.slot!, cursor) -
              performance.now(),
          ),
    );
  }
  function finishClassic(id: number) {
    if (
      !pendingClassicSpin(current.current) ||
      current.current.pack?.rounds[0].id !== id
    )
      return;
    const next = revealClassicSpin(current.current);
    commit(next);
    presentRound(next.pack!.rounds[0]);
    if (!pendingSpinRun(next)) pauseRun();
  }
  function revealSavedClassic() {
    if (busyRef.current || !pendingClassicSpin(current.current)) return;
    const round = current.current.pack!.rounds[0],
      duration = tableDuration(round);
    const run = {
      id: ++tableGeneration.current,
      started: performance.now(),
      duration,
    };
    setTableRun(run);
    busyRef.current = true;
    setBusy(true);
    feedback.play("spin");
    timer.current = setTimeout(
      () => {
        try {
          finishClassic(round.id);
        } catch {
          pauseRun();
          setError(
            "Storage unavailable. Your paid spin is saved; retry reveal.",
          );
        } finally {
          busyRef.current = false;
          setBusy(false);
        }
      },
      reduce ? 40 : duration,
    );
  }
  function uncoverScratch(index?: number) {
    if (busyRef.current || !pendingScratch(current.current)) return false;
    try {
      const before = current.current,
        opened = scratchRevealed(before),
        next = revealScratch(before, index);
      const fresh = scratchRevealed(next).filter((i) => !opened.includes(i));
      if (!fresh.length) return true;
      commit(next);
      const rounds = fresh.map((i) => next.pack!.rounds[i]);
      feedback.play("scratch");
      const total = {
        ...next.pack!.rounds[0],
        stake: sum(rounds.map((r) => r.stake)),
        payout: sum(rounds.map((r) => r.payout)),
      };
      presentRound(total);
      return true;
    } catch {
      setError(
        "Storage unavailable. Your ticket remains saved; retry revealing.",
      );
      return false;
    }
  }
  function act(action?: TableAction, advance = false) {
    if (
      busyRef.current ||
      mode !== "practice" ||
      !game ||
      (advance && !autoRef.current)
    )
      return;
    setPayoutEvent(undefined);
    busyRef.current = true;
    setError("");
    try {
      const previous = current.current;
      const next = action
        ? actSession(previous, action)
        : advance
          ? advanceSpinRun(previous)
          : isSlotGame(game)
            ? startSpinRun(
                previous,
                game as PracticeGame,
                practiceBet(stake),
                options.count ?? 1,
              )
            : playSession(
                previous,
                game as PracticeGame,
                practiceBet(stake),
                { side, target, over, picks },
                options,
              );
      commit(next);
      if (!action && !advance && isSlotGame(game) && (options.count ?? 1) > 1) {
        autoRef.current = true;
        autoGeneration.current++;
        setAutoRun(true);
      }
      const slotMotion = next.pack?.slot ? beginSlotMotion() : null;
      const duration =
        game === "blackjack"
          ? blackjackPlan(next, previous).duration
          : game === "plinko"
            ? PLINKO_REVEAL_MS + ((next.pack?.rounds.length ?? 1) - 1) * 120
            : tableDuration(next.history[0] ?? null);
      const run: TableRun = {
        id: ++tableGeneration.current,
        started: performance.now(),
        duration,
        previous,
        action,
        choice: { side, target, over, picks: [...picks] },
      };
      if (!slotMotion) setTableRun(run);
      setBusy(true);
      feedback.play(
        game === "blackjack"
          ? "deal"
          : game === "scratch_cards"
            ? "select"
            : "spin",
        isFleet(game) ? game : undefined,
      );
      timer.current = setTimeout(
        () => {
          try {
            if (next.pack?.slot) slotDone(next.pack.rounds[0].id, 0);
            else if (pendingClassicSpin(next))
              finishClassic(next.pack!.rounds[0].id);
            else if (
              next.sequence > previous.sequence &&
              game !== "scratch_cards"
            )
              presentRound(
                next.pack
                  ? {
                      ...next.pack.rounds[0],
                      payout: packTotal(next.pack, "payout"),
                      stake: packTotal(next.pack, "stake"),
                    }
                  : next.history[0],
              );
          } catch {
            pauseRun();
            setError(
              "Browser storage is unavailable. Your paid round is saved; retry revealing.",
            );
          } finally {
            setBusy(false);
            busyRef.current = false;
          }
        },
        reduce
          ? 40
          : Math.max(
              0,
              (slotMotion
                ? slotMotion.started + slotRevealMs(next.pack!.slot!, 0)
                : run.started + duration) - performance.now(),
            ),
      );
    } catch (e) {
      pauseRun();
      busyRef.current = false;
      setBusy(false);
      setError(
        e instanceof DOMException
          ? "Browser storage is unavailable. Enable tab storage to play without losing your balance."
          : String((e as Error).message),
      );
    }
  }
  const scheduledAction = useRef({ act, nextSlot });
  scheduledAction.current = { act, nextSlot };
  useEffect(() => {
    if (!autoRun || !autoRef.current || busy || mode !== "practice") return;
    if (
      pendingSlot(state) &&
      state.pack!.slot!.frames[state.pack!.slot!.cursor].kind !== "cascade"
    ) {
      pauseRun();
      return;
    }
    if (pendingClassicSpin(state)) return;
    if (!pendingSlot(state) && !pendingSpinRun(state)) {
      pauseRun();
      return;
    }
    const generation = autoGeneration.current,
      sequence = state.sequence,
      cursor = state.pack?.slot?.cursor;
    autoTimer.current = setTimeout(() => {
      if (
        !autoRef.current ||
        autoGeneration.current !== generation ||
        busyRef.current ||
        document.hidden ||
        current.current.sequence !== sequence ||
        current.current.pack?.slot?.cursor !== cursor
      )
        return;
      if (pendingSlot(current.current)) scheduledAction.current.nextSlot();
      else scheduledAction.current.act(undefined, true);
    }, 900);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, [autoRun, busy, state, mode]);
  function refill() {
    if (
      locked ||
      busyRef.current ||
      activeSession(current.current) ||
      crapsEscrow(current.current.craps)
    )
      return;
    try {
      commit(initialSession());
      setPayoutEvent(undefined);
      setResetConfirm(false);
      setError("");
      feedback.play("select");
    } catch {
      setError("Browser storage is unavailable.");
    }
  }
  const games = (mode === "testnet" ? CASINO_CATALOG : PRACTICE_CATALOG).filter(
    (g) =>
      !g.disabled &&
      (mode === "testnet"
        ? !TESTNET_QUARANTINE.has(g.key)
        : g.key === "craps" || PRACTICE_GAMES.includes(g.key as PracticeGame)),
  );
  const filtered = games.filter(
    (g) =>
      (category === "all" || g.category === category) &&
      `${g.name} ${titles(g.key).title}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const categories = [...new Set(games.map((g) => g.category))];
  const last = state.history[0]?.game === game ? state.history[0] : null;
  const pack = state.pack?.game === game ? state.pack : null;
  const result =
    busy ||
    pendingSlot(state) ||
    pendingClassicSpin(state) ||
    pendingScratch(state)
      ? null
      : pack
        ? {
            ...pack.rounds[0],
            stake: packTotal(pack, "stake"),
            payout: packTotal(pack, "payout"),
            label: pack.slot
              ? pack.rounds[0].label
              : `${pack.rounds.length} ${game === "roulette" ? "selections" : game === "blackjack" ? "hands" : "plays"} · total`,
          }
        : last;
  let totalStake = 0;
  try {
    totalStake =
      game === "roulette"
        ? sum((options.wagers ?? []).map((w) => w.stake))
        : game === "keno"
          ? sum((options.tickets ?? []).map((t) => t.stake))
          : practiceBet(stake) *
            (game === "blackjack"
              ? (options.seats ?? 1)
              : game === "plinko" ||
                  game === "scratch_cards" ||
                  isSlotGame(game ?? "")
                ? (options.count ?? 1)
                : 1);
  } catch {
    /* Input validation is shown on play. */
  }
  const spinRun = state.spinRun?.game === game ? state.spinRun : undefined;
  const runTotals = spinRunTotals(state);
  const displayedBalance = state.craps?.pending
    ? state.balance - evaluateCraps(state.craps.rolls[0]).payout
    : pack?.slot && pendingSlot(state)
      ? state.balance -
        pack.slot.payout +
        (pack.slot.cursor > 0
          ? pack.slot.frames[pack.slot.cursor - 1].total
          : 0)
      : pendingClassicSpin(state) && pack
        ? state.balance - packTotal(pack, "payout")
        : pendingScratch(state) && pack
          ? state.balance -
            sum(
              pack.rounds
                .filter((_, i) => !scratchRevealed(state).includes(i))
                .map((r) => r.payout),
            )
          : busy && last && !state.table && !state.hand
            ? state.balance - (pack ? packTotal(pack, "payout") : last.payout)
            : state.balance;
  const meta = game ? titles(game) : null;
  return (
    <CasinoFeedback.Provider value={feedback.play}>
      <section className="frontier-casino" data-mode={mode}>
        <header className="lounge-header">
          {!onReturnToStation && (
            <button
              className="lounge-station-return"
              disabled={chainBusy}
              onClick={() => {
                if (chainBusyRef.current) return;
                pauseRun();
                window.location.hash = "/casino-station";
              }}
            >
              Station ↗
            </button>
          )}
          {onReturnToStation && (
            <button
              className="lounge-station-return"
              disabled={chainBusy}
              onClick={() => {
                if (chainBusyRef.current) return;
                pauseRun();
                onReturnToStation();
              }}
            >
              ← Station floor
            </button>
          )}
          <a
            className="lounge-brand"
            href="#/casino"
            onClick={(e) => {
              e.preventDefault();
              if (mode === "donate") changeMode("practice");
              else navigate(null);
            }}
            aria-label="Casino lobby"
          >
            <span>◇</span>
            <div>
              CRADLE <b>CASINO</b>
              <small>AFTER HOURS IN THE FRONTIER</small>
            </div>
          </a>
          <div
            className="lounge-mode"
            role="group"
            aria-label="Casino currency mode"
          >
            <button
              aria-pressed={mode === "practice"}
              disabled={locked}
              onClick={() => changeMode("practice")}
            >
              Play Money
            </button>
            <button
              aria-pressed={mode === "testnet"}
              disabled={locked}
              onClick={() => changeMode("testnet")}
            >
              $EVE Testnet
            </button>
          </div>
          <button
            className="lounge-sound"
            aria-pressed={feedback.enabled}
            onClick={() => void feedback.toggle()}
            aria-label={
              feedback.enabled ? "Mute casino sound" : "Enable casino sound"
            }
          >
            {feedback.enabled ? "♪" : "♩"}
            <span>Sound {feedback.enabled ? "on" : "off"}</span>
          </button>
        </header>
        <div className="lounge-account">
          <button
            className="lounge-donate-link"
            disabled={locked}
            aria-pressed={mode === "donate"}
            onClick={() =>
              changeMode(mode === "donate" ? "practice" : "donate")
            }
          >
            {mode === "donate" ? "← Back to casino" : "Donate $EVE"}
          </button>
          <span className="lounge-mode-label">
            <i />{" "}
            {mode === "practice"
              ? "PLAY MONEY · FREE CHIPS"
              : mode === "donate"
                ? "$EVE · SEED THE HOUSE"
                : "$EVE · TESTNET ONLY"}
          </span>
          {mode === "practice" ? (
            <div>
              <span className="lounge-balance">
                {chipLabel(displayedBalance)} <small>chips</small>
              </span>
              <button
                disabled={locked || !!crapsEscrow(state.craps)}
                title={
                  crapsEscrow(
                    state.craps?.pending ? state.craps.rolls[0] : state.craps,
                  )
                    ? "Resolve or take down your craps bets before refilling"
                    : undefined
                }
                onClick={() => setResetConfirm(!resetConfirm)}
              >
                Refill
              </button>
            </div>
          ) : (
            <span className="lounge-muted">
              Wallet funds stay separate from play chips.
            </span>
          )}
        </div>
        {resetConfirm && mode === "practice" && (
          <div className="lounge-confirm">
            <span>Reset this tab to 10,000 chips and clear its history?</span>
            <button
              onClick={refill}
              disabled={locked || !!crapsEscrow(state.craps)}
            >
              Reset chips
            </button>
            <button onClick={() => setResetConfirm(false)}>Cancel</button>
          </div>
        )}
        {(error || feedback.error) && (
          <p className="lounge-error" role="alert">
            {error || feedback.error}
          </p>
        )}
        {mode === "testnet" && <TestnetStatus q={houseQuery} />}
        {mode === "donate" ? (
          <HouseDonatePanel
            onBusyChange={(value) => {
              busyRef.current = value;
              chainBusyRef.current = value;
              setChainBusy(value);
            }}
          />
        ) : !game ? (
          <>
            <div className="lounge-hero">
              <div>
                <span className="lounge-eyebrow">
                  THE FRONTIER DOESN’T SLEEP
                </span>
                <h2>
                  Find your
                  <br />
                  <em>next signal.</em>
                </h2>
                <p>
                  Salvaged fortunes. Familiar games.
                  <br />A lounge on the edge of the unknown.
                </p>
                <button
                  className="lounge-primary"
                  onClick={() =>
                    mode === "practice"
                      ? setCategory("slots")
                      : navigate("slots")
                  }
                >
                  {mode === "practice"
                    ? "Explore 9 slot games"
                    : "Play Salvage Reels"}{" "}
                  <span>↗</span>
                </button>
              </div>
              <div className="lounge-hero-art" aria-hidden="true">
                <div className="lounge-orbit" />
                <img src={`${base}casino/cards/slots.webp`} alt="" />
                <span>CRADLE // SALVAGE REELS</span>
              </div>
            </div>
            {mode === "practice" &&
              state.craps &&
              (crapsEscrow(state.craps) > 0 || state.craps.point > 0) && (
                <div className="craps-resume">
                  <span>
                    Craps · {chipLabel(crapsEscrow(state.craps))} chips on the
                    table
                    {state.craps.point ? ` · Point ${state.craps.point}` : ""}
                  </span>
                  <button onClick={() => navigate("craps")}>
                    Return to table
                  </button>
                </div>
              )}
            <div className="lounge-catalog-heading">
              <h3>
                {mode === "practice" ? "Practice floor" : "Testnet tables"}{" "}
                <span>{games.length}</span>
              </h3>
              <label className="lounge-search">
                <span>⌕</span>
                <input
                  type="search"
                  aria-label="Search casino games"
                  placeholder="Find your game"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            <nav className="lounge-categories" aria-label="Game categories">
              <button
                aria-pressed={category === "all"}
                onClick={() => setCategory("all")}
              >
                All games
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </nav>
            <div className="lounge-game-grid">
              {filtered.map((entry) => {
                const m = titles(entry.key);
                return (
                  <button
                    key={entry.key}
                    className="lounge-game-tile"
                    onClick={() => navigate(entry.key)}
                  >
                    <div className="tile-art">
                      {entry.key === "craps" ? (
                        <CrapsTile />
                      ) : isFleet(entry.key) ? (
                        <FleetTile game={entry.key} />
                      ) : (
                        <img
                          src={`${base}casino/cards/${entry.key}.webp`}
                          alt=""
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.visibility = "hidden";
                          }}
                        />
                      )}
                      <span className="tile-icon">
                        <ItemIcon typeId={m.icon} size={42} />
                      </span>
                      <span className="tile-play">↗</span>
                    </div>
                    <div>
                      <small>
                        {isFleet(entry.key)
                          ? FLEET[entry.key].mechanic
                          : entry.name}{" "}
                        <span>
                          {mode === "practice" ? "FREE PLAY" : "TESTNET"}
                        </span>
                      </small>
                      <h4>{m.title}</h4>
                    </div>
                  </button>
                );
              })}
            </div>
            {!filtered.length && (
              <p className="lounge-empty">
                No games found. Try another search or category.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="lounge-table-header">
              <button disabled={locked} onClick={() => navigate(null)}>
                ‹ Lobby
              </button>
              <div>
                <small>
                  {meta!.tag} /{" "}
                  {mode === "practice" ? "PLAY MONEY" : "$EVE TESTNET"}
                </small>
                <h2>{meta!.title}</h2>
              </div>
              <ItemIcon typeId={meta!.icon} size={48} />
            </div>
            {mode === "testnet" ? (
              <div className="lounge-chain-table">
                <CasinoPanel
                  key={game}
                  initialGame={game}
                  wageringReady={wageringReady}
                  embedded
                  onBusyChange={(value) => {
                    chainBusyRef.current = value;
                    setChainBusy(value);
                  }}
                  onLobby={() => navigate(null)}
                />
              </div>
            ) : game === "craps" ? (
              <CasinoCraps
                state={state}
                commit={commit}
                busy={busy}
                setBusy={(value) => {
                  busyRef.current = value;
                  setBusy(value);
                }}
                reduced={reduce}
                onError={setError}
              />
            ) : (
              <div className="lounge-play-layout">
                <div
                  className={`lounge-surface ${busy ? "round-active" : ""} ${result && result.payout > result.stake ? "round-won" : ""}`}
                >
                  <div className="lounge-surface-label">
                    <span>CRADLE / {meta!.tag}</span>
                    <span>
                      {pendingSlot(state)
                        ? "FEATURE SAVED"
                        : pendingScratch(state)
                          ? "TICKETS SAVED"
                          : pendingClassicSpin(state)
                            ? "SPIN SAVED"
                            : pendingSpinRun(state)
                              ? "SPIN RUN"
                              : activeSession(state)
                                ? "HAND IN PLAY"
                                : busy
                                  ? "RESOLVING"
                                  : "PRACTICE TABLE"}
                    </span>
                  </div>
                  <GameSurface
                    game={game as PracticeGame}
                    state={state}
                    result={result}
                    busy={busy}
                    reducedMotion={reduce}
                    selectedProfile={options.profile ?? "Low"}
                    slotRun={slotRun}
                    onNextSlot={() => nextSlot()}
                    tableRun={tableRun}
                    onScratchReveal={uncoverScratch}
                  />
                  <div
                    className={`lounge-result ${result ? (result.payout > result.stake ? "result-win" : result.payout === result.stake ? "result-push" : "result-loss") : ""}`}
                  >
                    {busy ? (
                      <span role="status">Resolving…</span>
                    ) : state.table ? (
                      <span role="status">
                        Seat {state.table.hands[state.table.active].seat + 1} ·
                        Your move
                      </span>
                    ) : state.hand ? (
                      <span role="status">
                        Your total · {cardTotal(state.hand.player)}
                      </span>
                    ) : null}
                    {!busy && state.hand && (
                      <span>Your move · Hit, stand or double</span>
                    )}
                    {!busy &&
                      !state.hand &&
                      !state.table &&
                      !pendingSlot(state) &&
                      !pendingClassicSpin(state) &&
                      !pendingScratch(state) &&
                      (result ? (
                        <CasinoRoundSummary
                          round={result}
                          reduced={reduce}
                          event={
                            payoutEvent?.roundId === result.id &&
                            payoutEvent.game === game
                              ? payoutEvent
                              : undefined
                          }
                        />
                      ) : (
                        <span>Set your stake. Make your move.</span>
                      ))}
                  </div>
                </div>
                <aside className="lounge-console">
                  <span className="lounge-eyebrow">PLAY MONEY</span>
                  <h3>Your controls</h3>
                  {!busy && state.table && (
                    <p className="casino-active-summary">
                      Seat {state.table.hands[state.table.active].seat + 1} ·{" "}
                      <strong>
                        {cardTotal(state.table.hands[state.table.active].cards)}
                      </strong>{" "}
                      vs dealer{" "}
                      <strong>{cardTotal([state.table.dealer[0]])}</strong>
                    </p>
                  )}
                  <label className="stake-label">
                    {game === "roulette"
                      ? "Chip value"
                      : game === "keno"
                        ? "Ticket stake to apply"
                        : "Stake per play"}{" "}
                    <span>chips</span>
                    <input
                      aria-label="Stake in play chips"
                      inputMode="decimal"
                      value={stake}
                      disabled={busy || activeSession(state)}
                      onChange={(e) => setStake(e.target.value)}
                    />
                  </label>
                  <div className="lounge-stakes">
                    {[10, 25, 100, 500].map((n) => (
                      <button
                        key={n}
                        disabled={busy || activeSession(state)}
                        onClick={() => setStake(String(n))}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <fieldset
                    disabled={busy || activeSession(state)}
                    className="lounge-options"
                  >
                    <CasinoPackControls
                      key={game}
                      game={game}
                      options={options}
                      setOptions={setOptions}
                      stake={stake}
                      pack={pack}
                      onError={setError}
                      onActivePicks={setPicks}
                    />
                    {game !== "keno" && (
                      <ExpandedOptions
                        game={game}
                        side={side}
                        setSide={setSide}
                        target={target}
                        setTarget={setTarget}
                        picks={picks}
                        setPicks={setPicks}
                      />
                    )}
                    {game === "coinflip" && (
                      <>
                        <legend>Your call</legend>
                        {["Heads", "Tails"].map((s, i) => (
                          <button
                            key={s}
                            aria-pressed={side === i}
                            onClick={() => setSide(i)}
                          >
                            {s}
                          </button>
                        ))}
                      </>
                    )}
                    {game === "dice" && (
                      <>
                        <legend>Target · {target}</legend>
                        <input
                          aria-label="Dice target"
                          type="range"
                          min={over ? 4 : 3}
                          max={over ? 98 : 97}
                          value={target}
                          onChange={(e) => setTarget(Number(e.target.value))}
                        />
                        <button
                          aria-pressed={over}
                          onClick={() => {
                            setOver(true);
                            setTarget((t) => Math.max(4, Math.min(98, t)));
                          }}
                        >
                          Over
                        </button>
                        <button
                          aria-pressed={!over}
                          onClick={() => {
                            setOver(false);
                            setTarget((t) => Math.max(3, Math.min(97, t)));
                          }}
                        >
                          Under
                        </button>
                        <p>
                          {over ? 100 - target : target - 1}% chance ·{" "}
                          {(98 / (over ? 100 - target : target - 1)).toFixed(2)}
                          × return
                        </p>
                      </>
                    )}
                  </fieldset>
                  {!activeSession(state) && (
                    <div className="casino-total-stake">
                      <span>
                        {isSlotGame(game) ? "Maximum run stake" : "Total stake"}
                      </span>
                      <strong>{chipLabel(totalStake)} chips</strong>
                    </div>
                  )}
                  {isSlotGame(game) && spinRun && spinRun.planned > 1 && (
                    <div className="casino-spin-run" aria-label="Slot run">
                      <strong>
                        {spinRun.shown} / {spinRun.planned} spins revealed
                      </strong>
                      <progress
                        aria-label="Spin run progress"
                        value={spinRun.shown}
                        max={spinRun.planned}
                      />
                      <span>
                        {chipLabel(spinRun.paid * spinRun.stake)} chips staked ·{" "}
                        {chipLabel(runTotals.payout)} revealed payout
                      </span>
                      <small>
                        {spinRun.stopped
                          ? "Stopped · paid spin stays saved"
                          : pendingSpinRun(state)
                            ? autoRun
                              ? "Running · charged per spin"
                              : "Paused · no new spins charged"
                            : spinRun.shown < spinRun.paid
                              ? "Last paid spin in progress"
                              : "Run complete"}
                      </small>
                      {pendingSpinRun(state) && (
                        <div>
                          {autoRun ? (
                            <button onClick={pauseRun}>Pause run</button>
                          ) : (
                            <button
                              disabled={
                                busy ||
                                pendingSlot(state) ||
                                pendingClassicSpin(state)
                              }
                              onClick={resumeRun}
                            >
                              Resume run
                            </button>
                          )}
                          <button onClick={stopRun}>Stop future spins</button>
                        </div>
                      )}
                    </div>
                  )}
                  {pendingClassicSpin(state) ? (
                    <button
                      className="lounge-primary"
                      disabled={busy}
                      onClick={revealSavedClassic}
                    >
                      {busy ? "Revealing…" : "Reveal saved spin"}
                    </button>
                  ) : pendingSlot(state) ? (
                    <div className="fleet-reveal-controls">
                      <button
                        className="lounge-primary"
                        disabled={busy}
                        onClick={() => nextSlot()}
                      >
                        {busy
                          ? "Revealing…"
                          : pack?.slot?.cursor === 0
                            ? "Reveal saved spin"
                            : slotAwaitingCollection(pack?.slot)
                              ? "Collect vault"
                              : pack?.slot?.frames[pack.slot.cursor]?.kind ===
                                  "free"
                                ? "Next free spin"
                                : pack?.slot?.frames[pack.slot.cursor]?.kind ===
                                    "hold"
                                  ? "Respin"
                                  : "Next cascade"}
                      </button>
                      <button disabled={busy} onClick={() => nextSlot(true)}>
                        Reveal all
                      </button>
                      <small>Already paid · no additional stake</small>
                    </div>
                  ) : pendingScratch(state) ? (
                    <small>
                      Scratch the tickets or choose Reveal all. Already paid.
                    </small>
                  ) : pendingSpinRun(state) ? (
                    <small>
                      Bonuses, hiding the tab and reloading pause the run.
                    </small>
                  ) : game === "blackjack" && state.table ? (
                    <div className="lounge-hand-actions">
                      {(["hit", "stand", "double", "split"] as const).map(
                        (a) => (
                          <button
                            key={a}
                            disabled={
                              busy ||
                              !tableActionAllowed(
                                state.table!,
                                a,
                                state.balance,
                              )
                            }
                            onClick={() => act(a)}
                          >
                            {a[0].toUpperCase() + a.slice(1)}
                          </button>
                        ),
                      )}
                    </div>
                  ) : game === "blackjack" && state.hand ? (
                    <div className="lounge-hand-actions">
                      <button
                        className="lounge-primary"
                        disabled={busy}
                        onClick={() => act("hit")}
                      >
                        Hit
                      </button>
                      <button disabled={busy} onClick={() => act("stand")}>
                        Stand
                      </button>
                      <button
                        disabled={
                          busy ||
                          state.hand.player.length !== 2 ||
                          state.balance < state.hand.stake
                        }
                        onClick={() => act("double")}
                      >
                        Double
                      </button>
                    </div>
                  ) : (
                    <button
                      className="lounge-primary lounge-start"
                      disabled={busy}
                      onClick={() => act()}
                    >
                      {busy
                        ? "Resolving…"
                        : isFleet(game) ||
                            game === "slots" ||
                            game === "roulette" ||
                            game === "wheel"
                          ? isSlotGame(game) && (options.count ?? 1) > 1
                            ? `Start ${options.count} spins`
                            : "Spin"
                          : game === "blackjack" || game === "war"
                            ? "Deal"
                            : game === "coinflip"
                              ? "Flip"
                              : game === "plinko"
                                ? "Drop"
                                : "Play"}{" "}
                      <span>↗</span>
                    </button>
                  )}
                  <p className="lounge-session-note">
                    Free chips · saved in this tab. No wallet or tokens used.
                  </p>
                  <Rules game={game as PracticeGame} picks={picks} />
                </aside>
              </div>
            )}
          </>
        )}
        {mode === "practice" && game !== "craps" && (
          <CasinoRoundHistory
            state={state}
            busy={busy}
            title={(key) => titles(key).title}
          />
        )}
        <footer className="lounge-footer">
          <span>◇ CRADLE CASINO</span>
          <span>
            {mode === "practice"
              ? "Practice chips are free, tab-local and non-redeemable."
              : "Sui Testnet · current-cycle $EVE · wallet confirmation required."}
          </span>
          <a href="#/gamedata">Sources</a>
        </footer>
      </section>
    </CasinoFeedback.Provider>
  );
}
