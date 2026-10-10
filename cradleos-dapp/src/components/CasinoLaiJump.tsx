import { useId } from "react";
import { type Round } from "../lib/casinoPractice";
import { clamp, type TableRun } from "../lib/casinoTableMotion";
import {
  laiJumpPose,
  laiSpeedLabel,
  laiFragmentPose,
  LAI_ACCELERATION_END,
  LAI_HULL,
  LAI_FRAGMENTS,
  LAI_TERMINAL_SPEED,
  LAI_CAMERA_FRACTION,
} from "../lib/casinoLaiMotion";
import { useTableCues } from "./useCasinoTimeline";
import "../styles/casino-lai-jump.css";
const SHIP = `${import.meta.env.BASE_URL}casino/lai-jump/lai-top.webp`;
const STARS = Array.from({ length: 60 }, (_, i) => ({
  x: (i * 197 + 17) % 520,
  y: (i * i * 61 + 19) % 320,
  r: i % 9 === 0 ? 0.8 : 0.4,
}));
const DUST = Array.from({ length: 18 }, (_, i) => ({
  x: (i * 173 + 27) % 720,
  y: (i * i * 47 + 11) % 320,
  depth: 0.35 + (i % 4) * 0.2,
}));
const SPARKS = Array.from({ length: 24 }, (_, i) => ({
  a: i * 2.399963,
  r: 95 + (i % 5) * 22,
  life: 0.28 + (i % 7) * 0.065,
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
    limit = round?.values[0] ?? 0;
  const target =
    round?.values[1] ??
    (Number.isFinite(previewTarget) &&
    previewTarget! >= 101 &&
    previewTarget! <= 100000
      ? previewTarget! * 100
      : 20000);
  const pose = laiJumpPose(t, limit, target, has),
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
  const imageProps = {
    href: SHIP,
    x: -LAI_HULL.width / 2,
    y: -LAI_HULL.height / 2,
    width: LAI_HULL.width,
    height: LAI_HULL.height,
  };
  const carrierX = laiJumpPose(t, 0, target, has).x;
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
          <radialGradient id={`${id}-light`}>
            <stop stopColor="#253b48" stopOpacity=".32" />
            <stop offset="1" stopColor="#10202b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-thrust`}>
            <stop stopColor="#86b5cf" stopOpacity="0" />
            <stop offset=".65" stopColor="#94cada" stopOpacity=".3" />
            <stop offset="1" stopColor="#efffff" stopOpacity=".85" />
          </linearGradient>
          <radialGradient id={`${id}-flash`}>
            <stop stopColor="#fff1bd" />
            <stop offset=".35" stopColor="#fff0ce" stopOpacity=".9" />
            <stop offset=".7" stopColor="#c58b58" stopOpacity=".25" />
            <stop offset="1" stopColor="#b36238" stopOpacity="0" />
          </radialGradient>
          {LAI_FRAGMENTS.map((f, i) => (
            <clipPath id={`${id}-fragment-${i}`} key={i}>
              <polygon points={f.points} />
            </clipPath>
          ))}
        </defs>
        <ellipse
          cx="350"
          cy="80"
          rx="270"
          ry="180"
          fill={`url(#${id}-light)`}
        />
        <g className="lai-starfield" aria-hidden="true">
          {STARS.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#bdcbd5"
              opacity={0.15 + (i % 5) * 0.07}
            />
          ))}
        </g>
        <g className="lai-dust" aria-hidden="true">
          {DUST.map((s, i) => {
            const x =
              ((((s.x - pose.cameraX * s.depth) % 720) + 720) % 720) - 100;
            const tail =
              (LAI_TERMINAL_SPEED *
                pose.charge *
                LAI_CAMERA_FRACTION *
                s.depth) /
              30;
            return (
              <path
                key={i}
                d={`M${x} ${s.y}h${has ? tail : 0.3}`}
                stroke="#a1b4be"
                strokeWidth=".8"
                opacity={0.11 + (i % 3) * 0.04}
              />
            );
          })}
        </g>
        {reached && pose.win && (
          <g className="lai-warp-wake" aria-hidden="true">
            {LAI_HULL.engines.map((e, i) => {
              const past = laiJumpPose(
                Math.max(LAI_ACCELERATION_END, t - 0.045),
                limit,
                target,
                has,
              );
              const from = past.worldX - pose.cameraX + e.x;
              return (
                <path
                  key={i}
                  d={`M${from} ${160 + e.y}H${pose.x + e.x}`}
                  stroke="#b2d9ed"
                  strokeWidth={2.5}
                  opacity={Math.min(1, pose.elapsed * 8) * 0.35}
                />
              );
            })}
          </g>
        )}
        <g
          className="lai-hull"
          transform={`translate(${pose.x} ${pose.y})`}
          opacity={pose.hullOpacity}
          data-world-x={pose.worldX}
          data-camera-x={pose.cameraX}
          data-forward="1,0"
        >
          <g
            className="lai-exhaust"
            opacity={pose.thrust}
            data-direction="-1,0"
          >
            {LAI_HULL.engines.map((e, i) => {
              const length =
                16 +
                pose.thrust * 24 +
                (reached && pose.win ? Math.min(36, pose.elapsed * 80) : 0);
              return (
                <g key={i} transform={`translate(${e.x} ${e.y})`}>
                  <path
                    d={`M0 -3.2L${-length} -6Q${-length - 5} 0 ${-length} 6L0 3.2Z`}
                    fill={`url(#${id}-thrust)`}
                  />
                  <ellipse
                    cx="-1"
                    cy="0"
                    rx="2.5"
                    ry="3.7"
                    fill="#d7f3fa"
                    opacity=".8"
                  />
                </g>
              );
            })}
          </g>
          <image {...imageProps} />
        </g>
        {reached && !pose.win && (
          <g className="lai-explosion">
            {LAI_FRAGMENTS.map((f, i) => {
              const q = laiFragmentPose(t, i);
              return (
                <g
                  className="lai-fragment"
                  key={i}
                  data-index={i}
                  transform={`translate(${q.x} ${q.y}) rotate(${q.angle}) translate(${-f.cx} ${-f.cy})`}
                >
                  <image
                    {...imageProps}
                    clipPath={`url(#${id}-fragment-${i})`}
                  />
                </g>
              );
            })}
            <g className="lai-ejecta" aria-hidden="true">
              {SPARKS.map((s, i) => {
                const u = pose.elapsed,
                  dx = Math.cos(s.a) * s.r,
                  dy = Math.sin(s.a) * s.r;
                const vx = LAI_TERMINAL_SPEED * (1 - LAI_CAMERA_FRACTION) + dx;
                const x = carrierX + dx * u,
                  y = 160 + dy * u;
                return (
                  <path
                    key={i}
                    d={`M${x - vx * 0.025} ${y - dy * 0.025}L${x} ${y}`}
                    stroke={u < 0.15 ? "#e1d9bc" : "#906e4e"}
                    strokeWidth={i % 4 === 0 ? 1.5 : 0.8}
                    opacity={clamp(1 - u / s.life)}
                  />
                );
              })}
            </g>
            <circle
              className="lai-plasma-flash"
              cx={carrierX}
              cy="160"
              r={30 + pose.elapsed * 140}
              fill={`url(#${id}-flash)`}
              opacity={pose.flash}
            />
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
