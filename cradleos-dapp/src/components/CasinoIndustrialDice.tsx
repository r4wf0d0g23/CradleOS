import type { CSSProperties } from "react";
import { clamp } from "../lib/casinoTableMotion";
import { diePose, dieLight, DIE_CONTACTS } from "../lib/casinoObjectMotion";
import type { MotionCue } from "./useCasinoTimeline";
import "../styles/casino-industrial-dice.css";

const PIPS = [
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
];
export function diceImpactCues(count: number, duration: number): MotionCue[] {
  return Array.from({ length: count }, (_, i) =>
    DIE_CONTACTS.map((contact, j) => ({
      at: (0.06 + i * 0.07 + contact * 0.74) * (duration - 100),
      cue: (["dice_impact", "dice_tick", "dice_settle"] as const)[j],
    })),
  )
    .flat()
    .sort((a, b) => a.at - b.at);
}

export function PhysicalDie({
  face,
  index,
  t,
  has,
  matched = false,
}: {
  face: number;
  index: number;
  t: number;
  has: boolean;
  matched?: boolean;
}) {
  const p = has ? clamp((t - 0.06 - index * 0.07) / 0.74) : 1,
    done = has && p === 1,
    pose = diePose(p, face, index);
  return (
    <div
      className={`physical-die-floor industrial-die-floor ${done && matched ? "die-matched" : ""}`}
      style={
        {
          "--shadow": pose.shadow,
          "--shadow-x": `${pose.x}px`,
          "--shadow-scale": pose.shadowScale,
          "--shadow-blur": `${2 + pose.height / 14}px`,
        } as CSSProperties
      }
    >
      <i className="dice-impact-pad" aria-hidden="true" />
      <div
        className="physical-die industrial-die"
        data-face={done ? face : undefined}
        data-die-progress={p}
        aria-label={done ? `Die ${face}` : has ? "Rolling die" : "Die"}
        style={{
          transform: `translate3d(${pose.x}px,calc(${-pose.height}px - ${pose.support - 1} * var(--die-half)),0) rotateZ(${pose.rz}deg) rotateX(${pose.rx}deg) rotateY(${pose.ry}deg)`,
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div
            key={n}
            className={`die-face face-${n}`}
            aria-hidden="true"
            style={{
              filter: `brightness(${dieLight(n - 1, pose.rx, pose.ry, pose.rz)})`,
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

/** Finite, outcome-independent hardware. The owner clock also governs instant/hidden mode. */
export function DiceHardware({
  kind,
  count,
  t,
}: {
  kind: string;
  count: number;
  t: number;
}) {
  const release = clamp(t / 0.13),
    closed = clamp((t - 0.3) / 0.12),
    gate = Math.sin((release * Math.PI) / 2) * (1 - closed),
    cage = 360 * (1 - (1 - clamp(t / 0.83)) ** 3);
  return (
    <div
      className={`industrial-dice-hardware hardware-${kind}`}
      aria-hidden="true"
    >
      <div className="dice-rig-header">
        <span />{" "}
        <b>
          {kind === "craps"
            ? "CRDL / SALVAGE"
            : kind === "sicbo"
              ? "R / III"
              : kind === "chuck_a_luck"
                ? "R / RESONANCE"
                : "R / DUAL"}
        </b>
        <span />
      </div>
      <div className="dice-rig-lanes">
        {Array.from({ length: count }, (_, i) => (
          <div className="dice-rig-lane" key={i}>
            <i
              className="dice-feed-gate"
              style={{ transform: `translateY(${-gate * 12}px)` }}
            />
            <small>{String(i + 1).padStart(2, "0")}</small>
          </div>
        ))}
      </div>
      {kind === "sicbo" && (
        <div className="dice-containment-glass">
          <i />
          <i />
        </div>
      )}
      {kind === "chuck_a_luck" && (
        <div className="dice-cage-bearing">
          <div
            className="industrial-resonance-cage"
            style={{ transform: `rotateX(${cage}deg)` }}
          >
            {[0, 45, 90, 135].map((angle) => (
              <i key={angle} style={{ transform: `rotateX(${angle}deg)` }} />
            ))}
          </div>
          <b />
          <b />
        </div>
      )}
      <div className="dice-rig-fasteners">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} />
        ))}
      </div>
    </div>
  );
}
