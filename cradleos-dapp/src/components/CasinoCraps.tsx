import { DIE_CONTACTS } from "../lib/casinoObjectMotion";
import { useContext, useEffect, useRef, useState } from "react";
import { ItemIcon } from "./GameIcon";
import { PhysicalDie } from "./CasinoRoundStage";
import { useCasinoTimeline, useTableCues } from "./useCasinoTimeline";
import { STILL_RUN, type TableRun } from "../lib/casinoTableMotion";
import { CasinoFeedback } from "../lib/casinoFeedback";
import { roundCue } from "../lib/casinoResultFeedback";
import { chipLabel } from "../lib/casinoPractice";
import { type Session } from "../lib/casinoSessions";
import {
  changeCrapsBet,
  rollCraps,
  revealCraps,
} from "../lib/casinoCrapsSession";
import {
  POINTS,
  HARD,
  newCraps,
  crapsEscrow,
  crapsUnit,
  crapsName,
  oddsLimit,
  evaluateCraps,
  type CrapsKey,
} from "../lib/casinoCraps";
import "../styles/casino-craps.css";
export { CRAPS_CATALOG } from "../lib/casinoExperienceCatalog";
export function CrapsTile() {
  return (
    <div className="craps-tile">
      <span>CRADLE / DICE DECK</span>
      <div>
        ⚄ <b>⚂</b>
      </div>
      <strong>HOLD THE LINE</strong>
      <small>FRONTIER CRAPS</small>
    </div>
  );
}
export function CasinoCraps({
  state,
  commit,
  busy,
  setBusy,
  reduced,
  onError,
}: {
  state: Session;
  commit: (s: Session) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  reduced: boolean;
  onError: (s: string) => void;
}) {
  const tray = useRef<HTMLDivElement>(null);
  const ledger = useRef(state);
  ledger.current = state;
  const guard = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    generation = useRef(0);
  const [run, setRun] = useState<TableRun>(STILL_RUN),
    [chip, setChip] = useState(500),
    [remove, setRemove] = useState(false);
  const feedback = useContext(CasinoFeedback);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      generation.current++;
    },
    [],
  );
  const table = state.craps ?? newCraps(),
    pending = table.pending,
    receipt = table.rolls[0];
  // All outcome-dependent UI stays on the before-state until the saved roll is revealed.
  const shown =
    pending && receipt ? { point: receipt.point, bets: receipt.bets } : table;
  const outcome = receipt && !pending ? evaluateCraps(receipt) : null;
  const { t, animated } = useCasinoTimeline(run, busy, reduced);
  useEffect(() => {
    if (!busy || !run.id) return;
    // After button focus and the pending-state layout commit. A synchronous
    // smooth scroll can be undone by browser focus/scroll anchoring on phones.
    const frame = requestAnimationFrame(() =>
      tray.current?.scrollIntoView({ behavior: "instant", block: "center" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [busy, run.id]);
  useTableCues(
    run,
    t,
    animated,
    [0, 1].flatMap((i) =>
      DIE_CONTACTS.map((contact, j) => ({
        at: (0.06 + i * 0.07 + contact * 0.74) * (run.duration - 100),
        cue: (j === 0 ? "land" : "tap") as "land" | "tap",
      })),
    ),
  );
  function put(key: CrapsKey) {
    if (guard.current || ledger.current.craps?.pending) return;
    try {
      const current = ledger.current,
        board = current.craps ?? newCraps();
      const amount = remove
        ? -(board.bets[key] ?? 0)
        : Math.ceil(chip / crapsUnit(key, board.point)) *
          crapsUnit(key, board.point);
      const next = changeCrapsBet(current, key, amount);
      commit(next);
      ledger.current = next;
      onError("");
      feedback("select");
    } catch (e) {
      onError((e as Error).message);
    }
  }
  function roll() {
    if (guard.current) return;
    guard.current = true;
    try {
      const next = ledger.current.craps?.pending
        ? ledger.current
        : rollCraps(ledger.current);
      if (next !== ledger.current) {
        commit(next);
        ledger.current = next;
      }
      onError("");
      setBusy(true);
      const id = next.craps!.sequence,
        duration = reduced ? 180 : 2600;
      const gen = ++generation.current;
      setRun({ id: gen, started: performance.now(), duration });
      feedback("spin");

      timer.current = setTimeout(() => {
        if (gen !== generation.current) return;
        try {
          const current = ledger.current,
            revealed = revealCraps(current, id);
          if (revealed !== current) {
            commit(revealed);
            ledger.current = revealed;
            const e = evaluateCraps(revealed.craps!.rolls[0]);
            if (e.settled.length) feedback(roundCue(e));
          }
        } catch {
          onError("Storage unavailable. Your roll is saved; retry revealing.");
        } finally {
          guard.current = false;
          setBusy(false);
        }
      }, duration);
    } catch (e) {
      guard.current = false;
      setBusy(false);
      onError((e as Error).message);
    }
  }
  function spot(key: CrapsKey, label: string, sub: string, style = "") {
    const held = shown.bets[key] ?? 0,
      unit = crapsUnit(key, shown.point),
      add = Math.ceil(chip / unit) * unit;
    const line = key === "pass" || key === "dont",
      odds = key.endsWith("Odds");
    const forbidden = remove
      ? !held || (key === "pass" && !!shown.point)
      : (line && !!shown.point) ||
        (odds &&
          (!shown.point || !shown.bets[key === "passOdds" ? "pass" : "dont"]));
    return (
      <button
        key={key}
        className={`craps-spot ${style} ${held ? "has-chips" : ""} ${style === "number" && shown.point === Number(label) ? "point-number" : ""}`}
        disabled={busy || pending || forbidden}
        onClick={() => put(key)}
        aria-label={`${remove ? "Remove" : "Add"} ${crapsName(key)}${remove ? "" : ` ${chipLabel(add)} chips`}`}
      >
        <strong>{label}</strong>
        <small>{sub}</small>
        {held > 0 ? (
          <span className="craps-chip">{chipLabel(held)}</span>
        ) : null}
        {!remove && <span className="craps-add">+{chipLabel(add)} / tap</span>}
      </button>
    );
  }
  return (
    <div className="craps-layout">
      <section className="craps-table" aria-label="Frontier craps table">
        <div className="craps-toprail">
          <div>
            <span>DICE DECK / 01</span>
            <h3>HOLD THE LINE</h3>
          </div>
          <div
            className={`craps-puck ${shown.point ? "on" : ""}`}
            aria-label={`Point ${shown.point || "off"}`}
          >
            <b>{shown.point || "OFF"}</b>
            <small>{shown.point ? "POINT" : "COME OUT"}</small>
          </div>
        </div>
        <div className="craps-throw-zone" ref={tray}>
          <div className="craps-ghost-art">
            <ItemIcon typeId={87848} size={112} />
          </div>
          <div
            className="craps-dice"
            aria-label={
              pending && !busy ? "Saved dice unrevealed" : "Dice tray"
            }
          >
            {(!pending || busy) && receipt ? (
              receipt.dice.map((face, index) => (
                <PhysicalDie
                  key={index}
                  face={face}
                  index={index}
                  t={busy ? t : 1}
                  has
                />
              ))
            ) : (
              <>
                <span className="craps-idle-die">◇</span>
                <span className="craps-idle-die">◇</span>
              </>
            )}
          </div>
          <div className="craps-call" role="status">
            <b>
              {busy
                ? "DICE IN FLIGHT"
                : pending
                  ? "ROLL SAVED"
                  : outcome
                    ? `${outcome.total} · ${outcome.label}`
                    : shown.point
                      ? `MAKE ${shown.point} BEFORE 7`
                      : "SET YOUR CHIPS"}
            </b>
            <span>
              {pending
                ? "Your bets are saved."
                : outcome
                  ? outcome.settled.length
                    ? `${chipLabel(outcome.payout)} returned · ${chipLabel(outcome.stake)} resolved`
                    : "Bets stay on the table"
                  : shown.point
                    ? "The line is set."
                    : "7 or 11 wins the Pass line."}
            </span>
          </div>
        </div>
        <div className="craps-numbers">
          {POINTS.map((n) =>
            spot(
              `place${n}`,
              String(n),
              n === 6 || n === 8 ? "7:6" : n === 5 || n === 9 ? "7:5" : "9:5",
              "number",
            ),
          )}
        </div>
        <div className="craps-working">
          PLACE & HARDWAYS · {shown.point ? "WORKING" : "OFF ON COME-OUT"}
        </div>
        <div className="craps-field">
          {spot("field", "FIELD", "2 · 3 · 4 · 9 · 10 · 11 · 12")}
          <span>2 PAYS DOUBLE · 12 PAYS TRIPLE</span>
        </div>
        <div className="craps-lines">
          {spot("dont", "DON’T PASS", "BAR 12")}
          {spot("pass", "PASS LINE", "EVEN MONEY", "pass-line")}
        </div>
        <div className="craps-odds">
          {spot(
            "dontOdds",
            "LAY ODDS",
            shown.point
              ? `LIMIT ${chipLabel(oddsLimit("dontOdds", shown.point, shown.bets))}`
              : "AFTER POINT",
          )}
          {spot(
            "passOdds",
            "TAKE ODDS",
            shown.point
              ? `LIMIT ${chipLabel(oddsLimit("passOdds", shown.point, shown.bets))}`
              : "AFTER POINT",
          )}
        </div>
        <div className="craps-hardways">
          <span>HARDWAYS</span>
          <div>
            {HARD.map((n) =>
              spot(
                `hard${n}`,
                `${n / 2} + ${n / 2}`,
                n === 6 || n === 8 ? "9:1" : "7:1",
              ),
            )}
          </div>
        </div>
        <div className="craps-footrail">
          ◇ CRADLE CASINO <span>FRONTIER CRAPS</span>
        </div>
      </section>
      <aside className="craps-controls">
        <span className="lounge-eyebrow">PLAY MONEY / LIVE TABLE</span>
        <h3>Your chips</h3>
        <div className="craps-bank">
          <span>On the table</span>
          <strong>{chipLabel(crapsEscrow(shown))}</strong>
        </div>
        <div
          className="craps-chip-rack"
          role="group"
          aria-label="Chip denomination"
        >
          {[100, 500, 2500, 10000].map((n) => (
            <button
              key={n}
              disabled={busy || pending}
              aria-pressed={chip === n && !remove}
              onClick={() => {
                setChip(n);
                setRemove(false);
              }}
            >
              {chipLabel(n)}
            </button>
          ))}
        </div>
        <div className="craps-edit" role="group" aria-label="Bet editing">
          <button
            disabled={busy || pending}
            aria-pressed={!remove}
            onClick={() => setRemove(false)}
          >
            Place chips
          </button>
          <button
            disabled={busy || pending}
            aria-pressed={remove}
            onClick={() => setRemove(true)}
          >
            Take down
          </button>
        </div>
        <p className="craps-hint">
          {remove
            ? "Tap a bet to return its chips. Pass locks after the point."
            : "Tap a table area to add chips. Each spot shows its exact increment."}
        </p>
        <button
          className="lounge-primary craps-roll"
          disabled={busy || (!pending && !crapsEscrow(table) && !table.point)}
          onClick={roll}
        >
          {busy ? "Rolling…" : pending ? "Reveal saved roll" : "Roll dice"}{" "}
          <span>↗</span>
        </button>
        <small className="craps-hint">
          No auto-rebet. Winning bets return with their winnings. Unresolved
          bets stay saved when you leave.
        </small>
        {outcome && (
          <section className="craps-receipt" aria-label="Latest roll receipt">
            <h4>
              ROLL {receipt.id} <span>{receipt.dice.join(" + ")}</span>
            </h4>
            {outcome.settled.length ? (
              outcome.settled.map((b) => (
                <div key={b.key}>
                  <span>
                    {crapsName(b.key)}
                    <small>{chipLabel(b.stake)} staked</small>
                  </span>
                  <b>
                    {chipLabel(b.payout)}
                    <small>returned</small>
                  </b>
                </div>
              ))
            ) : (
              <p>No bets resolved.</p>
            )}
          </section>
        )}
        <details className="craps-rules">
          <summary>Table rules & payouts</summary>
          <p>
            Two fair six-sided dice. Ratios on the table are profit odds, plus
            your returned stake. Limit: 1,000 chips total on the table.
          </p>
          <p>
            Pass: come-out 7/11 wins; 2/3/12 loses. Other totals establish the
            point. Make that point before 7 to win. Don’t Pass reverses this,
            with a push on come-out 12. No new line bets after the point.
          </p>
          <p>
            Pass odds: 3× on 4/10, 4× on 5/9, 5× on 6/8. Pay 2:1, 3:2, 6:5
            respectively. Lay odds: risk up to 6× Don’t Pass. Pay 1:2, 2:3, 5:6.
            Odds can come down; removing Don’t also returns its odds.
          </p>
          <p>
            Field resolves every roll. 3/4/9/10/11 pay 1:1; 2 pays 2:1; 12 pays
            3:1. Other totals lose.
          </p>
          <p>
            Place and Hardways are OFF on every come-out. Place wins its number
            before 7. Hardways win the displayed double before a soft same total
            or 7. No automatic rebet.
          </p>
          <p>
            Amounts use exact payout increments. Come/Don’t Come, Buy/Lay and
            proposition bets are not offered here.
          </p>
        </details>
        <details className="craps-history">
          <summary>Recent rolls</summary>
          {table.rolls
            .filter((_, i) => !pending || i !== 0)
            .map((r) => {
              const e = evaluateCraps(r);
              return (
                <div key={r.id}>
                  <b>{r.dice.join(" + ")}</b>
                  <span>{e.label}</span>
                  <small>
                    {chipLabel(e.payout)} returned / {chipLabel(e.stake)}{" "}
                    resolved
                  </small>
                </div>
              );
            })}
        </details>
      </aside>
    </div>
  );
}
