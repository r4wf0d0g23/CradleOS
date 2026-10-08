import { cardTotal } from "../lib/casinoPractice";
import { blackjackPlan, clamp, type TableRun } from "../lib/casinoTableMotion";
import type { Session } from "../lib/casinoSessions";
import { MotionCard } from "./CasinoRoundStage";
import { useCasinoTimeline, useTableCues } from "./useCasinoTimeline";
export function CasinoBlackjackMotion({
  state,
  run,
  busy,
  reduced,
}: {
  state: Session;
  run: TableRun;
  busy: boolean;
  reduced: boolean;
}) {
  const table = state.table ?? state.pack?.table,
    { t, animated } = useCasinoTimeline(run, busy, reduced),
    plan = blackjackPlan(state, run.previous),
    elapsed = t * (run.duration - 100);
  useTableCues(
    run,
    t,
    animated,
    plan.events.map((e) => ({ at: e.at + 120, cue: "card" })),
  );
  if (!table) return null;
  const visual = (row: number, index: number) => {
    const covered = row === -1 && index === 1 && !table.complete;
    if (!busy || !animated) return { progress: 1, hidden: covered, fly: false };
    const events = plan.events.filter(
        (e) => e.row === row && e.index === index,
      ),
      deal = events.find((e) => e.kind === "deal"),
      flip = events.find((e) => e.kind === "flip");
    if (flip && elapsed >= flip.at)
      return {
        progress: clamp((elapsed - flip.at) / 300),
        hidden: false,
        fly: false,
      };
    return {
      progress: deal ? clamp((elapsed - deal.at) / 300) : 1,
      hidden: covered || !!flip,
      fly: !!deal,
    };
  };
  const row = (cards: number[], index: number, label: string) => {
    const visible = cards.filter((_, i) => {
      const v = visual(index, i);
      return v.progress >= 0.5 && !v.hidden;
    });
    return (
      <div className="blackjack-card-row">
        <span>
          {label} <b>{visible.length ? cardTotal(visible) : "—"}</b>
        </span>
        <div>
          {cards.map((c, i) => (
            <MotionCard key={`${c}-${i}`} value={c} {...visual(index, i)} />
          ))}
        </div>
      </div>
    );
  };
  return (
    <div className="lounge-blackjack animated-blackjack" data-progress={t}>
      <div className="blackjack-shoe" aria-hidden="true">
        ◇<span>COMMAND DECK</span>
      </div>
      {row(table.dealer, -1, "DEALER · STANDS ON 17")}
      <div className="felt-line">
        <span>BLACKJACK 3:2 · SPLIT 21 1:1</span>
      </div>
      <div className="casino-seat-grid">
        {table.hands.map((h, i) => (
          <section
            key={`${h.seat}-${table.hands.slice(0, i).filter((x) => x.seat === h.seat).length}`}
            className={!busy && table.active === i ? "active-seat" : ""}
            aria-label={`Seat ${h.seat + 1}${h.split ? " split" : ""}${table.active === i ? " active" : ""}`}
          >
            {row(h.cards, i, `SEAT ${h.seat + 1}${h.split ? " · SPLIT" : ""}`)}
            <small>
              {busy
                ? "DEALING"
                : table.active === i
                  ? "YOUR MOVE"
                  : h.done
                    ? "COMPLETE"
                    : "WAITING"}
            </small>
          </section>
        ))}
      </div>
    </div>
  );
}
