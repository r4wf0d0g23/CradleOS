import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { CasinoPanel } from "./CasinoPanel";
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
  actPractice,
  cardTotal,
  chipLabel,
  initialPractice,
  playPractice,
  practiceBet,
  restorePractice,
  PLINKO_BPS,
  RED,
  SLOT_BPS,
  WHEEL_BPS,
  type PracticeGame,
  type PracticeState,
  type Round,
} from "../lib/casinoPractice";
import "../styles/casino-lounge.css";
const base = import.meta.env.BASE_URL;
const titles = (key: string) =>
  LOUNGE_NAMES[key] ?? {
    title: CASINO_CATALOG.find((g) => g.key === key)?.name ?? key,
    tag: "TABLE",
    icon: 72244,
  };
function initial() {
  try {
    return restorePractice(sessionStorage.getItem(PRACTICE_KEY));
  } catch {
    return initialPractice();
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
const wheelOrder = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
function OrbitWheel({
  roulette,
  result,
  busy,
}: {
  roulette: boolean;
  result: Round | null;
  busy: boolean;
}) {
  const numbers = roulette
      ? wheelOrder
      : Array.from({ length: 20 }, (_, i) => i),
    hit = result?.values[0];
  return (
    <div className={`lounge-wheel ${busy ? "is-spinning" : ""}`}>
      <svg
        viewBox="0 0 300 300"
        role="img"
        aria-label={
          roulette ? "European roulette wheel" : "20-sector multiplier wheel"
        }
      >
        <circle
          cx="150"
          cy="150"
          r="143"
          fill="#121510"
          stroke="#71654b"
          strokeWidth="3"
        />
        <circle cx="150" cy="150" r="111" fill="none" stroke="#fafae52a" />
        {numbers.map((n, i) => {
          const a = (((i / numbers.length) * 360 - 90) * Math.PI) / 180,
            x = 150 + 125 * Math.cos(a),
            y = 150 + 125 * Math.sin(a);
          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r={roulette ? 10 : 15}
                fill={
                  roulette
                    ? n === 0
                      ? "#155f48"
                      : RED.includes(n)
                        ? "#bd240f"
                        : "#222722"
                    : WHEEL_BPS[n]
                      ? "#61451f"
                      : "#222722"
                }
                stroke={n === hit ? "#f3db91" : "none"}
                strokeWidth="3"
              />
              <text
                x={x}
                y={y + 3}
                textAnchor="middle"
                fill="#fafae5"
                fontSize={roulette ? 9 : 10}
              >
                {roulette ? n : WHEEL_BPS[n] / 10000 + "×"}
              </text>
            </g>
          );
        })}
        <circle
          cx="150"
          cy="150"
          r="77"
          fill="#0a0c0b"
          stroke="#ff28006a"
          strokeWidth="2"
        />
        <text
          x="150"
          y="143"
          textAnchor="middle"
          fill="#a9aa9b"
          fontSize="10"
          letterSpacing="3"
        >
          {roulette ? "ORBITAL" : "REACTOR"}
        </text>
        <text x="150" y="181" textAnchor="middle" fill="#fafae5" fontSize="34">
          {busy
            ? "◇"
            : hit === undefined
              ? "◇"
              : roulette
                ? hit
                : WHEEL_BPS[hit] / 10000 + "×"}
        </text>
        <polygon
          className="wheel-indicator"
          points="144,2 156,2 150,13"
          fill="#f3db91"
          transform={`rotate(${hit === undefined ? 0 : (numbers.indexOf(hit) * 360) / numbers.length} 150 150)`}
        />
      </svg>
    </div>
  );
}
function Plinko({ result, busy }: { result: Round | null; busy: boolean }) {
  const path = result?.values ?? [],
    bucket = path.reduce((a, b) => a + b, 0);
  let rights = 0;
  const points = [
    "150,12",
    ...path.map((n, row) => {
      rights += n;
      return `${150 - (row + 1) * 9 + rights * 18},${28 + row * 16}`;
    }),
  ].join(" ");
  return (
    <div className="lounge-plinko">
      <svg
        viewBox="0 0 300 250"
        role="img"
        aria-label="Twelve-row Plinko board, low-risk payouts"
      >
        {Array.from({ length: 12 }, (_, row) =>
          Array.from({ length: row + 2 }, (_, col) => (
            <circle
              key={`${row}-${col}`}
              cx={150 - (row + 1) * 9 + col * 18}
              cy={24 + row * 16}
              r="2.2"
              fill="#d6d9c0"
            />
          )),
        )}
        {!busy && path.length > 0 && (
          <>
            <polyline
              points={points}
              stroke="#ff6749"
              fill="none"
              strokeWidth="2"
              opacity=".8"
            />
            <circle
              cx={150 - 108 + bucket * 18}
              cy="216"
              r="5"
              fill="#fff1b2"
            />
          </>
        )}
        {PLINKO_BPS.map((bps, i) => (
          <g key={i}>
            <rect
              x={33 + i * 18}
              y="227"
              width="17"
              height="19"
              rx="3"
              fill={
                !busy && path.length > 0 && i === bucket ? "#a2311b" : "#25261f"
              }
            />
            <text
              x={41 + i * 18}
              y="240"
              fill="#fafae5"
              textAnchor="middle"
              fontSize="8"
            >
              {bps / 10000}×
            </text>
          </g>
        ))}
        {busy && (
          <circle
            className="lounge-falling"
            cx="150"
            cy="12"
            r="5"
            fill="#fff1b2"
          />
        )}
      </svg>
    </div>
  );
}
function GameSurface({
  game,
  state,
  result,
  busy,
}: {
  game: PracticeGame;
  state: PracticeState;
  result: Round | null;
  busy: boolean;
}) {
  if (game === "slots")
    return (
      <div className={`lounge-reels ${busy ? "is-spinning" : ""}`}>
        {[0, 1, 2].map((i) => {
          const symbol = CASINO_SYMBOLS[result?.values[i] ?? [4, 3, 6][i]];
          return (
            <div key={i} style={{ "--reel": i } as CSSProperties}>
              <div className="reel-ghost" aria-hidden="true">
                <ItemIcon typeId={CASINO_SYMBOLS[(i + 1) % 7].id} size={68} />
              </div>
              <ItemIcon typeId={symbol.id} size={96} />
              <span>{busy ? "SCANNING" : symbol.name}</span>
              <div className="reel-ghost" aria-hidden="true">
                <ItemIcon typeId={CASINO_SYMBOLS[(i + 5) % 7].id} size={68} />
              </div>
            </div>
          );
        })}
      </div>
    );
  if (game === "blackjack") {
    const values = result?.values ?? [],
      separator = values.indexOf(-1),
      cut = separator < 0 ? 2 : separator;
    const player = state.hand?.player ?? values.slice(0, cut),
      dealer = state.hand?.dealer ?? values.slice(separator < 0 ? 2 : cut + 1);
    return (
      <div className="lounge-blackjack">
        <CardRow label="Dealer" cards={dealer} hidden={!!state.hand} />
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
  if (game === "roulette" || game === "wheel")
    return (
      <OrbitWheel roulette={game === "roulette"} result={result} busy={busy} />
    );
  if (game === "plinko") return <Plinko result={result} busy={busy} />;
  if (game === "war")
    return (
      <div className="lounge-duel">
        <CardRow label="You" cards={result ? [result.values[0]] : [11]} war />
        <span>VS</span>
        <CardRow label="House" cards={result ? [result.values[1]] : [12]} war />
      </div>
    );
  if (game === "coinflip")
    return (
      <div className={`lounge-coin ${busy ? "is-spinning" : ""}`}>
        <ItemIcon typeId={result?.values[0] === 1 ? 84180 : 72244} size={104} />
        <b>{busy ? "◇" : (result?.label ?? "HEADS / TAILS")}</b>
      </div>
    );
  return (
    <div className={`lounge-dice ${busy ? "is-spinning" : ""}`}>
      <span>PROBABILITY DRIVE</span>
      <strong>{busy ? "··" : (result?.values[0] ?? "50")}</strong>
      <i>01 — 100</i>
    </div>
  );
}
function Rules({ game }: { game: PracticeGame }) {
  const text: Record<PracticeGame, string> = {
    slots:
      "Three independent 16-stop reels. Symbol weights: 4, 3, 3, 2, 2, 1, 1. Exactly two matching symbols return 1.8×. Triple returns are shown below.",
    blackjack:
      "Single shuffled deck. Dealer stands on all 17s. Blackjack returns 2.5× (3:2 profit); a normal win 2×; a push returns your stake. Double on the first two cards. No splits or insurance in practice.",
    roulette:
      "European single-zero wheel. Red or black returns 2×; an exact number returns 36×. Zero loses both color bets.",
    coinflip:
      "Heads and tails each have a 50% chance. A correct call returns 1.96× your stake.",
    dice: "Roll an integer from 1 to 100. Over and under are strict: matching the target loses. A win returns 98 ÷ win-chance-percent times your stake.",
    wheel:
      "20 equally likely sectors: twelve blanks, five 1.2×, two 1.6×, one 10×.",
    plinko:
      "Low-risk table. Twelve independent left/right bounces; the bucket is the number of right bounces. The landing multipliers are shown on the board.",
    war: "Two independent card ranks, 2 low through Ace high. Higher returns 2×; a tie returns only half your stake.",
  };
  return (
    <details className="lounge-rules">
      <summary>
        Rules &amp; payouts <span>＋</span>
      </summary>
      <p>{text[game]}</p>
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
            Tables are connected; wagering awaits bankroll and operating limits.
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
    current = useRef<PracticeState>(state);
  const [mode, setMode] = useState<"practice" | "testnet">("practice");
  const [game, setGame] = useState<string | null>(() =>
    state.hand ? "blackjack" : null,
  );
  const [category, setCategory] = useState("all"),
    [search, setSearch] = useState("");
  const [stake, setStake] = useState("25"),
    [side, setSide] = useState(0),
    [target, setTarget] = useState(50),
    [over, setOver] = useState(true);
  const [busy, setBusy] = useState(false),
    busyRef = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chainBusy, setChainBusy] = useState(false),
    [error, setError] = useState(""),
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
  const locked = busy || chainBusy || !!state.hand;
  const commit = (next: PracticeState) => {
    // Tab-scoped: simultaneous tabs never race to overwrite one shared balance.
    // Fail before changing UI if durable hand/outcome storage is unavailable.
    sessionStorage.setItem(PRACTICE_KEY, JSON.stringify(next));
    current.current = next;
    setState(next);
  };
  function navigate(key: string | null) {
    if (locked || busyRef.current || current.current.hand) return;
    setGame(key);
    setSide(0);
    setTarget(50);
    setError("");
    feedback.play("select");
  }
  function changeMode(value: typeof mode) {
    if (locked || busyRef.current || current.current.hand) return;
    setMode(value);
    setGame(null);
    setCategory("all");
    setSearch("");
    setError("");
    feedback.play("select");
  }
  function act(action?: "hit" | "stand" | "double") {
    if (busyRef.current || mode !== "practice" || !game) return;
    busyRef.current = true;
    setError("");
    try {
      const previous = current.current;
      const next = action
        ? actPractice(previous, action)
        : playPractice(previous, game as PracticeGame, practiceBet(stake), {
            side,
            target,
            over,
          });
      commit(next);
      setBusy(true);
      feedback.play(game === "blackjack" ? "deal" : "spin");
      timer.current = setTimeout(
        () => {
          setBusy(false);
          busyRef.current = false;
          if (next.sequence > previous.sequence)
            feedback.play(
              next.history[0].payout > next.history[0].stake ? "win" : "loss",
            );
        },
        reduce ? 40 : game === "blackjack" ? 450 : 1100,
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
    if (locked || busyRef.current || current.current.hand) return;
    try {
      commit(initialPractice());
      setResetConfirm(false);
      setError("");
      feedback.play("select");
    } catch {
      setError("Browser storage is unavailable.");
    }
  }
  const games = CASINO_CATALOG.filter(
    (g) =>
      !g.disabled &&
      (mode === "testnet" || PRACTICE_GAMES.includes(g.key as PracticeGame)),
  );
  const filtered = games.filter(
    (g) =>
      (category === "all" || g.category === category) &&
      `${g.name} ${titles(g.key).title}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const categories = [...new Set(games.map((g) => g.category))];
  const last = state.history[0]?.game === game ? state.history[0] : null,
    result = busy ? null : last;
  const displayedBalance =
    busy && last && !state.hand ? state.balance - last.payout : state.balance;
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
              navigate(null);
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
          <span className="lounge-mode-label">
            <i />{" "}
            {mode === "practice"
              ? "PLAY MONEY · FREE CHIPS"
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
        {!game ? (
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
                  onClick={() => navigate("slots")}
                >
                  Play Salvage Reels <span>↗</span>
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
                      <img
                        src={`${base}casino/cards/${entry.key}.webp`}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.visibility = "hidden";
                        }}
                      />
                      <span className="tile-icon">
                        <ItemIcon typeId={m.icon} size={42} />
                      </span>
                      <span className="tile-play">↗</span>
                    </div>
                    <div>
                      <small>
                        {entry.name}{" "}
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
                      {state.hand
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
                  />
                  <div
                    className={`lounge-result ${result ? (result.payout > result.stake ? "result-win" : result.payout === result.stake ? "result-push" : "result-loss") : ""}`}
                    role="status"
                    aria-live="polite"
                  >
                    {busy ? (
                      <span>Resolving…</span>
                    ) : state.hand ? (
                      <span>Your total · {cardTotal(state.hand.player)}</span>
                    ) : null}
                    {!busy && state.hand && (
                      <span>Your move · Hit, stand or double</span>
                    )}
                    {!busy &&
                      !state.hand &&
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
                  <label className="stake-label">
                    Stake <span>chips</span>
                    <input
                      aria-label="Stake in play chips"
                      inputMode="decimal"
                      value={stake}
                      disabled={busy || !!state.hand}
                      onChange={(e) => setStake(e.target.value)}
                    />
                  </label>
                  <div className="lounge-stakes">
                    {[10, 25, 100, 500].map((n) => (
                      <button
                        key={n}
                        disabled={busy || !!state.hand}
                        onClick={() => setStake(String(n))}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <fieldset
                    disabled={busy || !!state.hand}
                    className="lounge-options"
                  >
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
                    {game === "roulette" && (
                      <>
                        <legend>Place your bet</legend>
                        {["Red", "Black", "Number"].map((s, i) => (
                          <button
                            key={s}
                            aria-pressed={side === i}
                            onClick={() => {
                              setSide(i);
                              if (i === 2) setTarget(0);
                            }}
                          >
                            {s}
                          </button>
                        ))}
                        {side === 2 && (
                          <label>
                            Number
                            <input
                              aria-label="Roulette number"
                              type="number"
                              min="0"
                              max="36"
                              value={target}
                              onChange={(e) =>
                                setTarget(Number(e.target.value))
                              }
                            />
                          </label>
                        )}
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
                    {game === "plinko" && (
                      <p>
                        LOW RISK <span>12 rows · up to 5×</span>
                      </p>
                    )}
                  </fieldset>
                  {game === "blackjack" && state.hand ? (
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
                        : game === "slots" ||
                            game === "roulette" ||
                            game === "wheel"
                          ? "Spin"
                          : game === "blackjack" || game === "war"
                            ? "Deal"
                            : game === "coinflip"
                              ? "Flip"
                              : game === "plinko"
                                ? "Drop"
                                : "Roll"}{" "}
                      <span>↗</span>
                    </button>
                  )}
                  <p className="lounge-session-note">
                    Free chips · saved in this tab. No wallet or tokens used.
                  </p>
                  <Rules game={game as PracticeGame} />
                </aside>
              </div>
            )}
          </>
        )}
        {mode === "practice" && state.history.length > 0 && !busy && (
          <section className="lounge-history">
            <h3>
              Your recent rounds <span>PLAY MONEY</span>
            </h3>
            <div>
              {state.history.slice(0, 6).map((r) => (
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
