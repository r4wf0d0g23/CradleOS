import { useEffect, useState } from "react";
import { chipLabel, type Round } from "../lib/casinoPractice";
import { laiSpeedLabel } from "../lib/casinoLaiMotion";
import {
  packTotal,
  pendingSlot,
  pendingClassicSpin,
  pendingScratch,
  scratchRevealed,
  type Session,
} from "../lib/casinoSessions";
import {
  payoutFlashRemaining,
  type PayoutEvent,
} from "../lib/casinoResultFeedback";

type Amounts = Pick<Round, "stake" | "payout" | "label"> &
  Partial<Pick<Round, "game" | "values">>;

export function roundOutcome({
  stake,
  payout,
}: Pick<Amounts, "stake" | "payout">) {
  return payout > stake
    ? "Win"
    : payout === stake
      ? "Bet returned"
      : payout > 0
        ? "Partial return"
        : "No payout";
}

function RoundBreakdown({ round }: { round: Amounts }) {
  const change = round.payout - round.stake;
  const label = round.game === "limbo" && round.values?.length === 2
    ? `${laiSpeedLabel(round.values[0], round.values[1])} limit · ${(round.values[1] / 10000).toFixed(2)}× target`
    : round.label;
  return (
    <div className="casino-round-breakdown">
      <p>{label}</p>
      <dl>
        <div>
          <dt>Total bet</dt>
          <dd>{chipLabel(round.stake)} chips</dd>
        </div>
        <div>
          <dt>Payout</dt>
          <dd>{chipLabel(round.payout)} chips</dd>
        </div>
        <div>
          <dt>Balance change</dt>
          <dd>
            {change > 0 ? "+" : ""}
            {chipLabel(change)} chips
          </dd>
        </div>
      </dl>
      <small>Payout includes any returned bet.</small>
    </div>
  );
}

function PayoutAmount({
  payout,
  event,
  reduced,
}: {
  payout: number;
  event?: PayoutEvent;
  reduced: boolean;
}) {
  const [flash, setFlash] = useState(
    () =>
      !!event &&
      payout > 0 &&
      !reduced &&
      typeof document !== "undefined" &&
      !document.hidden &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches &&
      payoutFlashRemaining(event.at, performance.now()) > 0,
  );
  useEffect(() => {
    if (reduced) setFlash(false);
  }, [reduced]);
  useEffect(() => {
    if (!flash || !event) return;
    if (document.hidden) {
      setFlash(false);
      return;
    }
    const timer = setTimeout(
      () => setFlash(false),
      payoutFlashRemaining(event.at, performance.now()),
    );
    const visibility = () => {
      if (document.hidden) setFlash(false);
    };
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const motion = (event: MediaQueryListEvent) => {
      if (event.matches) setFlash(false);
    };
    if (media.matches) setFlash(false);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", motion);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", motion);
    };
  }, [flash, event]);
  return (
    <strong className={flash ? "casino-payout-hit" : undefined}>
      {chipLabel(payout)} <small>chips</small>
    </strong>
  );
}

/** Amounts come from the settled round, never the editable next-bet field. */
export function CasinoRoundSummary({
  round,
  event,
  reduced = false,
}: {
  round: Amounts;
  event?: PayoutEvent;
  reduced?: boolean;
}) {
  return (
    <>
      <div
        className="casino-payout-summary"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="casino-payout-label">Payout</span>
        <PayoutAmount
          key={event?.id ?? 0}
          payout={round.payout}
          event={event}
          reduced={reduced}
        />
        <span>
          {roundOutcome(round)} · Total bet {chipLabel(round.stake)} chips
        </span>
      </div>
      <details className="casino-round-details">
        <summary>Round details</summary>
        <RoundBreakdown round={round} />
      </details>
    </>
  );
}

/** A closed disclosure still stores its DOM content: omit unrevealed receipts entirely. */
export function CasinoRoundHistory({
  state,
  busy,
  title,
}: {
  state: Session;
  busy: boolean;
  title: (game: string) => string;
}) {
  if (busy) return null;
  const pending =
    pendingSlot(state) || pendingClassicSpin(state) || pendingScratch(state);
  const hidden = new Set(
    pendingScratch(state)
      ? state
          .pack!.rounds.filter((_, i) => !scratchRevealed(state).includes(i))
          .map((r) => r.id)
      : pending
        ? [state.pack?.rounds[0].id]
        : [],
  );
  const rounds = state.history.filter((r) => !hidden.has(r.id)).slice(0, 6);
  if (!rounds.length) return null;
  const pack = !pending ? state.pack : null;
  return (
    <details className="lounge-history">
      <summary>
        Recent rounds <span>PLAY MONEY</span>
      </summary>
      {pack && pack.rounds.length > 1 && (
        <details className="casino-pack-receipt">
          <summary>
            Last round · {pack.rounds.length} individual plays
            {pack.profile ? ` · ${pack.profile}` : ""}
          </summary>
          <p>
            Total bet {chipLabel(packTotal(pack, "stake"))} · Payout{" "}
            {chipLabel(packTotal(pack, "payout"))} chips
          </p>
          {pack.rounds.map((r, i) => (
            <div key={r.id}>
              <span>
                {i + 1}. {r.label}
              </span>
              <span>
                Bet {chipLabel(r.stake)} · Payout {chipLabel(r.payout)} chips
              </span>
            </div>
          ))}
        </details>
      )}
      <div className="casino-history-grid">
        {rounds.map((r) => (
          <details key={r.id} className="casino-history-round">
            <summary>
              <span>{title(r.game)}</span>
              <small>
                Bet {chipLabel(r.stake)} · Payout {chipLabel(r.payout)} chips
              </small>
              <small>{roundOutcome(r)}</small>
            </summary>
            <RoundBreakdown round={r} />
          </details>
        ))}
      </div>
    </details>
  );
}
