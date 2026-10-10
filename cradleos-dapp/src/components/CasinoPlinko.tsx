import { useMemo, useId } from "react";
import { useCasinoTimeline, useTableCues } from "./useCasinoTimeline";
import { STILL_RUN, type TableRun } from "../lib/casinoTableMotion";
import { PLINKO_BPS, type Round } from "../lib/casinoPractice";
import {
  buildPlinkoRoute,
  samplePlinko,
  plinkoPeg,
  plinkoBucketX,
  PLINKO_ROWS,
  PLINKO_MOTION_MS,
  PLINKO_BALL_RADIUS,
  PLINKO_PEG_RADIUS,
} from "../lib/plinkoMotion";

export function CasinoPlinko({
  round,
  rounds: packRounds,
  payouts = PLINKO_BPS,
  profile = "Low",
  busy,
  reducedMotion,
  run = STILL_RUN,
}: {
  round: Round | null;
  rounds?: Round[];
  payouts?: readonly number[];
  profile?: string;
  busy: boolean;
  reducedMotion: boolean;
  run?: TableRun;
}) {
  const materialId = useId().replace(/:/g, "");
  const rounds = useMemo(
    () => packRounds ?? (round ? [round] : []),
    [packRounds, round],
  );
  const routes = useMemo(
    () => rounds.map((r) => buildPlinkoRoute(r.values)),
    [rounds],
  );
  const duration = PLINKO_MOTION_MS + Math.max(0, rounds.length - 1) * 120;
  const { t, animated } = useCasinoTimeline(run, busy, reducedMotion);
  const elapsed =
    t === 1 ? duration : Math.min(duration, t * (run.duration - 100));
  useTableCues(run, t, animated, [
    ...Array.from({ length: 12 }, (_, i) => ({
      at: 180 + i * 170,
      cue: "tap" as const,
    })),
    ...rounds.map((_, i) => ({
      at: PLINKO_MOTION_MS + i * 120,
      cue: "land" as const,
    })),
  ]);
  const landed = routes.length > 0 && elapsed >= duration;
  const balls = routes.map((route, i) => ({
    route,
    time: elapsed - i * 120,
    point: samplePlinko(route, Math.max(0, elapsed - i * 120)),
  }));
  return (
    <div className="lounge-plinko">
      <svg
        viewBox="0 0 300 250"
        role="img"
        aria-label={`Twelve-row Plinko board, ${profile} payouts, ${rounds.length || 1} balls`}
        data-landed={landed}
      >
        <defs>
          <radialGradient id={`${materialId}-peg`} cx="25%" cy="20%">
            <stop stopColor="#e2e5ce" />
            <stop offset=".4" stopColor="#99a9a3" />
            <stop offset="1" stopColor="#263b40" />
          </radialGradient>
          {["#e8d8b2", "#8fd5de", "#e8b46c", "#b7d89a"].map((color, i) => (
            <radialGradient
              key={i}
              id={`${materialId}-ball-${i}`}
              cx="28%"
              cy="23%"
            >
              <stop stopColor="#fffdec" />
              <stop offset=".3" stopColor={color} />
              <stop offset="1" stopColor="#344349" />
            </radialGradient>
          ))}
        </defs>
        <rect
          x="2"
          y="2"
          width="296"
          height="247"
          rx="12"
          fill="#15242a"
          stroke="#76867c"
          strokeWidth="3"
        />
        <rect
          x="7"
          y="7"
          width="286"
          height="216"
          rx="8"
          fill="#0a191f"
          stroke="#50675f55"
        />
        {[15, 285].flatMap((x) =>
          [16, 213].map((y) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r="3" fill="#718178" />
              <path d={`M${x - 1.5} ${y}h3`} stroke="#162c30" />
            </g>
          )),
        )}
        <path d="M142 7h16l-5 7h-6Z" fill="#bba479" stroke="#dbcfaa" />
        {!busy &&
          routes.map((r, i) => (
            <path key={i} d={r.svg} className="plinko-route" />
          ))}
        {Array.from({ length: PLINKO_ROWS }, (_, row) =>
          Array.from({ length: row + 1 }, (_, column) => {
            const p = plinkoPeg(row, column),
              hit =
                busy &&
                balls.some(
                  (b) =>
                    b.time >= 0 &&
                    b.time < PLINKO_MOTION_MS &&
                    Math.hypot(b.point.x - p.x, b.point.y - p.y) < 12,
                );
            return (
              <g key={`${row}-${column}`}>
                {hit && (
                  <circle
                    className="plinko-impact"
                    cx={p.x}
                    cy={p.y}
                    r={8}
                    opacity={0.6}
                  />
                )}
                <ellipse
                  cx={p.x + 1}
                  cy={p.y + 2}
                  rx={3.7}
                  ry={3}
                  fill="#000"
                  opacity=".65"
                />
                <circle
                  className="plinko-peg"
                  data-row={row}
                  data-column={column}
                  cx={p.x}
                  cy={p.y}
                  r={PLINKO_PEG_RADIUS}
                  fill={hit ? "#fff1b2" : `url(#${materialId}-peg)`}
                />
              </g>
            );
          }),
        )}
        {payouts.map((bps, i) => (
          <g
            key={i}
            data-bucket={i}
            data-hit={balls.some(
              (b) => b.time >= PLINKO_MOTION_MS && b.route.bucket === i,
            )}
          >
            <rect
              x={plinkoBucketX(i) - 8.5}
              y="227"
              width="17"
              height="19"
              rx="3"
              fill={
                balls.some(
                  (b) => b.time >= PLINKO_MOTION_MS && b.route.bucket === i,
                )
                  ? "#a2311b"
                  : "#25261f"
              }
            />
            <text
              x={plinkoBucketX(i)}
              y="240"
              fill="#fafae5"
              textAnchor="middle"
              fontSize="8"
            >
              {bps / 10000}×
            </text>
          </g>
        ))}
        {payouts.map((_, i) => {
          const n = balls.filter(
            (b) => b.time >= PLINKO_MOTION_MS && b.route.bucket === i,
          ).length;
          return n > 0 ? (
            <text
              key={`count${i}`}
              x={plinkoBucketX(i)}
              y="211"
              textAnchor="middle"
              fill="#fff4c9"
              fontSize="9"
            >
              {n}
            </text>
          ) : null;
        })}
        {balls.map(
          (b, i) =>
            b.time >= 0 && (
              <g key={rounds[i].id}>
                <ellipse
                  cx={b.point.x + 1}
                  cy={b.point.y + 4}
                  rx="4.6"
                  ry="2.4"
                  fill="#000"
                  opacity=".65"
                />
                {animated && (
                  <polyline
                    className="plinko-trail"
                    points={Array.from({ length: 7 }, (_, n) =>
                      samplePlinko(b.route, Math.max(0, b.time - (6 - n) * 20)),
                    )
                      .map((p) => `${p.x},${p.y}`)
                      .join(" ")}
                  />
                )}
                <circle
                  className="plinko-ball"
                  style={{
                    fill: `url(#${materialId}-ball-${i % 4})`,
                  }}
                  data-ball={i}
                  cx={b.point.x}
                  cy={b.point.y}
                  r={PLINKO_BALL_RADIUS}
                />
                <path
                  d="M-2.4-1.8Q0-3 2.4-1.8"
                  stroke="#fff5d988"
                  strokeWidth=".8"
                  fill="none"
                  transform={`translate(${b.point.x} ${b.point.y}) rotate(${Math.min(PLINKO_MOTION_MS, b.time) * 0.35 * (i % 2 ? -1 : 1)})`}
                />
              </g>
            ),
        )}
      </svg>
      {rounds.length > 0 && (
        <div className="motion-caption">
          {balls.filter((b) => b.time >= PLINKO_MOTION_MS).length} /{" "}
          {rounds.length} landed · {profile}
        </div>
      )}
    </div>
  );
}
