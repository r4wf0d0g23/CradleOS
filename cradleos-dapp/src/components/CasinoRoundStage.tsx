import { CasinoFleetDuel } from "./CasinoFleetDuel";
import {
  probabilityRollPose,
  probabilityPercent,
} from "../lib/casinoProbabilityMotion";
import { CasinoWarpRun } from "./CasinoWarpRun";
import { CasinoLaiJump } from "./CasinoLaiJump";
import { MotionCard, TableShoe } from "./CasinoTableCard";
export { MotionCard } from "./CasinoTableCard";
import { type CSSProperties } from "react";
import { CasinoRefinery } from "./CasinoRefinery";
import { CasinoWheelMechanism } from "./CasinoWheelMechanism";
import { ItemIcon } from "./GameIcon";
import { CASINO_SYMBOLS } from "../lib/casinoLounge";
import { type Round, type Choice } from "../lib/casinoPractice";
import { baccaratScore, threeRank } from "../lib/casinoExpanded";
import {
  clamp,
  ease,
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
import {
  diePose,
  dieLight,
  tokenPose,
  DIE_CONTACTS,
} from "../lib/casinoObjectMotion";
export const CASINO_ROUND_MS = 2400;
export const casinoRoundMs = tableDuration;
const DICE = ["sicbo", "double_dice", "under_over_7", "chuck_a_luck"];
const CARDS = [
  "baccarat",
  "three_card_poker",
  "dragon_tiger",
  "red_dog",
  "andar_bahar",
];
const HIGH = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const PIPS = [
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
];
export function PhysicalDie({
  face,
  index,
  t,
  has,
  matched = false,
}: {
  matched?: boolean;
  face: number;
  index: number;
  t: number;
  has: boolean;
}) {
  const p = has ? clamp((t - 0.06 - index * 0.07) / 0.74) : 1,
    done = has && p === 1;
  const pose = diePose(has ? p : 1, face, index);
  return (
    <div
      className={`physical-die-floor ${done && matched ? "die-matched" : ""}`}
      style={
        {
          "--shadow": pose.shadow,
          "--shadow-x": `${pose.x}px`,
          "--shadow-scale": pose.shadowScale,
          "--shadow-blur": `${3 + pose.height / 14}px`,
        } as CSSProperties
      }
    >
      <div
        className="physical-die"
        data-face={done ? face : undefined}
        aria-label={done ? `Die ${face}` : "Rolling die"}
        style={{
          transform: `translate3d(${pose.x}px,${-pose.height}px,0) rotateZ(${pose.rz}deg) rotateX(${pose.rx}deg) rotateY(${pose.ry}deg)`,
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div
            key={n}
            className={`die-face face-${n}`}
            aria-hidden="true"
            style={{
              filter: `brightness(${dieLight(n - 1, pose.rx, pose.ry)})`,
            }}
          >
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} className={PIPS[n - 1].includes(i) ? "pip" : ""} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
export function CasinoRoundStage({
  game,
  round,
  busy,
  reduced,
  run = STILL_RUN,
  choice = {},
  animateSlots = false,
}: {
  game: string;
  round: Round | null;
  busy: boolean;
  reduced: boolean;
  run?: TableRun;
  choice?: Choice;
  animateSlots?: boolean;
}) {
  const { t, animated } = useCasinoTimeline(
      run,
      busy,
      reduced,
      game === "slots" && animateSlots,
    ),
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
          ? Array.from(
              {
                length:
                  game === "double_dice" || game === "under_over_7" ? 2 : 3,
              },
              (_, i) =>
                DIE_CONTACTS.map((contact, j) => ({
                  at: (0.06 + i * 0.07 + contact * 0.74) * (run.duration - 100),
                  cue: (j === 0 ? "land" : "tap") as "land" | "tap",
                })),
            ).flat()
          : game === "coinflip"
            ? [{ at: (run.duration - 100) * 0.76, cue: "land" }]
            : game === "ore_refine"
              ? [
                  { at: 350, cue: "engine" },
                  { at: (run.duration - 100) * 0.86, cue: "land" },
                ]
              : [];
  useTableCues(run, t, animated, cues);
  if (game === "war")
    return (
      <CasinoFleetDuel round={round} t={t} animated={animated} run={run} />
    );
  if (["roulette", "wheel", "risk_wheel", "money_wheel"].includes(game))
    return (
      <CasinoWheelMechanism
        game={game}
        round={round}
        t={t}
        animated={animated}
        run={run}
        selectedRisk={choice.side ?? 0}
        busy={busy}
      />
    );
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
    const pose = tokenPose(has ? t : 0, v[0] ?? 0);
    return (
      <div className="casino-coin-stage physical-coin-stage" data-progress={t}>
        <div className="token-landing-pad" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
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
            transform: `translateY(${pose.floorShift - pose.lift}px) rotateZ(${pose.tilt}deg) rotateX(${pose.depthTilt}deg) rotateY(${pose.angle}deg)`,
          }}
        >
          <div className="token-edge" aria-hidden="true">
            {Array.from({ length: 32 }, (_, i) => (
              <i
                key={i}
                style={{
                  transform: `rotateZ(${i * 11.25}deg) translateX(72px) rotateY(90deg)`,
                }}
              />
            ))}
          </div>
          {[0, 1].map((face) => (
            <div key={face} className={`coin-face coin-face-${face}`}>
              <svg
                viewBox="0 0 100 100"
                className="token-engraving"
                aria-hidden="true"
              >
                <circle cx="50" cy="50" r="40" />
                <circle cx="50" cy="50" r="33" strokeDasharray="1 5" />
                {face ? (
                  <g>
                    <path d="M28 35h35l10 15-10 15H28M38 26v48M50 30v40M61 36v28" />
                    <circle cx="73" cy="50" r="4" />
                  </g>
                ) : (
                  <g>
                    <path d="M50 19 72 60 50 79 28 60ZM50 19v60M28 60h44M38 43h24" />
                  </g>
                )}
              </svg>
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
    const pose = probabilityRollPose(t, v[0] ?? 1),
      threshold = choice.target,
      landed = has && pose.landed;
    return (
      <div className="probability-stage" data-progress={t} data-landed={landed}>
        <small>PROBABILITY DRIVE</small>
        <strong>{has ? String(pose.number).padStart(2, "0") : "—"}</strong>
        <div className="probability-track">
          <div className="probability-calibration" aria-hidden="true">
            {[1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
              <span
                key={value}
                data-tick={value}
                style={{ left: `${probabilityPercent(value)}%` }}
              >
                <i />
                {value}
              </span>
            ))}
          </div>
          <div className="probability-rail">
            {threshold !== undefined && (
              <i
                data-threshold={threshold}
                style={{ left: `${probabilityPercent(threshold)}%` }}
              />
            )}
            {has && (
              <b
                data-roll={pose.number}
                data-position={pose.position}
                style={{ left: `${pose.percent}%` }}
              />
            )}
          </div>
        </div>
        <span>
          {threshold === undefined
            ? "ROLL"
            : `${choice.over ? "OVER" : "UNDER"} ${threshold}`}{" "}
          {landed ? "· RESOLVED" : ""}
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
        className={`physical-dice-stage dice-machine-${game} ${game === "chuck_a_luck" ? "dice-cage" : ""}`}
        data-progress={t}
      >
        <div className="dice-machine-rail" aria-hidden="true">
          <i />
          <span>
            {game === "sicbo"
              ? "III"
              : game === "double_dice"
                ? "II / II"
                : game === "chuck_a_luck"
                  ? "III / CAGE"
                  : "VII"}
          </span>
          <i />
        </div>
        <div className="dice-throw">
          {game === "chuck_a_luck" && (
            <div
              className="resonance-cage"
              aria-hidden="true"
              style={{ transform: `rotateX(${has ? ease(t) * 720 : 0}deg)` }}
            >
              {Array.from({ length: 8 }, (_, i) => (
                <i key={i} style={{ transform: `rotateX(${i * 45}deg)` }} />
              ))}
            </div>
          )}
          {Array.from({ length: n }, (_, i) => (
            <PhysicalDie
              key={i}
              face={has ? v[i] : i + 1}
              index={i}
              t={t}
              has={has}
              matched={game === "chuck_a_luck" && v[i] === target}
            />
          ))}
        </div>
        {game === "double_dice" && (
          <div
            className={`reactor-coupler ${done ? "coupled" : ""}`}
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
          </div>
        )}
        {game === "under_over_7" && (
          <div className="seven-scale">
            <span className={done && total < 7 ? "selected" : ""}>UNDER</span>
            <span className={done && total === 7 ? "selected" : ""}>7</span>
            <span className={done && total > 7 ? "selected" : ""}>OVER</span>
            {done && <i style={{ left: `${8 + ((total - 2) / 10) * 84}%` }} />}
          </div>
        )}
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
  if (game === "limbo")
    return (
      <CasinoLaiJump
        round={round}
        t={t}
        animated={animated}
        run={run}
        previewTarget={choice.target}
      />
    );
  if (game === "crash")
    return (
      <CasinoWarpRun
        round={round}
        t={t}
        animated={animated}
        run={run}
        previewTarget={choice.target}
      />
    );
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
          <svg
            className="scan-constellation"
            viewBox="0 0 800 500"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline
              points={picks
                .map(
                  (n) =>
                    `${((n - 1) % 8) * 100 + 50},${Math.floor((n - 1) / 8) * 100 + 50}`,
                )
                .join(" ")}
              fill="none"
              stroke="#e9c58c"
              strokeWidth="2"
              opacity=".35"
            />
          </svg>
          {Array.from({ length: 40 }, (_, i) => {
            const value = i + 1,
              revealedIndex = shown.indexOf(value),
              // The same clock reveals the number, sounds its cue and expands
              // its return. Finish before the next draw, including the last one.
              ping = (t * 11 - (revealedIndex + 1)) / 0.92,
              pinging = animated && revealedIndex >= 0 && ping >= 0 && ping < 1;
            return (
              <span
                key={value}
                className={`${picks.includes(value) ? "picked" : ""} ${shown.includes(value) ? "drawn" : ""} ${latest === value ? "latest-signal" : ""}`}
                data-number={value}
                data-drawn={shown.includes(value)}
              >
                {value}
                {pinging && (
                  <svg
                    className="scan-result-ping"
                    data-scan-ping={value}
                    data-phase={ping}
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r={12 + 34 * ease(ping)}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      vectorEffect="non-scaling-stroke"
                      opacity={0.95 * (1 - ping)}
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={9 + 23 * ease(ping)}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                      opacity={0.6 * (1 - ping)}
                    />
                  </svg>
                )}
              </span>
            );
          })}
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
        <svg
          className="signal-bus"
          viewBox="0 0 500 170"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {done &&
            counts.flatMap((n, s) =>
              n >= 2
                ? [
                    <polyline
                      key={s}
                      points={v
                        .flatMap((x, i) =>
                          x === s ? [`${50 + i * 100},125`] : [],
                        )
                        .join(" ")}
                      stroke={s % 2 ? "#a7d2bd" : "#dbb377"}
                      strokeWidth="3"
                      fill="none"
                    />,
                  ]
                : [],
            )}
        </svg>
        {Array.from({ length: 5 }, (_, i) => {
          const p = has ? clamp((t - i * 0.14) / 0.23) : 0,
            shown = p > 0.5,
            symbol = CASINO_SYMBOLS[v[i] ?? i];
          return (
            <div
              className={`signal-capsule ${done && counts[v[i]] >= 2 ? "matched-capsule" : ""}`}
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
    return <CasinoRefinery t={t} has={has} yieldKind={v[0] ?? 0} />;
  if (CARDS.includes(game)) {
    const pCard = (order: number, n: number) =>
      has ? clamp((t * (n + 1) - order - 0.35) * 1.65) : 0;
    if (game === "andar_bahar") {
      const dealt = Math.max(0, count(v.length) - 1),
        log = v.slice(1, 1 + dealt);
      return (
        <div className="andar-table" data-progress={t}>
          <TableShoe />
          <div className="andar-joker">
            <small>MATCH THIS RANK</small>
            <MotionCard value={v[0] ?? 0} hidden={!has} rankOnly aceFirst />
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
                          rankOnly
                          aceFirst
                          index={1}
                          runId={run.id}
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
        <TableShoe />
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
                  runId={run.id}
                  value={game === "red_dog" ? card - 1 : card}
                  progress={pCard(order, sequence.length)}
                  hidden={!has}
                  fly
                  rankOnly={rankOnly}
                  index={game === "three_card_poker" ? i : 1}
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
