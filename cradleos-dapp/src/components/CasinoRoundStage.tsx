import { casinoMotionProgress } from "../lib/casinoMotion";
import { useEffect, useState, type CSSProperties } from "react";
import { ItemIcon } from "./GameIcon";
import { CASINO_SYMBOLS } from "../lib/casinoLounge";
import { RED, WHEEL_BPS, type Round } from "../lib/casinoPractice";
import { MONEY_TABLE, RISK_TABLES, baccaratScore } from "../lib/casinoExpanded";

export const CASINO_ROUND_MS = 2400;
export const casinoRoundMs = (round: Round | null) =>
  round?.game === "andar_bahar"
    ? Math.max(CASINO_ROUND_MS, round.values.length * 160 + 300)
    : CASINO_ROUND_MS;
const ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const DICE = ["sicbo", "double_dice", "under_over_7", "chuck_a_luck"];
const CARDS = [
  "war",
  "baccarat",
  "three_card_poker",
  "dragon_tiger",
  "red_dog",
  "andar_bahar",
];
const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
const HIGH_RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];
function useProgress(round: Round | null, busy: boolean, reduced: boolean) {
  const [frame, setFrame] = useState<{ round: Round | null; t: number }>({
    round: null,
    t: 0,
  });
  useEffect(() => {
    if (!busy || reduced || !round) return;
    let id = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = casinoMotionProgress(now, start, casinoRoundMs(round) - 160);
      setFrame({ round, t });
      if (t < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [round, busy, reduced]);
  return !busy || reduced ? 1 : frame.round === round ? frame.t : 0;
}
function Card({
  value,
  shown,
  rankOnly = false,
  label,
}: {
  value: number;
  shown: boolean;
  rankOnly?: boolean;
  label?: string;
}) {
  return (
    <div
      className={`casino-dealt-card ${shown ? "revealed" : "covered"}`}
      data-value={shown ? value : undefined}
      aria-label={
        shown
          ? `${label ?? "Card"}: ${rankOnly ? HIGH_RANKS[value] : RANKS[value % 13]}`
          : "Unrevealed card"
      }
    >
      <b>{shown ? (rankOnly ? HIGH_RANKS[value] : RANKS[value % 13]) : "◇"}</b>
      <ItemIcon
        typeId={
          shown
            ? [82425, 87848, 81611, 84955][
                rankOnly ? 0 : Math.floor(value / 13)
              ]
            : 72244
        }
        size={50}
      />
      <small>{label}</small>
    </div>
  );
}
function PipDie({ face, rolling }: { face: number; rolling: boolean }) {
  const positions = [
    [4],
    [0, 8],
    [0, 4, 8],
    [0, 2, 6, 8],
    [0, 2, 4, 6, 8],
    [0, 2, 3, 5, 6, 8],
  ][face - 1];
  return (
    <div
      className={`casino-pip-die ${rolling ? "rolling" : ""}`}
      aria-label={rolling ? "Rolling die" : `Die ${face}`}
      data-face={rolling ? undefined : face}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={positions.includes(i) ? "pip" : ""} />
      ))}
    </div>
  );
}
/** Presentation only: never draws randomness, debits, chooses wins or settles. */
export function CasinoRoundStage({
  game,
  round,
  busy,
  reduced,
}: {
  game: string;
  round: Round | null;
  busy: boolean;
  reduced: boolean;
}) {
  const t = useProgress(round, busy, reduced),
    v = round?.values ?? [],
    has = !!round;
  const count = (n: number) =>
    !has ? 0 : Math.min(n, Math.floor(t * (n + 1)));
  const wheels = ["roulette", "wheel", "risk_wheel", "money_wheel"];
  if (wheels.includes(game)) {
    const table =
      game === "roulette"
        ? ORDER
        : game === "money_wheel"
          ? MONEY_TABLE
          : game === "risk_wheel"
            ? RISK_TABLES[v[1] ?? 0]
            : WHEEL_BPS;
    const index = game === "roulette" ? ORDER.indexOf(v[0] ?? 0) : (v[0] ?? 0),
      step = 360 / table.length;
    const angle = has
      ? (1080 + ((360 - index * step) % 360)) * (1 - Math.pow(1 - t, 4))
      : 0;
    return (
      <div
        className="casino-orbit-stage"
        data-progress={t}
        data-landed={t === 1 && has ? index : undefined}
      >
        <svg
          viewBox="0 0 320 320"
          role="img"
          aria-label={`${game.replace(/_/g, " ")} wheel${!busy && has ? `: ${round.label}` : ""}`}
        >
          <circle cx="160" cy="160" r="149" fill="#101611" stroke="#e4c788" />
          <g transform={`rotate(${angle} 160 160)`}>
            {table.map((n, i) => {
              const a = ((i * step - 90) * Math.PI) / 180;
              return (
                <g key={i}>
                  <circle
                    cx={160 + 127 * Math.cos(a)}
                    cy={160 + 127 * Math.sin(a)}
                    r={table.length > 40 ? 7 : table.length > 25 ? 10 : 16}
                    fill={
                      game === "roulette"
                        ? n === 0
                          ? "#306347"
                          : RED.includes(n)
                            ? "#af291f"
                            : "#242923"
                        : n
                          ? "#785726"
                          : "#242923"
                    }
                    stroke={
                      t === 1 && has && i === index ? "#fafae5" : "#444a37"
                    }
                  />
                  <text
                    x={160 + 127 * Math.cos(a)}
                    y={163 + 127 * Math.sin(a)}
                    textAnchor="middle"
                    fill="#fafae5"
                    fontSize={table.length > 40 ? 6 : 9}
                  >
                    {game === "roulette" ? n : `${n / 10000}×`}
                  </text>
                </g>
              );
            })}
          </g>
          <circle cx="160" cy="160" r="87" fill="#090d0a" stroke="#ff280060" />
          <text
            x="160"
            y="152"
            fill="#b6b6a6"
            textAnchor="middle"
            fontSize="10"
            letterSpacing="2"
          >
            {game === "roulette" ? "ORBITAL" : "REACTOR"}
          </text>
          <text
            x="160"
            y="185"
            fill="#fafae5"
            textAnchor="middle"
            fontSize="30"
          >
            {has && t === 1
              ? game === "roulette"
                ? v[0]
                : table[index] / 10000 + "×"
              : "◇"}
          </text>
          <path d="M150 3 L170 3 L160 25Z" fill="#fafae5" />
        </svg>
      </div>
    );
  }
  if (game === "slots")
    return (
      <div className="lounge-reels casino-moving-reels" data-progress={t}>
        {[0, 1, 2].map((i) => {
          const end = 0.62 + i * 0.16,
            done = has && t >= end,
            p = Math.min(1, t / end),
            symbol = done ? v[i] : (Math.floor(p * 28) + i) % 7;
          return (
            <div
              key={i}
              className={has && !done ? "reel-moving" : "reel-stopped"}
              data-symbol={done ? symbol : undefined}
              style={
                {
                  "--roll-y": `${done ? 0 : -Math.sin(p * 28 * Math.PI) * 22}px`,
                } as CSSProperties
              }
            >
              <ItemIcon
                typeId={CASINO_SYMBOLS[has ? symbol : [4, 3, 6][i]].id}
                size={90}
              />
              <span>{done ? CASINO_SYMBOLS[symbol].name : "SALVAGE"}</span>
            </div>
          );
        })}
      </div>
    );
  if (game === "coinflip") {
    const face = has && t === 1 ? v[0] : Math.floor(t * 10) % 2;
    return (
      <div className="casino-coin-stage" data-progress={t}>
        <div
          className="lounge-coin"
          style={{
            transform: `rotateY(${has ? (1 - Math.pow(1 - t, 3)) * 1800 : 0}deg)`,
          }}
        >
          <ItemIcon typeId={face ? 84180 : 72244} size={100} />
          <b>{has && t === 1 ? (face ? "TAILS" : "HEADS") : "SIGNAL"}</b>
        </div>
      </div>
    );
  }
  if (game === "dice")
    return (
      <div className="lounge-dice" data-progress={t}>
        <span>PROBABILITY DRIVE</span>
        <strong>
          {has ? (t === 1 ? v[0] : (Math.floor(t * 791) % 100) + 1) : "—"}
        </strong>
        <i>01 — 100</i>
      </div>
    );
  if (DICE.includes(game))
    return (
      <div className="casino-dice-stage" data-progress={t}>
        {Array.from(
          { length: game === "double_dice" || game === "under_over_7" ? 2 : 3 },
          (_, i) => {
            const done = has && t >= 0.68 + i * 0.1;
            return (
              <PipDie
                key={i}
                face={
                  done ? v[i] : has ? ((Math.floor(t * 40) + i) % 6) + 1 : i + 1
                }
                rolling={has && !done}
              />
            );
          },
        )}
      </div>
    );
  if (game === "crash" || game === "limbo") {
    const ceiling = (v[0] ?? 10000) / 10000,
      now = has ? Math.exp(Math.log(Math.max(0.98, ceiling)) * t) : 1;
    const x = 30 + t * 270,
      y = 175 - t * 135;
    return (
      <div className="casino-flight-stage" data-progress={t}>
        <strong>{now.toFixed(2)}×</strong>
        <svg viewBox="0 0 340 220" aria-label="Multiplier flight">
          <path d="M30 20V185H325" stroke="#fafae52a" fill="none" />
          <path
            d={`M30 175 Q${x} 175 ${x} ${y}`}
            stroke={t === 1 && has ? "#ff2800" : "#e4c788"}
            strokeWidth="3"
            fill="none"
          />
          {has && <circle cx={x} cy={y} r="7" fill="#fafae5" />}
        </svg>
        <span>
          {has
            ? `Target ${(v[1] / 10000).toFixed(2)}× · ${t === 1 ? "flight ended" : "precommitted auto-stop"}`
            : "Choose your target before launch"}
        </span>
      </div>
    );
  }
  if (game === "keno") {
    const n = v[0] ?? 0,
      picks = v.slice(1, n + 1),
      drawn = v.slice(n + 1),
      shown = drawn.slice(0, count(10));
    return (
      <div className="casino-keno-stage" data-progress={t}>
        {Array.from({ length: 40 }, (_, i) => {
          const value = i + 1;
          return (
            <span
              key={value}
              className={`${picks.includes(value) ? "picked" : ""} ${shown.includes(value) ? "drawn" : ""}`}
              data-number={value}
              data-drawn={shown.includes(value)}
            >
              {value}
            </span>
          );
        })}
        <small>
          {shown.length} / 10 signals · outlined numbers are your picks
        </small>
      </div>
    );
  }
  if (game === "diamonds" || game === "scratch_cards") {
    const n = game === "diamonds" ? 5 : 9;
    return (
      <div
        className={`casino-symbol-grid ${game === "scratch_cards" ? "scratch-grid" : ""}`}
        data-progress={t}
      >
        {Array.from({ length: n }, (_, i) => {
          const shown = i < count(n),
            symbol = CASINO_SYMBOLS[v[i] ?? i % 7];
          return (
            <div
              key={i}
              className={shown ? "revealed" : "covered"}
              data-symbol={shown ? v[i] : undefined}
              aria-label={shown ? symbol.name : "Sealed signal"}
            >
              {shown ? (
                <>
                  <ItemIcon typeId={symbol.id} size={64} />
                  <small>{symbol.name}</small>
                </>
              ) : (
                <span>◇</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  if (game === "ore_refine")
    return (
      <div
        className={`casino-refinery ${has && t === 1 ? `yield-${v[0]}` : ""}`}
        data-progress={t}
      >
        <div className="refinery-core">
          <ItemIcon
            typeId={has && t === 1 ? [78423, 88335, 84180, 91209][v[0]] : 91209}
            size={116}
          />
        </div>
        <progress
          max="1"
          value={has ? t : 0}
          aria-label="Refinement progress"
        />
        <b>
          {has && t === 1
            ? ["SLAG", "PARTIAL", "YIELD", "BONUS"][v[0]]
            : "REFINERY"}
        </b>
      </div>
    );
  if (CARDS.includes(game)) {
    if (game === "andar_bahar") {
      const dealt = Math.max(0, count(v.length) - 1),
        log = v.slice(1, 1 + dealt),
        last = log.slice(-8),
        start = log.length - last.length;
      return (
        <div className="casino-card-stage" data-progress={t}>
          <div className="casino-card-line">
            <span>Joker</span>
            <Card value={v[0] ?? 0} shown={has} />
          </div>
          <div className="casino-card-line">
            {last.map((c, i) => (
              <Card
                key={start + i}
                value={c}
                shown
                label={(start + i) % 2 ? "Bahar" : "Andar"}
              />
            ))}
          </div>
          <small>{dealt} cards dealt · alternating sides</small>
        </div>
      );
    }
    const separator = v.indexOf(-1),
      groups =
        separator >= 0
          ? [v.slice(0, separator), v.slice(separator + 1)]
          : game === "red_dog"
            ? [v.slice(0, 2), v.slice(2)]
            : [[v[0]], [v[1]]];
    const labels =
      game === "baccarat"
        ? ["Player", "Banker"]
        : game === "dragon_tiger"
          ? ["Dragon", "Tiger"]
          : game === "red_dog"
            ? ["Anchors", "Inside card"]
            : ["You", "Dealer"];
    let offset = 0;
    return (
      <div className="casino-card-stage" data-progress={t}>
        {groups.map((cards, g) => {
          const initial = offset;
          offset += cards.length;
          return (
            <div className="casino-card-line" key={g}>
              <span>
                {labels[g]}
                {has && t === 1 && game === "baccarat"
                  ? ` · ${baccaratScore(cards)}`
                  : ""}
              </span>
              {(has ? cards : [0, 0]).map((c, i) => (
                <Card
                  key={i}
                  value={game === "red_dog" ? c - 1 : c}
                  shown={
                    has && initial + i < count(v.filter((x) => x !== -1).length)
                  }
                  rankOnly={["war", "dragon_tiger", "red_dog"].includes(game)}
                />
              ))}
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}
