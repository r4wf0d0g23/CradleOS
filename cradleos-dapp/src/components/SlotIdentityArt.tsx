import { useState } from "react";
import { useGameIcons, iconAssetUrl } from "../lib/gameIcons";
import {
  SLOT_IDENTITIES,
  slotSymbol,
  fullInitialVault,
} from "../lib/casinoSlotIdentity";
import type { FleetKey, SlotFrame } from "../lib/casinoSlotFleet";
import { FLEET, WILD, SCATTER } from "../lib/casinoSlotFleet";
/** Uses extracted icon-library references; slot aliases are not official item-value claims. */
export function SlotSymbolArt({
  game,
  symbol,
  size = 64,
  eager = false,
}: {
  game: FleetKey;
  symbol: number;
  size?: number;
  eager?: boolean;
}) {
  const { data } = useGameIcons(),
    t = SLOT_IDENTITIES[game];
  const key =
    symbol === WILD
      ? t.wild
      : symbol === SCATTER
        ? t.scatter
        : slotSymbol(game, symbol)?.library;
  const src = iconAssetUrl(data?.library[key]?.asset);
  const name =
    symbol === WILD
      ? "WILD"
      : symbol === SCATTER
        ? "SCATTER"
        : (slotSymbol(game, symbol)?.name ?? "Symbol");
  const code =
    symbol === WILD
      ? "W"
      : symbol === SCATTER
        ? "S"
        : String(symbol + 1).padStart(2, "0");
  return (
    <IdentityImage
      key={src ?? "missing"}
      src={src}
      size={size}
      name={name}
      code={code}
      eager={eager}
    />
  );
}
function IdentityImage({
  src,
  size,
  name,
  code,
  eager,
}: {
  src: string | null;
  size: number;
  name: string;
  code: string;
  eager: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img
      className="game-icon"
      src={src}
      width={size}
      height={size}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="identity-symbol-fallback" title={name}>
      <b>{code}</b>
      <small>{name}</small>
    </span>
  );
}
export function SlotCoinValue({ value }: { value: number }) {
  const exact = String(Number(value.toFixed(4))),
    [whole, fraction] = exact.split(".");
  return exact.length > 6 && fraction ? (
    <>
      <b className="coin-whole">{whole}</b>
      <small className="coin-fraction">.{fraction}×</small>
    </>
  ) : (
    <>
      <b>{exact}</b>
      <small className="coin-unit">×</small>
    </>
  );
}
export function SlotWordmark({ game }: { game: FleetKey }) {
  const t = SLOT_IDENTITIES[game];
  return (
    <div className="slot-wordmark">
      <span>{t.title[0]}</span>
      <strong>{t.title[1]}</strong>
    </div>
  );
}
/** All decoration is non-interactive. No fictional progress meter or hidden outcome. */
export function SlotScenery({
  game,
  mini = false,
}: {
  game: FleetKey;
  mini?: boolean;
}) {
  const s = SLOT_IDENTITIES[game].scene;
  return (
    <div
      className={`slot-scenery scenery-${s} ${mini ? "scenery-mini" : ""}`}
      aria-hidden="true"
    >
      {s === "scrapyard" && (
        <>
          <div className="yard-gantry">
            <i />
            <i />
            <i />
          </div>
          <div className="yard-hoist">
            <span />
            <b />
          </div>
          <div className="yard-conveyor" />
          <div className="yard-plate">◈</div>
        </>
      )}
      {s === "wreckway" && (
        <>
          <div className="wreck-hull" />
          <div className="wreck-ribs">
            {[0, 1, 2, 3, 4].map((n) => (
              <i key={n} />
            ))}
          </div>
          <div className="wreck-keel" />
          <div className="wreck-lamp" />
        </>
      )}
      {s === "reactor" && (
        <>
          <div className="reactor-crown">
            <i />
            <b />
            <i />
          </div>
          <div className="reactor-pipe pipe-left" />
          <div className="reactor-pipe pipe-right" />
          <div className="reactor-exhaust" />
          <div className="reactor-heart" />
        </>
      )}
      {s === "feral" && (
        <svg viewBox="0 0 600 620" preserveAspectRatio="none">
          <g fill="none" stroke="currentColor" strokeWidth="13">
            <path d="M0 100 C170 0 24 205 87 280 S-20 390 83 525 L120 620" />
            <path d="M600 90 C450 8 579 200 529 278 S620 452 537 557 L500 620" />
            <path d="M0 510 Q70 440 48 370 M600 410 Q550 340 555 202" />
          </g>
          <g fill="currentColor">
            {[
              [35, 116],
              [72, 238],
              [53, 475],
              [560, 155],
              [542, 308],
              [568, 476],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="13" />
            ))}
          </g>
          <g stroke="currentColor" opacity=".35" strokeWidth="3">
            <path d="M50 0 L85 150 L145 215 M530 0 L480 145 L465 180 M0 600 L190 548 M600 580 L408 528" />
          </g>
        </svg>
      )}
      {s === "vault" && (
        <>
          <div className="vault-ring ring-outer" />
          <div className="vault-ring ring-inner" />
          <div className="vault-bolts">
            {Array.from({ length: 12 }, (_, n) => (
              <i
                key={n}
                style={{ transform: `rotate(${n * 30}deg) translateY(-47%)` }}
              />
            ))}
          </div>
          <div className="vault-crossbeam" />
        </>
      )}
      {s === "gatecrash" && (
        <>
          <div className="gate-horizon" />
          <div className="gate-causeway" />
          <div className="gate-stars" />
          {[0, 1, 2, 3, 4].map((n) => (
            <div
              className="gate-beam"
              key={n}
              style={{ left: `${8 + n * 20}%` }}
            />
          ))}
        </>
      )}
      {s === "drones" && (
        <>
          <div className="drone-screen-lines" />
          <div className="drone-corner corner-a" />
          <div className="drone-corner corner-b" />
          <svg className="drone-schematic" viewBox="0 0 300 100">
            <g stroke="currentColor" fill="none" strokeWidth="1.5">
              <path d="M150 3 L178 36 L279 69 L192 68 L170 92 L150 73 L130 92 L108 68 L21 69 L122 36Z" />
              <path d="M150 3 L150 73 M122 36 L178 36 M60 70 L130 46 M240 70 L170 46" />
              <circle cx="150" cy="49" r="12" />
            </g>
          </svg>
        </>
      )}
      {s === "eclipse" && (
        <>
          <div className="eclipse-corona" />
          <div className="eclipse-body" />
          <div className="orbit orbit-a" />
          <div className="orbit orbit-b" />
          <div className="orbit orbit-c" />
          <i className="eclipse-moon moon-a" />
          <i className="eclipse-moon moon-b" />
        </>
      )}
    </div>
  );
}
export function SlotFeatureInstrument({
  game,
  frame,
  covered,
}: {
  game: FleetKey;
  frame?: SlotFrame;
  covered: boolean;
}) {
  const s = SLOT_IDENTITIES[game].scene,
    visible = frame && !covered,
    stage = visible ? frame.multiplier : 1;
  if (s === "reactor")
    return (
      <div
        className="reaction-instrument"
        aria-label={`Reaction stage ${stage} of 6`}
      >
        <span>REACTION</span>
        <div>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <i key={n} className={n <= stage ? "lit" : ""} />
          ))}
        </div>
        <b>{stage}×</b>
      </div>
    );
  if (s === "feral")
    return (
      <div className="swarm-instrument">
        <span>NETWORK CHAIN</span>
        <b>{stage} / 4</b>
        <i style={{ width: `${stage * 25}%` }} />
      </div>
    );
  if (s === "vault") {
    const coins = visible ? frame.coins.filter((n) => n > 0).length : 0;
    return (
      <div className="vault-instrument">
        <span>
          {coins === 15
            ? "VAULT FULL"
            : coins >= 6
              ? "VAULT BREACHED"
              : "6 SEALS TO BREACH"}
        </span>
        <div>
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <i key={n} className={n < coins ? "lit" : ""} />
          ))}
        </div>
      </div>
    );
  }
  if (s === "drones") {
    const locked =
      visible && frame.kind === "free"
        ? frame.grid.flat().filter((n) => n === WILD).length
        : 0;
    return (
      <div className="drone-instrument">
        <span>HARDPOINTS HELD</span>
        <b>{locked.toString().padStart(2, "0")} / 15</b>
        <div>
          {Array.from({ length: 15 }, (_, n) => (
            <i key={n} className={n < locked ? "lit" : ""} />
          ))}
        </div>
      </div>
    );
  }
  if (s === "wreckway")
    return (
      <div className="cargo-bay-labels">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n}>BAY {String(n).padStart(2, "0")}</span>
        ))}
      </div>
    );
  if (s === "scrapyard")
    return (
      <div className="yard-badge">
        <span>RECLAIM / SORT / SALVAGE</span>
        <b>10 LINES</b>
      </div>
    );
  if (s === "gatecrash")
    return (
      <div className="transit-instrument">
        <span>GATE ARRAY</span>
        <div>
          {[0, 1, 2, 3, 4].map((n) => (
            <i
              key={n}
              className={
                visible && frame.grid[n].every((x) => x === WILD) ? "lit" : ""
              }
            />
          ))}
        </div>
        <b>05</b>
      </div>
    );
  return (
    <div className="orbital-instrument">
      <span>ALIGNMENT</span>
      <b>{visible ? frame.ways.toLocaleString() : "32–3,125"} WAYS</b>
    </div>
  );
}
/** Only edges between cells in the SAME evaluated connected win, never union-adjacent groups. */
export function FeralConnections({
  frame,
  visible,
}: {
  frame?: SlotFrame;
  visible: boolean;
}) {
  if (!frame || !visible) return null;
  return (
    <svg
      className="feral-connections"
      viewBox="0 0 500 500"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {frame.wins.flatMap((win, group) => {
        const set = new Set(win.cells);
        return win.cells.flatMap((id) => {
          const x = Math.floor(id / 5),
            y = id % 5;
          return [
            [x + 1, y],
            [x, y + 1],
          ].flatMap(([nx, ny]) =>
            nx < 5 && ny < 5 && set.has(nx * 5 + ny)
              ? [
                  <line
                    key={`${group}-${id}-${nx}-${ny}`}
                    x1={x * 100 + 50}
                    y1={y * 100 + 50}
                    x2={nx * 100 + 50}
                    y2={ny * 100 + 50}
                  />,
                ]
              : [],
          );
        });
      })}
    </svg>
  );
}

