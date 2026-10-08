import { useEffect, useState } from "react";
import { chipLabel, MAX_BET, practiceBet, RED } from "../lib/casinoPractice";
import {
  PROFILES,
  quickPick,
  wagerLabel,
  type Options,
  type Pack,
  type RouletteKind,
  type Wager,
} from "../lib/casinoSessions";
export function CasinoPackControls({
  game,
  options,
  setOptions,
  stake,
  pack,
  onError,
  onActivePicks,
}: {
  game: string;
  options: Options;
  setOptions: (o: Options) => void;
  stake: string;
  pack: Pack | null;
  onError: (s: string) => void;
  onActivePicks: (p: number[]) => void;
}) {
  const [ticket, setTicket] = useState(0),
    [undo, setUndo] = useState<Wager[][]>([]);
  const activePicks =
    options.tickets?.[Math.min(ticket, (options.tickets?.length ?? 1) - 1)]
      ?.picks;
  useEffect(() => {
    if (game === "keno" && activePicks) onActivePicks(activePicks);
  }, [game, activePicks, onActivePicks]);
  const patch = (o: Options) => setOptions({ ...options, ...o });
  if (game === "plinko" || game === "scratch_cards" || game === "blackjack")
    return (
      <>
        <legend>
          {game === "plinko"
            ? "Balls"
            : game === "blackjack"
              ? "Starting seats"
              : "Tickets"}
        </legend>
        <div className="casino-option-row">
          {(game === "plinko"
            ? [1, 3, 5, 10]
            : game === "blackjack"
              ? [1, 2, 3]
              : [1, 3, 5]
          ).map((n) => (
            <button
              key={n}
              aria-pressed={
                (game === "blackjack"
                  ? (options.seats ?? 1)
                  : (options.count ?? 1)) === n
              }
              onClick={() =>
                patch(game === "blackjack" ? { seats: n } : { count: n })
              }
            >
              {n}
            </button>
          ))}
        </div>
        {game === "plinko" && (
          <>
            <p>Risk · 12 rows</p>
            <div className="casino-option-row">
              {Object.keys(PROFILES).map((p) => (
                <button
                  key={p}
                  aria-pressed={(options.profile ?? "Low") === p}
                  onClick={() => patch({ profile: p as keyof typeof PROFILES })}
                >
                  {p}
                </button>
              ))}
            </div>
          </>
        )}
      </>
    );
  if (game === "roulette") {
    const ws = options.wagers ?? [];
    function edit(next: Wager[]) {
      setUndo([...undo, ws].slice(-50));
      patch({ wagers: next });
    }
    function add(kind: RouletteKind, value: number) {
      try {
        const unit = practiceBet(stake),
          old = ws.find((w) => w.kind === kind && w.value === value);
        if ((old?.stake ?? 0) + unit > MAX_BET)
          throw Error("Maximum 1,000 chips on each selection.");
        edit(
          old
            ? ws.map((w) => (w === old ? { ...w, stake: w.stake + unit } : w))
            : [...ws, { kind, value, stake: unit }],
        );
        onError("");
      } catch (e) {
        onError((e as Error).message);
      }
    }
    const outside: RouletteKind[] = [
      "color",
      "parity",
      "range",
      "dozen",
      "column",
    ];
    return (
      <>
        <legend>Add chips to the board</legend>
        <p>Each tap adds the chip value above.</p>
        <div className="casino-roulette-grid">
          {Array.from({ length: 37 }, (_, n) => (
            <button
              key={n}
              className={n === 0 ? "zero" : RED.includes(n) ? "red" : "black"}
              aria-label={`Bet on ${n}`}
              aria-pressed={ws.some(
                (w) => w.kind === "straight" && w.value === n,
              )}
              onClick={() => add("straight", n)}
            >
              {n}
            </button>
          ))}
        </div>
        {outside.map((kind) => (
          <div className="casino-option-row" key={kind}>
            {Array.from(
              { length: kind === "dozen" || kind === "column" ? 3 : 2 },
              (_, value) => (
                <button
                  key={value}
                  aria-pressed={ws.some(
                    (w) => w.kind === kind && w.value === value,
                  )}
                  onClick={() => add(kind, value)}
                >
                  {wagerLabel({ kind, value, stake: 0 })}
                </button>
              ),
            )}
          </div>
        ))}
        <div className="casino-option-row">
          <button
            disabled={!undo.length}
            onClick={() => {
              patch({ wagers: undo[undo.length - 1] });
              setUndo(undo.slice(0, -1));
            }}
          >
            Undo
          </button>
          <button disabled={!ws.length} onClick={() => edit([])}>
            Clear
          </button>
          <button
            disabled={pack?.game !== "roulette" || !pack.wagers}
            onClick={() => edit(pack!.wagers!.map((w) => ({ ...w })))}
          >
            Repeat selections
          </button>
        </div>
        <div className="casino-wager-list">
          {ws.map((w) => (
            <button
              key={`${w.kind}:${w.value}`}
              aria-label={`Remove ${wagerLabel(w)}`}
              onClick={() => edit(ws.filter((x) => x !== w))}
            >
              <span>
                {wagerLabel(w)} · {chipLabel(w.stake)}
              </span>{" "}
              ×
            </button>
          ))}
        </div>
      </>
    );
  }
  if (game === "keno") {
    const ts = options.tickets ?? [{ picks: [7, 17, 27], stake: 2500 }],
      index = Math.min(ticket, ts.length - 1),
      t = ts[index];
    const update = (p: Partial<typeof t>) =>
      patch({ tickets: ts.map((v, i) => (i === index ? { ...v, ...p } : v)) });
    return (
      <>
        <legend>Keno tickets · one shared draw</legend>
        <div className="casino-option-row">
          {ts.map((_, i) => (
            <button
              key={i}
              aria-pressed={index === i}
              onClick={() => setTicket(i)}
            >
              Ticket {i + 1}
            </button>
          ))}
          <button
            disabled={ts.length === 4}
            onClick={() => {
              patch({
                tickets: [...ts, { picks: quickPick(), stake: t.stake }],
              });
              setTicket(ts.length);
            }}
          >
            ＋ Ticket
          </button>
        </div>
        <p>
          Ticket {index + 1} · {t.picks.length}/6 numbers · {chipLabel(t.stake)}{" "}
          chips
        </p>
        <div className="casino-keno-picks">
          {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              aria-label={`Pick ${n}`}
              aria-pressed={t.picks.includes(n)}
              disabled={t.picks.length === 6 && !t.picks.includes(n)}
              onClick={() =>
                update({
                  picks: t.picks.includes(n)
                    ? t.picks.filter((v) => v !== n)
                    : [...t.picks, n],
                })
              }
            >
              {n}
            </button>
          ))}
        </div>
        <div className="casino-option-row">
          <button
            onClick={() => update({ picks: quickPick(t.picks.length || 3) })}
          >
            Quick pick
          </button>
          <button
            onClick={() => {
              try {
                update({ stake: practiceBet(stake) });
                onError("");
              } catch (e) {
                onError((e as Error).message);
              }
            }}
          >
            Apply stake above
          </button>
          <button
            disabled={ts.length === 1}
            onClick={() => {
              patch({ tickets: ts.filter((_, i) => i !== index) });
              setTicket(0);
            }}
          >
            Remove ticket
          </button>
        </div>
      </>
    );
  }
  return null;
}
