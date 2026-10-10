import { useId } from "react";
import { type Round } from "../lib/casinoPractice";
import { clamp, type TableRun } from "../lib/casinoTableMotion";
import {
  laiJumpPose,
  laiSpeedLabel,
  LAI_ACCELERATION_END,
} from "../lib/casinoLaiMotion";
import { useTableCues } from "./useCasinoTimeline";
import "../styles/casino-lai-jump.css";
const SHIP = `${import.meta.env.BASE_URL}casino/lai-jump/lai-hull.webp`;
const STARS = Array.from({ length: 45 }, (_, i) => ({
  x: (i * 97 + 31) % 580,
  y: (i * i * 43 + 13) % 300,
  r: i % 7 === 0 ? 1.2 : 0.55,
}));
const FRAGMENTS = Array.from({ length: 12 }, (_, i) => ({
  col: i % 4,
  row: Math.floor(i / 4),
  a: ((i * 137.5 + 27) * Math.PI) / 180,
  range: 65 + (i % 5) * 23,
  spin: (i % 2 ? -1 : 1) * (35 + i * 13),
}));
export function CasinoLaiJump({
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
    limit = round?.values[0] ?? 0,
    target =
      round?.values[1] ??
      (Number.isFinite(previewTarget) &&
      previewTarget! >= 101 &&
      previewTarget! <= 100000
        ? previewTarget! * 100
        : 20000);
  const pose = laiJumpPose(t, limit, target, has),
    u = pose.resolution,
    resolving = u > 0,
    reached = has && t >= LAI_ACCELERATION_END;
  const label =
    pose.phase === "ready"
      ? "READY"
      : pose.phase === "accelerating"
        ? "ACCELERATING"
        : pose.win
          ? pose.phase === "warped"
            ? "JUMP COMPLETE"
            : "WARPING"
          : pose.phase === "destroyed"
            ? "HULL LOST"
            : "HULL BREACH";
  const thrust =
    has && !reached ? 0.25 + pose.charge * 0.75 : pose.win && u < 0.65 ? 1 : 0;
  const travel = has ? 150 * Math.pow(pose.charge, 2) : 0;
  useTableCues(run, t, animated, [
    { at: 120, cue: "engine" },
    {
      at: (run.duration - 100) * LAI_ACCELERATION_END,
      cue: pose.win ? "scan" : "land",
    },
  ]);
  return (
    <div className="lai-jump-stage" data-progress={t} data-phase={pose.phase}>
      <header>
        <span>LAI / JUMP DRIVE</span>
        <b>{label}</b>
      </header>
      <svg
        className="lai-space"
        viewBox="0 0 520 320"
        role="img"
        aria-label={`Lai: ${label.toLowerCase()}`}
      >
        <defs>
          <radialGradient id={`${id}-nebula`}>
            <stop stopColor="#30454d" stopOpacity=".65" />
            <stop offset="1" stopColor="#10202b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-thrust`}>
            <stop stopColor="#cf672b" stopOpacity="0" />
            <stop offset=".6" stopColor="#ffb96e" stopOpacity=".8" />
            <stop offset="1" stopColor="#e5f5ed" />
          </linearGradient>
          <radialGradient id={`${id}-fire`}>
            <stop stopColor="#fff4c9" />
            <stop offset=".25" stopColor="#ffd07a" />
            <stop offset=".55" stopColor="#e3662b" stopOpacity=".85" />
            <stop offset="1" stopColor="#762d1d" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-warp`}>
            <stop stopColor="#e0fff6" stopOpacity=".8" />
            <stop offset=".25" stopColor="#9ccad6" stopOpacity=".35" />
            <stop offset="1" stopColor="#507f9a" stopOpacity="0" />
          </radialGradient>
          {FRAGMENTS.map((f, i) => (
            <clipPath id={`${id}-shard-${i}`} key={i}>
              <rect
                x={-104 + f.col * 52}
                y={-62 + f.row * 42}
                width="53"
                height="43"
              />
            </clipPath>
          ))}
        </defs>
        <ellipse
          cx="340"
          cy="92"
          rx="300"
          ry="160"
          fill={`url(#${id}-nebula)`}
        />
        <g className="lai-starfield" aria-hidden="true">
          {STARS.map((s, i) => {
            const x =
              ((((s.x - travel * (0.3 + (i % 3) * 0.4)) % 580) + 580) % 580) -
              30;
            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={s.y}
                  r={s.r}
                  fill="#c0d7d6"
                  opacity={0.18 + (i % 4) * 0.12}
                />
                <path
                  d={`M${x} ${s.y}h${has ? (-(4 + pose.charge * pose.charge * 45) * ((i % 3) + 1)) / 3 : 0}`}
                  stroke="#91b7c3"
                  strokeWidth=".65"
                  opacity={has ? pose.charge * 0.33 : 0}
                />
              </g>
            );
          })}
        </g>
        <path
          d="M22 31h20M22 31v20M498 31h-20M498 31v20M22 282h20M22 282v-20M498 282h-20M498 282v-20"
          stroke="#728d8955"
          fill="none"
        />
        {resolving && pose.win && (
          <g className="lai-warp-wake">
            <ellipse
              cx="410"
              cy="161"
              rx={14 + pose.shock * 82}
              ry={30 + pose.shock * 65}
              fill={`url(#${id}-warp)`}
              opacity={1 - u * 0.8}
            />
            {[0, 1, 2, 3].map((i) => (
              <ellipse
                key={i}
                cx={300 + i * 38 + u * 30}
                cy={169 - i * 3}
                rx={5 + u * 12}
                ry={22 + i * 9 + u * 20}
                fill="none"
                stroke="#b5e9e8"
                strokeWidth={1.6 - i * 0.3}
                opacity={(1 - u) * (0.75 - i * 0.13)}
              />
            ))}
            <path
              d="M245 173 504 152"
              stroke="#e4fff4"
              strokeWidth={1 + pose.flash * 5}
              opacity={pose.flash * 0.8}
            />
          </g>
        )}
        <g
          className="lai-hull"
          transform={`translate(${pose.x} ${pose.y}) rotate(${pose.bank}) scale(${pose.stretch} ${1 - (pose.stretch - 1) * 0.09})`}
          opacity={pose.hullOpacity}
        >
          <g className="lai-exhaust" opacity={thrust}>
            <path
              d={`M-44-4Q${-110 - thrust * 90} -20 ${-90 - thrust * 150} -2Q${-110 - thrust * 90} 15-44 4Z`}
              fill={`url(#${id}-thrust)`}
            />
            <path
              d={`M-42 16Q${-105 - thrust * 85} 2 ${-85 - thrust * 130} 20Q${-105 - thrust * 85} 35-42 25Z`}
              fill={`url(#${id}-thrust)`}
            />
          </g>
          <image href={SHIP} x="-104" y="-62" width="208" height="124" />
        </g>
        {reached && !pose.win && (
          <g className="lai-explosion">
            <ellipse
              cx="248"
              cy="172"
              rx={15 + pose.shock * 155}
              ry={5 + pose.shock * 65}
              fill="none"
              stroke="#da8b5f"
              strokeWidth={3 * (1 - u) + 0.5}
              opacity={(1 - u) * 0.6}
            />
            {FRAGMENTS.map((f, i) => {
              const d = pose.shock * f.range,
                dx = Math.cos(f.a) * d,
                dy = Math.sin(f.a) * d * 0.6;
              return (
                <g
                  className="lai-fragment"
                  key={i}
                  transform={`translate(${248 + dx} ${172 + dy}) rotate(${u * f.spin})`}
                  opacity={0.95 - u * 0.55}
                >
                  <image
                    href={SHIP}
                    x="-104"
                    y="-62"
                    width="208"
                    height="124"
                    clipPath={`url(#${id}-shard-${i})`}
                  />
                  <path
                    d={`M${-75 + f.col * 50} ${-43 + f.row * 42}l${-dx * 0.35} ${-dy * 0.35}`}
                    stroke="#f5ad68"
                    strokeWidth="1.5"
                    opacity={1 - u}
                  />
                </g>
              );
            })}
            <circle
              cx="248"
              cy="172"
              r={18 + pose.flash * 83}
              fill={`url(#${id}-fire)`}
              opacity={pose.flash}
            />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <circle
                key={i}
                cx={248 + Math.cos(i * 2.4) * pose.shock * 60}
                cy={172 + Math.sin(i * 2.4) * pose.shock * 40}
                r={9 + pose.shock * 24}
                fill="#5f4b3c"
                opacity={Math.sin(u * Math.PI) * 0.16}
              />
            ))}
          </g>
        )}
      </svg>
      <div className="lai-speed">
        <div>
          <span>SPEED</span>
          <strong>{laiSpeedLabel(pose.speed, target)}</strong>
        </div>
        <div>
          <span>JUMP</span>
          <b>{(target / 10000).toFixed(2)}×</b>
        </div>
      </div>
      <div
        className="lai-charge"
        role="progressbar"
        aria-label="Jump speed"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(clamp(pose.speed / target) * 100)}
      >
        <i style={{ width: `${clamp(pose.speed / target) * 100}%` }} />
      </div>
    </div>
  );
}
