import { useMemo, useId } from "react";
import { useCasinoTimeline, useTableCues } from "./useCasinoTimeline";
import { STILL_RUN, type TableRun } from "../lib/casinoTableMotion";
import { PlinkoRigHousing, PlinkoRigFeeder } from "./CasinoPlinkoRig";
import { iconAssetUrl, useGameIcons } from "../lib/gameIcons";
import { PLINKO_BPS, type Round } from "../lib/casinoPractice";
import {
  buildPlinkoRoute,
  samplePlinko,
  plinkoPeg,
  plinkoBucketX,
  PLINKO_ROWS,
  PLINKO_MOTION_MS,
  PLINKO_LAUNCH_MS,
  PLINKO_COLLECTION_MS,
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
  const { data: icons } = useGameIcons();
  const rounds = useMemo(
    () => packRounds ?? (round ? [round] : []),
    [packRounds, round],
  );
  const routes = useMemo(
    () => rounds.map((r) => buildPlinkoRoute(r.values)),
    [rounds],
  );
  const duration =
    PLINKO_MOTION_MS + Math.max(0, rounds.length - 1) * PLINKO_LAUNCH_MS;
  const { t, animated } = useCasinoTimeline(run, busy, reducedMotion);
  const elapsed =
    t === 1 ? duration : Math.min(duration, t * (run.duration - 100));
  const contacts = useMemo(
    () =>
      routes.flatMap((route, i) =>
        route.contacts.map((contact) => ({
          ...contact,
          at: contact.at + i * PLINKO_LAUNCH_MS,
          strength: Math.min(
            1,
            Math.hypot(
              contact.incoming.x - contact.outgoing.x,
              contact.incoming.y - contact.outgoing.y,
            ) / 260,
          ),
        })),
      ),
    [routes],
  );
  const cues = useMemo(
    () =>
      [
        ...contacts.map((contact) => ({
          at: contact.at,
          cue:
            contact.strength > 0.9
              ? ("plinko_strike" as const)
              : ("plinko_tick" as const),
        })),
        ...routes.map((route, i) => ({
          at: route.floorAt + i * PLINKO_LAUNCH_MS,
          cue: "plinko_catch" as const,
        })),
      ].sort((a, b) => a.at - b.at),
    [contacts, routes],
  );
  useTableCues(run, t, animated, cues);
  const impacts = new Map<string, number>();
  if (animated)
    for (const contact of contacts) {
      const age = elapsed - contact.at;
      if (age >= 0 && age < 85) {
        const key = `${contact.peg.x},${contact.peg.y}`;
        impacts.set(
          key,
          Math.max(impacts.get(key) ?? 0, contact.strength * (1 - age / 85)),
        );
      }
    }
  let aperture = 0;
  if (animated)
    for (let i = 0; i < routes.length; i++) {
      const age = elapsed - i * PLINKO_LAUNCH_MS;
      const opening =
        age < 0 ? (age + 80) / 80 : age < 50 ? 1 : (150 - age) / 100;
      aperture = Math.max(aperture, Math.max(0, Math.min(1, opening)));
    }
  const landed = routes.length > 0 && elapsed >= duration;
  const balls = routes.map((route, i) => ({
    route,
    time: elapsed - i * PLINKO_LAUNCH_MS,
    point: samplePlinko(route, Math.max(0, elapsed - i * PLINKO_LAUNCH_MS)),
  }));
  return (
    <div className="lounge-plinko plinko-salvage-rig">
      <svg
        viewBox="-10 -39 320 314"
        role="img"
        aria-label={`Twelve-row Plinko board, ${profile} payouts, ${rounds.length || 1} balls`}
        data-landed={landed}
        data-elapsed={elapsed}
      >
        <defs>
          <radialGradient id={`${materialId}-peg`} cx="25%" cy="20%">
            <stop stopColor="#e2e5ce" />
            <stop offset=".4" stopColor="#99a9a3" />
            <stop offset="1" stopColor="#30382f" />
          </radialGradient>
          {["#e1dcc1", "#c5d4d0", "#d7c1a1", "#ced5ba"].map((color, i) => (
            <radialGradient
              key={i}
              id={`${materialId}-ball-${i}`}
              cx="28%"
              cy="23%"
            >
              <stop stopColor="#fffdec" />
              <stop offset=".3" stopColor={color} />
              <stop offset="1" stopColor="#3a4237" />
            </radialGradient>
          ))}
        </defs>
        <PlinkoRigHousing
          id={materialId}
          salvage={iconAssetUrl(icons?.ui["space_action/salvage_32px"]?.asset)}
          reprocess={iconAssetUrl(
            icons?.ui["gameplay/reprocessing_32px"]?.asset,
          )}
        />
        {Array.from({ length: PLINKO_ROWS }, (_, row) =>
          Array.from({ length: row + 1 }, (_, column) => {
            const p = plinkoPeg(row, column),
              impact = impacts.get(`${p.x},${p.y}`) ?? 0;
            return (
              <g key={`${row}-${column}`}>
                <path
                  className="plinko-peg-mount"
                  d={`M${p.x - 1.55} ${p.y - 2.7}h3.1l1.55 2.7-1.55 2.7h-3.1l-1.55-2.7Z`}
                  fill="#303a30"
                  stroke="#89917a"
                  strokeWidth=".35"
                />
                <ellipse
                  cx={p.x + 0.4}
                  cy={p.y + 1}
                  rx={2.2}
                  ry={1.9}
                  fill="#020806"
                  opacity=".8"
                />
                {impact > 0 && (
                  <circle
                    className="plinko-impact"
                    cx={p.x}
                    cy={p.y}
                    r={3.5}
                    style={{
                      stroke: "#f3ab65",
                      strokeWidth: 0.65,
                      fill: "#d7853d",
                    }}
                    opacity={impact * 0.65}
                  />
                )}
                <circle
                  className="plinko-peg"
                  data-row={row}
                  data-column={column}
                  cx={p.x}
                  cy={p.y}
                  r={PLINKO_PEG_RADIUS}
                  fill={`url(#${materialId}-peg)`}
                />
              </g>
            );
          }),
        )}
        {payouts.map((bps, i) => {
          const x = plinkoBucketX(i),
            residents = balls.filter((b) => b.route.bucket === i);
          const arrived = residents.some((b) => b.time >= b.route.floorAt);
          const n = residents.filter((b) => b.time >= b.route.duration).length;
          const pulse = animated
            ? Math.max(
                0,
                ...residents.map((b) => {
                  const age = b.time - b.route.floorAt;
                  return age < 0 ? 0 : Math.max(0, 1 - age / 260);
                }),
              )
            : 0;
          const labelY = i % 2 ? 252 : 237,
            multiplier = `${bps / 10000}×`;
          return (
            <g
              key={i}
              className="plinko-collection-bay"
              data-bucket={i}
              data-hit={n > 0}
              data-arrived={arrived}
              data-count={n}
            >
              <path
                d={`M${x - 8.5} 212h17v10h-17Z`}
                fill={`url(#${materialId}-well)`}
              />
              <path
                d={`M${x - 7} 214h14v7h-14Z`}
                fill="#bc7539"
                opacity={arrived ? 0.09 + pulse * 0.19 : 0}
              />
              <path
                d={`M${x - 9} 216v6h18v-6`}
                fill="none"
                stroke="#858975"
                strokeWidth="1"
              />
              <path
                d={`M${x - 5} 224h10`}
                stroke={arrived ? "#f4a554" : "#404a36"}
                strokeWidth="1.5"
              />
              <path
                d={`M${x} 225v${labelY - 234}`}
                stroke={arrived ? "#bb824b" : "#55614b"}
                strokeWidth=".6"
              />
              <rect
                x={x - 17}
                y={labelY - 11}
                width="34"
                height="15"
                rx="1"
                fill={n > 0 ? "#49391f" : "#101711"}
                stroke={n > 0 ? "#b68a4f" : "#4b5941"}
                strokeWidth=".5"
              />
              <text
                className="plinko-bay-label"
                x={x}
                y={labelY}
                textAnchor="middle"
                fill={n > 0 ? "#ffe0a5" : "#d0d3bb"}
                fontSize="9"
                textLength={multiplier.length > 6 ? 31 : undefined}
                lengthAdjust="spacingAndGlyphs"
              >
                {multiplier}
              </text>
              {rounds.length > 1 && n > 0 && (
                <text
                  className="plinko-bay-count"
                  x={x}
                  y="266"
                  textAnchor="middle"
                  fill="#edc997"
                  fontSize="9"
                >
                  {n}
                </text>
              )}
            </g>
          );
        })}
        {balls.map(
          (b, i) =>
            b.time >= 0 && (
              <g
                key={rounds[i].id}
                data-flight={i}
                data-settled={b.time >= b.route.duration}
                opacity={
                  rounds.length > 1
                    ? Math.max(
                        0,
                        Math.min(
                          1,
                          1 -
                            (b.time - b.route.duration) / PLINKO_COLLECTION_MS,
                        ),
                      )
                    : 1
                }
              >
                <ellipse
                  cx={b.point.x + 0.7}
                  cy={b.point.y + 1.2}
                  rx="3.1"
                  ry="2.8"
                  fill="#000"
                  opacity=".65"
                />
                {animated && (
                  <polyline
                    className="plinko-trail"
                    points={Array.from({ length: 7 }, (_, n) =>
                      samplePlinko(b.route, Math.max(0, b.time - (6 - n) * 8)),
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
              </g>
            ),
        )}
        <PlinkoRigFeeder id={materialId} open={aperture} />
      </svg>
      {rounds.length > 0 && (
        <div className="motion-caption">
          {balls.filter((b) => b.time >= b.route.duration).length} /{" "}
          {rounds.length} landed · {profile}
        </div>
      )}
    </div>
  );
}
