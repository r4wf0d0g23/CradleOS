import { useMemo } from "react";
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
                <circle
                  className="plinko-peg"
                  data-row={row}
                  data-column={column}
                  cx={p.x}
                  cy={p.y}
                  r={PLINKO_PEG_RADIUS}
                  fill={hit ? "#fff1b2" : "#abb29f"}
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
                    fill: ["#fafae5", "#8fd5de", "#e8b46c", "#b7d89a"][i % 4],
                  }}
                  data-ball={i}
                  cx={b.point.x}
                  cy={b.point.y}
                  r={PLINKO_BALL_RADIUS}
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
