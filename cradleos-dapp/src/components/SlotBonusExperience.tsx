import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  SCATTER,
  type FleetKey,
  type SlotReceipt,
} from "../lib/casinoSlotFleet";
import {
  BONUS_NAMES,
  bonusPerk,
  type SlotBonusView,
} from "../lib/casinoSlotBonus";
import { chipLabel } from "../lib/casinoPractice";
import { SlotSymbolArt } from "./SlotIdentityArt";
import type { SlotMotionRun } from "../lib/casinoSlotMotion";
import "../styles/casino-slot-bonus.css";
export function SlotBonusRail({
  view,
  game,
  busy,
  run,
  reduced,
}: {
  view: SlotBonusView;
  game: FleetKey;
  busy: boolean;
  run: SlotMotionRun;
  reduced: boolean;
}) {
  const free = view.kind === "free",
    complete = view.phase === "complete";
  const label = complete
    ? free
      ? "FREE SPINS COMPLETE"
      : "VAULT COLLECTED"
    : view.phase === "awarded"
      ? "BONUS READY"
      : free
        ? "FREE SPINS"
        : view.kind === "collect"
          ? "FULL VAULT"
          : "RESPINS";
  return (
    <section
      className={`slot-bonus-rail ${complete ? "bonus-complete" : ""} ${busy && !reduced ? "bonus-launching" : ""}`}
      key={`${run.id}:${complete}`}
      aria-label="Bonus feature status"
    >
      <div className="bonus-rail-top">
        <span>{BONUS_NAMES[game]}</span>
        <b>
          {view.kind === "collect"
            ? "15 / 15 LOCKED"
            : view.boost > 1
              ? `${view.boost}× WINS`
              : game === "slot_drones"
                ? "STICKY WILDS"
                : view.kind === "respin"
                  ? `${view.locked} / 15 LOCKED`
                  : "BONUS FEATURE"}
        </b>
      </div>
      <div className="bonus-rail-count" role="status" aria-live="polite">
        <strong>{label}</strong>
        <b>
          {free
            ? view.phase === "awarded"
              ? view.total
              : `${view.current} / ${view.total}`
            : view.kind === "collect"
              ? "◆"
              : `${view.remaining} LEFT`}
        </b>
      </div>
      {free ? (
        <div className="bonus-spin-track" aria-hidden="true">
          {Array.from({ length: view.total }, (_, i) => (
            <i
              key={i}
              className={
                i < view.completed
                  ? "done"
                  : busy && i === view.current - 1
                    ? "current"
                    : ""
              }
            />
          ))}
        </div>
      ) : (
        <div className="bonus-lock-track" aria-hidden="true">
          {Array.from({ length: 15 }, (_, i) => (
            <i key={i} className={i < view.locked ? "done" : ""} />
          ))}
        </div>
      )}
      <div className="bonus-rail-bottom">
        <span>
          {view.reset
            ? "RESPINS RESET"
            : complete
              ? "FEATURE TOTAL"
              : busy
                ? view.kind === "collect"
                  ? "COLLECTING"
                  : view.kind === "respin"
                    ? "RESPIN IN PROGRESS"
                    : "SPIN IN PROGRESS"
                : view.phase === "awarded"
                  ? "READY TO START"
                  : "BONUS RETURN"}
        </span>
        <b>
          {chipLabel(view.returnChips)} <small>chips</small>
        </b>
      </div>
    </section>
  );
}
export function SlotBonusEntry({
  view,
  game,
  receipt,
  run,
  reduced,
  onContinue,
}: {
  view: SlotBonusView;
  game: FleetKey;
  receipt: SlotReceipt;
  run: SlotMotionRun;
  reduced: boolean;
  onContinue: () => void;
}) {
  const [animateEntry, setAnimateEntry] = useState(
    () =>
      run.id > 0 &&
      !reduced &&
      (typeof document === "undefined" || !document.hidden),
  );
  const [dismissed, setDismissed] = useState(false),
    ref = useRef<HTMLDivElement>(null),
    seen = useRef<unknown>(null);
  useEffect(() => setDismissed(false), [receipt.draws, game]);
  useEffect(() => {
    const stop = () => {
      if (document.hidden) setAnimateEntry(false);
    };
    if (reduced) setAnimateEntry(false);
    stop();
    document.addEventListener("visibilitychange", stop);
    return () => document.removeEventListener("visibilitychange", stop);
  }, [reduced]);
  const visible = view.phase === "awarded" && !dismissed;
  useEffect(() => {
    if (
      !visible ||
      run.id === 0 ||
      seen.current === receipt.draws ||
      document.hidden
    )
      return;
    seen.current = receipt.draws;
    const box = ref.current?.getBoundingClientRect();
    if (box && (box.top < 0 || box.bottom > innerHeight))
      ref.current?.scrollIntoView({
        block: "center",
        behavior: reduced ? "auto" : "smooth",
      });
  }, [visible, run.id, receipt.draws, reduced]);
  if (!visible) return null;
  const free = view.kind === "free",
    collect = view.kind === "collect";
  return (
    <div
      ref={ref}
      className={`slot-bonus-entry ${animateEntry && !reduced ? "bonus-entry-burst" : ""}`}
      role="region"
      aria-label={
        free
          ? "Free spins unlocked"
          : collect
            ? "Full vault ready"
            : "Vault respins unlocked"
      }
    >
      <div className="bonus-burst-rays" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <i key={i} style={{ "--ray": i } as CSSProperties} />
        ))}
      </div>
      <div className="bonus-entry-content">
        <small>{BONUS_NAMES[game]}</small>
        <div className="bonus-emblem">
          <SlotSymbolArt game={game} symbol={SCATTER} size={80} eager />
          <i aria-hidden="true" />
        </div>
        <h3>
          {collect
            ? "FULL VAULT"
            : run.id === 0
              ? "BONUS READY"
              : "BONUS UNLOCKED"}
        </h3>
        <div className="bonus-award">
          <strong>{collect ? "15" : view.total}</strong>
          <span>
            {free ? "FREE SPINS" : collect ? "LOCKED TOKENS" : "RESPINS"}
          </span>
        </div>
        <p>{bonusPerk(game, view)}</p>
        <button className="bonus-enter" onClick={onContinue}>
          {free
            ? "START FREE SPINS"
            : collect
              ? "COLLECT VAULT"
              : "START RESPINS"}{" "}
          <span aria-hidden="true">▶</span>
        </button>
        <button className="bonus-view-reels" onClick={() => setDismissed(true)}>
          View reels
        </button>
      </div>
    </div>
  );
}
