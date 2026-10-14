import { isKeeperGame } from "./casinoKeeper";
import { activeSession, type Session } from "./casinoSessions";
import { crapsReserve } from "./casinoCraps";
import { randomInt, type RandomInt } from "./casinoPractice";
import {
  frontierPending,
  frontierView,
  makeFrontierRound,
  pusherOutcome,
  type FrontierGame,
  type FrontierAction,
} from "./casinoFrontier";
const cap = (s: Session, extra: number) => {
  if (
    !Number.isSafeInteger(s.balance + crapsReserve(s.craps) + extra) ||
    s.balance + crapsReserve(s.craps) + extra > 1e12
  )
    throw Error("Practice balance limit reached.");
};
export function startFrontier(
  s: Session,
  game: FrontierGame,
  stake: number,
  choice: number[],
  rng: RandomInt = randomInt,
): Session {
  if (activeSession(s)) throw Error("Finish the current round first.");
  const required = stake * (game === "frontier_holdem" ? 6 : 1);
  if (!Number.isSafeInteger(required) || s.balance < required)
    throw Error(
      game === "frontier_holdem"
        ? "Reserve 6× ante for all raises."
        : "Not enough chips.",
    );
  cap(
    s,
    stake *
      (game === "frontier_holdem" ? 511 : game === "frontier_pusher" ? 101 : isKeeperGame(game) ? 32 : 5),
  );
  const f = s.frontier,
    r = makeFrontierRound(game, stake, choice, (f?.sequence ?? 0) + 1, f, rng),
    v = frontierView(r);
  return {
    ...s,
    notice: undefined,
    balance: s.balance - v.wager,
    frontier: {
      version: 1,
      sequence: r.id,
      current: r,
      history: f?.history ?? [],
      ...(f?.tray ? { tray: f.tray, nextToken: f.nextToken } : {}),
      ...(r.pusher
        ? { tray: pusherOutcome(r).tray, nextToken: r.pusher.tokenId + 1 }
        : {}),
    },
  };
}
function current(s: Session, id: number, revision: number) {
  const r = s.frontier?.current;
  if (
    !r ||
    !frontierPending(s.frontier) ||
    r.id !== id ||
    r.actions.length !== revision
  )
    throw Error("Round already changed.");
  return r;
}
export function actFrontier(
  s: Session,
  id: number,
  revision: number,
  action: FrontierAction,
): Session {
  const old = current(s, id, revision),
    before = frontierView(old),
    r = { ...old, actions: [...old.actions, action] },
    v = frontierView(r),
    debit = v.wager - before.wager;
  if (!Number.isSafeInteger(debit) || debit < 0 || debit > s.balance)
    throw Error("Not enough chips.");
  cap(s, Math.max(0, v.payout - debit));
  return {
    ...s,
    balance: s.balance - debit,
    frontier: { ...s.frontier!, current: r },
  };
}
export function collectFrontier(
  s: Session,
  id: number,
  revision: number,
): Session {
  const r = current(s, id, revision),
    v = frontierView(r);
  if (v.phase !== "done") throw Error("Finish the current round first.");
  cap(s, v.payout);
  return {
    ...s,
    balance: s.balance + v.payout,
    frontier: {
      ...s.frontier!,
      current: { ...r, collected: true },
      history: [
        {
          id: r.id,
          game: r.game,
          wager: v.wager,
          payout: v.payout,
          label: v.label,
        },
        ...s.frontier!.history,
      ].slice(0, 20),
    },
  };
}
export function frontierContinuationReserve(s: Session): number {
  const r = s.frontier?.current;
  if (!r || r.collected) return 0;
  const v = frontierView(r);
  return r.game === "frontier_holdem" && v.phase !== "done"
    ? (v.phase === "preflop" ? 4 : v.phase === "flop" ? 2 : 1) * r.stake
    : 0;
}
