import { chipLabel, type Round } from "../lib/casinoPractice";
import { packTotal, pendingSlot, type Session } from "../lib/casinoSessions";

type Amounts = Pick<Round, "stake" | "payout" | "label">;

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
  return (
    <div className="casino-round-breakdown">
      <p>{round.label}</p>
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

/** Amounts come from the settled round, never the editable next-bet field. */
export function CasinoRoundSummary({ round }: { round: Amounts }) {
  return (
    <>
      <div
        className="casino-payout-summary"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="casino-payout-label">Payout</span>
        <strong>
          {chipLabel(round.payout)} <small>chips</small>
        </strong>
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
  const pending = pendingSlot(state);
  const rounds = state.history
    .filter((r) => !pending || r.id !== state.pack?.rounds[0].id)
    .slice(0, 6);
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
