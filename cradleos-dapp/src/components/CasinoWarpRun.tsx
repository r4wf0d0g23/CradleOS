import { useId } from "react";
import type { Round } from "../lib/casinoPractice";
import type { TableRun } from "../lib/casinoTableMotion";
import { LAI_HULL, LAI_FRAGMENTS } from "../lib/casinoLaiMotion";
import {
  warpPose,
  warpShipTravel,
  warpFragmentPose,
  warpMultiplierLabel,
  WARP_FAILURE_AT,
  WARP_FAILURE_SECONDS,
  WARP_HULL_SCALE,
  WARP_START_X,
} from "../lib/casinoWarpMotion";
import { useTableCues } from "./useCasinoTimeline";
import "../styles/casino-warp-run.css";
const SHIP = `${import.meta.env.BASE_URL}casino/lai-jump/lai-top.webp`;
const STARS = Array.from({ length: 52 }, (_, i) => ({
  x: (i * 197 + 17) % 520,
  y: (i * i * 61 + 19) % 310,
  r: i % 9 === 0 ? 0.8 : 0.4,
}));
const DUST = Array.from({ length: 24 }, (_, i) => ({
  x: (i * 173 + 27) % 720,
  y: (i * i * 47 + 11) % 310,
  depth: 0.35 + (i % 4) * 0.2,
}));
export function CasinoWarpRun({
  round,
  t,
  animated,
  run,
  previewTarget,
}: {
  round: Round | null;
  t: number;
  animated: boolean;
  run: TableRun;
  previewTarget?: number;
}) {
  const id = useId().replace(/:/g, ""),
    has = !!round,
    limit = round?.values[0] ?? 10000,
    target =
      round?.values[1] ??
      (Number.isFinite(previewTarget) &&
      previewTarget! >= 101 &&
      previewTarget! <= 100000
        ? previewTarget! * 100
        : 20000),
    p = warpPose(t, limit, target, has),
    status =
      p.phase === "ready"
        ? "READY"
        : p.failed
          ? "DRIVE LOST"
          : p.escaped
            ? "WARP COMPLETE"
            : p.paid
              ? "WARPING"
              : "IN FLIGHT",
    imageProps = {
      href: SHIP,
      x: -LAI_HULL.width / 2,
      y: -LAI_HULL.height / 2,
      width: LAI_HULL.width,
      height: LAI_HULL.height,
    },
    wakeEnd = p.paid ? p.seconds : Math.min(p.seconds, WARP_FAILURE_SECONDS),
    from =
      WARP_START_X +
      warpShipTravel(Math.max(0, wakeEnd - 0.14), p.departure).distance -
      p.cameraX,
    to =
      WARP_START_X + warpShipTravel(wakeEnd, p.departure).distance - p.cameraX;
  useTableCues(
    run,
    t,
    animated,
    [
      { at: 120, cue: "engine" as const },
      ...(Number.isFinite(p.cross)
        ? [
            {
              at: p.cross * WARP_FAILURE_AT * (run.duration - 100),
              cue: "scan" as const,
            },
          ]
        : []),
      ...(limit < target
        ? [{ at: WARP_FAILURE_AT * (run.duration - 100), cue: "land" as const }]
        : []),
    ].sort((a, b) => a.at - b.at),
  );
  return (
    <div className="warp-run-stage" data-progress={t} data-phase={p.phase}>
      <header>
        <span>WARP RUN</span>
        <b>{status}</b>
      </header>
      <svg
        className="warp-space"
        viewBox="0 0 520 310"
        role="img"
        aria-label={`Warp Run: ${status.toLowerCase()}`}
      >
        <defs>
          <radialGradient id={`${id}-field`}>
            <stop stopColor="#213c4e" stopOpacity=".5" />
            <stop offset="1" stopColor="#07121d" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-exhaust`}>
            <stop stopColor="#73b6db" stopOpacity="0" />
            <stop offset=".7" stopColor="#9fd7ed" stopOpacity=".4" />
            <stop offset="1" stopColor="#e5f7ff" stopOpacity=".9" />
          </linearGradient>
          <radialGradient id={`${id}-flash`}>
            <stop stopColor="#fff3d1" />
            <stop offset=".25" stopColor="#e0d3ab" stopOpacity=".8" />
            <stop offset="1" stopColor="#b27649" stopOpacity="0" />
          </radialGradient>
          {LAI_FRAGMENTS.map((f, i) => (
            <clipPath id={`${id}-fragment-${i}`} key={i}>
              <polygon points={f.points} />
            </clipPath>
          ))}
        </defs>
        <ellipse
          cx="330"
          cy="145"
          rx="290"
          ry="200"
          fill={`url(#${id}-field)`}
        />
        <g className="warp-stars" aria-hidden="true">
          {STARS.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#c4d3dc"
              opacity={0.15 + (i % 5) * 0.07}
            />
          ))}
        </g>
        <g className="warp-dust" aria-hidden="true">
          {DUST.map((s, i) => {
            const x = ((((s.x - p.cameraX * s.depth) % 720) + 720) % 720) - 100,
              tail = has ? (p.cameraVelocity * s.depth) / 35 : 0.4;
            return (
              <path
                key={i}
                d={`M${x} ${s.y}h${tail}`}
                stroke="#acc9d8"
                strokeWidth=".8"
                opacity={0.15 + (i % 3) * 0.05}
              />
            );
          })}
        </g>
        {has && p.wake > 0 && (
          <g className="warp-wake" opacity={p.wake * 0.4} aria-hidden="true">
            {LAI_HULL.engines.map((e, i) => (
              <path
                key={i}
                d={`M${from + e.x * WARP_HULL_SCALE} ${p.y + e.y * WARP_HULL_SCALE}H${to + e.x * WARP_HULL_SCALE}`}
                stroke="#8bbbd8"
                strokeWidth={p.paid ? 3 : 1.6}
              />
            ))}
          </g>
        )}
        <g
          className="warp-hull"
          transform={`translate(${p.x} ${p.y})`}
          opacity={p.hullOpacity}
          data-world-x={p.worldX}
          data-camera-x={p.cameraX}
          data-velocity={p.velocity}
          data-forward="1,0"
        >
          <g transform={`scale(${WARP_HULL_SCALE})`}>
            <g
              className="warp-exhaust"
              opacity={p.thrust}
              data-direction="-1,0"
            >
              {LAI_HULL.engines.map((e, i) => {
                const length = 12 + 34 * p.thrust;
                return (
                  <g key={i} transform={`translate(${e.x} ${e.y})`}>
                    <path
                      d={`M0 -3L${-length} -5Q${-length - 8} 0 ${-length} 5L0 3Z`}
                      fill={`url(#${id}-exhaust)`}
                    />
                    <ellipse cx="-1" cy="0" rx="2" ry="3" fill="#e1f5ff" />
                  </g>
                );
              })}
            </g>
            <image {...imageProps} />
          </g>
        </g>
        {p.failed && (
          <g className="warp-breakup">
            {LAI_FRAGMENTS.map((f, i) => {
              const q = warpFragmentPose(t, i);
              return (
                <g
                  key={i}
                  className="warp-fragment"
                  data-index={i}
                  transform={`translate(${q.x} ${q.y}) rotate(${q.angle}) scale(${WARP_HULL_SCALE}) translate(${-f.cx} ${-f.cy})`}
                >
                  <image
                    {...imageProps}
                    clipPath={`url(#${id}-fragment-${i})`}
                  />
                </g>
              );
            })}
            {p.flash > 0 && (
              <circle
                className="warp-flash"
                cx={p.x}
                cy={p.y}
                r={25 + p.elapsed * 100}
                opacity={p.flash}
                fill={`url(#${id}-flash)`}
              />
            )}
          </g>
        )}
      </svg>
      <div className="warp-readouts">
        <div>
          <span>MULTIPLIER</span>
          <strong>
            {has ? warpMultiplierLabel(p.multiplier, target) : "—"}
          </strong>
        </div>
        <div className={p.paid ? "warp-paid" : ""} data-paid={p.paid}>
          <span>{p.paid ? "AUTO-STOP · PAID" : "AUTO-STOP"}</span>
          <b>{(target / 10000).toFixed(2)}×</b>
        </div>
      </div>
    </div>
  );
}
