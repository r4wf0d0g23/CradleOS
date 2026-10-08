import {
  validCraps,
  crapsReserve,
  evaluateCraps,
  type CrapsTable,
} from "./casinoCraps";
import {
  isFleet,
  spinFleet,
  validSlotReceipt,
  type SlotReceipt,
} from "./casinoSlotFleet";
import {
  initialPractice,
  restorePractice,
  playPractice,
  actPractice,
  MAX_BET,
  RED,
  PLINKO_BPS,
  randomInt,
  type PracticeState,
  type PracticeGame,
  type Round,
  type Choice,
  type RandomInt,
} from "./casinoPractice";
import { KENO_TABLE, SCRATCH_BPS } from "./casinoExpanded";
import {
  actTable,
  dealTable,
  tableReturns,
  validTable,
  type BlackjackTable,
  type TableAction,
} from "./casinoBlackjackTable";
export const SESSION_KEY = "cradleos:casino:practice:v2";
export const PROFILES = {
  Classic: [
    1300000, 60000, 30000, 16000, 12000, 5000, 4851, 5000, 12000, 16000, 30000,
    60000, 1300000,
  ],
  Low: PLINKO_BPS,
  Medium: [
    1000000, 100000, 30000, 15000, 11000, 8500, 0, 8500, 11000, 15000, 30000,
    100000, 1000000,
  ],
  High: [
    5000000, 500000, 50000, 10000, 5000, 1000, 0, 1000, 5000, 10000, 50000,
    500000, 5000000,
  ],
} as const;
export type Profile = keyof typeof PROFILES;
export type RouletteKind =
  | "straight"
  | "color"
  | "parity"
  | "range"
  | "dozen"
  | "column";
export type Wager = { kind: RouletteKind; value: number; stake: number };
export type Ticket = { picks: number[]; stake: number };
export type Pack = {
  game: PracticeGame;
  rounds: Round[];
  profile?: Profile;
  wagers?: Wager[];
  tickets?: Ticket[];
  table?: BlackjackTable;
  slot?: SlotReceipt;
  /** Cosmetic reveal indices; absent in legacy packs means all revealed. */
  revealed?: number[];
};
export type SpinRun = {
  game: PracticeGame;
  stake: number;
  planned: number;
  paid: number;
  shown: number;
  startSequence: number;
  stopped: boolean;
};
export const isSlotGame = (game: string) => game === "slots" || isFleet(game);
export type Session = Omit<PracticeState, "version"> & {
  version: 2;
  table: BlackjackTable | null;
  pack: Pack | null;
  notice?: string;
  spinRun?: SpinRun;
  craps?: CrapsTable;
};
export type Options = {
  count?: number;
  profile?: Profile;
  wagers?: Wager[];
  tickets?: Ticket[];
  seats?: number;
};
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const integer = (n: unknown, min = 0, max = 1e12): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
const validStake = (n: unknown) => integer(n, 100, MAX_BET);
const base = (s: Session): PracticeState => ({
  version: 1,
  balance: s.balance,
  sequence: s.sequence,
  history: s.history,
  hand: s.hand,
});
const wrap = (s: PracticeState): Session => ({
  ...s,
  version: 2,
  table: null,
  pack: null,
});
export const initialSession = () => wrap(initialPractice());
export const pendingSlot = (s: Session) =>
  !!s.pack?.slot && s.pack.slot.cursor < s.pack.slot.frames.length;
export const pendingSpinRun = (s: Session) =>
  !!s.spinRun && !s.spinRun.stopped && s.spinRun.paid < s.spinRun.planned;
export const pendingClassicSpin = (s: Session) =>
  s.spinRun?.game === "slots" && s.spinRun.shown < s.spinRun.paid;
export const scratchRevealed = (s: Session): number[] =>
  s.pack?.game === "scratch_cards"
    ? (s.pack.revealed ?? s.pack.rounds.map((_, i) => i))
    : [];
export const pendingScratch = (s: Session) =>
  s.pack?.game === "scratch_cards" &&
  scratchRevealed(s).length < s.pack.rounds.length;
export const activeSession = (s: Session) =>
  !!s.craps?.pending ||
  !!s.hand ||
  !!s.table ||
  pendingSlot(s) ||
  pendingClassicSpin(s) ||
  pendingScratch(s) ||
  pendingSpinRun(s);
