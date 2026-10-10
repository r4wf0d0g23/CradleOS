import { describe, it, expect } from "vitest";
import {
  rankPoker,
  bestPoker,
  comparePoker,
  houseWing,
  splitWing,
} from "./casinoFrontierPoker";
import {
  BROKER_VALUES,
  frontierView,
  validFrontierState,
  pusherOutcome,
  type FrontierRound,
} from "./casinoFrontier";
import {
  startFrontier,
  actFrontier,
  collectFrontier,
} from "./casinoFrontierSession";
import {
  initialSession,
  restoreSession,
  activeSession,
  playSession,
} from "./casinoSessions";
import { casinoLaunchGame } from "./casinoStationSession";
import {
  initialTray,
  simulatePusher,
  validTray,
  PUSHER_COST,
} from "./casinoFrontierPusher";
const cards = (rs: number[], suits = rs.map((_, i) => i % 4)) =>
  rs.map((r, i) => suits[i] * 13 + (r === 14 ? 0 : r - 1));
const round = (
  game: FrontierRound["game"],
  draw: number[],
  actions: FrontierRound["actions"] = [],
  choice: number[] = [],
): FrontierRound => ({
  id: 1,
  game,
  stake: 10000,
  draw,
  choice,
  actions,
  collected: false,
});
const a = (kind: string, ...values: number[]) => ({ kind, values });
const saved = (s: ReturnType<typeof initialSession>) =>
  expect(restoreSession(JSON.stringify(s))).toEqual(s);
