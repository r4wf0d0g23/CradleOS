/** Original Frontier practice slots. Pure rules; no wallet/network or adaptive odds. */
export const FLEET_KEYS = [
  "slot_scrapyard",
  "slot_wreckways",
  "slot_reactor",
  "slot_feral",
  "slot_vault",
  "slot_gatecrash",
  "slot_drones",
  "slot_eclipse",
] as const;
export type FleetKey = (typeof FLEET_KEYS)[number];
export const isFleet = (key: string): key is FleetKey =>
  (FLEET_KEYS as readonly string[]).includes(key);
export type FleetGame = {
  key: FleetKey;
  name: string;
  mechanic: string;
  feature: string;
  icon: number;
  accent: string;
  mode: "lines" | "ways" | "count" | "cluster" | "hold";
  rows: number;
  free: number;
  boost: number;
  stages: number;
  scale: number;
};
export const FLEET: Record<FleetKey, FleetGame> = {
  slot_scrapyard: {
    key: "slot_scrapyard",
    name: "Scrapyard Circuit",
    mechanic: "10 paylines",
    feature: "Wilds · 5 free spins",
    icon: 84180,
    accent: "#bc9c66",
    mode: "lines",
    rows: 3,
    free: 5,
    boost: 1,
    stages: 1,
    scale: 6257344,
  },
  slot_wreckways: {
    key: "slot_wreckways",
    name: "Wreckway 243",
    mechanic: "243 ways",
    feature: "6 free spins · 2×",
    icon: 81611,
    accent: "#76b3ae",
    mode: "ways",
    rows: 3,
    free: 6,
    boost: 2,
    stages: 1,
    scale: 1152213,
  },
  slot_reactor: {
    key: "slot_reactor",
    name: "Reactor Fall",
    mechanic: "8+ anywhere pays",
    feature: "Tumbles · 1–6×",
    icon: 88335,
    accent: "#e18244",
    mode: "count",
    rows: 4,
    free: 0,
    boost: 1,
    stages: 6,
    scale: 30747077,
  },
  slot_feral: {
    key: "slot_feral",
    name: "Feral Swarm",
    mechanic: "Connected clusters",
    feature: "5+ connected · 1–4×",
    icon: 72244,
    accent: "#a5b965",
    mode: "cluster",
    rows: 5,
    free: 0,
    boost: 1,
    stages: 4,
    scale: 12422698,
  },
  slot_vault: {
    key: "slot_vault",
    name: "Null Vault",
    mechanic: "Hold & respin",
    feature: "Lock 6 coins · reset 3",
    icon: 91209,
    accent: "#c497d0",
    mode: "hold",
    rows: 3,
    free: 0,
    boost: 1,
    stages: 1,
    scale: 36029283,
  },
  slot_gatecrash: {
    key: "slot_gatecrash",
    name: "Gatecrash",
    mechanic: "Expanding wild reels",
    feature: "5 free spins · 2×",
    icon: 84955,
    accent: "#c96b57",
    mode: "lines",
    rows: 3,
    free: 5,
    boost: 2,
    stages: 1,
    scale: 5119368,
  },
  slot_drones: {
    key: "slot_drones",
    name: "Drone Protocol",
    mechanic: "Sticky-wild feature",
    feature: "8 free spins · wilds stay",
    icon: 87848,
    accent: "#9ab8d0",
    mode: "lines",
    rows: 3,
    free: 8,
    boost: 1,
    stages: 1,
    scale: 2394927,
  },
  slot_eclipse: {
    key: "slot_eclipse",
    name: "Eclipse Routes",
    mechanic: "32–3,125 ways",
    feature: "Variable reels · 6 free spins",
    icon: 82425,
    accent: "#8e8cc8",
    mode: "ways",
    rows: 0,
    free: 6,
    boost: 2,
    stages: 1,
    scale: 482378,
  },
};
export const WILD = 7,
  SCATTER = 8,
  COIN = 9,
  EMPTY = 10;