/** Revealed feature state only. No progress invented from future saved frames. */
export function SlotBonusPanel({
  game,
  frame,
}: {
  game: FleetKey;
  frame?: SlotFrame;
}) {
  if (!frame) return null;
  if (fullInitialVault(game, frame))
    return (
      <div className="identity-bonus vault-attempts">COLLECTION READY</div>
    );
  if (game === "slot_vault")
    return frame.remaining > 0 ? (
      <div
        className="identity-bonus vault-attempts"
        aria-label={`${frame.remaining} respins remaining`}
      >
        <span>BREACH ATTEMPTS</span>
        <div>
          {[0, 1, 2].map((n) => (
            <i key={n} className={n < frame.remaining ? "on" : ""} />
          ))}
        </div>
        <b>{frame.remaining} LEFT</b>
      </div>
    ) : null;
  const labels: Partial<Record<FleetKey, string>> = {
    slot_scrapyard: "SALVAGE PASSES",
    slot_wreckways: "RECOVERY SWEEP",
    slot_gatecrash: "GATE RUN",
    slot_drones: "RECLAMATION MISSION",
    slot_eclipse: "ORBITAL ALIGNMENT",
  };
  const label = labels[game];
  if (
    !label ||
    !(frame.kind === "free" || (frame.kind === "spin" && frame.remaining > 0))
  )
    return null;
  const total = FLEET[game].free,
    current = frame.kind === "free" ? frame.index : 0;
  return (
    <div
      className="identity-bonus"
      aria-label={`${label}: ${current ? `Free spin ${current} of ${total}` : `${total} free spins awarded`}`}
    >
      <span>{label}</span>
      <div>
        {Array.from({ length: total }, (_, n) => (
          <i key={n} className={n < current ? "on" : ""} />
        ))}
      </div>
      <b>
        {current ? `${current} / ${total}` : `${total} FREE`}
        {FLEET[game].boost > 1 ? ` · ${FLEET[game].boost}×` : ""}
      </b>
    </div>
  );
}
