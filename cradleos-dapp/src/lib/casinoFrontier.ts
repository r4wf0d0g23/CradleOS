import {
  randomInt,
  shuffledDeck,
  MAX_BET,
  type RandomInt,
} from "./casinoPractice";
import {
  bestPoker,
  comparePoker,
  houseWing,
  splitWing,
} from "./casinoFrontierPoker";
import {
  initialTray,
  PUSHER_COST,
  simulatePusher,
  validTray,
  type PusherToken,
  type PusherResult,
} from "./casinoFrontierPusher";
export const FRONTIER_KEYS = [
  "frontier_remainder",
  "frontier_broker",
  "frontier_holdem",
  "frontier_wing",
  "frontier_race",
  "frontier_pusher",
] as const;
export type FrontierGame = (typeof FRONTIER_KEYS)[number];
export const isFrontierGame = (x: unknown): x is FrontierGame =>
  typeof x === "string" && (FRONTIER_KEYS as readonly string[]).includes(x);
export const FRONTIER_NAMES: Record<FrontierGame, string> = {
  frontier_remainder: "Reactor Remainder",
  frontier_broker: "Derelict Broker",
  frontier_holdem: "Command Hold’em",
  frontier_wing: "Wing Command",
  frontier_race: "Gate Runner",
  frontier_pusher: "Salvage Pusher",
};
export const BROKER_VALUES = [
  0, 100, 300, 700, 1400, 2500, 5000, 8000, 12000, 18000, 27000, 40200,
];
export type FrontierAction = { kind: string; values: number[] };
export type FrontierRound = {
  id: number;
  game: FrontierGame;
  stake: number;
  draw: number[];
  choice: number[];
  actions: FrontierAction[];
  collected: boolean;
  pusher?: { tray: PusherToken[]; tokenId: number };
};
export type FrontierReceipt = {
  id: number;
  game: FrontierGame;
  wager: number;
  payout: number;
  label: string;
};
export type FrontierState = {
  version: 1;
  sequence: number;
  current: FrontierRound;
  history: FrontierReceipt[];
  tray?: PusherToken[];
  nextToken?: number;
};
export type FrontierView = {
  phase: string;
  wager: number;
  payout: number;
  label: string;
  own: number;
  opened: number[];
  offer: number;
  checks: number;
  raise: number;
  escort: number[];
  dealerEscort: number[];
  boardCount: number;
};
const int = (n: unknown, min = 0, max = 1e12): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
const bps = (stake: number, b: number) => Math.floor((stake * b) / 10000);
const pusherCache = new WeakMap<FrontierRound, PusherResult>();
export function pusherOutcome(r: FrontierRound): PusherResult {
  let out = pusherCache.get(r);
  if (!out) {
    if (!r.pusher) throw Error("Missing tray.");
    out = simulatePusher(
      r.pusher.tray,
      r.choice[0],
      r.choice[1] / 1000,
      r.pusher.tokenId,
      true,
    );
    pusherCache.set(r, out);
  }
  return out;
}
function holdemResult(r: FrontierRound, v: FrontierView) {
  const player = bestPoker([...r.draw.slice(0, 2), ...r.draw.slice(4)]),
    dealer = bestPoker([...r.draw.slice(2, 4), ...r.draw.slice(4)]),
    cmp = comparePoker(player, dealer),
    qualifies = dealer.category >= 1;
  const blindProfit =
    player.category === 8
      ? player.kickers[0] === 14
        ? 500
        : 50
      : (({ 4: 1, 5: 1.5, 6: 3, 7: 10 } as Record<number, number>)[
          player.category
        ] ?? 0);
  v.payout =
    cmp === 0
      ? v.wager
      : cmp < 0
        ? qualifies
          ? 0
          : r.stake
        : Math.floor(
            r.stake * ((qualifies ? 2 : 1) + 1 + blindProfit + v.raise * 2),
          );
  v.label =
    cmp > 0
      ? `${player.name} · Win`
      : cmp === 0
        ? "Tie"
        : `${dealer.name} · Dealer`;
  v.phase = "done";
  v.boardCount = 5;
}
export function frontierView(r: FrontierRound): FrontierView {
  const v: FrontierView = {
    phase: "done",
    wager: r.stake,
    payout: 0,
    label: "",
    own: -1,
    opened: [],
    offer: 0,
    checks: 0,
    raise: 0,
    escort: [],
    dealerEscort: [],
    boardCount: 0,
  };
  if (r.game === "frontier_remainder") {
    const result = r.draw[0] % 4 || 4;
    v.payout = result === r.choice[0] ? bps(r.stake, 38000) : 0;
    v.label = `Remainder ${result}`;
  }
  if (r.game === "frontier_broker") v.phase = "pick";
  if (r.game === "frontier_holdem") {
    v.phase = "preflop";
    v.wager = r.stake * 2;
  }
  if (r.game === "frontier_wing") v.phase = "split";
  if (r.game === "frontier_race") {
    const pos = r.draw.slice(0, 4).indexOf(r.choice[0]);
    v.payout =
      pos < (r.choice[1] === 0 ? 1 : 2)
        ? bps(r.stake, r.choice[1] === 0 ? 38000 : 19000)
        : 0;
    v.label = `Runner ${r.choice[0] + 1} · #${pos + 1}`;
  }
  if (r.game === "frontier_pusher") {
    const out = pusherOutcome(r);
    v.payout = out.collected.length * PUSHER_COST;
    v.label = `${out.collected.length} collected · ${out.missed.length} lost`;
  }
  for (const a of r.actions) {
    if (
      v.phase === "done" ||
      !a ||
      typeof a.kind !== "string" ||
      !Array.isArray(a.values) ||
      a.values.some((x) => !int(x, 0, 100))
    )
      throw Error("Invalid round action.");
    const noValues = a.values.length === 0,
      n = a.values[0];
    if (r.game === "frontier_broker") {
      if (
        a.kind === "pick" &&
        v.phase === "pick" &&
        a.values.length === 1 &&
        int(n, 0, 11)
      ) {
        v.own = n;
        v.phase = "open";
      } else if (
        a.kind === "open" &&
        v.phase === "open" &&
        a.values.length === 1 &&
        int(n, 0, 11) &&
        n !== v.own &&
        !v.opened.includes(n)
      ) {
        v.opened.push(n);
        const stage = [3, 6, 8, 10].indexOf(v.opened.length);
        if (stage >= 0) {
          const remaining = r.draw.filter((_, i) => !v.opened.includes(i));
          const total = remaining.reduce((a, b) => a + b, 0);
          v.offer = Math.floor(
            (r.stake * total * [85, 90, 95, 98][stage]) /
              (remaining.length * 1000000),
          );
          v.phase = "offer";
        }
      } else if (a.kind === "accept" && v.phase === "offer" && noValues) {
        v.payout = v.offer;
        v.label = "Offer accepted";
        v.phase = "done";
      } else if (a.kind === "reject" && v.phase === "offer" && noValues) {
        v.phase = v.opened.length === 10 ? "final" : "open";
      } else if (
        (a.kind === "keep" || a.kind === "swap") &&
        v.phase === "final" &&
        noValues
      ) {
        if (a.kind === "swap")
          v.own = r.draw.findIndex(
            (_, i) => i !== v.own && !v.opened.includes(i),
          );
        v.payout = bps(r.stake, r.draw[v.own]);
        v.label = a.kind === "keep" ? "Cargo retained" : "Cargo exchanged";
        v.phase = "done";
      } else throw Error("Invalid cargo action.");
    } else if (r.game === "frontier_holdem") {
      if (
        a.kind === "check" &&
        noValues &&
        (v.phase === "preflop" || v.phase === "flop")
      ) {
        v.checks++;
        v.phase = v.checks === 1 ? "flop" : "river";
        v.boardCount = v.checks === 1 ? 3 : 5;
      } else if (
        a.kind === "raise" &&
        a.values.length === 1 &&
        ((v.phase === "preflop" && [3, 4].includes(n)) ||
          (v.phase === "flop" && n === 2) ||
          (v.phase === "river" && n === 1))
      ) {
        v.raise = n;
        v.wager += n * r.stake;
        holdemResult(r, v);
      } else if (a.kind === "fold" && v.phase === "river" && noValues) {
        v.phase = "done";
        v.label = "Fold";
        v.boardCount = 5;
      } else throw Error("Invalid Hold’em action.");
    } else if (
      r.game === "frontier_wing" &&
      a.kind === "split" &&
      a.values.length === 2
    ) {
      const player = splitWing(r.draw.slice(0, 7), a.values);
      if (!player.legal) throw Error("Main fleet must outrank escort.");
      v.escort = [...a.values];
      v.dealerEscort = houseWing(r.draw.slice(7));
      const dealer = splitWing(r.draw.slice(7), v.dealerEscort);
      const wins =
        Number(comparePoker(player.mainRank, dealer.mainRank) > 0) +
        Number(comparePoker(player.escortRank, dealer.escortRank) > 0);
      v.payout = bps(r.stake, [0, 10000, 19500][wins]);
      v.label = ["Both hands lost", "Split · Push", "Both hands won"][wins];
      v.phase = "done";
    } else throw Error("Invalid game action.");
  }
  return v;
}
export function makeFrontierRound(
  game: FrontierGame,
  stake: number,
  choice: number[],
  id: number,
  previous?: FrontierState,
  rng: RandomInt = randomInt,
): FrontierRound {
  if (
    !isFrontierGame(game) ||
    !int(stake, 100, MAX_BET) ||
    !int(id, 1) ||
    !Array.isArray(choice)
  )
    throw Error("Invalid wager.");
  if(game === "frontier_pusher" && (previous?.nextToken ?? 82) >= 999999999) throw Error("Tray drop limit reached. Refill chips to reset.");
  const sample = (n: number) => {
    const v = rng(n);
    if (!int(v, 0, n - 1)) throw Error("Invalid random draw.");
    return v;
  };
  let draw: number[] = [];
  if (game === "frontier_remainder") draw = [48 + sample(48)];
  if (game === "frontier_broker") {
    draw = [...BROKER_VALUES];
    for (let i = 11; i > 0; i--) {
      const j = sample(i + 1);
      [draw[i], draw[j]] = [draw[j], draw[i]];
    }
  }
  if (game === "frontier_holdem" || game === "frontier_wing")
    draw = shuffledDeck(sample).slice(0, game === "frontier_holdem" ? 9 : 14);
  if (game === "frontier_race") {
    draw = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) {
      const j = sample(i + 1);
      [draw[i], draw[j]] = [draw[j], draw[i]];
    }
    draw.push(...Array.from({ length: 4 }, () => sample(1000)));
  }
  const r: FrontierRound = {
    id,
    game,
    stake,
    draw,
    choice: [...choice],
    actions: [],
    collected: false,
    ...(game === "frontier_pusher"
      ? {
          pusher: {
            tray: previous?.tray ?? initialTray(),
            tokenId: previous?.nextToken ?? 82,
          },
        }
      : {}),
  };
  if (!validFrontierRound(r)) throw Error("Invalid game selection.");
  return r;
}
export function validFrontierRound(r: unknown): r is FrontierRound {
  try {
    const q = r as FrontierRound;
    if (
      !q ||
      !isFrontierGame(q.game) ||
      !int(q.id, 1) ||
      !int(q.stake, 100, MAX_BET) ||
      typeof q.collected !== "boolean" ||
      !Array.isArray(q.draw) ||
      !Array.isArray(q.choice) ||
      !Array.isArray(q.actions) ||
      q.actions.length > 24
    )
      return false;
    const d = q.draw,
      c = q.choice;
    if (
      q.game === "frontier_remainder" &&
      (d.length !== 1 ||
        !int(d[0], 48, 95) ||
        c.length !== 1 ||
        !int(c[0], 1, 4))
    )
      return false;
    if (
      q.game === "frontier_broker" &&
      (c.length !== 0 ||
        JSON.stringify([...d].sort((a, b) => a - b)) !==
          JSON.stringify(BROKER_VALUES))
    )
      return false;
    if (
      (q.game === "frontier_holdem" || q.game === "frontier_wing") &&
      (c.length !== 0 ||
        d.length !== (q.game === "frontier_holdem" ? 9 : 14) ||
        new Set(d).size !== d.length ||
        d.some((n) => !int(n, 0, 51)))
    )
      return false;
    if (
      q.game === "frontier_race" &&
      (d.length !== 8 ||
        d.slice(0, 4).some((n) => !int(n, 0, 3)) ||
        [...d.slice(0, 4)].sort().join() !== "0,1,2,3" ||
        d.slice(4).some((n) => !int(n, 0, 999)) ||
        c.length !== 2 ||
        !int(c[0], 0, 3) ||
        !int(c[1], 0, 1))
    )
      return false;
    if (q.game === "frontier_pusher") {
      if (
        d.length !== 0 ||
        q.stake !== PUSHER_COST ||
        c.length !== 2 ||
        !int(c[0], 36, 324) ||
        !int(c[1], 0, 999) ||
        !q.pusher ||
        !validTray(q.pusher.tray) ||
        q.pusher.tray.length >= 100 ||
        !int(q.pusher.tokenId, 1, 999999999) ||
        q.pusher.tray.some((t) => t.id >= q.pusher!.tokenId)
      )
        return false;
    } else if (q.pusher !== undefined) return false;
    const v = frontierView(q);
    return !q.collected || v.phase === "done";
  } catch {
    return false;
  }
}
export const frontierPending = (s?: FrontierState) =>
  !!s && !s.current.collected;
