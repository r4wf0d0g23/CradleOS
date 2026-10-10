import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { type Session } from "../lib/casinoSessions";
import { chipLabel, practiceBet } from "../lib/casinoPractice";
import {
  frontierView,
  frontierPending,
  FRONTIER_NAMES,
  type FrontierRound,
  type FrontierGame,
} from "../lib/casinoFrontier";
import {
  startFrontier,
  actFrontier,
  collectFrontier,
} from "../lib/casinoFrontierSession";
import { houseWing, splitWing } from "../lib/casinoFrontierPoker";
import { CasinoFeedback } from "../lib/casinoFeedback";
import {
  BrokerScene,
  HoldemScene,
  WingScene,
  RaceScene,
  RemainderScene,
  PusherScene,
  RUNNERS,
} from "./CasinoFrontierScenes";
import "../styles/casino-frontier-games.css";
export { FrontierTile } from "./CasinoFrontierScenes";
type Run = {
  id: number;
  revision: number;
  duration: number;
  from?: FrontierRound;
};
const rules: Record<FrontierGame, string[]> = {
  frontier_remainder: [
    "Choose a remainder: 1–4. A batch of 48–95 ore is sorted in groups of four. Zero remainder counts as 4.",
    "Correct: 3.8× total return. 95% theoretical return before rounding.",
  ],
  frontier_broker: [
    "12 cargo values: 0×, 0.01×, 0.03×, 0.07×, 0.14×, 0.25×, 0.5×, 0.8×, 1.2×, 1.8×, 2.7×, 4.02×.",
    "Choose your cargo; open 3 / 3 / 2 / 2 others. Accept an offer or continue. At the final two: keep or swap.",
    "Offers: 85% / 90% / 95% / 98% of the remaining cargo’s mean value, including your sealed cargo. Initial cargo mean: 0.96× stake. All values are total returns.",
  ],
  frontier_holdem: [
    "52 cards. Ante and blind: 1× each. Keep 6× ante available. Preflop: check or raise 3× / 4×. Flop: check or raise 2×. River: raise 1× or fold. A raise locks betting.",
    "Best five of seven wins. Dealer qualifies with a pair or better. Play pays 1:1; qualifying ante pays 1:1, otherwise ante pushes. Ties push all bets. Fold loses ante and blind.",
    "Blind profit on a win: straight 1:1 · flush 3:2 · full house 3:1 · quads 10:1 · straight flush 50:1 · royal flush 500:1. Lower hands push blind. Dealer win loses blind and play; ante pushes only if dealer does not qualify.",
  ],
  frontier_wing: [
    "52 cards, no joker. Split seven into a five-card main fleet and two-card escort. Main must outrank escort; compare category, then ranks highest first.",
    "Dealer maximizes its legal escort, then main. Tied individual hands go to the dealer.",
    "Win both: 1.95× total. Split: 1×. Lose both: 0×.",
  ],
  frontier_race: [
    "Four equally likely Lai-class runners. Choose a runner and Win or Place.",
    "Win: first place pays 3.8× total. Place: top two pays 1.9× total. 95% theoretical return before rounding.",
  ],
  frontier_pusher: [
    "Drop: 25 chips. Each token collected: 25 chips. Choose a chute position and release delay. Two motor cycles per drop.",
    "Tokens crossing the front collection lip pay; side-chute tokens are lost. The starting tray contains 81 tokens. No automatic restocking; tray persists between drops.",
    "Timing and position change token collisions. No fixed return percentage. Maximum tray: 100 tokens. A chip refill resets the tray.",
  ],
};
export function CasinoFrontier({
  game,
  state,
  commit,
  busy,
  setBusy,
  reduced,
  onError,
}: {
  game: FrontierGame;
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
    gen = useRef(0),
    stage = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState<Run | null>(null),
    [progress, setProgress] = useState(0),
    [stake, setStake] = useState("25"),
    [pick, setPick] = useState(1),
    [runner, setRunner] = useState(0),
    [kind, setKind] = useState(0),
    [escort, setEscort] = useState<number[]>([]),
    [drop, setDrop] = useState(180),
    [phase, setPhase] = useState(300);
  const feedback = useContext(CasinoFeedback),
    callbacks = useRef({ commit, setBusy, onError, feedback });
  callbacks.current = { commit, setBusy, onError, feedback };
  const r =
      state.frontier?.current.game === game
        ? state.frontier.current
        : undefined,
    v = useMemo(() => (r ? frontierView(r) : undefined), [r]);
  const pending = frontierPending(state.frontier),
    inPlay = !!r && !r.collected;
  const show =
      !!r &&
      v?.phase === "done" &&
      (r.collected || (!!run && progress >= 0.99)),
    showCards =
      !!r &&
      v?.phase === "done" &&
      (r.collected || (!!run && progress >= 0.68));
  useEffect(
    () => () => {
      gen.current++;
      cancelAnimationFrame(frame.current);
    },
    [],
  );
  useEffect(() => {
    if (!run) return;
    const ticket = ++gen.current,
      start = performance.now();
    const stop = () => {
      if (ticket !== gen.current) return;
      gen.current++;
      cancelAnimationFrame(frame.current);
      guard.current = false;
      callbacks.current.setBusy(false);
      setRun(null);
      setProgress(0);
    };
    const end = () => {
      if (ticket !== gen.current) return;
      try {
        const s = ledger.current,
          current = s.frontier?.current;
        if (current?.id !== run.id || current.actions.length !== run.revision)
          throw Error("Round already changed.");
        if (frontierView(current).phase === "done" && !current.collected) {
          const next = collectFrontier(s, run.id, run.revision);
          callbacks.current.commit(next);
          ledger.current = next;
          const view = frontierView(current);
          callbacks.current.feedback(
            view.payout > view.wager ? "win" : view.payout ? "payout" : "stop",
          );
        }
        setProgress(1);
      } catch (e) {
        callbacks.current.onError((e as Error).message);
        setProgress(0);
      } finally {
        guard.current = false;
        callbacks.current.setBusy(false);
        setRun(null);
      }
    };
    const tick = (now: number) => {
      if (ticket !== gen.current) return;
      if (document.hidden) {
        stop();
        return;
      }
      const p = reduced ? 1 : Math.min(1, (now - start) / run.duration);
      setProgress(p);
      if (p >= 1) end();
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
    const current = next.frontier!.current,
      view = frontierView(current);
    const duration =
      game === "frontier_pusher"
        ? 7200
        : game === "frontier_race"
          ? 6500
          : game === "frontier_remainder"
            ? 3400
            : view.phase === "done"
              ? game === "frontier_broker"
                ? 1100
                : 1900
              : from
                ? 650
                : 1000;
    setProgress(0);
    setRun({
      id: current.id,
      revision: current.actions.length,
      duration,
      from,
    });
    setBusy(true);
    feedback(
      game === "frontier_pusher"
        ? "coin"
        : game === "frontier_race"
          ? "engine"
          : game === "frontier_broker"
            ? "scan"
            : "deal",
    );
  }
  function begin() {
    if (guard.current || busy || pending) return;
    guard.current = true;
    try {
      const choice =
        game === "frontier_remainder"
          ? [pick]
          : game === "frontier_race"
            ? [runner, kind]
            : game === "frontier_pusher"
              ? [drop, phase]
              : [];
      const next = startFrontier(
        ledger.current,
        game,
        game === "frontier_pusher" ? 2500 : practiceBet(stake),
        choice,
      );
      commit(next);
      ledger.current = next;
      setEscort([]);
      onError("");
      present(next);
    } catch (e) {
      guard.current = false;
      onError((e as Error).message);
    }
  }
  function act(action: string, ...values: number[]) {
    if (guard.current || busy) return;
    guard.current = true;
    try {
      const old = ledger.current.frontier!.current,
        next = actFrontier(ledger.current, old.id, old.actions.length, {
          kind: action,
          values,
        });
      commit(next);
      ledger.current = next;
      onError("");
      present(next, old);
    } catch (e) {
      guard.current = false;
      onError((e as Error).message);
    }
  }
  function reveal() {
    if (guard.current || busy || !r || r.collected || v?.phase !== "done")
      return;
    guard.current = true;
    onError("");
    present(ledger.current);
  }
  const status = busy
    ? "IN PROGRESS"
    : r?.collected
      ? v!.label
      : inPlay
        ? (
            {
              pick: "Choose your cargo",
              open: "Open cargo",
              offer: "Broker offer",
              final: "Keep or swap",
              preflop: "Preflop",
              flop: "Flop",
              river: "River",
              split: "Set your formation",
              done: "Round saved",
            } as Record<string, string>
          )[v!.phase]
        : "READY";
  const canSplit =
    !!r && escort.length === 2 && splitWing(r.draw.slice(0, 7), escort).legal;
  return (
    <div
      className={`frontier-games ${game}`}
      data-frontier-game={game}
      data-phase={v?.phase ?? "ready"}
      data-running={busy}
    >
      <div ref={stage} className="fn-scene" data-progress={progress}>
        {game === "frontier_remainder" && (
          <RemainderScene
            r={r}
            p={run ? progress : r?.collected ? 1 : 0}
            show={show}
            pick={inPlay ? r!.choice[0] : pick}
          />
        )}
        {game === "frontier_broker" && (
          <BrokerScene
            r={r}
            v={v}
            previous={run?.from}
            p={progress}
            show={show}
            busy={busy}
            act={act}
          />
        )}
        {game === "frontier_holdem" && (
          <HoldemScene
            r={r}
            v={v}
            p={progress}
            busy={busy}
            show={showCards}
            previous={run?.from}
          />
        )}
        {game === "frontier_wing" && (
          <WingScene
            r={r}
            v={v}
            selected={escort}
            setSelected={setEscort}
            busy={busy}
            show={showCards}
          />
        )}
        {game === "frontier_race" && (
          <RaceScene
            r={r}
            p={progress}
            show={show}
            running={!!run}
            pick={inPlay ? r!.choice[0] : runner}
          />
        )}
        {game === "frontier_pusher" && (
          <PusherScene
            r={r}
            p={progress}
            show={show}
            running={!!run}
            tray={state.frontier?.tray}
            drop={drop}
            setDrop={setDrop}
            disabled={busy || inPlay}
          />
        )}
      </div>
      <div className="fn-console">
        <div className="fn-status" role="status">
          <span>{status}</span>
          <b>
            {r?.collected
              ? `${chipLabel(v!.payout)} returned`
              : inPlay
                ? `${chipLabel(v!.wager)} committed`
                : "PLAY MONEY"}
          </b>
        </div>
        {!inPlay && (
          <div className="fn-wager">
            <label>
              {game === "frontier_holdem" ? "Ante" : "Stake"}
              {game === "frontier_pusher" ? (
                <b>25 chips</b>
              ) : (
                <input
                  aria-label={game === "frontier_holdem" ? "Ante" : "Stake"}
                  value={stake}
                  inputMode="decimal"
                  onChange={(e) => setStake(e.target.value)}
                  disabled={busy}
                />
              )}
            </label>
            {game === "frontier_remainder" && (
              <div className="fn-choices" role="group" aria-label="Remainder">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    aria-pressed={pick === n}
                    onClick={() => setPick(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
            {game === "frontier_race" && (
              <>
                <div className="fn-choices" role="group" aria-label="Runner">
                  {RUNNERS.map((name, i) => (
                    <button
                      key={name}
                      aria-pressed={runner === i}
                      onClick={() => setRunner(i)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="fn-choices">
                  <button aria-pressed={kind === 0} onClick={() => setKind(0)}>
                    Win · 3.8×
                  </button>
                  <button aria-pressed={kind === 1} onClick={() => setKind(1)}>
                    Place · 1.9×
                  </button>
                </div>
              </>
            )}
            {game === "frontier_pusher" && (
              <>
                <label>
                  Chute{" "}
                  <output>{Math.round(((drop - 36) / 288) * 100)}%</output>
                  <input
                    type="range"
                    aria-label="Chute position"
                    min="36"
                    max="324"
                    value={drop}
                    onChange={(e) => setDrop(Number(e.target.value))}
                  />
                </label>
                <label>
                  Release <output>{((phase / 1000) * 3.6).toFixed(2)} s</output>
                  <input
                    type="range"
                    aria-label="Release delay"
                    min="0"
                    max="999"
                    value={phase}
                    onChange={(e) => setPhase(Number(e.target.value))}
                  />
                </label>
              </>
            )}
            <button
              className="fn-primary"
              onClick={begin}
              disabled={busy || pending}
            >
              {game === "frontier_pusher"
                ? "Drop · 25 chips"
                : game === "frontier_broker"
                  ? "Open contract"
                  : game === "frontier_race"
                    ? "Launch race"
                    : game === "frontier_remainder"
                      ? "Sort ore"
                      : "Deal"}
            </button>
          </div>
        )}
        {inPlay && (
          <div className="fn-actions">
            {v?.phase === "done" && !busy && (
              <button className="fn-primary" onClick={reveal}>
                Reveal saved round
              </button>
            )}
            {v?.phase === "offer" && (
              <>
                <strong>{chipLabel(v.offer)} chips</strong>
                <button
                  className="fn-primary"
                  disabled={busy}
                  onClick={() => act("accept")}
                >
                  Accept
                </button>
                <button disabled={busy} onClick={() => act("reject")}>
                  Continue
                </button>
              </>
            )}
            {v?.phase === "final" && (
              <>
                <button
                  className="fn-primary"
                  disabled={busy}
                  onClick={() => act("keep")}
                >
                  Keep cargo
                </button>
                <button disabled={busy} onClick={() => act("swap")}>
                  Swap cargo
                </button>
              </>
            )}
            {["preflop", "flop", "river"].includes(v?.phase ?? "") && (
              <>
                {v!.phase !== "river" && (
                  <button disabled={busy} onClick={() => act("check")}>
                    Check
                  </button>
                )}
                {(v!.phase === "preflop"
                  ? [3, 4]
                  : v!.phase === "flop"
                    ? [2]
                    : [1]
                ).map((n) => (
                  <button
                    key={n}
                    className="fn-primary"
                    disabled={busy}
                    onClick={() => act("raise", n)}
                  >
                    Raise {n}× · {chipLabel(r!.stake * n)}
                  </button>
                ))}
                {v!.phase === "river" && (
                  <button disabled={busy} onClick={() => act("fold")}>
                    Fold
                  </button>
                )}
              </>
            )}
            {v?.phase === "split" && (
              <>
                <button
                  disabled={busy}
                  onClick={() => setEscort(houseWing(r!.draw.slice(0, 7)))}
                >
                  Auto-arrange
                </button>
                <button
                  className="fn-primary"
                  disabled={busy || !canSplit}
                  onClick={() => act("split", ...escort)}
                >
                  Lock formation
                </button>
                <span>
                  {escort.length < 2
                    ? "Select two escorts"
                    : canSplit
                      ? "Formation valid"
                      : "Main must outrank escort"}
                </span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="fn-details">
        <details>
          <summary>Rules & returns</summary>
          <ul>
            {rules[game].map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </details>
        <details>
          <summary>Recent rounds</summary>
          <div className="fn-history">
            {state.frontier?.history
              .filter((h) => h.game === game)
              .map((h) => (
                <div key={h.id}>
                  <span>
                    #{h.id} · {h.label}
                  </span>
                  <span>
                    {chipLabel(h.wager)} → <b>{chipLabel(h.payout)}</b>
                  </span>
                </div>
              )) ?? <span>No rounds</span>}
          </div>
        </details>
      </div>
      <span className="fn-sr-only">{FRONTIER_NAMES[game]}</span>
    </div>
  );
}