export const BASE_POINTS = [8, 12, 18, 30, 50, 90, 160];
export const LINE_WEIGHTS = [24, 20, 16, 12, 9, 6, 4, 3, 6];
export const WAY_WEIGHTS = [24, 20, 16, 12, 9, 6, 7, 0, 6];
export const CLUSTER_WEIGHTS = [25, 20, 16, 13, 10, 9, 7, 0, 0];
export const GATE_WEIGHTS = [24, 20, 16, 12, 9, 6, 6, 1, 6];
export const COIN_POINTS = [1, 2, 5, 10, 25, 100, 500];
export const COIN_THRESHOLDS = [9000, 9600, 9800, 9900, 9980, 9999, 10000];
export const LINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 2],
];
export type SlotWin = {
  symbol: number;
  count: number;
  ways: number;
  cells: number[];
  points: number;
};
export type SlotFrame = {
  grid: number[][];
  original: number[][];
  wins: SlotWin[];
  kind: "spin" | "free" | "cascade" | "hold";
  index: number;
  remaining: number;
  multiplier: number;
  points: number;
  award: number;
  total: number;
  scatters: number;
  ways: number;
  coins: number[];
  label: string;
};
export type SlotReceipt = {
  version: 1;
  key: FleetKey;
  stake: number;
  draws: number[];
  frames: SlotFrame[];
  payout: number;
  capReached: boolean;
  cursor: number;
};
export type SlotRng = (bound: number) => number;
const integer = (n: unknown, min = 0, max = 1e12): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
export const weightsFor = (g: FleetGame) =>
  g.key === "slot_gatecrash"
    ? GATE_WEIGHTS
    : g.mode === "ways"
      ? WAY_WEIGHTS
      : g.mode === "count" || g.mode === "cluster"
        ? CLUSTER_WEIGHTS
        : LINE_WEIGHTS;
export function weightedSymbol(weights: number[], draw: SlotRng): number {
  let n = draw(weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < weights.length; i++) {
    if (n < weights[i]) return i;
    n -= weights[i];
  }
  throw Error("Invalid weighted draw.");
}
const pointValue = (symbol: number, n: number) =>
  BASE_POINTS[symbol] * ([0, 0, 0, 1, 3, 10][Math.min(n, 5)] ?? 0);
export function lineWins(grid: number[][]): SlotWin[] {
  return LINES.flatMap((line) => {
    let best: SlotWin | null = null;
    for (let s = 0; s < 7; s++) {
      let n = 0;
      const cells: number[] = [];
      for (let c = 0; c < 5; c++) {
        const v = grid[c][line[c]];
        if (v !== s && v !== WILD) break;
        n++;
        cells.push(c * 5 + line[c]);
      }
      const points = pointValue(s, n);
      if (points > 0 && (!best || points > best.points))
        best = { symbol: s, count: n, ways: 1, cells, points };
    }
    return best ? [best] : [];
  });
}
export function wayWins(grid: number[][]): SlotWin[] {
  const wins: SlotWin[] = [];
  for (let s = 0; s < 7; s++) {
    let n = 0,
      ways = 1;
    const cells: number[] = [];
    for (let c = 0; c < grid.length; c++) {
      const found = grid[c].flatMap((v, r) => (v === s ? [c * 5 + r] : []));
      if (!found.length) break;
      n++;
      ways *= found.length;
      cells.push(...found);
    }
    if (n >= 3)
      wins.push({
        symbol: s,
        count: n,
        ways,
        cells,
        points: pointValue(s, n) * ways,
      });
  }
  return wins;
}
export function groupWins(grid: number[][], connected: boolean): SlotWin[] {
  const wins: SlotWin[] = [],
    visited = new Set<number>();
  for (let c = 0; c < grid.length; c++)
    for (let r = 0; r < grid[c].length; r++) {
      const id = c * 5 + r,
        symbol = grid[c][r];
      if (symbol > 6 || visited.has(id)) continue;
      const cells: number[] = [];
      if (!connected) {
        for (let x = 0; x < grid.length; x++)
          for (let y = 0; y < grid[x].length; y++)
            if (grid[x][y] === symbol) {
              cells.push(x * 5 + y);
              visited.add(x * 5 + y);
            }
      } else {
        const todo = [id];
        visited.add(id);
        while (todo.length) {
          const v = todo.pop()!;
          cells.push(v);
          const x = Math.floor(v / 5),
            y = v % 5;
          for (const [nx, ny] of [
            [x - 1, y],
            [x + 1, y],
            [x, y - 1],
            [x, y + 1],
          ]) {
            const next = nx * 5 + ny;
            if (
              nx >= 0 &&
              nx < grid.length &&
              ny >= 0 &&
              ny < grid[nx].length &&
              !visited.has(next) &&
              grid[nx][ny] === symbol
            ) {
              visited.add(next);
              todo.push(next);
            }
          }
        }
      }
      const min = connected ? 5 : 8;
      if (cells.length >= min)
        wins.push({
          symbol,
          count: cells.length,
          ways: 1,
          cells,
          points: BASE_POINTS[symbol] * (cells.length - min + 1),
        });
    }
  return wins;
}
export function collapse(
  grid: number[][],
  removed: Set<number>,
  symbol: () => number,
): number[][] {
  return grid.map((col, c) => {
    const kept = col.filter((_, r) => !removed.has(c * 5 + r));
    return [
      ...Array.from({ length: col.length - kept.length }, symbol),
      ...kept,
    ];
  });
}
export const effectiveMultiplier = (g: FleetGame, points: number) =>
  (points * g.scale) / 1e8;
