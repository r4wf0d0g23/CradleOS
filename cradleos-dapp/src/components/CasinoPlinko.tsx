import { useEffect, useMemo, useState } from "react";
import { PLINKO_BPS, type Round } from "../lib/casinoPractice";
import {
  buildPlinkoRoute,
  samplePlinko,
  plinkoPeg,
  plinkoBucketX,
  PLINKO_ROWS,
  PLINKO_ENTRY_MS,
  PLINKO_HOP_MS,
  PLINKO_MOTION_MS,
  PLINKO_BALL_RADIUS,
  PLINKO_PEG_RADIUS,
} from "../lib/plinkoMotion";

export function CasinoPlinko({
  round,
  busy,
  reducedMotion,
}: {
  round: Round | null;
  busy: boolean;
  reducedMotion: boolean;
}) {
  const route = useMemo(
    () => (round ? buildPlinkoRoute(round.values) : null),
    [round],
  );
  const [tick, setTick] = useState<{ round: Round | null; elapsed: number }>({
    round: null,
    elapsed: 0,
  });
  useEffect(() => {
    if (!round || !busy || reducedMotion) return;
    const start = performance.now();
    let frame = 0;
    const advance = (now: number) => {
      const elapsed = Math.min(PLINKO_MOTION_MS, now - start);
      setTick({ round, elapsed });
      if (elapsed < PLINKO_MOTION_MS) frame = requestAnimationFrame(advance);
    };
    setTick({ round, elapsed: 0 });
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [round, busy, reducedMotion]);
  // A new round never renders the previous round's final animation frame.
  const elapsed =
    !busy || reducedMotion
      ? PLINKO_MOTION_MS
      : tick.round === round
        ? tick.elapsed
        : 0;
  const landed = !!route && elapsed >= PLINKO_MOTION_MS;
  const impactRow = Math.floor((elapsed - PLINKO_ENTRY_MS) / PLINKO_HOP_MS);
  const sinceImpact = elapsed - PLINKO_ENTRY_MS - impactRow * PLINKO_HOP_MS;
  const impact =
    busy &&
    !reducedMotion &&
    impactRow >= 0 &&
    impactRow < PLINKO_ROWS &&
    sinceImpact < 120
      ? route?.pegs[impactRow]
      : null;
  const ball = route ? samplePlinko(route, elapsed) : null;
  const trail =
    route && busy && !reducedMotion
      ? Array.from({ length: 7 }, (_, i) =>
          samplePlinko(route, Math.max(0, elapsed - (6 - i) * 20)),
        )
          .map((p) => `${p.x},${p.y}`)
          .join(" ")
      : "";
  return (
    <div className="lounge-plinko">
      <svg
        viewBox="0 0 300 250"
        role="img"
        aria-label="Twelve-row Plinko board, low-risk payouts"
        data-landed={landed}
      >
        {route && !busy && <path d={route.svg} className="plinko-route" />}
        {Array.from({ length: PLINKO_ROWS }, (_, row) =>
          Array.from({ length: row + 1 }, (_, column) => {
            const p = plinkoPeg(row, column),
              hit = impact?.x === p.x && impact?.y === p.y;
            return (
              <g key={`${row}-${column}`}>
                {hit && (
                  <circle
                    className="plinko-impact"
                    cx={p.x}
                    cy={p.y}
                    r={5 + sinceImpact / 24}
                    opacity={1 - sinceImpact / 120}
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
        {PLINKO_BPS.map((bps, i) => (
          <g key={i} data-bucket={i} data-hit={landed && route?.bucket === i}>
            <rect
              x={plinkoBucketX(i) - 8.5}
              y="227"
              width="17"
              height="19"
              rx="3"
              fill={landed && route?.bucket === i ? "#a2311b" : "#25261f"}
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
        {trail && <polyline points={trail} className="plinko-trail" />}
        {ball && (
          <circle
            className="plinko-ball"
            cx={ball.x}
            cy={ball.y}
            r={PLINKO_BALL_RADIUS}
          />
        )}
      </svg>
    </div>
  );
}
