import {
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { type Session } from "../lib/casinoSessions";
import { practiceBet, chipLabel } from "../lib/casinoPractice";
import { frontierPending, type FrontierRound } from "../lib/casinoFrontier";
import {
  startFrontier,
  actFrontier,
  collectFrontier,
} from "../lib/casinoFrontierSession";
import {
  keeperView,
  KEEPER_NAMES,
  GLYPHS,
  CIPHER_BPS,
  ARCHIVE_BPS,
  ARCHIVE_LABELS,
  archiveCategory,
  type KeeperGame,
} from "../lib/casinoKeeper";
import { CasinoFeedback } from "../lib/casinoFeedback";
import "../styles/casino-keeper.css";
const base = import.meta.env.BASE_URL + "casino/keeper/";
const patterns = [
  "0010001110111110111000100",
  "1010101010001000101010101",
  "0111010001101011000101110",
  "0010000100111110010000100",
  "1000111011101011000110001",
  "0010001110001001010101110",
];
const colors = [
  "#f5a158",
  "#85c5dd",
  "#c5b0ef",
  "#ead68e",
  "#e78e97",
  "#95c5ab",
];
function Glyph({ n, hidden = false }: { n: number; hidden?: boolean }) {
  return (
    <span
      className="kp-glyph"
      style={{ "--glyph": colors[n] ?? "#956d4b" } as CSSProperties}
    >
      {hidden ? (
        <span className="kp-unknown">◇</span>
      ) : (
        <>
          <svg viewBox="0 0 50 50" aria-hidden="true">
            {[...(patterns[n] ?? patterns[0])].map((v, i) =>
              v === "1" ? (
                <rect
                  key={i}
                  x={(i % 5) * 10 + 1}
                  y={Math.floor(i / 5) * 10 + 1}
                  width="8"
                  height="8"
                />
              ) : null,
            )}
          </svg>
          <small>{GLYPHS[n]}</small>
        </>
      )}
    </span>
  );
}
export function KeeperSignal({ active = false }: { active?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="kp-signal" aria-hidden="true">
      <img
        src={base + "keeper-sigil.webp"}
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <span className="kp-fallback">◇</span>
      {active && !failed && (
        <div className="kp-native">
          <img src={base + "keeper-frame.png"} alt="" />
          <video
            autoPlay
            muted
            playsInline
            loop
            src={base + "keeper-signal.webm"}
            onError={() => setFailed(true)}
          />
        </div>
      )}
    </div>
  );
}
export function KeeperTile({ game }: { game: KeeperGame }) {
  return (
    <div className={"kp-tile " + game}>
      <KeeperSignal />
      <span>
        {game === "keeper_cipher"
          ? "DECODE THE SIGNAL"
          : game === "keeper_archive"
            ? "RESTORE THE ARCHIVE"
            : "FOLLOW THE KEEPER"}
      </span>
    </div>
  );
}
const rules: Record<KeeperGame, string[]> = {
  keeper_cipher: [
    "Six glyphs. The Keeper hides three different glyphs in order. Submit up to three distinct-glyph guesses; no repeated codes.",
    "Exact = correct position. Misplaced = correct glyph, different position. Solve on guess 1 / 2 / 3: 18× / 4.5× / 1.8× total return. Failure or End trial: 0×.",
    "95.25% theoretical return with optimal guesses, before rounding. Other strategies return less.",
  ],
  keeper_archive: [
    "Five independent glyphs, six equally likely symbols. Hold any positions, then redraw the others once. Keep all retains the starting five.",
    "Highest combination pays, as total return. Single pairs and no combination pay 0×. Returns below 1× are partial returns.",
    "95.2889% theoretical return with optimal holds, before rounding. Other strategies return less.",
  ],
  keeper_passage: [
    "Five stages, four gates each. Choose Stable (3 safe) or Deep (2 safe), then a gate. Each stage is independent.",
    "Bank after any successful stage. A closed gate loses the stake; the fifth success banks automatically. Before the first crossing, Return stake refunds the full stake.",
    "Banked total = stake × 0.96 × each stage’s 4 / safe-gate count. 96% theoretical return before rounding for play that crosses a gate; pre-cross refunds excluded.",
  ],
};
type Run = { id: number; revision: number; from?: FrontierRound };
export function CasinoKeeper({
  game,
  state,
  commit,
  busy,
  setBusy,
  reduced,
  onError,
}: {
  game: KeeperGame;
  state: Session;
  commit: (s: Session) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  reduced: boolean;
  onError: (s: string) => void;
}) {
  const ledger = useRef(state);
  ledger.current = state;
  const guard = useRef(false),
    frame = useRef(0),
    generation = useRef(0),
    stage = useRef<HTMLDivElement>(null);
  const feedback = useContext(CasinoFeedback),
    callbacks = useRef({ commit, setBusy, onError, feedback });
  callbacks.current = { commit, setBusy, onError, feedback };
  const [run, setRun] = useState<Run | null>(null),
    [progress, setProgress] = useState(0),
    [stake, setStake] = useState("25"),
    [guess, setGuess] = useState<number[]>([]),
    [held, setHeld] = useState<number[]>([]),
    [risk, setRisk] = useState(0);
  const r =
    state.frontier?.current.game === game ? state.frontier.current : undefined;
  const v = r ? keeperView(r) : undefined,
    inPlay = !!r && !r.collected,
    pending = frontierPending(state.frontier);
  const terminal = v?.phase === "done",
    shown = !!r && terminal && (r.collected || (!!run && progress >= 0.92));
  // Render only the prior committed step until the action reveal boundary.
  const visibleRound =
    run && progress < 0.72
      ? run.from
      : terminal && !r?.collected && !run && r
        ? { ...r, actions: r.actions.slice(0, -1) }
        : r;
  const display = visibleRound ? keeperView(visibleRound) : undefined;
  const revealed = !!r && (r.collected || (!!run && progress >= 0.72));
  const canAct = inPlay && !busy && !terminal;
  useEffect(
    () => () => {
      generation.current++;
      cancelAnimationFrame(frame.current);
    },
    [],
  );
  useEffect(() => {
    if (!run) return;
    const ticket = ++generation.current,
      start = performance.now(),
      duration = run.from ? 1800 : 1200;
    const stop = () => {
      if (ticket !== generation.current) return;
      generation.current++;
      cancelAnimationFrame(frame.current);
      guard.current = false;
      callbacks.current.setBusy(false);
      setRun(null);
      setProgress(0);
    };
    const finish = () => {
      if (ticket !== generation.current) return;
      try {
        const s = ledger.current,
          c = s.frontier?.current;
        if (!c || c.id !== run.id || c.actions.length !== run.revision)
          throw Error("Round already changed.");
        const view = keeperView(c);
        if (view.phase === "done" && !c.collected) {
          const next = collectFrontier(s, run.id, run.revision);
          callbacks.current.commit(next);
          ledger.current = next;
          callbacks.current.feedback(
            view.payout > c.stake ? "win" : view.payout ? "payout" : "stop",
          );
        }
      } catch (e) {
        callbacks.current.onError((e as Error).message);
      } finally {
        guard.current = false;
        callbacks.current.setBusy(false);
        setRun(null);
        setProgress(0);
      }
    };
    const tick = (now: number) => {
      if (ticket !== generation.current) return;
      if (document.hidden) {
        stop();
        return;
      }
      const p = reduced ? 1 : Math.min(1, (now - start) / duration);
      setProgress(p);
      if (p === 1) finish();
      else frame.current = requestAnimationFrame(tick);
    };
    const visibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", visibility);
    frame.current = requestAnimationFrame(tick);
    stage.current?.scrollIntoView({ behavior: "instant", block: "center" });
    return () => {
      cancelAnimationFrame(frame.current);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [run, reduced]);
  function present(next: Session, from?: FrontierRound) {
    const c = next.frontier!.current;
    setProgress(0);
    setRun({ id: c.id, revision: c.actions.length, from });
    setBusy(true);
    feedback("scan");
  }
  function begin() {
    if (guard.current || busy || pending) return;
    guard.current = true;
    try {
      const next = startFrontier(ledger.current, game, practiceBet(stake), []);
      commit(next);
      ledger.current = next;
      setGuess([]);
      setHeld([]);
      setRisk(0);
      onError("");
      present(next);
    } catch (e) {
      guard.current = false;
      onError((e as Error).message);
    }
  }
  function act(kind: string, values: number[] = []) {
    if (guard.current || busy) return;
    guard.current = true;
    try {
      const old = ledger.current.frontier!.current,
        next = actFrontier(ledger.current, old.id, old.actions.length, {
          kind,
          values,
        });
      commit(next);
      ledger.current = next;
      onError("");
      if (kind === "guess") setGuess([]);
      present(next, old);
    } catch (e) {
      guard.current = false;
      onError((e as Error).message);
    }
  }
  function reveal() {
    if (guard.current || busy || !r || r.collected || !terminal) return;
    guard.current = true;
    onError("");
    present(ledger.current, { ...r, actions: r.actions.slice(0, -1) });
  }
  const status = busy
    ? "TRANSMITTING"
    : r?.collected
      ? v!.label
      : terminal
        ? "Result ready"
        : v?.phase === "guess"
          ? `Guess ${v.clues.length + 1} / 3`
          : v?.phase === "hold"
            ? "Hold glyphs"
            : v?.phase === "cross"
              ? `Stage ${v.steps.length + 1} / 5`
              : "Awaiting signal";
  const visibleSymbols = display?.symbols ?? [];
  const initialResonance =
    visibleSymbols.length === 5
      ? ARCHIVE_LABELS[archiveCategory(visibleSymbols)]
      : "";
  return (
    <div
      className={"keeper-games " + game}
      data-keeper-game={game}
      data-phase={busy ? "transmitting" : terminal && !r?.collected ? "saved" : v?.phase ?? "ready"}
      data-running={busy}
      data-progress={progress}
    >
      <div className="kp-stage" ref={stage}>
        <header className="kp-transmission">
          <KeeperSignal active={!!run && !reduced} />
          <div>
            <small>THE KEEPER</small>
            <strong>{status}</strong>
            <span>
              {game === "keeper_cipher"
                ? "THE CIPHER"
                : game === "keeper_archive"
                  ? "THE ARCHIVE"
                  : "THE PASSAGE"}
            </span>
          </div>
        </header>
        {game === "keeper_cipher" && (
          <div className="kp-cipher">
            <div className="kp-secret" aria-label="Keeper code">
              {[0, 1, 2].map((i) => (
                <Glyph
                  key={i}
                  n={terminal && revealed ? r!.draw[i] : 0}
                  hidden={!(terminal && revealed)}
                />
              ))}
            </div>
            <div className="kp-guesses">
              {[0, 1, 2].map((i) => {
                const clue = display?.clues[i];
                return (
                  <div
                    className={"kp-guess-row " + (clue ? "kp-decoded" : "")}
                    key={i}
                    data-clue={clue ? `${clue.exact},${clue.misplaced}` : ""}
                  >
                    <b>{String(i + 1).padStart(2, "0")}</b>
                    <div>
                      {[0, 1, 2].map((j) => (
                        <Glyph key={j} n={clue?.guess[j] ?? 0} hidden={!clue} />
                      ))}
                    </div>
                    <span>
                      {clue ? (
                        <>
                          <strong>{clue.exact} exact</strong>
                          <small>{clue.misplaced} misplaced</small>
                        </>
                      ) : (
                        <small>{CIPHER_BPS[i] / 10000}×</small>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            {canAct && (
              <div className="kp-code-entry">
                <div className="kp-current-code" aria-label="Your code">
                  {[0, 1, 2].map((i) => (
                    <button
                      key={i}
                      aria-label={
                        guess[i] === undefined
                          ? `Empty position ${i + 1}`
                          : `Remove ${GLYPHS[guess[i]]}`
                      }
                      disabled={guess[i] === undefined}
                      onClick={() => setGuess(guess.filter((_, j) => j !== i))}
                    >
                      <Glyph
                        n={guess[i] ?? 0}
                        hidden={guess[i] === undefined}
                      />
                    </button>
                  ))}
                </div>
                <div
                  className="kp-glyph-palette"
                  role="group"
                  aria-label="Glyphs"
                >
                  {GLYPHS.map((name, n) => (
                    <button
                      key={name}
                      aria-label={`Add ${name}`}
                      disabled={guess.includes(n) || guess.length === 3}
                      onClick={() => setGuess([...guess, n])}
                    >
                      <Glyph n={n} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {game === "keeper_archive" && (
          <div className="kp-archive">
            <div className="kp-archive-slots">
              {[0, 1, 2, 3, 4].map((i) => {
                const hold = terminal
                  ? (v?.held.includes(i) ?? false)
                  : held.includes(i);
                const concealed = !visibleSymbols.length;
                return (
                  <button
                    key={i}
                    className={
                      "kp-archive-glyph " +
                      (hold ? "kp-held" : "") +
                      (busy && !hold ? " kp-redrawing" : "")
                    }
                    style={
                      {
                        transform:
                          busy && !hold && !reduced
                            ? `perspective(500px) rotateX(${progress < 0.72 ? (progress / 0.72) * 88 : ((1 - progress) / 0.28) * 88}deg)`
                            : undefined,
                        opacity:
                          busy && !hold && !reduced
                            ? 0.25 + (0.75 * Math.abs(progress - 0.72)) / 0.72
                            : 1,
                      } as CSSProperties
                    }
                    aria-label={`Glyph ${i + 1}${concealed ? "" : `: ${GLYPHS[visibleSymbols[i]]}`}`}
                    aria-pressed={hold}
                    disabled={!canAct}
                    onClick={() =>
                      setHeld(
                        held.includes(i)
                          ? held.filter((x) => x !== i)
                          : [...held, i],
                      )
                    }
                  >
                    <Glyph n={visibleSymbols[i] ?? 0} hidden={concealed} />
                    <span>{hold ? "HELD" : "◇"}</span>
                  </button>
                );
              })}
            </div>
            <div className="kp-resonance" aria-live="polite">
              {busy
                ? "Reading archive"
                : initialResonance || "Five glyphs · One redraw"}
            </div>
            <div className="kp-paytable">
              {(Object.keys(ARCHIVE_BPS) as (keyof typeof ARCHIVE_BPS)[])
                .filter((k) => k !== "none")
                .map((k) => (
                  <div
                    key={k}
                    className={
                      terminal && revealed &&
                      visibleSymbols.length &&
                      archiveCategory(visibleSymbols) === k
                        ? "kp-paying"
                        : ""
                    }
                  >
                    <span>{ARCHIVE_LABELS[k]}</span>
                    <b>{ARCHIVE_BPS[k] / 10000}×</b>
                  </div>
                ))}
            </div>
          </div>
        )}
        {game === "keeper_passage" && (
          <div className="kp-passage">
            <div className="kp-gates">
              {[0, 1, 2, 3, 4].map((row) => {
                const step = display?.steps[row],
                  current = canAct && row === v!.steps.length;
                return (
                  <div
                    key={row}
                    className={
                      "kp-gate-row " +
                      (step ? "kp-visited" : "") +
                      (current ? " kp-current" : "")
                    }
                  >
                    <b>{String(row + 1).padStart(2, "0")}</b>
                    {[0, 1, 2, 3].map((gate) => {
                      const safe = step?.safe.includes(gate);
                      const crossing =
                        !!run &&
                        !!run.from &&
                        v?.steps.length === row + 1 &&
                        v.steps[row].gate === gate &&
                        run.from.actions.length < r!.actions.length &&
                        r!.actions[r!.actions.length - 1]?.kind === "cross";
                      return (
                        <button
                          key={gate}
                          disabled={!current}
                          aria-label={`Stage ${row + 1} gate ${gate + 1}${step ? (safe ? " safe" : " closed") : ""}`}
                          className={
                            step
                              ? (safe ? "kp-safe" : "kp-closed") +
                                (step.gate === gate ? " kp-chosen" : "")
                              : ""
                          }
                          style={
                            crossing && !reduced
                              ? {
                                  boxShadow: `inset 0 ${-60 + 120 * progress}px 22px -8px #ffaf6577`,
                                }
                              : undefined
                          }
                          onClick={() => act("cross", [risk, gate])}
                        >
                          <svg viewBox="0 0 50 62" aria-hidden="true">
                            <path d="M25 3 46 24v19L25 60 4 43V24Z" />
                            <path d="M25 12 37 27v12L25 50 13 39V27Z" />
                          </svg>
                          <span>{step ? (safe ? "◇" : "×") : gate + 1}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {canAct && (
              <div className="kp-risk" role="group" aria-label="Route risk">
                {[0, 1].map((n) => (
                  <button
                    key={n}
                    aria-pressed={risk === n}
                    onClick={() => setRisk(n)}
                  >
                    <strong>{n === 0 ? "Stable" : "Deep"}</strong>
                    <small>{n === 0 ? "3" : "2"} / 4 safe</small>
                    <b>Next {chipLabel(v!.next[n])}</b>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="kp-result" aria-live="polite">
          {shown ? (
            <>
              <span>{v!.label}</span>
              <strong data-return={v!.payout}>
                {chipLabel(v!.payout)} <small>returned</small>
              </strong>
            </>
          ) : busy ? (
            <span>Receiving signal…</span>
          ) : inPlay && !terminal && game === "keeper_passage" ? (
            <>
              <span>Bank</span>
              <strong>{chipLabel(v!.bank)}</strong>
            </>
          ) : (
            <span>
              {terminal ? "Result ready" : inPlay ? status : "Choose a stake"}
            </span>
          )}
        </div>
      </div>
      <div className="kp-controls">
        {busy ? <button className="kp-primary" disabled>Transmitting</button> : !inPlay ? (
          <>
            <label>
              Stake
              <input
                aria-label="Stake"
                value={stake}
                inputMode="decimal"
                disabled={busy}
                onChange={(e) => setStake(e.target.value)}
              />
            </label>
            <button
              className="kp-primary"
              disabled={busy || pending}
              onClick={begin}
            >
              {game === "keeper_cipher"
                ? "Begin cipher"
                : game === "keeper_archive"
                  ? "Open archive"
                  : "Begin passage"}
            </button>
          </>
        ) : terminal ? (
          <button className="kp-primary" disabled={busy} onClick={reveal}>
            {busy ? "Revealing" : "Reveal result"}
          </button>
        ) : game === "keeper_cipher" ? (
          <>
            <button
              className="kp-primary"
              disabled={
                busy ||
                guess.length !== 3 ||
                v!.clues.some((c) => c.guess.join() === guess.join())
              }
              onClick={() => act("guess", guess)}
            >
              Transmit code
            </button>
            <button disabled={busy} onClick={() => act("end")}>
              End trial · 0 return
            </button>
          </>
        ) : game === "keeper_archive" ? (
          <>
            <button
              className="kp-primary"
              disabled={busy}
              onClick={() => act("draw", held)}
            >
              {held.length === 5 ? "Keep all" : `Redraw ${5 - held.length}`}
            </button>
            <button
              disabled={busy}
              onClick={() => setHeld(held.length === 5 ? [] : [0, 1, 2, 3, 4])}
            >
              {held.length === 5 ? "Release all" : "Hold all"}
            </button>
          </>
        ) : (
          <button
            className="kp-primary"
            disabled={busy}
            onClick={() => act("bank")}
          >
            {v!.steps.length ? `Bank ${chipLabel(v!.bank)}` : "Return stake"}
          </button>
        )}
      </div>
      <div className="kp-details">
        <details>
          <summary>Rules & returns</summary>
          <ul>
            {rules[game].map((s) => (
              <li key={s}>{s}</li>
            ))}
            <li>
              Returns include the stake. Fractional hundredths round down.
            </li>
          </ul>
        </details>
        <details>
          <summary>Recent rounds</summary>
          {state.frontier?.history
            .filter((h) => h.game === game)
            .map((h) => (
              <div className="kp-history" key={h.id}>
                <span>
                  #{h.id} · {h.label}
                </span>
                <b>
                  {chipLabel(h.wager)} → {chipLabel(h.payout)}
                </b>
              </div>
            ))}
        </details>
      </div>
      <span className="kp-sr">{KEEPER_NAMES[game]}</span>
    </div>
  );
}
