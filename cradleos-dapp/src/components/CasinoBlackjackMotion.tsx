import { cardTotal } from "../lib/casinoPractice";
import {
  blackjackPlan,
  clamp,
  BLACKJACK_FLIGHT_MS,
  BLACKJACK_FLIP_MS,
  type TableRun,
} from "../lib/casinoTableMotion";
import type { Session } from "../lib/casinoSessions";
import { AstralCard, AstralTable } from "./CasinoAstralCards";
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
    plan.events.map((e) => ({ at: e.at + 350, cue: "card" })),
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
        progress: clamp((elapsed - flip.at) / BLACKJACK_FLIP_MS),
        hidden: false,
        fly: false,
      };
    return {
      progress: deal ? clamp((elapsed - deal.at) / BLACKJACK_FLIGHT_MS) : 1,
      hidden: covered || !!flip,
      fly: !!deal,
    };
  };
  const row = (
    cards: number[],
    index: number,
    label: string,
    phase = index,
  ) => {
    const visible = cards.filter((_, i) => {
      const v = visual(index, i);
      return v.progress >= 0.5 && !v.hidden;
    });
    return (
      <div className="astral-hand">
        <div className="astral-hand-label">
          {label} <b>{visible.length ? cardTotal(visible) : "—"}</b>
        </div>
        <div className="astral-fan">
          {cards.map((c, i) => (
            <AstralCard
              key={`${c}-${i}`}
              value={c}
              index={i + (phase + 1) * 3}
              runId={run.id}
              {...visual(index, i)}
            />
          ))}
        </div>
      </div>
    );
  };
  return (
    <AstralTable reduced={reduced} dealing={busy && animated} progress={t}>
      {row(table.dealer, -1, "DEALER · STANDS ON 17")}
      <div className="astral-rule">
        <span>BLACKJACK 3:2 · SPLIT 21 1:1</span>
      </div>
      <div className="casino-seat-grid">
        {table.hands.map((h, i) => (
          <section
            key={`${h.seat}-${table.hands.slice(0, i).filter((x) => x.seat === h.seat).length}`}
            className={!busy && table.active === i ? "active-seat" : ""}
            aria-label={`Seat ${h.seat + 1}${h.split ? " split" : ""}${table.active === i ? " active" : ""}`}
          >
            {row(
              h.cards,
              i,
              `SEAT ${h.seat + 1}${h.split ? " · SPLIT" : ""}`,
              h.seat,
            )}
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
    </AstralTable>
  );
}
