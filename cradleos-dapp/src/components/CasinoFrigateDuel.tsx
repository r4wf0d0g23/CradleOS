import { useId } from "react";
import type { Round } from "../lib/casinoPractice";
import type { TableRun } from "../lib/casinoTableMotion";
import { LAI_HULL, LAI_FRAGMENTS } from "../lib/casinoLaiMotion";
import {
  FRIGATE_SECONDS,
  FRIGATE_REVEAL,
  FRIGATE_IMPACT,
  FRIGATE_RESOLVE,
  frigateWinner,
  frigateCardProgress,
  frigatePose,
  frigatePoint,
  frigateShots,
  frigateShotPose,
  frigateDamage,
  frigateFragmentPose,
  type FrigateSide,
} from "../lib/casinoFrigateDuelMotion";
import { MotionCard } from "./CasinoTableCard";
import { useTableCues } from "./useCasinoTimeline";
import "../styles/casino-frigate-duel.css";
const SHIP = `${import.meta.env.BASE_URL}casino/lai-jump/lai-top.webp`;
const SIDES = [0, 1] as FrigateSide[];
const NAMES = ["DRAGON", "TIGER"];
const COLORS = ["#a9e4db", "#edb185"];
const STARS = Array.from({ length: 54 }, (_, i) => ({
  x: (i * 173 + 37) % 600,
  y: (i * i * 43 + 17) % 320,
}));
export function CasinoFrigateDuel({
  round,
  t,
  animated,
  run,
}: {
  round: Round | null;
  t: number;
  animated: boolean;
  run: TableRun;
}) {
  const id = useId().replace(/:/g, ""),
    has = !!round,
    winner = has ? frigateWinner(round.values[0], round.values[1]) : null,
    resolved = has && t >= FRIGATE_RESOLVE,
    phase = !has
      ? "READY"
      : resolved
        ? "RESOLVED"
        : t < 0.35
          ? "APPROACH"
          : "ENGAGING",
    result = winner === null ? "STANDOFF" : `${NAMES[winner]} WINS`,
    shots = frigateShots(winner),
    imageProps = {
      href: SHIP,
      x: -LAI_HULL.width / 2,
      y: -LAI_HULL.height / 2,
      width: LAI_HULL.width,
      height: LAI_HULL.height,
    };
  useTableCues(run, t, animated, [
    ...FRIGATE_REVEAL.map((at) => ({
      at: at * (run.duration - 100),
      cue: "card" as const,
    })),
    { at: 0.35 * (run.duration - 100), cue: "scan" as const },
    ...(winner === null
      ? []
      : [{ at: FRIGATE_IMPACT * (run.duration - 100), cue: "land" as const }]),
  ]);
  return (
    <div
      className="frigate-duel-stage"
      data-progress={t}
      data-phase={phase.toLowerCase()}
      data-outcome={
        resolved
          ? winner === null
            ? "tie"
            : winner === 0
              ? "dragon"
              : "tiger"
          : undefined
      }
    >
      <header>
        <span>FRIGATE DUEL</span>
        <b>{phase}</b>
      </header>
      <div className="frigate-cards">
        {SIDES.map((side) => (
          <section key={side} className={`frigate-side-${side}`}>
            <h4>{NAMES[side]}</h4>
            <MotionCard
              value={round?.values[side] ?? 0}
              hidden={!has}
              rankOnly
              progress={frigateCardProgress(t, side, has)}
              winner={resolved && winner === side}
            />
          </section>
        ))}
        <span className="frigate-vs" aria-hidden="true">
          VS
        </span>
      </div>
      <svg
        className="frigate-engagement"
        viewBox="0 0 600 320"
        role="img"
        aria-label={resolved ? result : "Dragon and Tiger frigates"}
      >
        <defs>
          <radialGradient id={`${id}-field`}>
            <stop stopColor="#26474c" stopOpacity=".5" />
            <stop offset="1" stopColor="#060c13" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-impact`}>
            <stop stopColor="#fff6d8" />
            <stop offset=".25" stopColor="#efa574" stopOpacity=".8" />
            <stop offset="1" stopColor="#bc5129" stopOpacity="0" />
          </radialGradient>
          {LAI_FRAGMENTS.map((f, i) => (
            <clipPath id={`${id}-piece-${i}`} key={i}>
              <polygon points={f.points} />
            </clipPath>
          ))}
        </defs>
        <ellipse
          cx="300"
          cy="160"
          rx="280"
          ry="155"
          fill={`url(#${id}-field)`}
        />
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={i % 9 === 0 ? 0.95 : 0.5}
            fill="#c4d8d1"
            opacity={0.12 + (i % 4) * 0.06}
          />
        ))}
        <path
          d="M270 160h60M300 130v60"
          fill="none"
          stroke="#83a5a32b"
          strokeWidth=".8"
        />
        {SIDES.map((side) => {
          const ship = frigatePose(has ? t : 0, side),
            damage = frigateDamage(t, side, winner, has);
          return (
            <g
              key={side}
              className="frigate-ship"
              data-side={side}
              data-destroyed={damage.destroyed}
              transform={`translate(${ship.x} ${ship.y}) rotate(${ship.heading})`}
            >
              {!damage.destroyed ? (
                <g
                  className="frigate-intact"
                  transform={`scale(${ship.scale})`}
                >
                  <image {...imageProps} />
                  <path
                    d="M-51 -45v-12h9M-51 45v12h9"
                    fill="none"
                    stroke={COLORS[side]}
                    strokeWidth="2.5"
                    opacity=".8"
                  />
                </g>
              ) : (
                <g className="frigate-wreck">
                  {LAI_FRAGMENTS.map((f, i) => {
                    const q = frigateFragmentPose(damage.elapsed, i);
                    return (
                      <g
                        key={i}
                        className="frigate-fragment"
                        transform={`translate(${q.x} ${q.y}) rotate(${q.angle}) scale(${ship.scale}) translate(${-f.cx} ${-f.cy})`}
                      >
                        <image
                          {...imageProps}
                          clipPath={`url(#${id}-piece-${i})`}
                          opacity=".7"
                        />
                      </g>
                    );
                  })}
                </g>
              )}
              {damage.flash > 0 && (
                <circle
                  className="frigate-destruction"
                  cx={32 * ship.scale}
                  r={18 + damage.elapsed * 85}
                  opacity={damage.flash}
                  fill={`url(#${id}-impact)`}
                />
              )}
            </g>
          );
        })}
        {has &&
          t < 1 &&
          shots
            .filter(
              (shot) => t >= shot.fire && t < shot.hit + 0.25 / FRIGATE_SECONDS,
            )
            .map((shot, i) => {
              const q = frigateShotPose(t, shot),
                impact = (t - shot.hit) * FRIGATE_SECONDS,
                targetSide = shot.side === 0 ? 1 : 0,
                target = frigatePoint(t, targetSide, 32),
                targetPose = frigatePose(t, targetSide),
                muzzleAge = (t - shot.fire) * FRIGATE_SECONDS,
                muzzle = frigatePoint(t, shot.side, 38);
              return (
                <g key={i}>
                  {muzzleAge >= 0 && muzzleAge < 0.055 && (
                    <circle
                      className="frigate-muzzle"
                      cx={muzzle.x}
                      cy={muzzle.y}
                      r={shot.lethal ? 5 : 3}
                      opacity={1 - muzzleAge / 0.055}
                      fill={COLORS[shot.side]}
                    />
                  )}
                  {q.active && (
                    <path
                      className="frigate-bolt"
                      data-firing-side={shot.side}
                      data-lethal={shot.lethal}
                      d={`M${q.tx} ${q.ty}L${q.x} ${q.y}`}
                      stroke={COLORS[shot.side]}
                      strokeWidth={shot.lethal ? 3 : 1.9}
                      strokeLinecap="round"
                    />
                  )}
                  {!shot.lethal && impact >= 0 && impact < 0.25 && (
                    <g
                      transform={`translate(${target.x} ${target.y}) rotate(${targetPose.heading})`}
                    >
                      <ellipse
                        className="frigate-shield"
                        rx={12 + impact * 50}
                        ry={29 + impact * 55}
                        fill="none"
                        stroke={COLORS[targetSide]}
                        opacity={0.85 * (1 - impact / 0.25)}
                        strokeWidth="2"
                      />
                    </g>
                  )}
                </g>
              );
            })}
        <path
          d="M12 37V12h25M563 12h25v25M12 283v25h25M563 308h25v-25"
          stroke="#73958b65"
          fill="none"
        />
      </svg>
      <footer>{resolved ? result : "\u00a0"}</footer>
    </div>
  );
}
