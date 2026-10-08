import { slotAwaitingCollection } from "../lib/casinoSlotIdentity";
import {
  FleetBoard,
  FleetRules,
  FleetTile,
  FLEET_CATALOG,
  SLOT_REVEAL_MS,
} from "./CasinoSlotFleet";
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
import { CasinoRoundStage, casinoRoundMs } from "./CasinoRoundStage";
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
}: {
  game: PracticeGame;
  state: Session;
  result: Round | null;
  busy: boolean;
  reducedMotion: boolean;
  selectedProfile: keyof typeof PROFILES;
}) {
  const pack = state.pack?.game === game ? state.pack : null;
  const [receiptTicket, setReceiptTicket] = useState(0);
  useEffect(() => setReceiptTicket(0), [pack]);
  if (isFleet(game))
    return (
      <FleetBoard
        game={game}
        receipt={pack?.slot}
        busy={busy}
        reduced={reducedMotion}
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
              disabled={busy}
              aria-pressed={i === ticket}
              onClick={() => setReceiptTicket(i)}
            >
              Result {i + 1}
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
        reduced={reducedMotion}
      />
    );
  if (game === "blackjack" && (state.table || pack?.table)) {
    const table = state.table ?? pack!.table!;
    return (
      <div className="lounge-blackjack casino-multi-blackjack">
        <CardRow
          label="Dealer · stands on 17"
          cards={table.dealer}
          hidden={!table.complete}
        />
        <div className="felt-line">
          <span>BLACKJACK PAYS 3:2 · SPLIT 21 PAYS 1:1</span>
        </div>
        <div className="casino-seat-grid">
          {table.hands.map((h, i) => (
            <section
              key={i}
              className={table.active === i ? "active-seat" : ""}
              aria-label={`Seat ${h.seat + 1}${h.split ? " split" : ""}${table.active === i ? " active" : ""}`}
            >
              <CardRow
                label={`Seat ${h.seat + 1}${h.split ? " · split" : ""}`}
                cards={h.cards}
              />
              <small>
                {chipLabel(h.stake)} chips ·{" "}
                {table.active === i
                  ? "YOUR MOVE"
                  : h.done
                    ? "Complete"
                    : "Waiting"}
              </small>
            </section>
          ))}
        </div>
      </div>
    );
  }
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
        />
      </>
    );
  }
  return (
    <CasinoRoundStage
      game={game}
      round={state.history[0]?.game === game ? state.history[0] : null}
      busy={busy}
      reduced={reducedMotion}
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
export function CasinoExperience() {
  const [state, setState] = useState(initial),
    current = useRef<Session>(state);
  const [mode, setMode] = useState<"practice" | "testnet" | "donate">(
    "practice",
  );
  const [game, setGame] = useState<string | null>(() =>
    state.hand || state.table ? "blackjack" : (state.pack?.game ?? null),
  );
  const [category, setCategory] = useState("all"),
    [search, setSearch] = useState("");
  const [stake, setStake] = useState("25"),
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
    setGame(key);
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
    setMode(value);
    setGame(null);
    setCategory("all");
    setSearch("");
    setError("");
    feedback.play("select");
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
    if (feature.cursor === feature.frames.length)
      feedback.play(
        feature.payout > feature.stake ? "win" : "loss",
        feature.key,
      );
    else if (frame.remaining > 0 && frame.kind === "spin")
      feedback.play("bonus", feature.key);
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
        setError(
          "Browser storage is unavailable. Your saved round is unchanged; try revealing again.",
        );
      }
      return;
    }
    busyRef.current = true;
    setBusy(true);
    feedback.play(
      saved.pack!.slot!.frames[cursor].kind === "cascade" ? "cascade" : "spin",
      saved.pack!.slot!.key,
    );
    timer.current = setTimeout(
      () => {
        try {
          slotDone(id, cursor);
        } catch {
          setError(
            "Browser storage is unavailable. Your saved round is unchanged; try revealing again.",
          );
        } finally {
          setBusy(false);
          busyRef.current = false;
        }
      },
      reduce ? 40 : SLOT_REVEAL_MS,
    );
  }
  function act(action?: TableAction) {
    if (busyRef.current || mode !== "practice" || !game) return;
    busyRef.current = true;
    setError("");
    try {
      const previous = current.current;
      const next = action
        ? actSession(previous, action)
        : playSession(
            previous,
            game as PracticeGame,
            practiceBet(stake),
            {
              side,
              target,
              over,
              picks,
            },
            options,
          );
      commit(next);
      setBusy(true);
      feedback.play(
        game === "blackjack" ? "deal" : "spin",
        isFleet(game) ? game : undefined,
      );
      timer.current = setTimeout(
        () => {
          setBusy(false);
          busyRef.current = false;
          if (next.pack?.slot) {
            try {
              slotDone(next.pack.rounds[0].id, 0);
            } catch {
              setError(
                "Browser storage is unavailable. Your round is saved; try revealing again.",
              );
            }
          } else if (next.sequence > previous.sequence)
            feedback.play(
              (
                next.pack
                  ? packTotal(next.pack, "payout") >
                    packTotal(next.pack, "stake")
                  : next.history[0].payout > next.history[0].stake
              )
                ? "win"
                : "loss",
            );
        },
        reduce
          ? 40
          : isFleet(game)
            ? SLOT_REVEAL_MS
            : game === "blackjack"
              ? 450
              : game === "plinko"
                ? PLINKO_REVEAL_MS + ((next.pack?.rounds.length ?? 1) - 1) * 120
                : casinoRoundMs(next.history[0] ?? null),
      );
    } catch (e) {
      busyRef.current = false;
      setBusy(false);
      setError(
        e instanceof DOMException
          ? "Browser storage is unavailable. Enable tab storage to play without losing your balance."
          : String((e as Error).message),
      );
    }
  }
  function refill() {
    if (locked || busyRef.current || activeSession(current.current)) return;
    try {
      commit(initialSession());
      setResetConfirm(false);
      setError("");
      feedback.play("select");
    } catch {
      setError("Browser storage is unavailable.");
    }
  }
  const games = (
    mode === "testnet" ? CASINO_CATALOG : [...CASINO_CATALOG, ...FLEET_CATALOG]
  ).filter(
    (g) =>
      !g.disabled &&
      (mode === "testnet"
        ? !TESTNET_QUARANTINE.has(g.key)
        : PRACTICE_GAMES.includes(g.key as PracticeGame)),
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
    busy || pendingSlot(state)
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
              : game === "plinko" || game === "scratch_cards"
                ? (options.count ?? 1)
                : 1);
  } catch {
    /* Input validation is shown on play. */
  }
  const displayedBalance =
    pack?.slot && pendingSlot(state)
      ? state.balance -
        pack.slot.payout +
        (pack.slot.cursor > 0
          ? pack.slot.frames[pack.slot.cursor - 1].total
          : 0)
      : busy && last && !activeSession(state)
        ? state.balance - (pack ? packTotal(pack, "payout") : last.payout)
        : state.balance;
  const meta = game ? titles(game) : null;
  return (
    <CasinoFeedback.Provider value={feedback.play}>
      <section className="frontier-casino" data-mode={mode}>
        <header className="lounge-header">
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
                disabled={locked}
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
            <button onClick={refill} disabled={locked}>
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
                      {isFleet(entry.key) ? (
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
                  onBusyChange={setChainBusy}
                  onLobby={() => navigate(null)}
                />
              </div>
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
                  />
                  <div
                    className={`lounge-result ${result ? (result.payout > result.stake ? "result-win" : result.payout === result.stake ? "result-push" : "result-loss") : ""}`}
                    role="status"
                    aria-live="polite"
                  >
                    {busy ? (
                      <span>Resolving…</span>
                    ) : state.table ? (
                      <span>
                        Seat {state.table.hands[state.table.active].seat + 1} ·
                        Your move
                      </span>
                    ) : state.hand ? (
                      <span>Your total · {cardTotal(state.hand.player)}</span>
                    ) : null}
                    {!busy && state.hand && (
                      <span>Your move · Hit, stand or double</span>
                    )}
                    {!busy &&
                      !activeSession(state) &&
                      (result ? (
                        <>
                          <strong>{result.label}</strong>
                          <span>
                            Return {chipLabel(result.payout)}{" "}
                            <small>chips</small> · Net{" "}
                            {result.payout - result.stake > 0 ? "+" : ""}
                            {chipLabel(result.payout - result.stake)}
                          </span>
                        </>
                      ) : (
                        <span>Set your stake. Make your move.</span>
                      ))}
                  </div>
                </div>
                <aside className="lounge-console">
                  <span className="lounge-eyebrow">PLAY MONEY</span>
                  <h3>Your controls</h3>
                  {state.table && (
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
                      <span>Total stake</span>
                      <strong>{chipLabel(totalStake)} chips</strong>
                    </div>
                  )}
                  {pendingSlot(state) ? (
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
                          ? "Spin"
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
        {mode === "practice" && pack && !busy && (
          <details className="casino-pack-receipt">
            <summary>
              Last round · {pack.rounds.length} individual returns
              {pack.profile ? ` · ${pack.profile}` : ""}
            </summary>
            {pack.rounds.map((r, i) => (
              <div key={r.id}>
                <span>
                  {i + 1}. {r.label}
                </span>
                <span>
                  {chipLabel(r.stake)} → {chipLabel(r.payout)} chips
                </span>
              </div>
            ))}
          </details>
        )}
        {mode === "practice" && state.history.length > 0 && !busy && (
          <section className="lounge-history">
            <h3>
              Your recent rounds <span>PLAY MONEY</span>
            </h3>
            <div>
              {state.history
                .filter(
                  (r) =>
                    !pendingSlot(state) || r.id !== state.pack?.rounds[0].id,
                )
                .slice(0, 6)
                .map((r) => (
                  <div key={r.id}>
                    <span>{titles(r.game).title}</span>
                    <small>Stake {chipLabel(r.stake)}</small>
                    <strong
                      className={
                        r.payout > r.stake
                          ? "positive"
                          : r.payout === r.stake
                            ? "neutral"
                            : "negative"
                      }
                    >
                      {r.payout - r.stake > 0 ? "+" : ""}
                      {chipLabel(r.payout - r.stake)}
                    </strong>
                  </div>
                ))}
            </div>
          </section>
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