const paid = (stake: number, points: number, scale: number) =>
  Number((BigInt(stake) * BigInt(points) * BigInt(scale)) / 100000000n);
/** Generate one complete paid round once; cosmetic reveal cursor has no draw side effects. */
export function spinFleet(
  key: FleetKey,
  stake: number,
  source: SlotRng,
): SlotReceipt {
  if (!isFleet(key) || !integer(stake, 100, 100000))
    throw Error("Invalid slot stake or game.");
  const g = FLEET[key],
    draws: number[] = [],
    frames: SlotFrame[] = [];
  let totalPoints = 0;
  const draw = (bound: number) => {
    if (draws.length >= 4000) throw Error("Slot draw limit exceeded.");
    const n = source(bound);
    if (!integer(n, 0, bound - 1)) throw Error("Invalid slot random draw.");
    draws.push(n);
    return n;
  };
  const symbol = () => weightedSymbol(weightsFor(g), draw),
    grid = () =>
      Array.from({ length: 5 }, () =>
        Array.from({ length: g.rows || 2 + draw(4) }, symbol),
      );
  function append(
    board: number[][],
    wins: SlotWin[],
    kind: SlotFrame["kind"],
    index: number,
    remaining: number,
    multiplier: number,
    label: string,
    coins: number[] = [],
    extra = 0,
    original = board,
  ) {
    const points = wins.reduce((a, w) => a + w.points, 0) * multiplier + extra;
    totalPoints += points;
    const total = Math.min(stake * 2500, paid(stake, totalPoints, g.scale)),
      award = total - (frames[frames.length - 1]?.total ?? 0);
    frames.push({
      grid: board.map((c) => [...c]),
      original: original.map((c) => [...c]),
      wins,
      kind,
      index,
      remaining,
      multiplier,
      points,
      award,
      total,
      scatters: original.flat().filter((v) => v === SCATTER).length,
      ways:
        g.mode === "ways"
          ? board.reduce((a, c) => a * c.length, 1)
          : g.mode === "lines"
            ? 10
            : 0,
      coins: [...coins],
      label,
    });
  }
  if (g.mode === "hold") {
    const value = () => {
      const n = draw(10000);
      return COIN_POINTS[COIN_THRESHOLDS.findIndex((t) => n < t)];
    };
    const coins = Array.from({ length: 15 }, () =>
      draw(100) < 22 ? value() : 0,
    );
    const board = () =>
      Array.from({ length: 5 }, (_, c) =>
        Array.from({ length: 3 }, (_, r) => (coins[c * 3 + r] ? COIN : EMPTY)),
      );
    const locked = () => coins.filter((n) => n > 0).length;
    let remain = locked() >= 6 ? 3 : 0;
    append(
      board(),
      [],
      "spin",
      0,
      remain,
      1,
      remain ? "VAULT OPEN · 3 RESPINS" : "6 COINS OPEN THE VAULT",
      coins,
    );
    let index = 0;
    while (remain > 0 && locked() < 15) {
      let added = 0;
      for (let i = 0; i < 15; i++)
        if (!coins[i] && draw(100) < 12) {
          coins[i] = value();
          added++;
        }
      remain = added ? 3 : remain - 1;
      index++;
      if (index > 30) throw Error("Respin bound exceeded.");
      const done = remain === 0 || locked() === 15;
      append(
        board(),
        [],
        "hold",
        index,
        done ? 0 : remain,
        1,
        done
          ? locked() === 15
            ? "FULL VAULT · FIXED BONUS"
            : "VAULT COLLECTED"
          : added
            ? "NEW COIN · RESPINS RESET"
            : "RESPIN",
        coins,
        done
          ? coins.reduce((a, b) => a + b, 0) + (locked() === 15 ? 100 : 0)
          : 0,
      );
    }
    // A full initial board is already a completed feature.
    if (frames.length === 1 && locked() === 15)
      append(
        board(),
        [],
        "hold",
        1,
        0,
        1,
        "FULL VAULT · FIXED BONUS",
        coins,
        coins.reduce((a, b) => a + b, 0) + 100,
      );
  } else if (g.mode === "count" || g.mode === "cluster") {
    let board = grid();
    for (let stage = 0; stage < g.stages; stage++) {
      const wins = groupWins(board, g.mode === "cluster");
      append(
        board,
        wins,
        stage ? "cascade" : "spin",
        stage,
        0,
        stage + 1,
        wins.length
          ? stage === g.stages - 1
            ? "CHAIN LIMIT · COLLECT"
            : "CASCADE WIN"
          : "CHAIN COMPLETE",
      );
      if (!wins.length || stage === g.stages - 1) break;
      board = collapse(board, new Set(wins.flatMap((w) => w.cells)), symbol);
    }
  } else {
    const sticky = new Set<number>();
    let free = 0;
    for (let spin = 0; spin <= free; spin++) {
      let board = grid();
      if (spin && g.key === "slot_drones") {
        for (const id of sticky) board[Math.floor(id / 5)][id % 5] = WILD;
      }
      const original = board.map((c) => [...c]),
        scatters = board.flat().filter((n) => n === SCATTER).length;
      if (g.key === "slot_gatecrash")
        board = board.map((col) =>
          col.includes(WILD) ? col.map(() => WILD) : col,
        );
      if (spin && g.key === "slot_drones")
        board.forEach((col, c) =>
          col.forEach((n, r) => {
            if (n === WILD) sticky.add(c * 5 + r);
          }),
        );
      if (spin === 0 && scatters >= 3) free = g.free;
      append(
        board,
        g.mode === "ways" ? wayWins(board) : lineWins(board),
        spin ? "free" : "spin",
        spin,
        free - spin,
        spin ? g.boost : 1,
        spin
          ? `FREE SPIN ${spin}/${free}`
          : free
            ? `${free} FREE SPINS AWARDED`
            : "BASE SPIN",
        [],
        0,
        original,
      );
    }
  }
  return {
    version: 1,
    key,
    stake,
    draws,
    frames,
    payout: frames[frames.length - 1]?.total ?? 0,
    capReached: paid(stake, totalPoints, g.scale) > stake * 2500,
    cursor: 0,
  };
}
export function validSlotReceipt(value: unknown): value is SlotReceipt {
  try {
    const r = value as SlotReceipt;
    if (
      !r ||
      r.version !== 1 ||
      !isFleet(r.key) ||
      !integer(r.stake, 100, 100000) ||
      !Array.isArray(r.draws) ||
      r.draws.length > 4000 ||
      !Array.isArray(r.frames) ||
      r.frames.length < 1 ||
      r.frames.length > 32 ||
      !integer(r.cursor, 0, r.frames.length)
    )
      return false;
    const board = (v: unknown): v is number[][] =>
      Array.isArray(v) &&
      v.length === 5 &&
      v.every(
        (c) =>
          Array.isArray(c) &&
          c.length >= 2 &&
          c.length <= 5 &&
          c.every((n) => integer(n, 0, 10)),
      );
    if (
      r.frames.some(
        (f) =>
          !f ||
          !board(f.grid) ||
          !board(f.original) ||
          !Array.isArray(f.wins) ||
          f.wins.length > 25 ||
          f.wins.some(
            (w) => !w || !Array.isArray(w.cells) || w.cells.length > 25,
          ) ||
          !Array.isArray(f.coins) ||
          f.coins.length > 15 ||
          typeof f.label !== "string" ||
          f.label.length > 80,
      )
    )
      return false;
    let i = 0;
    const rebuilt = spinFleet(r.key, r.stake, () => r.draws[i++]);
    return (
      i === r.draws.length &&
      JSON.stringify({ ...rebuilt, cursor: r.cursor }) === JSON.stringify(r)
    );
  } catch {
    return false;
  }
}
