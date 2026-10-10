import { useId, useMemo } from "react";
import { RED, WHEEL_BPS, type Round } from "../lib/casinoPractice";
import { MONEY_TABLE, RISK_TABLES } from "../lib/casinoExpanded";
import { clamp, wheelAngle, type TableRun } from "../lib/casinoTableMotion";
import { bearingBall } from "../lib/casinoObjectMotion";
import { useTableCues } from "./useCasinoTimeline";
const ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const point = (r: number, a: number) => [
  160 + r * Math.cos((a * Math.PI) / 180),
  160 + r * Math.sin((a * Math.PI) / 180),
];
const ring = (i: number, n: number, inner: number, outer: number) => {
  const a = (i * 360) / n - 90 - 180 / n,
    b = a + 360 / n,
    p = point(outer, a),
    q = point(outer, b),
    r = point(inner, b),
    s = point(inner, a);
  return `M${p}A${outer} ${outer} 0 0 1 ${q}L${r}A${inner} ${inner} 0 0 0 ${s}Z`;
};
export function CasinoWheelMechanism({
  game,
  round,
  t,
  animated,
  run,
  selectedRisk = 0,
  busy = false,
}: {
  game: string;
  round: Round | null;
  t: number;
  animated: boolean;
  run: TableRun;
  selectedRisk?: number;
  busy?: boolean;
}) {
  const preview =
    game === "risk_wheel" &&
    !busy &&
    (!round || round.values[1] !== selectedRisk);
  const id = useId().replace(/:/g, ""),
    v = preview ? [] : (round?.values ?? []),
    has = !!round && !preview,
    done = has && t === 1;
  const table =
    game === "roulette"
      ? ORDER
      : game === "money_wheel"
        ? MONEY_TABLE
        : game === "risk_wheel"
          ? RISK_TABLES[preview ? selectedRisk : (v[1] ?? 0)]
          : WHEEL_BPS;
  const index = game === "roulette" ? ORDER.indexOf(v[0] ?? 0) : (v[0] ?? 0),
    angle = has ? wheelAngle(t, index, table.length) : 0,
    finalAngle = wheelAngle(1, index, table.length);
  const ball = bearingBall(t, angle, finalAngle),
    step = 360 / table.length;
  const cues = useMemo(
    () =>
      Array.from({ length: Math.floor(finalAngle / step + 0.5) }, (_, i) => ({
        at:
          (1 - Math.cbrt(1 - ((i + 0.5) * step) / finalAngle)) *
          (run.duration - 100),
        cue: "tap" as const,
      })),
    [finalAngle, step, run.duration],
  );
  useTableCues(run, t, animated, cues);
  const phase = (angle / step + 0.5) % 1,
    flex = animated ? Math.sin(phase * Math.PI) * -14 * clamp((1 - t) * 6) : 0;
  const title =
    game === "roulette"
      ? "ORBITAL"
      : game === "wheel"
        ? "REACTOR"
        : game === "risk_wheel"
          ? "OVERDRIVE"
          : "SALVAGE";
  return (
    <div
      className={`casino-orbit-stage table-wheel wheel-${game} wheel-mechanism`}
      data-risk={
        game === "risk_wheel"
          ? preview
            ? selectedRisk
            : (v[1] ?? 0)
          : undefined
      }
      data-progress={t}
      data-landed={done ? index : undefined}
    >
      <svg
        viewBox="0 0 320 340"
        role="img"
        aria-label={`${title} wheel${done ? `: ${round!.label}` : ""}`}
      >
        <defs>
          <radialGradient id={`${id}-bowl`} cx="42%" cy="30%">
            <stop stopColor="#758079" />
            <stop offset=".56" stopColor="#283438" />
            <stop offset=".87" stopColor="#111b20" />
            <stop offset="1" stopColor="#a1aaa0" />
          </radialGradient>
          <linearGradient id={`${id}-metal`} x2=".6" y2="1">
            <stop stopColor="#acb6af" />
            <stop offset=".25" stopColor="#313d41" />
            <stop offset=".7" stopColor="#182126" />
            <stop offset="1" stopColor="#7f8981" />
          </linearGradient>
          <radialGradient id={`${id}-ball`} cx="28%" cy="20%">
            <stop stopColor="#fffef0" />
            <stop offset=".5" stopColor="#e4d8b5" />
            <stop offset="1" stopColor="#80735a" />
          </radialGradient>
        </defs>
        <ellipse cx="160" cy="318" rx="137" ry="13" fill="#000" opacity=".45" />
        <circle
          cx="160"
          cy="169"
          r="156"
          fill="#0a1115"
          stroke="#303d40"
          strokeWidth="5"
        />
        <circle cx="160" cy="160" r="156" fill={`url(#${id}-metal)`} />
        <circle
          cx="160"
          cy="160"
          r="148"
          fill={`url(#${id}-bowl)`}
          stroke="#a3b3a2"
          strokeOpacity=".4"
          strokeWidth="2"
        />
        {Array.from({ length: 12 }, (_, i) => {
          const [x, y] = point(152, i * 30);
          return (
            <g key={i} transform={`translate(${x} ${y}) rotate(${i * 30})`}>
              <circle
                r="2.5"
                fill="#152329"
                stroke="#a5b1a3"
                strokeWidth=".6"
              />
              <path d="M-1.3 0h2.6" stroke="#718078" />
            </g>
          );
        })}
        <g className="wheel-rotor" transform={`rotate(${angle} 160 160)`}>
          {table.map((n, i) => {
            const [x, y] = point(
              game === "roulette" ? 130 : 126,
              i * step - 90,
            );
            return (
              <g key={i}>
                <path
                  d={ring(i, table.length, game === "roulette" ? 116 : 97, 141)}
                  fill={
                    game === "roulette"
                      ? n === 0
                        ? "#345a49"
                        : RED.includes(n)
                          ? "#89392c"
                          : "#18252a"
                      : n === 0
                        ? "#1a292e"
                        : game === "wheel"
                          ? i % 2
                            ? "#b3ae91"
                            : "#556c70"
                          : game === "risk_wheel"
                            ? i % 2
                              ? "#826342"
                              : "#39494e"
                            : i % 2
                              ? "#706b50"
                              : "#394e50"
                  }
                  stroke="#10181c"
                  strokeWidth="1.5"
                />
                {game === "roulette" && (
                  <path
                    d={ring(i, table.length, 101, 116)}
                    fill={
                      n === 0
                        ? "#193d31"
                        : RED.includes(n)
                          ? "#59291f"
                          : "#0b151b"
                    }
                    stroke="#b7a77a88"
                    strokeWidth="1.4"
                  />
                )}
                {done && i === index && (
                  <path
                    d={ring(i, table.length, 101, 141)}
                    fill="none"
                    stroke="#fff0b8"
                    strokeWidth="2"
                  />
                )}
                <text
                  x={x}
                  y={y + 3}
                  transform={`rotate(${i * step} ${x} ${y})`}
                  textAnchor="middle"
                  fill="#f7edcf"
                  fontSize={table.length > 40 ? 6.5 : 9}
                >
                  {game === "roulette" ? n : `${n / 10000}×`}
                </text>
              </g>
            );
          })}
          {Array.from({ length: game === "wheel" ? 12 : 8 }, (_, i) => (
            <path
              key={i}
              d={ring(i, game === "wheel" ? 12 : 8, 45, 91)}
              fill={i % 2 ? "#253237" : "#38484b"}
              stroke="#74877e44"
              strokeWidth="1"
              transform={`rotate(${game === "wheel" ? 8 : 0} 160 160)`}
            />
          ))}
        </g>
        <circle
          cx="160"
          cy="160"
          r="97"
          fill="none"
          stroke="#a6ad9455"
          strokeWidth="3"
        />
        {game === "roulette" &&
          Array.from({ length: 8 }, (_, i) => {
            const [x, y] = point(145, i * 45 + 22);
            return (
              <path
                key={i}
                d="M-2-5 2 0-2 5Z"
                fill="#758477"
                transform={`translate(${x} ${y}) rotate(${i * 45 + 22})`}
              />
            );
          })}
        {game === "risk_wheel" &&
          [0, 90, 180, 270].map((a) => (
            <g key={a} transform={`rotate(${a} 160 160)`}>
              <path d="M135 72h50l-7 14h-36Z" fill="#899587" stroke="#15262a" />
              <path
                d="M139 74h42"
                stroke="#e99362"
                opacity={animated ? 0.4 + Math.sin(t * Math.PI) * 0.6 : 0.3}
              />
            </g>
          ))}
        {game === "money_wheel" &&
          Array.from({ length: 6 }, (_, i) => {
            const [x, y] = point(77, i * 60);
            return (
              <rect
                key={i}
                x={x - 9}
                y={y - 6}
                width="18"
                height="12"
                rx="2"
                fill="#858269"
                stroke="#1b2b2e"
                transform={`rotate(${i * 60} ${x} ${y})`}
              />
            );
          })}
        <circle
          cx="160"
          cy="160"
          r="60"
          fill={`url(#${id}-metal)`}
          stroke="#8d9b8a"
          strokeWidth="2"
        />
        <circle cx="160" cy="160" r="53" fill="#111e23" stroke="#3a4b4d" />
        <text x="160" y="148" textAnchor="middle" className="wheel-kicker">
          {title}
        </text>
        <text x="160" y="177" textAnchor="middle" className="wheel-value">
          {done
            ? game === "roulette"
              ? v[0]
              : `${table[index] / 10000}×`
            : "◇"}
        </text>
        <g className="wheel-detent" transform={`rotate(${flex} 160 7)`}>
          <path
            d="M149 0h22l-4 21-7 12-7-12Z"
            fill={`url(#${id}-metal)`}
            stroke="#c4bc91"
          />
          <circle cx="160" cy="7" r="3" fill="#a3ab9a" stroke="#19262b" />
        </g>
        {game === "roulette" && has && (
          <g>
            <ellipse
              cx={ball.x + 1}
              cy={ball.y + 3}
              rx="5"
              ry="3"
              fill="#000"
              opacity=".6"
            />
            <circle
              className="roulette-ball"
              data-ball-x={ball.x}
              data-ball-y={ball.y}
              cx={ball.x}
              cy={ball.y}
              r="4.5"
              fill={`url(#${id}-ball)`}
            />
          </g>
        )}
      </svg>
      <div className="wheel-pocket-label">
        {done
          ? `${game === "roulette" ? v[0] : `${table[index] / 10000}×`}`
          : animated
            ? "IN MOTION"
            : "READY"}
      </div>
    </div>
  );
}