describe("Frontier poker", () => {
  it.each([
    [[14, 13, 12, 11, 10], [0, 0, 0, 0, 0], 8, "Royal flush"],
    [[9, 8, 7, 6, 5], [1, 1, 1, 1, 1], 8, "Straight flush"],
    [[10, 10, 10, 10, 2], [0, 1, 2, 3, 0], 7, "Four of a kind"],
    [[9, 9, 9, 3, 3], [0, 1, 2, 0, 1], 6, "Full house"],
    [[14, 10, 8, 6, 2], [0, 0, 0, 0, 0], 5, "Flush"],
    [[14, 5, 4, 3, 2], [0, 1, 2, 3, 0], 4, "Straight"],
    [[5, 5, 5, 14, 13], [0, 1, 2, 0, 1], 3, "Three of a kind"],
    [[5, 5, 4, 4, 14], [0, 1, 0, 1, 2], 2, "Two pair"],
    [[9, 9, 14, 7, 3], [0, 1, 2, 3, 0], 1, "Pair"],
    [[14, 10, 8, 6, 2], [0, 1, 2, 3, 0], 0, "High card"],
  ])("ranks %j", (rs, suits, cat, name) =>
    expect(rankPoker(cards(rs as number[], suits as number[]))).toMatchObject({
      category: cat,
      name,
    }),
  );
  it("wheel loses to six-high; kicker and suit-independent ties", () => {
    expect(
      comparePoker(
        rankPoker(cards([14, 5, 4, 3, 2])),
        rankPoker(cards([6, 5, 4, 3, 2])),
      ),
    ).toBe(-1);
    expect(
      comparePoker(
        rankPoker(cards([14, 14, 10, 8, 2])),
        rankPoker(cards([14, 14, 9, 8, 2])),
      ),
    ).toBe(1);
    expect(
      comparePoker(
        rankPoker(cards([14, 10, 8, 6, 2])),
        rankPoker(cards([14, 10, 8, 6, 2], [1, 2, 3, 0, 1])),
      ),
    ).toBe(0);
  });
  it("best seven uses the board and dealer house way is legal", () => {
    expect(bestPoker([0, 1, 2, 3, 4, 5, 6]).category).toBe(8);
    for (let n = 0; n < 40; n++) {
      const hand = Array.from({ length: 7 }, (_, i) => (n + i * 7) % 52),
        split = houseWing(hand);
      expect(splitWing(hand, split).legal).toBe(true);
      expect(houseWing(hand)).toEqual(split);
    }
  });
});
describe("Frontier game rules", () => {
  it("exact remainder distribution, payouts and choices", () => {
    for (let pick = 1; pick <= 4; pick++) {
      let total = 0;
      for (let count = 48; count <= 95; count++) {
        const v = frontierView(
          round("frontier_remainder", [count], [], [pick]),
        );
        total += v.payout;
        expect(v.payout).toBe((count % 4 || 4) === pick ? 38000 : 0);
      }
      expect(total / (48 * 10000)).toBe(0.95);
    }
  });
  it("broker mean and first offer include own case, not its secret position", () => {
    expect(BROKER_VALUES.reduce((a, b) => a + b) / 12).toBe(9600);
    const acts = [a("pick", 0), a("open", 1), a("open", 2), a("open", 3)];
    const v = frontierView(round("frontier_broker", BROKER_VALUES, acts));
    const swapped = [...BROKER_VALUES];
    [swapped[0], swapped[11]] = [swapped[11], swapped[0]];
    expect(frontierView(round("frontier_broker", swapped, acts)).offer).toBe(
      v.offer,
    );
    expect(v.offer).toBe(Math.floor(((115200 - 100 - 300 - 700) / 9) * 0.85));
    expect(
      frontierView(
        round("frontier_broker", BROKER_VALUES, [...acts, a("accept")]),
      ).payout,
    ).toBe(v.offer);
    expect(() =>
      frontierView(
        round("frontier_broker", BROKER_VALUES, [a("pick", 0), a("open", 0)]),
      ),
    ).toThrow();
  });
  it("broker walks all offer stages, keeps or swaps final case", () => {
    const acts = [a("pick", 0)];
    for (let i = 1; i <= 10; i++) {
      acts.push(a("open", i));
      if ([3, 6, 8, 10].includes(i)) {
        expect(
          frontierView(round("frontier_broker", BROKER_VALUES, acts)).phase,
        ).toBe("offer");
        acts.push(a("reject"));
      }
    }
    expect(
      frontierView(
        round("frontier_broker", BROKER_VALUES, [...acts, a("keep")]),
      ).payout,
    ).toBe(0);
    expect(
      frontierView(
        round("frontier_broker", BROKER_VALUES, [...acts, a("swap")]),
      ).payout,
    ).toBe(40200);
  });
  it("holdem staged action constraints, fold and exact max royal payout", () => {
    const draw = [0, 12, 14, 27, 9, 10, 11, 2, 17]; // player royal, dealer pair of twos
    expect(
      frontierView(round("frontier_holdem", draw, [a("raise", 4)])).payout,
    ).toBe(5110000);
    expect(
      frontierView(round("frontier_holdem", draw, [a("check")])).boardCount,
    ).toBe(3);
    expect(
      frontierView(
        round("frontier_holdem", draw, [a("check"), a("check"), a("fold")]),
      ),
    ).toMatchObject({ wager: 20000, payout: 0, phase: "done" });
    expect(() =>
      frontierView(round("frontier_holdem", draw, [a("raise", 1)])),
    ).toThrow();
    expect(() =>
      frontierView(round("frontier_holdem", draw, [a("raise", 4), a("check")])),
    ).toThrow();
  });
  it("holdem board tie returns entire wager, unqualified dealer returns losing ante", () => {
    expect(
      frontierView(
        round(
          "frontier_holdem",
          [1, 15, 3, 17, 0, 9, 10, 11, 12],
          [a("raise", 4)],
        ),
      ).payout,
    ).toBe(60000);
    const draw = cards(
      [2, 3, 14, 13, 12, 10, 8, 6, 4],
      [0, 1, 0, 1, 2, 3, 0, 1, 2],
    );
    expect(
      frontierView(round("frontier_holdem", draw, [a("raise", 4)])).payout,
    ).toBe(10000);
  });
  it("wing requires legal assignment and gives copies to dealer", () => {
    const player = cards([14, 14, 13, 12, 10, 8, 6], [0, 1, 0, 1, 2, 3, 0]);
    expect(() =>
      frontierView(
        round(
          "frontier_wing",
          [...player, ...cards([2, 2, 3, 5, 7, 9, 11], [0, 1, 1, 2, 3, 0, 2])],
          [a("split", 0, 1)],
        ),
      ),
    ).toThrow();
    const draw = [
      ...cards([14, 14, 13, 12, 10, 8, 6], [0, 1, 0, 0, 0, 0, 0]),
      ...cards([14, 14, 13, 12, 10, 8, 6], [2, 3, 2, 2, 2, 2, 2]),
    ];
    const v = frontierView(
      round("frontier_wing", draw, [
        a("split", ...houseWing(draw.slice(0, 7))),
      ]),
    );
    expect(v.payout).toBe(0);
  });
  it("all race orders and bets yield exact 95 percent before rounding", () => {
    const perms = (xs: number[]): number[][] =>
      xs.length
        ? xs.flatMap((x, i) =>
            perms(xs.filter((_, j) => i !== j)).map((p) => [x, ...p]),
          )
        : [[]];
    for (let runner = 0; runner < 4; runner++)
      for (let kind = 0; kind < 2; kind++) {
        const sum = perms([0, 1, 2, 3]).reduce(
          (s, order) =>
            s +
            frontierView(
              round(
                "frontier_race",
                [...order, 0, 1, 2, 3],
                [],
                [runner, kind],
              ),
            ).payout,
          0,
        );
        expect(sum / 24).toBe(9500);
      }
  });
});
describe("escrow, replay and legacy coexistence", () => {
  it.each([
    "frontier_remainder",
    "frontier_broker",
    "frontier_holdem",
    "frontier_wing",
    "frontier_race",
  ] as const)("preserves %s pending saves and locks old games", (game) => {
    const s = startFrontier(
      initialSession(),
      game,
      2500,
      game === "frontier_remainder"
        ? [2]
        : game === "frontier_race"
          ? [1, 0]
          : [],
      (n) => n - 1,
    );
    saved(s);
    expect(activeSession(s)).toBe(true);
    expect(casinoLaunchGame(s, "roulette")).toBe(game);
    expect(() => playSession(s, "coinflip", 100)).toThrow();
  });
  it("guards round/revision, additional debit and exactly-once payout", () => {
    let s = startFrontier(
      initialSession(),
      "frontier_holdem",
      2500,
      [],
      (n) => n - 1,
    );
    expect(s.balance).toBe(995000);
    s = actFrontier(s, 1, 0, a("check"));
    saved(s);
    expect(() => actFrontier(s, 1, 0, a("check"))).toThrow();
    s = actFrontier(s, 1, 1, a("raise", 2));
    saved(s);
    expect(s.balance).toBe(990000);
    const payout = frontierView(s.frontier!.current).payout;
    s = collectFrontier(s, 1, 2);
    saved(s);
    expect(s.balance).toBe(990000 + payout);
    expect(() => collectFrontier(s, 1, 2)).toThrow();
    s = playSession(s, "coinflip", 100, { side: 0 });
    saved(s);
    expect(s.frontier?.history).toHaveLength(1);
  });
  it("rejects affordability/headroom/conflicting records and invalid transcripts", () => {
    expect(() =>
      startFrontier(
        { ...initialSession(), balance: 14999 },
        "frontier_holdem",
        2500,
        [],
      ),
    ).toThrow();
    expect(() =>
      startFrontier(
        { ...initialSession(), balance: 1e12 - 1000 },
        "frontier_holdem",
        2500,
        [],
      ),
    ).toThrow();
    let s = startFrontier(
      initialSession(),
      "frontier_broker",
      2500,
      [],
      (n) => n - 1,
    );
    expect(
      restoreSession(
        JSON.stringify({
          ...s,
          frontier: {
            ...s.frontier,
            current: { ...s.frontier!.current, actions: [a("accept")] },
          },
        }),
      ).notice,
    ).toBeTruthy();
    expect(validFrontierState({ ...s.frontier, history: [{ id: 1 }] })).toBe(
      false,
    );
    s = { ...s, balance: -1 };
    expect(restoreSession(JSON.stringify(s)).notice).toBeTruthy();
  });
  it("retains last twenty receipts and valid old saves", () => {
    let s = initialSession();
    saved(s);
    for (let i = 0; i < 25; i++) {
      s = startFrontier(s, "frontier_remainder", 100, [4], () => 0);
      s = collectFrontier(s, i + 1, 0);
    }
    saved(s);
    expect(s.frontier!.history.length).toBe(20);
  });
});
describe("physical pusher", () => {
  it("is deterministic, bounded, conserves tokens and collects only at the lip", () => {
    const tray = initialTray(),
      out = simulatePusher(tray, 180, 0.3, 82, true),
      again = simulatePusher(tray, 180, 0.3, 82);
    expect(out.tray).toEqual(again.tray);
    expect(out.collected).toEqual(again.collected);
    expect(validTray(out.tray)).toBe(true);
    expect(out.tray.length + out.collected.length + out.missed.length).toBe(82);
    expect(
      new Set([...out.tray.map((t) => t.id), ...out.collected, ...out.missed])
        .size,
    ).toBe(82);
    expect(out.frames[0].motor).toBe(65);
    expect(out.frames[out.frames.length - 1].motor).toBeCloseTo(65);
    expect(out.frames[0].tokens.some((t) => t.id === 82)).toBe(false);
    expect(out.frames.some((f) => f.tokens.some((t) => t.id === 82))).toBe(
      true,
    );
    expect(out.collected.length).toBeGreaterThan(0);
  });
  it("empty tray cannot invent prizes, location/timing changes real contact paths", () => {
    const empty = simulatePusher([], 180, 0, 1);
    expect(empty.collected).toHaveLength(0);
    expect(empty.tray).toHaveLength(1);
    const left = simulatePusher(initialTray(), 45, 0.1, 82),
      right = simulatePusher(initialTray(), 315, 0.8, 82);
    expect(left.tray).not.toEqual(right.tray);
  });
  it("saves compact inputs, recomputes exact tray, reloads and credits only once", () => {
    let s = startFrontier(
      initialSession(),
      "frontier_pusher",
      PUSHER_COST,
      [180, 300],
    );
    saved(s);
    expect(JSON.stringify(s).length).toBeLessThan(20000);
    const payout =
      pusherOutcome(s.frontier!.current).collected.length * PUSHER_COST;
    expect(s.balance).toBe(1000000 - PUSHER_COST);
    s = collectFrontier(s, 1, 0);
    saved(s);
    expect(s.balance).toBe(1000000 - PUSHER_COST + payout);
    const bad = JSON.parse(JSON.stringify(s));
    bad.frontier.tray[0].x += 1;
    expect(restoreSession(JSON.stringify(bad)).notice).toBeTruthy();
  });
});