export function validFrontierState(s: unknown): s is FrontierState {
  try {
    const f = s as FrontierState;
    if (
      !f ||
      f.version !== 1 ||
      !int(f.sequence, 1) ||
      !validFrontierRound(f.current) ||
      f.current.id !== f.sequence ||
      !Array.isArray(f.history) ||
      f.history.length > 20
    )
      return false;
    if (
      (f.tray === undefined) !== (f.nextToken === undefined) ||
      (f.tray !== undefined &&
        (!validTray(f.tray) ||
          !int(f.nextToken, 82, 999999999) ||
          f.tray.some((t) => t.id >= f.nextToken!)))
    )
      return false;
    if (f.current.game === "frontier_pusher") {
      const out = pusherOutcome(f.current);
      if (
        JSON.stringify(f.tray) !== JSON.stringify(out.tray) ||
        f.nextToken !== f.current.pusher!.tokenId + 1
      )
        return false;
    }
    const last = f.sequence - (f.current.collected ? 0 : 1);
    if (
      f.history.length !== Math.min(20, last) ||
      !f.history.every(
        (h, i) =>
          h &&
          h.id === last - i &&
          isFrontierGame(h.game) &&
          int(h.wager, 100, MAX_BET * 6) &&
          int(h.payout) &&
          typeof h.label === "string" &&
          h.label.length < 120,
      )
    )
      return false;
    if (f.current.collected) {
      const v = frontierView(f.current),
        h = f.history[0];
      if (
        h.game !== f.current.game ||
        h.wager !== v.wager ||
        h.payout !== v.payout ||
        h.label !== v.label
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