export const packTotal = (p: Pack, key: "stake" | "payout") =>
  sum(p.rounds.map((r) => r[key]));
export function rouletteBps(w: Wager, n: number): number {
  if (w.kind === "straight") return n === w.value ? 360000 : 0;
  if (n === 0) return 0;
  const yes =
    w.kind === "color"
      ? (RED.includes(n) ? 0 : 1) === w.value
      : w.kind === "parity"
        ? n % 2 === w.value
        : w.kind === "range"
          ? Math.floor((n - 1) / 18) === w.value
          : w.kind === "dozen"
            ? Math.floor((n - 1) / 12) === w.value
            : (n - 1) % 3 === w.value;
  return yes ? (w.kind === "dozen" || w.kind === "column" ? 30000 : 20000) : 0;
}
export function wagerLabel(w: Wager): string {
  if (w.kind === "straight") return String(w.value);
  return (
    {
      color: ["Red", "Black"],
      parity: ["Even", "Odd"],
      range: ["1–18", "19–36"],
      dozen: ["1st dozen", "2nd dozen", "3rd dozen"],
      column: ["Column 1", "Column 2", "Column 3"],
    } as const
  )[w.kind][w.value];
}
function validWagers(ws: Wager[]): boolean {
  const maxima = {
    straight: 36,
    color: 1,
    parity: 1,
    range: 1,
    dozen: 2,
    column: 2,
  };
  return (
    Array.isArray(ws) &&
    ws.length > 0 &&
    ws.length <= 49 &&
    new Set(ws.map((w) => `${w.kind}:${w.value}`)).size === ws.length &&
    ws.every(
      (w) =>
        w &&
        Object.prototype.hasOwnProperty.call(maxima, w.kind) &&
        integer(w.value, 0, maxima[w.kind]) &&
        validStake(w.stake),
    )
  );
}
function validTickets(ts: Ticket[], draft = false): boolean {
  return (
    Array.isArray(ts) &&
    ts.length >= 1 &&
    ts.length <= 4 &&
    ts.every(
      (t) =>
        t &&
        validStake(t.stake) &&
        Array.isArray(t.picks) &&
        t.picks.length >= (draft ? 0 : 1) &&
        t.picks.length <= 6 &&
        new Set(t.picks).size === t.picks.length &&
        t.picks.every((n) => integer(n, 1, 40)),
    )
  );
}
export function quickPick(n = 3, rng: RandomInt = randomInt): number[] {
  return drawNumbers(40, n, rng).sort((a, b) => a - b);
}
function drawNumbers(size: number, count: number, rng: RandomInt): number[] {
  const pool = Array.from({ length: size }, (_, i) => i + 1);
  for (let i = size - 1; i > 0; i--) {
    const j = rng(i + 1);
    if (!integer(j, 0, i)) throw Error("Invalid random draw.");
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
const money = (stake: number, bps: number) => Math.floor((stake * bps) / 10000);
function ensureFree(s: Session) {
  if (activeSession(s)) throw Error("Finish the current round first.");
}
function settle(s: Session, p: Pack): Session {
  const stake = packTotal(p, "stake"),
    payout = packTotal(p, "payout");
  if (!integer(stake) || s.balance < stake)
    throw Error("Not enough chips for the total stake.");
  const balance = s.balance - stake + payout;
  if (
    !integer(balance + crapsReserve(s.craps)) ||
    !integer(s.sequence + p.rounds.length)
  )
    throw Error("Practice balance limit reached.");
  const rounds = p.rounds.map((r, i) => ({ ...r, id: s.sequence + i + 1 }));
  return {
    ...s,
    notice: undefined,
    spinRun: undefined,
    balance,
    sequence: s.sequence + rounds.length,
    hand: null,
    table: null,
    pack: { ...p, rounds },
    history: [...rounds].reverse().concat(s.history).slice(0, 20),
  };
}
function finishTable(s: Session, t: BlackjackTable, debit: number): Session {
  if (s.balance < debit) throw Error("Not enough chips for this action.");
  if (!t.complete)
    return {
      ...s,
      notice: undefined,
      balance: s.balance - debit,
      table: t,
      pack: null,
    };
  const payouts = tableReturns(t);
  const rounds = t.hands.map(
    (h, i): Round => ({
      id: 0,
      game: "blackjack",
      stake: h.stake,
      payout: payouts[i],
      values: [...h.cards, -1, ...t.dealer],
      label: `Seat ${h.seat + 1}${h.split ? " · split" : ""} · ${payouts[i] > h.stake ? "Win" : payouts[i] === h.stake ? "Push" : "Loss"}`,
    }),
  );
  // Existing stakes are already in escrow. Settle all hands exactly once.
  return settle(
    {
      ...s,
      balance: s.balance - debit + sum(rounds.map((r) => r.stake)),
      table: null,
    },
    { game: "blackjack", rounds, table: t },
  );
}
export function playSession(
  s: Session,
  game: PracticeGame,
  stake: number,
  choice: Choice = {},
  options: Options = {},
  rng: RandomInt = randomInt,
): Session {
  ensureFree(s);
  s = { ...s, spinRun: undefined };
  const source = rng;
  rng = (bound) => {
    const n = source(bound);
    if (!integer(n, 0, bound - 1)) throw Error("Invalid random draw.");
    return n;
  };
  if (!validStake(stake)) throw Error("Enter a stake from 1 to 1,000 chips.");
  if (isFleet(game)) {
    if (stake > s.balance) throw Error("Not enough chips for this spin.");
    const slot = spinFleet(game, stake, rng);
    return settle(s, {
      game,
      slot,
      rounds: [
        {
          id: 0,
          game,
          stake,
          payout: slot.payout,
          values: [1, slot.frames.length],
          label: `${slot.frames.length} stage${slot.frames.length === 1 ? "" : "s"} · ${slot.capReached ? "Cap reached" : slot.payout > stake ? "Win" : slot.payout === stake ? "Push" : slot.payout ? "Partial return" : "No return"}`,
        },
      ],
    });
  }
  if (game === "blackjack") {
    const { table, debit } = dealTable(
      options.seats ?? 1,
      stake,
      s.balance,
      rng,
    );
    return finishTable(s, table, debit);
  }
  const count = options.count ?? 1;
  if (game === "roulette") {
    const ws = options.wagers ?? [{ kind: "color", value: 0, stake }];
    if (!validWagers(ws))
      throw Error("Add valid roulette selections (max 1,000 chips each).");
    if (s.balance < sum(ws.map((w) => w.stake)))
      throw Error("Not enough chips for all selections.");
    const n = rng(37);
    return settle(s, {
      game,
      wagers: ws.map((w) => ({ ...w })),
      rounds: ws.map((w) => ({
        id: 0,
        game,
        stake: w.stake,
        payout: money(w.stake, rouletteBps(w, n)),
        values: [n],
        label: `${wagerLabel(w)} · ball ${n}`,
      })),
    });
  }
  if (game === "keno") {
    const ts = options.tickets ?? [
      { picks: choice.picks ?? [7, 17, 27], stake },
    ];
    if (!validTickets(ts))
      throw Error(
        "Use 1–4 tickets, each with 1–6 unique numbers and a valid stake.",
      );
    if (s.balance < sum(ts.map((t) => t.stake)))
      throw Error("Not enough chips for all tickets.");
    const drawn = drawNumbers(40, 10, rng);
    return settle(s, {
      game,
      tickets: ts.map((t) => ({ ...t, picks: [...t.picks] })),
      rounds: ts.map((t, i) => {
        const hits = t.picks.filter((n) => drawn.includes(n)).length;
        return {
          id: 0,
          game,
          stake: t.stake,
          payout: money(t.stake, KENO_TABLE[t.picks.length - 1][hits]),
          values: [t.picks.length, ...t.picks, ...drawn],
          label: `Ticket ${i + 1} · ${hits}/${t.picks.length} hits`,
        };
      }),
    });
  }
  if (
    !integer(count, 1, 10) ||
    !(
      game === "plinko"
        ? [1, 3, 5, 10]
        : game === "scratch_cards"
          ? [1, 3, 5]
          : [1]
    ).includes(count)
  )
    throw Error("Invalid pack size.");
  if (s.balance < stake * count)
    throw Error("Not enough chips for the entire pack.");
  if (game === "plinko") {
    const profile = options.profile ?? "Low";
    if (!Object.prototype.hasOwnProperty.call(PROFILES, profile))
      throw Error("Choose a Plinko risk profile.");
    return settle(s, {
      game,
      profile,
      rounds: Array.from({ length: count }, () => {
        const values = Array.from({ length: 12 }, () => rng(2)),
          bucket = sum(values);
        return {
          id: 0,
          game,
          stake,
          payout: money(stake, PROFILES[profile][bucket]),
          values,
          label: `${profile} · bucket ${bucket} · ${PROFILES[profile][bucket] / 10000}×`,
        };
      }),
    });
  }
  // Existing instant games retain their rules and random distributions.
  let temporary = base(s);
  const rounds: Round[] = [];
  for (let i = 0; i < count; i++) {
    temporary = playPractice(temporary, game, stake, choice, rng);
    rounds.push(temporary.history[0]);
  }
  return settle(s, {
    game,
    rounds,
    ...(game === "scratch_cards" ? { revealed: [] } : {}),
  });
}
export function actSession(s: Session, action: TableAction): Session {
  if (s.table) {
    const { table, debit } = actTable(s.table, action, s.balance);
    return finishTable(s, table, debit);
  }
  if (s.hand && action !== "split") {
    const next = wrap(actPractice(base(s), action));
    if (!integer(next.balance + crapsReserve(s.craps)))
      throw Error("Practice balance limit reached.");
    return { ...next, ...(s.craps ? { craps: s.craps } : {}) };
  }
  throw Error("There is no active hand.");
}
export function revealSlot(s: Session, all = false): Session {
  if (!pendingSlot(s) || !s.pack?.slot)
    throw Error("No saved slot feature to reveal.");
  const complete = all || s.pack.slot.cursor + 1 === s.pack.slot.frames.length;
  return {
    ...s,
    ...(complete && s.spinRun
      ? { spinRun: { ...s.spinRun, shown: s.spinRun.paid } }
      : {}),
    pack: {
      ...s.pack,
      slot: {
        ...s.pack.slot,
        cursor: all ? s.pack.slot.frames.length : s.pack.slot.cursor + 1,
      },
    },
  };
}
/** Future spins are neither generated nor debited until this explicit step. */
export function startSpinRun(
  s: Session,
  game: PracticeGame,
  stake: number,
  count: number,
  rng: RandomInt = randomInt,
): Session {
  if (!isSlotGame(game) || ![1, 3, 5, 10].includes(count))
    throw Error("Choose 1, 3, 5 or 10 slot spins.");
  if (!validStake(stake) || s.balance < stake * count)
    throw Error("Not enough chips for the maximum run stake.");
  const next = playSession(s, game, stake, {}, {}, rng);
  return {
    ...next,
    spinRun: {
      game,
      stake,
      planned: count,
      paid: 1,
      shown: 0,
      startSequence: s.sequence,
      stopped: false,
    },
  };
}
export function advanceSpinRun(
  s: Session,
  rng: RandomInt = randomInt,
): Session {
  if (!pendingSpinRun(s) || pendingSlot(s) || pendingClassicSpin(s))
    throw Error("Finish the paid spin before continuing the run.");
  const run = s.spinRun!;
  const next = playSession(
    { ...s, spinRun: undefined },
    run.game,
    run.stake,
    {},
    {},
    rng,
  );
  return { ...next, spinRun: { ...run, paid: run.paid + 1 } };
}
export function revealClassicSpin(s: Session): Session {
  if (!pendingClassicSpin(s)) throw Error("No saved classic spin to reveal.");
  return { ...s, spinRun: { ...s.spinRun!, shown: s.spinRun!.paid } };
}
export function stopSpinRun(s: Session): Session {
  if (!s.spinRun) return s;
  return { ...s, spinRun: { ...s.spinRun, stopped: true } };
}
export function spinRunTotals(s: Session) {
  const rs = s.spinRun
    ? s.history.filter(
        (r) =>
          r.id > s.spinRun!.startSequence &&
          r.id <= s.spinRun!.startSequence + s.spinRun!.shown,
      )
    : [];
  return {
    stake: sum(rs.map((r) => r.stake)),
    payout: sum(rs.map((r) => r.payout)),
  };
}
export function revealScratch(s: Session, index?: number): Session {
  if (s.pack?.game !== "scratch_cards" || !pendingScratch(s))
    throw Error("No covered tickets.");
  if (index !== undefined && !integer(index, 0, s.pack.rounds.length - 1))
    throw Error("Invalid ticket.");
  const revealed =
    index === undefined
      ? s.pack.rounds.map((_, i) => i)
      : [...new Set([...scratchRevealed(s), index])].sort((a, b) => a - b);
  return { ...s, pack: { ...s.pack, revealed } };
}
function validSpinRun(s: Session): boolean {
  const r = s.spinRun;
  if (!r) return r === undefined;
  if (
    !isSlotGame(r.game) ||
    !validStake(r.stake) ||
    ![1, 3, 5, 10].includes(r.planned) ||
    !integer(r.paid, 1, r.planned) ||
    !integer(r.shown, 0, r.paid) ||
    r.paid - r.shown > 1 ||
    !integer(r.startSequence) ||
    typeof r.stopped !== "boolean" ||
    s.sequence !== r.startSequence + r.paid ||
    s.hand ||
    s.table ||
    s.pack?.game !== r.game ||
    s.history.length < r.paid
  )
    return false;
  if (isFleet(r.game) && pendingSlot(s) !== r.shown < r.paid) return false;
  return s.history
    .slice(0, r.paid)
    .every(
      (h, i) =>
        h.game === r.game && h.stake === r.stake && h.id === s.sequence - i,
    );
}
function validPack(p: Pack, s: Session): boolean {
  if (
    !p ||
    !Array.isArray(p.rounds) ||
    p.rounds.length < 1 ||
    p.rounds.length > 49
  )
    return false;
  if (
    p.rounds.some(
      (r, i) =>
        r.game !== p.game || r.id !== s.sequence - p.rounds.length + 1 + i,
    )
  )
    return false;
  for (const r of p.rounds) {
    const raw = JSON.stringify({
      version: 1,
      balance: 0,
      sequence: r.id,
      history: [r],
      hand: null,
    });
    if (JSON.stringify(restorePractice(raw)) !== raw) return false;
  }
  if (
    JSON.stringify(s.history.slice(0, Math.min(20, p.rounds.length))) !==
    JSON.stringify([...p.rounds].reverse().slice(0, 20))
  )
    return false;
  if (
    p.revealed !== undefined &&
    (p.game !== "scratch_cards" ||
      !Array.isArray(p.revealed) ||
      new Set(p.revealed).size !== p.revealed.length ||
      !p.revealed.every((i) => integer(i, 0, p.rounds.length - 1)))
  )
    return false;
  if (isFleet(p.game))
    return (
      !!p.slot &&
      validSlotReceipt(p.slot) &&
      p.slot.key === p.game &&
      p.rounds.length === 1 &&
      p.rounds[0].stake === p.slot.stake &&
      p.rounds[0].payout === p.slot.payout &&
      JSON.stringify(p.rounds[0].values) ===
        JSON.stringify([1, p.slot.frames.length])
    );
  if (p.slot !== undefined) return false;
  if (p.game === "plinko")
    return (
      !!p.profile &&
      Object.prototype.hasOwnProperty.call(PROFILES, p.profile) &&
      [1, 3, 5, 10].includes(p.rounds.length) &&
      p.rounds.every(
        (r) => r.payout === money(r.stake, PROFILES[p.profile!][sum(r.values)]),
      )
    );
  if (p.game === "roulette")
    return (
      !!p.wagers &&
      validWagers(p.wagers) &&
      p.wagers.length === p.rounds.length &&
      p.rounds.every(
        (r, i) =>
          r.values[0] === p.rounds[0].values[0] &&
          r.stake === p.wagers![i].stake &&
          r.payout === money(r.stake, rouletteBps(p.wagers![i], r.values[0])),
      )
    );
  if (p.game === "keno")
    return (
      !!p.tickets &&
      validTickets(p.tickets) &&
      p.tickets.length === p.rounds.length &&
      p.rounds.every((r, i) => {
        const t = p.tickets![i],
          draw = r.values.slice(-10),
          hits = t.picks.filter((n) => draw.includes(n)).length;
        return (
          r.stake === t.stake &&
          JSON.stringify(r.values.slice(0, -10)) ===
            JSON.stringify([t.picks.length, ...t.picks]) &&
          JSON.stringify(draw) ===
            JSON.stringify(p.rounds[0].values.slice(-10)) &&
          r.payout === money(t.stake, KENO_TABLE[t.picks.length - 1][hits])
        );
      })
    );
  if (p.game === "blackjack")
    return (
      !!p.table &&
      p.table.complete &&
      validTable(p.table) &&
      p.rounds.length === p.table.hands.length &&
      p.rounds.every(
        (r, i) =>
          r.stake === p.table!.hands[i].stake &&
          r.payout === tableReturns(p.table!)[i] &&
          JSON.stringify(r.values) ===
            JSON.stringify([
              ...p.table!.hands[i].cards,
              -1,
              ...p.table!.dealer,
            ]),
      )
    );
  if (p.game === "scratch_cards")
    return (
      [1, 3, 5].includes(p.rounds.length) &&
      p.rounds.every((r) => {
        const counts = Array.from(
            { length: 6 },
            (_, i) => r.values.filter((n) => n === i).length,
          ),
          symbol = counts.findIndex((n) => n === 3);
        const expected =
          symbol < 0
            ? [0, 0, 1, 1, 2, 2, 3, 4, 5]
            : [
                symbol,
                symbol,
                symbol,
                ...[0, 1, 2, 3, 4, 5].filter((n) => n !== symbol),
                symbol === 0 ? 1 : 0,
              ];
        return (
          symbol < 5 &&
          JSON.stringify([...r.values].sort()) ===
            JSON.stringify(expected.sort()) &&
          r.payout === money(r.stake, SCRATCH_BPS[symbol + 1])
        );
      })
    );
  return p.rounds.length === 1;
}
/** v1 is migration input only, never an automatic rollback from an invalid v2. */
export function restoreSession(
  raw: string | null,
  legacy: string | null = null,
): Session {
  if (raw === null) return wrap(restorePractice(legacy));
  try {
    if (raw.length > 300000) throw Error();
    const s = JSON.parse(raw) as Session;
    if (s.version !== 2) throw Error();
    const b = base(s),
      checked = restorePractice(JSON.stringify(b));
    if (JSON.stringify(checked) !== JSON.stringify(b)) throw Error();
    if (
      s.table !== null &&
      (!validTable(s.table) ||
        s.table.complete ||
        s.hand !== null ||
        s.pack !== null)
    )
      throw Error();
    if (s.pack !== null && (s.hand || s.table || !validPack(s.pack, s)))
      throw Error();
    if (!validSpinRun(s)) throw Error();
    if (
      s.craps !== undefined &&
      (!validCraps(s.craps) ||
        !integer(s.balance + crapsReserve(s.craps)) ||
        (s.craps.pending &&
          s.balance < evaluateCraps(s.craps.rolls[0]).payout) ||
        (s.craps.pending &&
          (s.hand ||
            s.table ||
            pendingSlot(s) ||
            pendingSpinRun(s) ||
            pendingClassicSpin(s) ||
            pendingScratch(s))))
    )
      throw Error();
    return {
      ...wrap(checked),
      table: s.table,
      pack: s.pack,
      ...(s.spinRun ? { spinRun: s.spinRun } : {}),
      ...(s.craps ? { craps: s.craps } : {}),
    };
  } catch {
    return {
      ...initialSession(),
      notice:
        "This tab’s practice save could not be read. New free chips are ready; the older snapshot was not restored.",
    };
  }
}

export const OPTIONS_KEY = "cradleos:casino:options:v1";
/** Preferences only; never a balance, wager or resumable action. */
export function restoreOptions(raw: string | null, s: Session): Options {
  const defaults: Options = {
    count:
      s.pack?.game === "plinko" || s.pack?.game === "scratch_cards"
        ? s.pack.rounds.length
        : 1,
    profile: s.pack?.profile ?? "Low",
    wagers: s.pack?.wagers ?? [],
    tickets: s.pack?.tickets ?? [{ picks: [7, 17, 27], stake: 2500 }],
    seats: s.table?.seats ?? s.pack?.table?.seats ?? 1,
  };
  if (raw === null) return defaults;
  try {
    const o = JSON.parse(raw) as Options;
    return {
      count: (s.pack?.game === "scratch_cards"
        ? [1, 3, 5]
        : [1, 3, 5, 10]
      ).includes(o.count ?? 0)
        ? o.count
        : 1,
      profile:
        o.profile && Object.prototype.hasOwnProperty.call(PROFILES, o.profile)
          ? o.profile
          : defaults.profile,
      seats: integer(o.seats, 1, 3) ? o.seats : 1,
      wagers: o.wagers && validWagers(o.wagers) ? o.wagers : [],
      tickets:
        o.tickets && validTickets(o.tickets, true)
          ? o.tickets
          : defaults.tickets,
    };
  } catch {
    return defaults;
  }
}
