import { useId } from "react";
import type { Round } from "../lib/casinoPractice";
import type { TableRun } from "../lib/casinoTableMotion";
import { LAI_HULL, LAI_FRAGMENTS } from "../lib/casinoLaiMotion";
import {
  FLEET_RANKS,
  FLEET_REVEAL,
  FLEET_RESOLVE,
  fleetWinner,
  fleetCardPose,
  fleetShipPose,
  fleetDamage,
  fleetFragmentPose,
  fleetShots,
  fleetShotPose,
  type FleetSide,
} from "../lib/casinoFleetDuelMotion";
import { useTableCues } from "./useCasinoTimeline";
import "../styles/casino-fleet-duel.css";
const SHIP = `${import.meta.env.BASE_URL}casino/lai-jump/lai-top.webp`;
const SIDES = [0, 1] as FleetSide[];
const STARS = Array.from({ length: 58 }, (_, i) => ({
  x: (i * 157 + 19) % 600,
  y: (i * i * 47 + 11) % 280,
}));
export function CasinoFleetDuel({
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
    winner = has ? fleetWinner(round.values[0], round.values[1]) : null,
    resolved = has && t >= FLEET_RESOLVE,
    phase = !has
      ? "ready"
      : resolved
        ? "resolved"
        : t < 0.34
          ? "deploying"
          : "engaging",
    result = winner === null ? "STANDOFF" : winner === 0 ? "VICTORY" : "DEFEAT",
    shots = fleetShots(winner),
    imageProps = {
      href: SHIP,
      x: -LAI_HULL.width / 2,
      y: -LAI_HULL.height / 2,
      width: LAI_HULL.width,
      height: LAI_HULL.height,
    };
  useTableCues(run, t, animated, [
    ...FLEET_REVEAL.map((at) => ({
      at: at * (run.duration - 100),
      cue: "card" as const,
    })),
    { at: 0.35 * (run.duration - 100), cue: "scan" as const },
    ...(winner === null
      ? []
      : [{ at: 0.7 * (run.duration - 100), cue: "land" as const }]),
  ]);
  return (
    <div
      className="fleet-duel-stage"
      data-progress={t}
      data-phase={phase}
      data-outcome={
        resolved
          ? winner === null
            ? "tie"
            : winner === 0
              ? "win"
              : "loss"
          : undefined
      }
    >
      <header>
        <span>FLEET DUEL</span>
        <b>{resolved ? "RESOLVED" : phase.toUpperCase()}</b>
      </header>
      <div className="fleet-command-cards">
        {SIDES.map((side) => {
          const card = fleetCardPose(t, side, has),
            rank = card.shown ? FLEET_RANKS[round!.values[side]] : null;
          return (
            <section
              key={side}
              className={`fleet-command-side fleet-side-${side}`}
            >
              <h4>{side === 0 ? "YOUR FLEET" : "OPPOSING FLEET"}</h4>
              <div
                className={`fleet-command-card ${card.shown ? "face" : "back"} ${resolved && winner === side ? "victor" : ""} ${resolved && winner !== null && winner !== side ? "defeated" : ""}`}
                role="img"
                aria-label={
                  card.shown
                    ? `${side === 0 ? "Your" : "Opposing"} fleet: ${rank}`
                    : "Unrevealed fleet card"
                }
                data-rank={card.shown ? round!.values[side] : undefined}
                style={{ transform: `rotateY(${card.angle}deg)` }}
              >
                {card.shown ? (
                  <>
                    <span className="fleet-card-rank">{rank}</span>
                    <span className="fleet-card-designator">LAI / WING</span>
                    <div className="fleet-card-art" aria-hidden="true">
                      {[0, 1, 2].map((i) => (
                        <img
                          key={i}
                          src={SHIP}
                          alt=""
                          className={`fleet-card-ship ship-${i}`}
                        />
                      ))}
                    </div>
                    <span className="fleet-card-corner">{rank}</span>
                    <div className="fleet-card-bars" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="fleet-card-sigil" aria-hidden="true">
                      ◇<i />
                      <i />
                    </div>
                    <span className="fleet-card-back-label">CRADLE</span>
                  </>
                )}
              </div>
              <small>
                {resolved
                  ? winner === null
                    ? "STANDOFF"
                    : winner === side
                      ? "VICTORY"
                      : "DEFEAT"
                  : " "}
              </small>
            </section>
          );
        })}
        <span className="fleet-card-vs" aria-hidden="true">
          VS
        </span>
      </div>
      <svg
        className="fleet-engagement"
        viewBox="0 0 600 280"
        role="img"
        aria-label={
          resolved
            ? `Fleet engagement: ${result.toLowerCase()}`
            : "Opposing Lai fleets"
        }
      >
        <defs>
          <radialGradient id={`${id}-field`}>
            <stop stopColor="#20454c" stopOpacity=".3" />
            <stop offset="1" stopColor="#09131a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-impact`}>
            <stop stopColor="#fff2cd" />
            <stop offset=".22" stopColor="#f3a16b" stopOpacity=".7" />
            <stop offset="1" stopColor="#c5622e" stopOpacity="0" />
          </radialGradient>
          {LAI_FRAGMENTS.map((f, i) => (
            <clipPath id={`${id}-piece-${i}`} key={i}>
              <polygon points={f.points} />
            </clipPath>
          ))}
        </defs>
        <ellipse
          cx="300"
          cy="140"
          rx="300"
          ry="140"
          fill={`url(#${id}-field)`}
        />
        <path d="M280 140h40M300 120v40" stroke="#728a8650" strokeWidth=".7" />
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={i % 8 === 0 ? 0.9 : 0.45}
            fill="#a6c1c7"
            opacity={0.12 + (i % 4) * 0.07}
          />
        ))}
        {SIDES.map((side) => (
          <g
            key={side}
            className={`fleet-wing fleet-wing-${side}`}
            data-side={side}
          >
            {[0, 1, 2].map((index) => {
              const ship = fleetShipPose(has ? t : 0, side, index),
                damage = fleetDamage(t, side, index, winner, has);
              return (
                <g
                  key={index}
                  className="fleet-ship"
                  data-index={index}
                  data-destroyed={damage.destroyed}
                  transform={`translate(${ship.x} ${ship.y}) rotate(${ship.heading})`}
                >
                  {!damage.destroyed ? (
                    <g
                      className="fleet-intact"
                      transform={`scale(${ship.scale})`}
                    >
                      <image {...imageProps} />
                      <path
                        d={`M${LAI_HULL.width / 2 + 8} -12v-8h-8M${LAI_HULL.width / 2 + 8} 12v8h-8`}
                        fill="none"
                        stroke={side === 0 ? "#8ed7d1" : "#dc9e73"}
                        strokeWidth="3"
                        opacity=".65"
                      />
                    </g>
                  ) : (
                    <g className="fleet-wreck">
                      {LAI_FRAGMENTS.map((f, i) => {
                        const q = fleetFragmentPose(
                          damage.elapsed,
                          i,
                          ship.scale,
                        );
                        return (
                          <g
                            key={i}
                            className="fleet-fragment"
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
                      className="fleet-destruction"
                      r={12 + damage.elapsed * 60}
                      opacity={damage.flash}
                      fill={`url(#${id}-impact)`}
                    />
                  )}
                </g>
              );
            })}
          </g>
        ))}
        {has &&
          t < 1 &&
          shots.map((shot, i) => {
            const q = fleetShotPose(t, shot),
              impact = (t - shot.hit) * 4,
              target = fleetShipPose(t, shot.side === 0 ? 1 : 0, shot.target);
            return (
              <g key={i}>
                {q.active && (
                  <path
                    className="fleet-bolt"
                    data-firing-side={shot.side}
                    data-lethal={shot.lethal}
                    d={`M${q.tx} ${q.ty}L${q.x} ${q.y}`}
                    stroke={shot.side === 0 ? "#b6eeea" : "#efb283"}
                    strokeWidth={shot.lethal ? 2.7 : 1.6}
                    strokeLinecap="round"
                  />
                )}
                {!shot.lethal && impact >= 0 && impact < 0.28 && (
                  <ellipse
                    className="fleet-shield"
                    cx={target.x}
                    cy={target.y}
                    rx={14 + impact * 45}
                    ry={23 + impact * 36}
                    fill="none"
                    stroke={shot.side === 0 ? "#efb283" : "#b6eeea"}
                    opacity={0.75 * (1 - impact / 0.28)}
                    strokeWidth="1.5"
                  />
                )}
              </g>
            );
          })}
        <path
          d="M12 35V12h23M565 12h23v23M12 245v23h23M565 268h23v-23"
          stroke="#6c898160"
          strokeWidth="1"
          fill="none"
        />
      </svg>
      <footer>
        {resolved
          ? winner === null
            ? "TIE · ½ RETURN"
            : winner === 0
              ? "2× RETURN"
              : "0× RETURN"
          : has
            ? " "
            : "READY"}
      </footer>
    </div>
  );
}
