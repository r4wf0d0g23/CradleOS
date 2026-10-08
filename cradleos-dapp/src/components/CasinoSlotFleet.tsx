import measured from "../data/casino-slot-math.json";
import { useContext, useEffect, useState, type CSSProperties } from "react";

import {
  SLOT_IDENTITIES,
  slotSymbol,
  slotFrameLabel,
} from "../lib/casinoSlotIdentity";
import {
  SlotScenery,
  SlotSymbolArt,
  SlotWordmark,
  SlotBonusPanel,
  SlotCoinValue,
  SlotFeatureInstrument,
  FeralConnections,
} from "./SlotIdentityArt";
import "../styles/casino-slot-identities.css";
import { CasinoFeedback } from "../lib/casinoFeedback";
import { chipLabel } from "../lib/casinoPractice";
import {
  BASE_POINTS,
  COIN_POINTS,
  COIN_THRESHOLDS,
  FLEET,
  FLEET_KEYS,
  LINES,
  WILD,
  SCATTER,
  COIN,
  EMPTY,
  effectiveMultiplier,
  weightsFor,
  type FleetKey,
  type SlotReceipt,
} from "../lib/casinoSlotFleet";
import type { GameEntry } from "../lib/casinoCatalog";
export const FLEET_CATALOG: GameEntry[] = FLEET_KEYS.map((key) => ({
  key,
  name: FLEET[key].name,
  category: "slots",
  variance: "H",
  buildClass: "I",
  glyph: "◇",
  hook: FLEET[key].feature,
  status: "live",
}));
export const SLOT_REVEAL_MS = 1500;
const mult = (n: number) => `${Number(n.toFixed(4))}×`;
export function FleetTile({ game }: { game: FleetKey }) {
  const t = SLOT_IDENTITIES[game];
  return (
    <div
      className={`fleet-tile identity-tile scene-${t.scene}`}
      style={
        {
          "--fleet-accent": t.accent,
          "--scene-secondary": t.secondary,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <SlotScenery game={game} mini />
      <SlotWordmark game={game} />
      <div className="identity-tile-symbols">
        {[0, 3, 6].map((n) => (
          <SlotSymbolArt game={game} symbol={n} size={44} key={n} />
        ))}
      </div>
    </div>
  );
}
export function FleetBoard({
  game,
  receipt,
  busy,
  reduced,
}: {
  game: FleetKey;
  receipt?: SlotReceipt;
  busy: boolean;
  reduced: boolean;
}) {
  const g = FLEET[game],
    t = SLOT_IDENTITIES[game],
    play = useContext(CasinoFeedback);
  const [expanded, setExpanded] = useState(true);
  const index = receipt
    ? Math.min(
        receipt.frames.length - 1,
        busy ? receipt.cursor : Math.max(0, receipt.cursor - 1),
      )
    : 0;
  const frame = receipt?.frames[index];
  const covered = !!receipt && !busy && receipt.cursor === 0;
  useEffect(() => {
    setExpanded(!busy || reduced);
    if (!busy || reduced) return;
    const timers = [
      setTimeout(() => {
        setExpanded(true);
        play("stop", game);
      }, 900),
    ];
    return () => timers.forEach(clearTimeout);
  }, [busy, index, receipt?.draws, game, reduced, play]);
  const shown = frame
    ? expanded
      ? frame.grid
      : frame.original
    : Array.from({ length: 5 }, (_, c) =>
        Array.from({ length: g.rows || 3 }, (_, r) => (c + r) % 7),
      );
  const won = new Set(
    !busy && !covered ? frame?.wins.flatMap((w) => w.cells) : [],
  );
  const previous = receipt && index > 0 ? receipt.frames[index - 1] : null;
  const previousWins = new Set(previous?.wins.flatMap((w) => w.cells) ?? []);
  const count = frame?.coins.filter((n) => n > 0).length ?? 0;
  const revealed =
    receipt && receipt.cursor > 0
      ? receipt.frames[receipt.cursor - 1].total
      : 0;
  return (
    <div
      className={`fleet-board slot-identity scene-${t.scene} fleet-${g.mode} ${busy && !reduced ? "fleet-spinning" : ""} ${covered ? "fleet-covered" : ""}`}
      style={
        {
          "--fleet-accent": t.accent,
          "--scene-secondary": t.secondary,
        } as CSSProperties
      }
      data-slot-game={game}
      data-stage={index}
      data-cursor={receipt?.cursor ?? 0}
    >
      <div
        className={`identity-stage ${game === "slot_vault" && !busy && !covered && count >= 6 ? "vault-open" : ""} ${busy && !reduced ? "identity-active" : ""} ${!busy && frame?.kind === "free" && !covered ? "identity-free" : ""}`}
      >
        <SlotScenery game={game} />
        <header className="identity-heading">
          <small>{t.tagline}</small>
          <SlotWordmark game={game} />
        </header>
        <SlotFeatureInstrument
          game={game}
          frame={frame ? { ...frame, grid: shown } : undefined}
          covered={covered}
        />
        <div className="identity-playfield">
          <div
            className="fleet-grid"
            role="img"
            aria-label={
              covered
                ? "Saved spin ready to reveal"
                : `${g.name} ${slotFrameLabel(game, frame)}. ${shown.map((col, c) => `Reel ${c + 1}: ${col.map((n) => (n === WILD ? "Wild" : n === SCATTER ? "Scatter" : n === COIN ? "Value token" : n === EMPTY ? "Empty" : slotSymbol(game, n)?.name)).join(", ")}`).join(". ")}`
            }
          >
            {shown.map((col, c) => (
              <div
                className="fleet-reel"
                key={c}
                style={{ "--reel": c } as CSSProperties}
              >
                {col.map((symbol, r) => {
                  const id = c * 5 + r,
                    coinValue = frame?.coins[c * 3 + r] ?? 0;
                  const before = previous?.grid[c]?.[r];
                  const locked =
                    (g.mode === "hold" && symbol === COIN && before === COIN) ||
                    (game === "slot_drones" &&
                      frame?.kind === "free" &&
                      previous?.kind === "free" &&
                      symbol === WILD &&
                      before === WILD);
                  // Refill cells enter from above; each survivor falls from its actual prior row.
                  const refills =
                    previous?.grid[c]?.filter((_, y) =>
                      previousWins.has(c * 5 + y),
                    ).length ?? 0;
                  const animate =
                    busy &&
                    !reduced &&
                    !locked &&
                    (frame?.kind !== "cascade" || r < refills);
                  const survivors =
                    previous?.grid[c]?.flatMap((_, y) =>
                      previousWins.has(c * 5 + y) ? [] : [y],
                    ) ?? [];
                  const fall =
                    busy &&
                    !reduced &&
                    frame?.kind === "cascade" &&
                    r >= refills
                      ? r - (survivors[r - refills] ?? r)
                      : 0;
                  return (
                    <div
                      key={r}
                      style={{ "--fall": fall, "--row": r } as CSSProperties}
                      className={`fleet-cell ${symbol === WILD ? "fleet-wild" : symbol === SCATTER ? "fleet-scatter" : symbol === COIN ? "fleet-coin" : symbol === EMPTY ? "fleet-empty" : ""} ${won.has(id) ? "fleet-cell-win" : ""} ${animate ? "fleet-cell-drop" : ""} ${fall > 0 ? "fleet-cell-fall" : ""} ${locked ? "fleet-locked" : ""}`}
                      data-symbol={symbol}
                      data-cell={id}
                      title={
                        covered
                          ? "Unrevealed"
                          : symbol === WILD
                            ? "Wild"
                            : symbol === SCATTER
                              ? "Scatter"
                              : symbol === COIN
                                ? `${mult(effectiveMultiplier(g, coinValue))} stake, collected at feature end`
                                : symbol === EMPTY
                                  ? "Empty"
                                  : slotSymbol(game, symbol)?.name
                      }
                    >
                      {covered ? (
                        <span>◇</span>
                      ) : symbol < 7 ? (
                        <SlotSymbolArt game={game} symbol={symbol} size={64} />
                      ) : symbol === WILD ? (
                        <>
                          <SlotSymbolArt game={game} symbol={WILD} size={52} />
                          <b>WILD</b>
                        </>
                      ) : symbol === SCATTER ? (
                        <>
                          <SlotSymbolArt
                            game={game}
                            symbol={SCATTER}
                            size={52}
                          />
                          <b>SCATTER</b>
                        </>
                      ) : symbol === COIN ? (
                        <SlotCoinValue
                          value={effectiveMultiplier(g, coinValue)}
                        />
                      ) : (
                        <span>·</span>
                      )}
                      {locked && !covered && (
                        <small className="fleet-lock">◆</small>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {game === "slot_feral" && (
            <FeralConnections frame={frame} visible={!busy && !covered} />
          )}
        </div>
        {!busy && !covered && <SlotBonusPanel game={game} frame={frame} />}
        <div className="identity-stage-foot">
          <span>{g.mechanic}</span>
          <span>{g.feature}</span>
        </div>
      </div>
      <div className="fleet-meter">
        <span>
          {covered
            ? "SAVED ROUND"
            : busy
              ? frame?.kind === "hold"
                ? "RESPINNING"
                : frame?.kind === "cascade"
                  ? "CASCADING"
                  : "REELS ACTIVE"
              : slotFrameLabel(game, frame)}
        </span>
        <strong>
          {covered
            ? "—"
            : g.mode === "hold"
              ? `${count}/15 COINS`
              : frame?.ways
                ? `${frame.ways.toLocaleString()} ${g.mode === "ways" ? "WAYS" : "LINES"}`
                : `${frame?.multiplier ?? 1}× CHAIN`}
        </strong>
      </div>
      {game === "slot_gatecrash" &&
        frame &&
        !covered &&
        frame.scatters >= 3 && (
          <small className="fleet-trigger">
            {frame.scatters} scatters before wild expansion
            {frame.kind === "spin" ? " · 5 free spins" : " · no retrigger"}
          </small>
        )}
      {frame && !busy && !covered && (
        <div className="fleet-stage-win">
          <span>
            Stage return <b>{chipLabel(frame.award)}</b>
          </span>
          <span>
            Collected <b>{chipLabel(revealed)}</b> chips
          </span>
        </div>
      )}
      {frame && !busy && !covered && frame.wins.length > 0 && (
        <details className="fleet-win-detail">
          <summary>
            {frame.wins.length} winning{" "}
            {g.mode === "lines"
              ? "lines"
              : g.mode === "ways"
                ? "symbols"
                : "groups"}
          </summary>
          {frame.wins.map((w, i) => (
            <p key={i}>
              {slotSymbol(game, w.symbol).name} · {w.count}{" "}
              {g.mode === "lines" || g.mode === "ways" ? "reels" : "symbols"}
              {w.ways > 1 ? ` · ${w.ways} ways` : ""} ·{" "}
              {mult(effectiveMultiplier(g, w.points) * frame.multiplier)}
            </p>
          ))}
        </details>
      )}
    </div>
  );
}
export function FleetRules({ game }: { game: FleetKey }) {
  const g = FLEET[game],
    weights = weightsFor(g);
  return (
    <details className="lounge-rules fleet-rules">
      <summary>
        Rules, rewards &amp; measured odds <span>＋</span>
      </summary>
      <p>
        One stake covers the entire spin and its bonus. Returns include any
        returned stake. Weighted independent cells, not physical reel strips. No
        paid bonus buys, auto-betting or progressive pool.
      </p>
      {g.mode === "hold" ? (
        <>
          <p>
            Each of 15 initial cells has a 22% coin chance. Fewer than 6 coins
            returns zero. At least 6 opens three respins: each empty cell has a
            12% new-coin chance; any new coin resets the counter to 3. Coins and
            values stay locked. Collect once on a full board or after three
            misses. Filling all 15 adds a fixed{" "}
            {mult(effectiveMultiplier(g, 100))} bonus, on top of the coins—not a
            fixed total jackpot.
          </p>
          <div className="lounge-paytable">
            {COIN_POINTS.map((p, i) => (
              <div key={p}>
                <span>{mult(effectiveMultiplier(g, p))} coin</span>
                <b>
                  {(COIN_THRESHOLDS[i] - (COIN_THRESHOLDS[i - 1] ?? 0)) / 100}%
                  of coins
                </b>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p>
            {g.mode === "lines"
              ? "Ten fixed paylines. Match 3+ of the same symbol from the leftmost reel. Wilds substitute for regular symbols; only the highest-paying eligible match pays on each line. Multiple lines add together."
              : g.mode === "ways"
                ? "Match the same symbol on 3+ consecutive reels starting at the left. All combinations across matching cells pay; longest match only per symbol. These games have no wild symbols."
                : g.mode === "count"
                  ? "Eight or more matching symbols anywhere on the 5×4 board pay. Winning symbols disappear; survivors fall and new symbols refill. Up to six evaluated boards; multipliers run 1× through 6×. Stage six is final even if it wins."
                  : "Five or more orthogonally connected matching symbols pay on the 5×5 board. Diagonals do not connect. Winning clusters disappear and refill, with multipliers 1× through 4× across at most four evaluated boards."}
          </p>
          {g.free > 0 && (
            <p>
              Three or more scatters on the initial spin award {g.free} free
              spins at {g.boost}×. No retriggers and no separate scatter payout.{" "}
              {game === "slot_gatecrash"
                ? "Any wild expands its whole reel. Scatters trigger before expansion; payouts use the expanded grid."
                : game === "slot_drones"
                  ? "Wilds found during free spins stay in position through the remaining free spins. Base-spin wilds do not carry into the feature."
                  : game === "slot_eclipse"
                    ? "Each reel independently chooses 2–5 rows with equal chance on every spin, including free spins."
                    : ""}
            </p>
          )}
          <div className="lounge-paytable">
            {SLOT_IDENTITIES[game].symbols.map((s, i) => (
              <div key={s.library}>
                <SlotSymbolArt game={game} symbol={i} size={32} />
                <span>
                  {s.name}
                  <small> {weights[i]}% per cell</small>
                </span>
                <b>
                  {g.mode === "lines" || g.mode === "ways"
                    ? [1, 3, 10]
                        .map((n) =>
                          mult(effectiveMultiplier(g, BASE_POINTS[i] * n)),
                        )
                        .join(" / ")
                    : mult(effectiveMultiplier(g, BASE_POINTS[i]))}
                </b>
              </div>
            ))}
          </div>
          <p>
            {g.mode === "lines" || g.mode === "ways"
              ? "Columns show 3 / 4 / 5 reel match returns per winning line or combination, before feature multipliers."
              : `Shown value × (matched count − ${g.mode === "count" ? 7 : 4}) × current chain multiplier.`}{" "}
            {weights[7] > 0 ? `Wild ${weights[7]}%. ` : ""}
            {weights[8] > 0 ? `Scatter ${weights[8]}%.` : ""}
          </p>
          {g.mode === "lines" && (
            <div className="fleet-paylines" aria-label="Ten payline paths">
              {LINES.map((line, i) => (
                <svg
                  key={i}
                  viewBox="0 0 100 54"
                  aria-label={`Line ${i + 1}, rows ${line.map((x) => x + 1).join(",")}`}
                >
                  <polyline
                    points={line
                      .map((r, c) => `${8 + c * 21},${8 + r * 19}`)
                      .join(" ")}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <text x="3" y="53" fontSize="10">
                    {i + 1}
                  </text>
                </svg>
              ))}
            </div>
          )}
        </>
      )}
      <p>
        Total return capped at 2,500× stake. Returns are rounded down to 0.01
        chip cumulatively across the entire feature; fractional amounts carry
        between stages. Displayed multipliers are rounded to four decimals;
        saved integer calculations settle the result.
      </p>
      <div className="fleet-math-summary">
        <strong>Measured · 1,000,000 paid spins at 100 chips</strong>
        <p>
          Return {measured[game].rtp.toFixed(2)}% · approximate 95% interval{" "}
          {measured[game].interval.map((n) => n.toFixed(2)).join("–")}%
        </p>
        <p>
          Any return {measured[game].hit.toFixed(2)}% · net profit{" "}
          {measured[game].profit.toFixed(2)}%
        </p>
        <p>
          {g.mode === "count" || g.mode === "cluster"
            ? "Cascade continuation (500,000 spins)"
            : "Free-spin / hold feature"}{" "}
          {measured[game].feature.toFixed(2)}%
        </p>
      </div>
      <p>
        Version 1 · calibrated toward 96% long-run return.{" "}
        <a
          href={`${import.meta.env.BASE_URL}casino/slot-fleet-math.json`}
          target="_blank"
          rel="noreferrer"
        >
          Measured results and methodology ↗
        </a>
        . Simulation is not certification or a promise of an individual return.
        Rare rewards need very large samples.
      </p>
      <p>
        Free chips only, no cash or $EVE value. The complete outcome is saved
        before its first reveal. Resume or reveal all without a new stake. This
        local practice simulation is not secure financial wagering.
      </p>
    </details>
  );
}
