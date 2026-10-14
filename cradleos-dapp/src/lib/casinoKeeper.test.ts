import { describe, it, expect } from "vitest";
import {
  KEEPER_KEYS,
  cipherClue,
  archiveCategory,
  ARCHIVE_BPS,
  keeperView,
  passageReturn,
  validKeeperRound,
  keeperDraw,
} from "./casinoKeeper";
import {
  makeFrontierRound,
  validFrontierRound,
  frontierView,
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
  type Session,
} from "./casinoSessions";
import { casinoLaunchGame } from "./casinoStationSession";
import { STATION_CATALOG, PRACTICE_CATALOG } from "./casinoExperienceCatalog";
const codes = Array.from({ length: 6 }, (_, a) =>
  Array.from({ length: 6 }, (_, b) =>
    Array.from({ length: 6 }, (_, c) => [a, b, c]),
  ),
)
  .flat(2)
  .filter((a) => new Set(a).size === 3);
const action = (kind: string, ...values: number[]) => ({ kind, values });
const round = (
  game: FrontierRound["game"],
  draw: number[],
  actions: FrontierRound["actions"] = [],
  stake = 10000,
): FrontierRound => ({
  id: 1,
  game,
  draw,
  actions,
  stake,
  choice: [],
  collected: false,
});
const gates = Array.from({ length: 5 }, () => [0, 1, 2, 3]).flat();
const save = (s: Session) => {
  const restored = restoreSession(JSON.stringify(s));
  expect(restored).toEqual(s);
  return restored;
};
describe("Keeper cipher", () => {
  it("scores all120×120 code/guess pairs", () => {
    expect(codes).toHaveLength(120);
    for (const a of codes)
      for (const b of codes) {
        const c = cipherClue(a, b);
        expect(c.exact).toBe(a.reduce((n, x, i) => n + Number(b[i] === x), 0));
        expect(c.exact + c.misplaced).toBe(6 - new Set([...a, ...b]).size);
      }
  });
  it.each([0, 1, 2])("pays only solve turn %i", (n) => {
    const bad = [
        [3, 4, 5],
        [1, 2, 0],
      ],
      actions = [
        ...bad.slice(0, n).map((g) => action("guess", ...g)),
        action("guess", 0, 1, 2),
      ];
    const r = round("keeper_cipher", [0, 1, 2], actions);
    expect(keeperView(r).payout).toBe([180000, 45000, 18000][n]);
    expect(validFrontierRound(r)).toBe(true);
    expect(() =>
      keeperView({ ...r, actions: [...actions, action("end")] }),
    ).toThrow();
  });
  it("rejects malformed/repeated guesses and ends with no reward", () => {
    for (const values of [
      [0, 0, 1],
      [0, 1],
      [0, 1, 6],
      ["0", 1, 2] as unknown as number[],
    ])
      expect(() =>
        keeperView(
          round("keeper_cipher", [0, 1, 2], [action("guess", ...values)]),
        ),
      ).toThrow();
    expect(() =>
      keeperView(
        round(
          "keeper_cipher",
          [0, 1, 2],
          [action("guess", 3, 4, 5), action("guess", 3, 4, 5)],
        ),
      ),
    ).toThrow();
    const fail = keeperView(
      round(
        "keeper_cipher",
        [0, 1, 2],
        [
          [3, 4, 5],
          [5, 4, 3],
          [2, 1, 0],
        ].map((g) => action("guess", ...g)),
      ),
    );
    expect(fail).toMatchObject({
      phase: "done",
      payout: 0,
      label: "Signal lost",
    });
    expect(
      keeperView(round("keeper_cipher", [0, 1, 2], [action("end")])).payout,
    ).toBe(0);
  });
});
describe("Keeper archive", () => {
  it("exhausts7776 outcomes against independent multiplicity classification", () => {
    const categories: Record<string, number> = {};
    for (let x = 0; x < 7776; x++) {
      let n = x;
      const d = Array.from({ length: 5 }, () => {
        const v = n % 6;
        n = Math.floor(n / 6);
        return v;
      });
      const groups = Object.values(
        d.reduce<Record<string, number>>(
          (a, v) => ({ ...a, [v]: (a[v] ?? 0) + 1 }),
          {},
        ),
      )
        .sort((a, b) => b - a)
        .join();
      const cat =
        (
          {
            "5": "five",
            "4,1": "four",
            "3,2": "full",
            "3,1,1": "three",
            "2,2,1": "two",
          } as Record<string, string>
        )[groups] ?? "none";
      expect(archiveCategory(d)).toBe(cat);
      categories[cat] = (categories[cat] ?? 0) + 1;
    }
    expect(categories).toEqual({
      five: 6,
      four: 150,
      full: 300,
      three: 1200,
      two: 1800,
      none: 4320,
    });
  });
  it("keeps indexed symbols, redraws once and accepts hold-all", () => {
    const draw = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1];
    for (let mask = 0; mask < 32; mask++) {
      const held = [0, 1, 2, 3, 4].filter((i) => mask & (1 << i)),
        r = round("keeper_archive", draw, [action("draw", ...held)]);
      const v = keeperView(r),
        expected = draw
          .slice(0, 5)
          .map((x, i) => (held.includes(i) ? x : draw[i + 5]));
      expect(v.symbols).toEqual(expected);
      expect(v.payout).toBe(ARCHIVE_BPS[archiveCategory(expected)]);
      expect(() =>
        keeperView({ ...r, actions: [...r.actions, action("draw")] }),
      ).toThrow();
    }
    expect(() =>
      keeperView(round("keeper_archive", draw, [action("draw", 2, 2)])),
    ).toThrow();
  });
});
describe("Keeper passage", () => {
  it("has exact3/4 and2/4 safe probabilities for every gate", () => {
    function perm(a: number[]): number[][] {
      return a.length
        ? a.flatMap((x, i) =>
            perm(a.filter((_, j) => i !== j)).map((p) => [x, ...p]),
          )
        : [[]];
    }
    for (const risk of [0, 1])
      for (let gate = 0; gate < 4; gate++) {
        let wins = 0;
        for (const p of perm([0, 1, 2, 3])) {
          const v = keeperView(
            round(
              "keeper_passage",
              [...p, ...gates.slice(4)],
              [action("cross", risk, gate)],
            ),
          );
          wins += Number(v.phase !== "done");
        }
        expect(wins).toBe(risk === 0 ? 18 : 12);
      }
  });
  it("uses exact rational gross return once and auto-banks fifth success", () => {
    expect(passageReturn(101, [0, 0, 1, 0])).toBe(
      Number((101n * 96n * 256n) / (100n * 54n)),
    );
    for (let bits = 0; bits < 32; bits++) {
      const risks = Array.from({ length: 5 }, (_, i) => (bits >> i) & 1),
        r = round(
          "keeper_passage",
          gates,
          risks.map((r) => action("cross", r, 0)),
          100,
        );
      expect(keeperView(r)).toMatchObject({
        phase: "done",
        payout: passageReturn(100, risks),
      });
      expect(keeperView(r).payout).toBeLessThanOrEqual(3072);
    }
    expect(
      keeperView(
        round(
          "keeper_passage",
          gates,
          Array.from({ length: 5 }, () => action("cross", 1, 0)),
        ),
      ).payout,
    ).toBe(307200);
  });
  it("banks at every stage, refunds before any gate, rejects continuing failures", () => {
    for (let n = 0; n < 5; n++) {
      const v = keeperView(
        round("keeper_passage", gates, [
          ...Array.from({ length: n }, () => action("cross", 0, 0)),
          action("bank"),
        ]),
      );
      expect(v.payout).toBe(passageReturn(10000, Array(n).fill(0)));
    }
    const r = round("keeper_passage", gates, [action("cross", 1, 3)]);
    expect(keeperView(r)).toMatchObject({ phase: "done", payout: 0, bank: 0 });
    expect(() =>
      keeperView({ ...r, actions: [...r.actions, action("bank")] }),
    ).toThrow();
    for (const vals of [[2, 0], [0, 4], [-1, 0], [0]])
      expect(() =>
        keeperView(round("keeper_passage", gates, [action("cross", ...vals)])),
      ).toThrow();
  });
});
describe("Keeper ledger integration", () => {
  it.each(KEEPER_KEYS)("roundtrips %s and credits exactly once", (game) => {
    let s = save(startFrontier(initialSession(), game, 2500, [], () => 0));
    const openingBalance = s.balance;
    expect(activeSession(s)).toBe(true);
    expect(casinoLaunchGame(s, "blackjack")).toBe(game);
    expect(() => startFrontier(s, game, 2500, [])).toThrow();
    expect(() => playSession(s, "coinflip", 100, {})).toThrow();
    const r = s.frontier!.current;
    const a =
      game === "keeper_cipher"
        ? action("guess", ...r.draw)
        : game === "keeper_archive"
          ? action("draw", 0, 1, 2, 3, 4)
          : action("cross", 0, r.draw[0]);
    s = save(actFrontier(s, 1, 0, a));
    if (game === "keeper_passage")
      s = save(actFrontier(s, 1, 1, action("bank")));
    const revision = s.frontier!.current.actions.length,
      payout = frontierView(s.frontier!.current).payout;
    expect(s.balance).toBe(openingBalance);
    expect(() => actFrontier(s, 1, 0, a)).toThrow();
    s = save(collectFrontier(s, 1, revision));
    expect(s.balance).toBe(openingBalance + payout);
    expect(activeSession(s)).toBe(false);
    expect(() => collectFrontier(s, 1, revision)).toThrow();
    expect(s.frontier!.history[0].payout).toBe(payout);
  });
  it("restores each intermediate gate without resampling", () => {
    let s = startFrontier(initialSession(), "keeper_passage", 101, [], () => 0);
    for (let i = 0; i < 4; i++)
      s = save(
        actFrontier(
          s,
          1,
          i,
          action("cross", i % 2, s.frontier!.current.draw[i * 4]),
        ),
      );
    expect(s.frontier!.current.actions.length).toBe(4);
  });
  it("rejects corrupted inputs and caps maximum outstanding liability", () => {
    for (const game of KEEPER_KEYS) {
      expect(() =>
        makeFrontierRound(game, 100, [], 1, undefined, () => NaN),
      ).toThrow();
      expect(() =>
        makeFrontierRound(game, 100, [], 1, undefined, (n) => n),
      ).toThrow();
      expect(() =>
        startFrontier(
          { ...initialSession(), balance: 1e12 - 100 },
          game,
          100,
          [],
        ),
      ).toThrow();
      const r = makeFrontierRound(game, 100, [], 1);
      expect(validFrontierRound({ ...r, draw: [] })).toBe(false);
      expect(validKeeperRound({ ...r, choice: [1] })).toBe(false);
      expect(validFrontierRound({ ...r, collected: true })).toBe(false);
      expect(validFrontierRound({ ...r, actions: [action("__proto__")] })).toBe(
        false,
      );
    }
    const s = startFrontier(
      initialSession(),
      "keeper_archive",
      100,
      [],
      () => 0,
    );
    expect(
      restoreSession(JSON.stringify({ ...s, balance: 1e12 - 100 })).notice,
    ).toBeTruthy();
  });
  it("adds only three web games", () => {
    expect(STATION_CATALOG).toHaveLength(34);
    for (const key of KEEPER_KEYS) {
      expect(PRACTICE_CATALOG.some((x) => x.key === key)).toBe(true);
      expect(STATION_CATALOG.some((x) => x.key === key)).toBe(false);
    }
  });
  it("draws10 independent archive values and five separate shuffles", () => {
    const asks: number[] = [];
    keeperDraw("keeper_archive", (n) => {
      asks.push(n);
      return 0;
    });
    expect(asks).toEqual(Array(10).fill(6));
    asks.length = 0;
    keeperDraw("keeper_passage", (n) => {
      asks.push(n);
      return 0;
    });
    expect(asks).toEqual(Array(5).fill([4, 3, 2]).flat());
  });
});
