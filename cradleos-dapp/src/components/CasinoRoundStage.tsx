import { type CSSProperties } from "react";
import { ItemIcon } from "./GameIcon";
import { CASINO_SYMBOLS } from "../lib/casinoLounge";
import { RED, WHEEL_BPS, type Round, type Choice } from "../lib/casinoPractice";
import {
  MONEY_TABLE,
  RISK_TABLES,
  baccaratScore,
  threeRank,
} from "../lib/casinoExpanded";
import {
  clamp,
  ease,
  coinPose,
  wheelAngle,
  rouletteBall,
  tableDuration,
  STILL_RUN,
  type TableRun,
} from "../lib/casinoTableMotion";
import {
  useCasinoTimeline,
  useTableCues,
  type MotionCue,
} from "./useCasinoTimeline";
import "../styles/casino-table-motion.css";
export const CASINO_ROUND_MS = 2400;
export const casinoRoundMs = tableDuration;
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
const HIGH = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export function MotionCard({
  value,
  progress = 1,
  hidden = false,
  rankOnly = false,
  label = "",
  winner = false,
  fly = false,
}: {
  value: number;
  progress?: number;
  hidden?: boolean;
  rankOnly?: boolean;
  label?: string;
  winner?: boolean;
  fly?: boolean;
}) {
  const p = clamp(progress),
    shown = !hidden && p >= 0.5,
    rank = rankOnly ? HIGH[value] : RANKS[value % 13],
    suit = rankOnly ? 0 : Math.floor(value / 13);
  const transform = fly
    ? `translate3d(${(1 - ease(p)) * 90}px,${-(1 - ease(p)) * 90}px,0) rotate(${(1 - p) * -18}deg) rotateY(${p < 0.5 ? p * 180 : (1 - p) * 180}deg)`
    : `rotateY(${p < 0.5 ? p * 180 : (1 - p) * 180}deg)`;
  return (
    <div
      className={`casino-dealt-card motion-card ${shown ? "revealed" : "covered"} ${winner && p === 1 ? "card-winner" : ""}`}
      data-value={shown ? value : undefined}
      data-card-progress={p}
      aria-label={shown ? `${label || "Card"}: ${rank}` : "Unrevealed card"}
      style={{ transform, opacity: p === 0 && fly ? 0 : 1 }}
    >
      <b>{shown ? rank : "◇"}</b>
      <ItemIcon
        typeId={shown ? [82425, 87848, 81611, 84955][suit] : 72244}
        size={50}
      />
      <small>{label}</small>
    </div>
  );
}
const PIPS = [
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
];
function PhysicalDie({
  face,
  index,
  t,
  has,
}: {
  face: number;
  index: number;
  t: number;
  has: boolean;
}) {
  const p = has ? clamp((t - 0.06 - index * 0.07) / 0.74) : 1,
    done = has && p === 1;
  const [rx, ry] = [
    [0, 0],
    [0, -90],
    [90, 0],
    [-90, 0],
    [0, 90],
    [0, 180],
  ][face - 1];
  const lift =
    has && p < 1 ? Math.abs(Math.sin(p * Math.PI * 2.5)) * 45 * (1 - p) : 0;
  return (
    <div
      className="physical-die-floor"
      style={{ "--shadow": 0.18 + 0.5 * p } as CSSProperties}
    >
      <div
        className="physical-die"
        data-face={done ? face : undefined}
        aria-label={done ? `Die ${face}` : "Rolling die"}
        style={{
          transform: `translate3d(${has ? Math.sin(p * Math.PI * 2 + index) * 20 * (1 - p) : 0}px,${-lift}px,0) rotateX(${ease(p) * (1080 + rx)}deg) rotateY(${ease(p) * (720 + ry)}deg)`,
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className={`die-face face-${n}`} aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} className={PIPS[n - 1].includes(i) ? "pip" : ""} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
const at = (cx: number, cy: number, r: number, a: number) => [
  cx + r * Math.cos((a * Math.PI) / 180),
  cy + r * Math.sin((a * Math.PI) / 180),
];
function wedge(i: number, n: number) {
  const step = 360 / n,
    a = at(160, 160, 146, i * step - 90 - step / 2),
    b = at(160, 160, 146, (i + 1) * step - 90 - step / 2);
  return `M160 160 L${a.join(" ")} A146 146 0 0 1 ${b.join(" ")}Z`;
}
export function CasinoRoundStage({
  game,
  round,
  busy,
  reduced,
  run = STILL_RUN,
  choice = {},
}: {
  game: string;
  round: Round | null;
  busy: boolean;
  reduced: boolean;
  run?: TableRun;
  choice?: Choice;
}) {
  const { t, animated } = useCasinoTimeline(run, busy, reduced),
    v = round?.values ?? [],
    has = !!round,
    done = has && t === 1;
  const count = (n: number) =>
    !has ? 0 : Math.min(n, Math.floor(t * (n + 1)));
  const cardValues = v.filter((x) => x !== -1);
  const cues: MotionCue[] =
    game === "keno"
      ? Array.from({ length: 10 }, (_, i) => ({
          at: ((i + 1) * (run.duration - 100)) / 11,
          cue: "scan",
        }))
      : CARDS.includes(game)
        ? Array.from({ length: Math.min(30, cardValues.length) }, (_, i) => ({
            at: ((i + 1) * (run.duration - 100)) / (cardValues.length + 1),
            cue: "card",
          }))
        : DICE.includes(game)
          ? (game === "double_dice" || game === "under_over_7"
              ? [0.8, 0.87]
              : [0.8, 0.87, 0.94]
            ).map((n) => ({
              at: n * (run.duration - 100),
              cue: "land",
            }))
          : ["roulette", "wheel", "risk_wheel", "money_wheel"].includes(game)
            ? [0.12, 0.21, 0.3, 0.39, 0.48, 0.59, 0.71, 0.84, 0.95].map(
                (n) => ({ at: n * (run.duration - 100), cue: "tap" }),
              )
            : game === "coinflip"
              ? [{ at: (run.duration - 100) * 0.94, cue: "land" }]
              : game === "ore_refine"
                ? [
                    { at: 350, cue: "engine" },
                    { at: (run.duration - 100) * 0.86, cue: "land" },
                  ]
                : [];
  useTableCues(run, t, animated, cues);
  if (["roulette", "wheel", "risk_wheel", "money_wheel"].includes(game)) {
    const table =
      game === "roulette"
        ? ORDER
        : game === "money_wheel"
          ? MONEY_TABLE
          : game === "risk_wheel"
            ? RISK_TABLES[v[1] ?? 0]
            : WHEEL_BPS;
    const index = game === "roulette" ? ORDER.indexOf(v[0] ?? 0) : (v[0] ?? 0),
      step = 360 / table.length,
      angle = has ? wheelAngle(t, index, table.length) : 0,
      ball = rouletteBall(t, angle);
    return (
      <div
        className={`casino-orbit-stage table-wheel wheel-${game}`}
        data-progress={t}
        data-landed={done ? index : undefined}
      >
        <svg
          viewBox="0 0 320 320"
          role="img"
          aria-label={`${game.replace(/_/g, " ")} wheel${done ? `: ${round!.label}` : ""}`}
        >
          <defs>
            <radialGradient id={`rim-${game}`}>
              <stop stopColor="#574b32" />
              <stop offset=".85" stopColor="#171b18" />
              <stop offset="1" stopColor="#d0ba82" />
            </radialGradient>
          </defs>
          <circle cx="160" cy="160" r="156" fill={`url(#rim-${game})`} />
          <g className="wheel-rotor" transform={`rotate(${angle} 160 160)`}>
            {table.map((n, i) => {
              const [x, y] = at(160, 160, 127, i * step - 90);
              return (
                <g key={i}>
                  <path
                    d={wedge(i, table.length)}
                    fill={
                      game === "roulette"
                        ? n === 0
                          ? "#245a42"
                          : RED.includes(n)
                            ? "#9e281f"
                            : "#151c1b"
                        : n === 0
                          ? "#1b2525"
                          : i % 2
                            ? "#6b5230"
                            : "#3b514b"
                    }
                    stroke={done && i === index ? "#fafae5" : "#ad9e664d"}
                    strokeWidth={done && i === index ? 2 : 1}
                  />
                  <text
                    x={x}
                    y={y + 3}
                    textAnchor="middle"
                    fill="#fafae5"
                    fontSize={table.length > 40 ? 7 : 10}
                    transform={`rotate(${i * step} ${x} ${y})`}
                  >
                    {game === "roulette" ? n : `${n / 10000}×`}
                  </text>
                </g>
              );
            })}
          </g>
          <circle cx="160" cy="160" r="96" fill="#0a1112" stroke="#c9bb7855" />
          <circle cx="160" cy="160" r="85" fill="none" stroke="#c9bb7825" />
          <text x="160" y="141" textAnchor="middle" className="wheel-kicker">
            {game === "roulette"
              ? "ORBITAL"
              : game === "money_wheel"
                ? "SALVAGE"
                : game === "risk_wheel"
                  ? "OVERDRIVE"
                  : "REACTOR"}
          </text>
          <text x="160" y="181" textAnchor="middle" className="wheel-value">
            {done
              ? game === "roulette"
                ? v[0]
                : `${table[index] / 10000}×`
              : "◇"}
          </text>
          <path
            className="wheel-pointer"
            d="M150 2 L170 2 L160 26Z"
            fill="#fafae5"
            style={{
              transformOrigin: "160px 2px",
              transform: `rotate(${animated ? Math.sin(t * 120) * 8 * (1 - t) : 0}deg)`,
            }}
          />
          {game === "roulette" && has && (
            <circle
              className="roulette-ball"
              data-ball-x={ball.x}
              data-ball-y={ball.y}
              cx={ball.x}
              cy={ball.y}
              r="4.5"
              fill="#fff9d9"
            />
          )}
        </svg>
        <div className="wheel-pocket-label">
          {done
            ? `Landed · ${game === "roulette" ? v[0] : `${table[index] / 10000}×`}`
            : "Awaiting pocket"}
        </div>
      </div>
    );
  }
  if (game === "slots")
    return (
      <div className="lounge-reels casino-moving-reels" data-progress={t}>
        {[0, 1, 2].map((i) => {
          const end = 0.62 + i * 0.16,
            p = Math.min(1, t / end),
            stopped = has && t >= end,
            symbol = stopped ? v[i] : (Math.floor(p * 28) + i) % 7;
          return (
            <div
              key={i}
              className={has && !stopped ? "reel-moving" : "reel-stopped"}
              data-symbol={stopped ? symbol : undefined}
              style={
                {
                  "--roll-y": `${stopped ? 0 : -Math.sin(p * 28 * Math.PI) * 22}px`,
                } as CSSProperties
              }
            >
              <ItemIcon
                typeId={CASINO_SYMBOLS[has ? symbol : [4, 3, 6][i]].id}
                size={90}
              />
              <span>{stopped ? CASINO_SYMBOLS[symbol].name : "SALVAGE"}</span>
            </div>
          );
        })}
      </div>
    );
  if (game === "coinflip") {
    const pose = coinPose(has ? t : 0, v[0] ?? 0);
    return (
      <div className="casino-coin-stage physical-coin-stage" data-progress={t}>
        <div
          className="coin-shadow"
          style={{
            transform: `scale(${1 - pose.lift / 150})`,
            opacity: 0.55 - pose.lift / 190,
          }}
        />
        <div
          className="physical-coin"
          style={{
            transform: `translateY(${-pose.lift}px) rotateZ(${pose.tilt}deg) rotateY(${pose.angle}deg)`,
          }}
        >
          {[0, 1].map((face) => (
            <div key={face} className={`coin-face coin-face-${face}`}>
              <ItemIcon typeId={face ? 84180 : 72244} size={90} />
              <b>{face ? "TAILS" : "HEADS"}</b>
            </div>
          ))}
        </div>
        <span className="motion-caption">
          {done
            ? v[0]
              ? "TAILS"
              : "HEADS"
            : has
              ? "SIGNAL IN FLIGHT"
              : "CALL YOUR SIGNAL"}
        </span>
      </div>
    );
  }
  if (game === "dice") {
    const number = done
        ? v[0]
        : has
          ? (Math.floor(ease(t) * 987) % 100) + 1
          : 0,
      threshold = choice.target;
    return (
      <div className="probability-stage" data-progress={t}>
        <small>PROBABILITY DRIVE</small>
        <strong>{has ? String(number).padStart(2, "0") : "—"}</strong>
        <div className="probability-rail">
          {threshold !== undefined && <i style={{ left: `${threshold}%` }} />}
          <b style={{ left: `${number}%` }} />
        </div>
        <span>
          {threshold === undefined
            ? "ROLL"
            : `${choice.over ? "OVER" : "UNDER"} ${threshold}`}{" "}
          {done ? "· RESOLVED" : ""}
        </span>
      </div>
    );
  }
  if (DICE.includes(game)) {
    const n = game === "double_dice" || game === "under_over_7" ? 2 : 3,
      total = v.reduce((a, b) => a + b, 0),
      target = choice.target;
    return (
      <div
        className={`physical-dice-stage ${game === "chuck_a_luck" ? "dice-cage" : ""}`}
        data-progress={t}
      >
        <div className="dice-throw">
          {Array.from({ length: n }, (_, i) => (
            <PhysicalDie
              key={i}
              face={has ? v[i] : i + 1}
              index={i}
              t={t}
              has={has}
            />
          ))}
        </div>
        <div className="dice-readout">
          {done
            ? game === "chuck_a_luck"
              ? target === undefined
                ? round!.label
                : `${v.filter((x) => x === target).length} × ${target} MATCHES`
              : game === "under_over_7"
                ? `${total} · ${total === 7 ? "EXACTLY SEVEN" : total < 7 ? "UNDER SEVEN" : "OVER SEVEN"}`
                : `TOTAL ${total}${new Set(v).size === 1 ? " · " + (n === 3 ? "TRIPLE" : "DOUBLE") : ""}`
            : "DICE IN PLAY"}
        </div>
      </div>
    );
  }
  if (game === "crash" || game === "limbo") {
    const end = (v[0] ?? 10000) / 10000,
      target = (v[1] ?? 20000) / 10000,
      current = has ? Math.exp(Math.log(Math.max(0.98, end)) * t) : 1,
      hit = has && end >= target && (done || current >= target),
      cross =
        end >= target ? Math.log(target) / Math.log(Math.max(1.00001, end)) : 2;
    if (game === "limbo")
      return (
        <div
          className={`limbo-gate ${done ? (hit ? "gate-clear" : "gate-denied") : ""}`}
          data-progress={t}
        >
          <div
            className="gate-rings"
            style={{ "--charge": `${has ? t * 360 : 0}deg` } as CSSProperties}
          >
            <ItemIcon typeId={84955} size={130} />
            <strong>{current.toFixed(2)}×</strong>
          </div>
          <span>JUMP THRESHOLD {target.toFixed(2)}×</span>
          <b>
            {done
              ? hit
                ? "GATE CLEARED"
                : "THRESHOLD NOT REACHED"
              : "CHARGING"}
          </b>
        </div>
      );
    const x = 30 + t * 270,
      y =
        180 -
        Math.min(140, (Math.log(Math.max(1, current)) / Math.log(target)) * 75),
      cx = 30 + clamp(cross) * 270,
      cy = 105;
    return (
      <div className="casino-flight-stage warp-flight" data-progress={t}>
        <strong>{current.toFixed(2)}×</strong>
        <svg viewBox="0 0 340 225" aria-label="Precommitted auto-stop flight">
          <path d="M30 15V190H325" stroke="#fafae52a" fill="none" />
          {
            <g>
              <path
                d={`M30 ${cy}H325`}
                stroke="#7bc6ad66"
                strokeDasharray="4 5"
              />
              <text x="35" y={cy - 6} fill="#7bc6ad" fontSize="10">
                AUTO-STOP {target.toFixed(2)}×
              </text>
            </g>
          }
          <path
            d={`M30 180 Q${x} 180 ${x} ${y}`}
            stroke={hit ? "#75c8af" : "#dec18a"}
            strokeWidth="3"
            fill="none"
          />
          {has && (
            <g transform={`translate(${x} ${y}) rotate(-28)`}>
              <path d="M-16 0L10-6L18 0L10 6Z" fill="#fafae5" />
              <path
                d="M-18-4L-28 0L-18 4"
                fill="#ff7044"
                opacity={done ? 0.3 : 1}
              />
            </g>
          )}
          {hit && (
            <circle cx={cx} cy={cy} r="7" stroke="#7bc6ad" fill="#0e211f" />
          )}
          {done && (
            <g transform={`translate(${x} ${y})`} stroke="#ff784f">
              <path d="M-13-13L13 13M13-13L-13 13" />
            </g>
          )}
        </svg>
        <span>
          {done
            ? hit
              ? `Auto-stop paid at ${target.toFixed(2)}× · Flight ended ${end.toFixed(2)}×`
              : `Flight ended before ${target.toFixed(2)}×`
            : "Target locked before launch"}
        </span>
      </div>
    );
  }
  if (game === "keno") {
    const n = v[0] ?? 0,
      picks = v.slice(1, n + 1),
      drawn = v.slice(n + 1),
      shown = drawn.slice(0, count(10)),
      latest = shown.slice(-1)[0];
    return (
      <div className="keno-scanner" data-progress={t}>
        <div className="keno-incoming">
          <span>INCOMING SIGNAL</span>
          <strong>{latest ?? "—"}</strong>
          <b>
            {shown.filter((x) => picks.includes(x)).length} / {n} MATCHED
          </b>
        </div>
        <div className="casino-keno-stage">
          {Array.from({ length: 40 }, (_, i) => {
            const value = i + 1;
            return (
              <span
                key={value}
                className={`${picks.includes(value) ? "picked" : ""} ${shown.includes(value) ? "drawn" : ""} ${latest === value ? "latest-signal" : ""}`}
                data-number={value}
                data-drawn={shown.includes(value)}
              >
                {value}
              </span>
            );
          })}
          <div
            className="scanner-sweep"
            style={{
              top: `${((t * 4) % 1) * 100}%`,
              opacity: animated ? 0.25 : 0,
            }}
          />
        </div>
        <div className="keno-draw-strip" aria-label="Draw order">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={picks.includes(shown[i]) ? "matched" : ""}>
              {shown[i] ?? "·"}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (game === "diamonds") {
    const counts = Array.from(
        { length: 7 },
        (_, n) => v.filter((x) => x === n).length,
      ),
      best = Math.max(...counts),
      max = has ? 5 : 0;
    return (
      <div className="signal-capsules" data-progress={t}>
        {Array.from({ length: 5 }, (_, i) => {
          const p = has ? clamp((t - i * 0.14) / 0.23) : 0,
            shown = p > 0.5,
            symbol = CASINO_SYMBOLS[v[i] ?? i];
          return (
            <div
              className={`signal-capsule ${done && best >= 3 && counts[v[i]] === best ? "matched-capsule" : ""}`}
              data-symbol={shown ? v[i] : undefined}
              style={{
                transform: `translateY(${(1 - ease(p)) * -15}px) rotateY(${shown ? (1 - p) * 180 : p * 180}deg)`,
              }}
              key={i}
            >
              {shown ? (
                <>
                  <ItemIcon typeId={symbol.id} size={68} />
                  <small>{symbol.name}</small>
                </>
              ) : (
                <b>◇</b>
              )}
            </div>
          );
        })}
        <span className="motion-caption">
          {done
            ? best >= 2
              ? `${best} MATCHING SIGNALS`
              : "NO MATCHING GROUP"
            : max
              ? "DECODING SIGNALS"
              : "FIVE SEALED SIGNALS"}
        </span>
      </div>
    );
  }
  if (game === "ore_refine")
    return (
      <div
        className={`casino-refinery refinery-machine ${done ? `yield-${v[0]}` : ""}`}
        data-progress={t}
      >
        <div
          className="refinery-feed"
          style={{
            transform: `translateX(${ease(clamp(t / 0.3)) * 50}px)`,
            opacity: has ? 1 - clamp((t - 0.22) * 8) : 0.8,
          }}
        >
          <ItemIcon typeId={78423} size={55} />
        </div>
        <div
          className="refinery-core"
          style={{ "--heat": has ? Math.sin(t * Math.PI) : 0 } as CSSProperties}
        >
          <div
            className="refinery-blades"
            style={{ transform: `rotate(${has ? ease(t) * 1080 : 0}deg)` }}
          />
          <ItemIcon
            typeId={done ? [78423, 88335, 84180, 91209][v[0]] : 91209}
            size={100}
          />
        </div>
        <div
          className="refinery-output"
          style={{
            opacity: clamp((t - 0.8) * 5),
            transform: `translateX(${clamp((t - 0.8) * 5) * 20}px)`,
          }}
        >
          {done ? (
            <ItemIcon typeId={[78423, 88335, 84180, 91209][v[0]]} size={55} />
          ) : null}
        </div>
        <progress
          max="1"
          value={has ? t : 0}
          aria-label="Refinement progress"
        />
        <b>
          {done
            ? ["SLAG", "PARTIAL YIELD", "REFINED YIELD", "BONUS YIELD"][v[0]]
            : has
              ? t < 0.3
                ? "FEEDING"
                : t < 0.8
                  ? "REFINING"
                  : "EXTRACTING"
              : "REFINERY READY"}
        </b>
      </div>
    );
  if (CARDS.includes(game)) {
    const pCard = (order: number, n: number) =>
      has ? clamp((t * (n + 1) - order - 0.35) * 1.65) : 0;
    if (game === "andar_bahar") {
      const dealt = Math.max(0, count(v.length) - 1),
        log = v.slice(1, 1 + dealt);
      return (
        <div className="andar-table" data-progress={t}>
          <div className="andar-joker">
            <small>MATCH THIS RANK</small>
            <MotionCard value={v[0] ?? 0} hidden={!has} />
          </div>
          <div className="andar-lanes">
            {[0, 1].map((side) => {
              const indices = log
                .map((_, i) => i)
                .filter((i) => i % 2 === side)
                .slice(-4);
              return (
                <section key={side}>
                  <h4>{side ? "BAHAR" : "ANDAR"}</h4>
                  <div className="andar-stack">
                    {indices.map((i, j) => (
                      <div key={i} style={{ left: `${j * 18}%`, zIndex: j }}>
                        <MotionCard
                          value={log[i]}
                          progress={pCard(i + 1, v.length)}
                          fly
                          label={`${i + 1}`}
                          winner={
                            done && i === log.length - 1 && log[i] === v[0]
                          }
                        />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <span>{dealt} cards dealt</span>
        </div>
      );
    }
    const sep = v.indexOf(-1),
      groups =
        sep >= 0
          ? [v.slice(0, sep), v.slice(sep + 1)]
          : game === "red_dog"
            ? [v.slice(0, 2), v.slice(2)]
            : [[v[0]], [v[1]]];
    const labels =
      game === "baccarat"
        ? ["PLAYER", "BANKER"]
        : game === "dragon_tiger"
          ? ["DRAGON", "TIGER"]
          : game === "red_dog"
            ? ["ANCHORS", "INSIDE CARD"]
            : ["YOUR HAND", "DEALER"];
    const sequence =
      game === "baccarat"
        ? [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
            ...(groups[0].length === 3 ? [[0, 2]] : []),
            ...(groups[1].length === 3 ? [[1, 2]] : []),
          ]
        : groups.flatMap((g, row) => g.map((_, i) => [row, i]));
    const rankOnly = ["war", "dragon_tiger", "red_dog"].includes(game);
    return (
      <div className={`casino-card-stage card-table-${game}`} data-progress={t}>
        {groups.map((cards, row) => (
          <div key={row} className="casino-card-line">
            <span>
              {labels[row]}{" "}
              {game === "baccarat" && has
                ? `· ${baccaratScore(
                    cards.filter(
                      (_, i) =>
                        pCard(
                          sequence.findIndex(([r, c]) => r === row && c === i),
                          sequence.length,
                        ) >= 0.5,
                    ),
                  )}`
                : ""}
            </span>
            {(has ? cards : [0, 0]).map((card, i) => {
              const order = sequence.findIndex(
                ([r, c]) => r === row && c === i,
              );
              return (
                <MotionCard
                  key={i}
                  value={game === "red_dog" ? card - 1 : card}
                  progress={pCard(order, sequence.length)}
                  hidden={!has}
                  fly
                  rankOnly={rankOnly}
                  winner={
                    done &&
                    round!.payout > round!.stake &&
                    (game === "three_card_poker"
                      ? row === 0 &&
                        (threeRank(groups[0]) >= 2 ||
                          (threeRank(groups[0]) === 1
                            ? groups[0].filter((x) => x % 13 === card % 13)
                                .length === 2
                            : Math.max(
                                ...groups[0].map((x) =>
                                  x % 13 === 0 ? 13 : x % 13,
                                ),
                              ) === (card % 13 === 0 ? 13 : card % 13)))
                      : game === "dragon_tiger"
                        ? v[0] !== v[1] && (v[0] > v[1] ? 0 : 1) === row
                        : game === "baccarat"
                          ? baccaratScore(groups[row]) >
                            baccaratScore(groups[1 - row])
                          : game === "war"
                            ? row === 0
                            : false)
                  }
                />
              );
            })}
          </div>
        ))}
        {game === "red_dog" && has && pCard(1, 3) >= 1 && (
          <div className="rank-window">
            {HIGH.map((label, i) => (
              <span
                key={i}
                className={`${i > Math.min(v[0], v[1]) - 1 && i < Math.max(v[0], v[1]) - 1 ? "inside-window" : ""} ${done && i === v[2] - 1 ? "post-rank" : ""}`}
              >
                {label}
              </span>
            ))}
          </div>
        )}
        {game === "three_card_poker" && done && (
          <div className="card-verdict">
            {
              [
                "HIGH CARD",
                "PAIR",
                "FLUSH",
                "STRAIGHT",
                "THREE OF A KIND",
                "STRAIGHT FLUSH",
              ][threeRank(groups[0])]
            }{" "}
            · {round!.label}
          </div>
        )}
        {done && game !== "three_card_poker" && (
          <div className="card-verdict">{round!.label}</div>
        )}
      </div>
    );
  }
  return null;
}