describe("Frontier boundaries", () => {
  it("rejects coercible string race runners", () => {
    const s = startFrontier(
      initialSession(),
      "frontier_race",
      2500,
      [0, 0],
      (n) => n - 1,
    );
    const bad = JSON.parse(JSON.stringify(s));
    bad.frontier.current.draw.splice(0, 4, "0", "1", "2", "3");
    expect(restoreSession(JSON.stringify(bad)).notice).toBeTruthy();
  });
  it("keeps physical pusher inventory conserved across repeated drops", () => {
    let tray = initialTray();
    let removed = 0;
    for (let i = 0; i < 20; i++) {
      const result = simulatePusher(
        tray,
        36 + ((i * 73) % 289),
        ((i * 137) % 1000) / 1000,
        82 + i,
      );
      removed += result.collected.length + result.missed.length;
      expect(result.tray.length + removed).toBe(82 + i);
      expect(validTray(result.tray)).toBe(true);
      tray = result.tray;
    }
    expect(removed).toBeGreaterThan(0);
  }, 15000);
});
it('rejects exhausted token IDs before committing or charging',()=>{
 let s=startFrontier(initialSession(),'frontier_remainder',100,[4],()=>0);s=collectFrontier(s,1,0);
 s={...s,frontier:{...s.frontier!,tray:initialTray(),nextToken:999999999}};saved(s);
 const before=JSON.stringify(s);expect(()=>startFrontier(s,'frontier_pusher',2500,[180,300])).toThrow('Tray drop limit');expect(JSON.stringify(s)).toBe(before);
});
