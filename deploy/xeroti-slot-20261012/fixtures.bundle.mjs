// deploy/xeroti-slot-20261012/fixtures.mjs
import fs from "node:fs";

// cradleos-dapp/src/lib/casinoSlotFleet.ts
var FLEET_KEYS = [
  "slot_scrapyard",
  "slot_wreckways",
  "slot_reactor",
  "slot_feral",
  "slot_vault",
  "slot_gatecrash",
  "slot_drones",
  "slot_eclipse",
  "slot_xeroti"
];
var isFleet = (key) => FLEET_KEYS.includes(key);
var FLEET = {
  slot_xeroti: {
    key: "slot_xeroti",
    name: "Xeroti Tidofiza",
    mechanic: "5+ connected symbols",
    feature: "Devouring cascades \xB7 1\u20134\xD7",
    icon: 91011,
    accent: "#ffaf79",
    mode: "cluster",
    rows: 5,
    free: 0,
    boost: 1,
    stages: 4,
    scale: 12422698
  },
  slot_scrapyard: {
    key: "slot_scrapyard",
    name: "Scrapyard Circuit",
    mechanic: "10 paylines",
    feature: "Wilds \xB7 5 free spins",
    icon: 84180,
    accent: "#bc9c66",
    mode: "lines",
    rows: 3,
    free: 5,
    boost: 1,
    stages: 1,
    scale: 6257344
  },
  slot_wreckways: {
    key: "slot_wreckways",
    name: "Wreckway 243",
    mechanic: "243 ways",
    feature: "6 free spins \xB7 2\xD7",
    icon: 81611,
    accent: "#76b3ae",
    mode: "ways",
    rows: 3,
    free: 6,
    boost: 2,
    stages: 1,
    scale: 1152213
  },
  slot_reactor: {
    key: "slot_reactor",
    name: "Reactor Fall",
    mechanic: "8+ anywhere pays",
    feature: "Tumbles \xB7 1\u20136\xD7",
    icon: 88335,
    accent: "#e18244",
    mode: "count",
    rows: 4,
    free: 0,
    boost: 1,
    stages: 6,
    scale: 30747077
  },
  slot_feral: {
    key: "slot_feral",
    name: "Feral Swarm",
    mechanic: "Connected clusters",
    feature: "5+ connected \xB7 1\u20134\xD7",
    icon: 72244,
    accent: "#a5b965",
    mode: "cluster",
    rows: 5,
    free: 0,
    boost: 1,
    stages: 4,
    scale: 12422698
  },
  slot_vault: {
    key: "slot_vault",
    name: "Null Vault",
    mechanic: "Hold & respin",
    feature: "Lock 6 coins \xB7 reset 3",
    icon: 91209,
    accent: "#c497d0",
    mode: "hold",
    rows: 3,
    free: 0,
    boost: 1,
    stages: 1,
    scale: 36029283
  },
  slot_gatecrash: {
    key: "slot_gatecrash",
    name: "Gatecrash",
    mechanic: "Expanding wild reels",
    feature: "5 free spins \xB7 2\xD7",
    icon: 84955,
    accent: "#c96b57",
    mode: "lines",
    rows: 3,
    free: 5,
    boost: 2,
    stages: 1,
    scale: 5119368
  },
  slot_drones: {
    key: "slot_drones",
    name: "Drone Protocol",
    mechanic: "Sticky-wild feature",
    feature: "8 free spins \xB7 wilds stay",
    icon: 87848,
    accent: "#9ab8d0",
    mode: "lines",
    rows: 3,
    free: 8,
    boost: 1,
    stages: 1,
    scale: 2394927
  },
  slot_eclipse: {
    key: "slot_eclipse",
    name: "Eclipse Routes",
    mechanic: "32\u20133,125 ways",
    feature: "Variable reels \xB7 6 free spins",
    icon: 82425,
    accent: "#8e8cc8",
    mode: "ways",
    rows: 0,
    free: 6,
    boost: 2,
    stages: 1,
    scale: 482378
  }
};
var WILD = 7;
var SCATTER = 8;
var COIN = 9;
var EMPTY = 10;
var BASE_POINTS = [8, 12, 18, 30, 50, 90, 160];
var LINE_WEIGHTS = [24, 20, 16, 12, 9, 6, 4, 3, 6];
var WAY_WEIGHTS = [24, 20, 16, 12, 9, 6, 7, 0, 6];
var CLUSTER_WEIGHTS = [25, 20, 16, 13, 10, 9, 7, 0, 0];
var GATE_WEIGHTS = [24, 20, 16, 12, 9, 6, 6, 1, 6];
var COIN_POINTS = [1, 2, 5, 10, 25, 100, 500];
var COIN_THRESHOLDS = [9e3, 9600, 9800, 9900, 9980, 9999, 1e4];
var LINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 2]
];
var integer = (n, min = 0, max = 1e12) => typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
var weightsFor = (g) => g.key === "slot_gatecrash" ? GATE_WEIGHTS : g.mode === "ways" ? WAY_WEIGHTS : g.mode === "count" || g.mode === "cluster" ? CLUSTER_WEIGHTS : LINE_WEIGHTS;
function weightedSymbol(weights, draw2) {
  let n = draw2(weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < weights.length; i++) {
    if (n < weights[i]) return i;
    n -= weights[i];
  }
  throw Error("Invalid weighted draw.");
}
var pointValue = (symbol, n) => BASE_POINTS[symbol] * ([0, 0, 0, 1, 3, 10][Math.min(n, 5)] ?? 0);
function lineWins(grid) {
  return LINES.flatMap((line) => {
    let best = null;
    for (let s = 0; s < 7; s++) {
      let n = 0;
      const cells = [];
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
function wayWins(grid) {
  const wins = [];
  for (let s = 0; s < 7; s++) {
    let n = 0, ways = 1;
    const cells = [];
    for (let c = 0; c < grid.length; c++) {
      const found = grid[c].flatMap((v, r) => v === s ? [c * 5 + r] : []);
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
        points: pointValue(s, n) * ways
      });
  }
  return wins;
}
function groupWins(grid, connected) {
  const wins = [], visited = /* @__PURE__ */ new Set();
  for (let c = 0; c < grid.length; c++)
    for (let r = 0; r < grid[c].length; r++) {
      const id = c * 5 + r, symbol = grid[c][r];
      if (symbol > 6 || visited.has(id)) continue;
      const cells = [];
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
          const v = todo.pop();
          cells.push(v);
          const x = Math.floor(v / 5), y = v % 5;
          for (const [nx, ny] of [
            [x - 1, y],
            [x + 1, y],
            [x, y - 1],
            [x, y + 1]
          ]) {
            const next = nx * 5 + ny;
            if (nx >= 0 && nx < grid.length && ny >= 0 && ny < grid[nx].length && !visited.has(next) && grid[nx][ny] === symbol) {
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
          points: BASE_POINTS[symbol] * (cells.length - min + 1)
        });
    }
  return wins;
}
function collapse(grid, removed, symbol) {
  return grid.map((col, c) => {
    const kept = col.filter((_, r) => !removed.has(c * 5 + r));
    return [
      ...Array.from({ length: col.length - kept.length }, symbol),
      ...kept
    ];
  });
}
var paid = (stake, points, scale) => Number(BigInt(stake) * BigInt(points) * BigInt(scale) / 100000000n);
function spinFleet(key, stake, source) {
  if (!isFleet(key) || !integer(stake, 100, 1e5))
    throw Error("Invalid slot stake or game.");
  const g = FLEET[key], draws = [], frames = [];
  let totalPoints = 0;
  const draw2 = (bound) => {
    if (draws.length >= 4e3) throw Error("Slot draw limit exceeded.");
    const n = source(bound);
    if (!integer(n, 0, bound - 1)) throw Error("Invalid slot random draw.");
    draws.push(n);
    return n;
  };
  const symbol = () => weightedSymbol(weightsFor(g), draw2), grid = () => Array.from(
    { length: 5 },
    () => Array.from({ length: g.rows || 2 + draw2(4) }, symbol)
  );
  function append(board, wins, kind, index, remaining, multiplier, label, coins = [], extra = 0, original = board) {
    const points = wins.reduce((a, w) => a + w.points, 0) * multiplier + extra;
    totalPoints += points;
    const total = Math.min(stake * 2500, paid(stake, totalPoints, g.scale)), award = total - (frames[frames.length - 1]?.total ?? 0);
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
      ways: g.mode === "ways" ? board.reduce((a, c) => a * c.length, 1) : g.mode === "lines" ? 10 : 0,
      coins: [...coins],
      label
    });
  }
  if (g.mode === "hold") {
    const value = () => {
      const n = draw2(1e4);
      return COIN_POINTS[COIN_THRESHOLDS.findIndex((t) => n < t)];
    };
    const coins = Array.from(
      { length: 15 },
      () => draw2(100) < 22 ? value() : 0
    );
    const board = () => Array.from(
      { length: 5 },
      (_, c) => Array.from({ length: 3 }, (_2, r) => coins[c * 3 + r] ? COIN : EMPTY)
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
      remain ? "VAULT OPEN \xB7 3 RESPINS" : "6 COINS OPEN THE VAULT",
      coins
    );
    let index = 0;
    while (remain > 0 && locked() < 15) {
      let added = 0;
      for (let i = 0; i < 15; i++)
        if (!coins[i] && draw2(100) < 12) {
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
        done ? locked() === 15 ? "FULL VAULT \xB7 FIXED BONUS" : "VAULT COLLECTED" : added ? "NEW COIN \xB7 RESPINS RESET" : "RESPIN",
        coins,
        done ? coins.reduce((a, b) => a + b, 0) + (locked() === 15 ? 100 : 0) : 0
      );
    }
    if (frames.length === 1 && locked() === 15)
      append(
        board(),
        [],
        "hold",
        1,
        0,
        1,
        "FULL VAULT \xB7 FIXED BONUS",
        coins,
        coins.reduce((a, b) => a + b, 0) + 100
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
        wins.length ? stage === g.stages - 1 ? "CHAIN LIMIT \xB7 COLLECT" : "CASCADE WIN" : "CHAIN COMPLETE"
      );
      if (!wins.length || stage === g.stages - 1) break;
      board = collapse(board, new Set(wins.flatMap((w) => w.cells)), symbol);
    }
  } else {
    const sticky = /* @__PURE__ */ new Set();
    let free = 0;
    for (let spin = 0; spin <= free; spin++) {
      let board = grid();
      if (spin && g.key === "slot_drones") {
        for (const id of sticky) board[Math.floor(id / 5)][id % 5] = WILD;
      }
      const original = board.map((c) => [...c]), scatters = board.flat().filter((n) => n === SCATTER).length;
      if (g.key === "slot_gatecrash")
        board = board.map(
          (col) => col.includes(WILD) ? col.map(() => WILD) : col
        );
      if (spin && g.key === "slot_drones")
        board.forEach(
          (col, c) => col.forEach((n, r) => {
            if (n === WILD) sticky.add(c * 5 + r);
          })
        );
      if (spin === 0 && scatters >= 3) free = g.free;
      append(
        board,
        g.mode === "ways" ? wayWins(board) : lineWins(board),
        spin ? "free" : "spin",
        spin,
        free - spin,
        spin ? g.boost : 1,
        spin ? `FREE SPIN ${spin}/${free}` : free ? `${free} FREE SPINS AWARDED` : "BASE SPIN",
        [],
        0,
        original
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
    cursor: 0
  };
}

// cradleos-dapp/src/lib/casinoExpanded.ts
var EXPANDED_GAMES = [
  "limbo",
  "crash",
  "diamonds",
  "keno",
  "sicbo",
  "double_dice",
  "baccarat",
  "three_card_poker",
  "dragon_tiger",
  "under_over_7",
  "ore_refine",
  "risk_wheel",
  "money_wheel",
  "andar_bahar",
  "scratch_cards",
  "chuck_a_luck",
  "red_dog"
];
var RISK_TABLES = [
  [
    ...Array(6).fill(0),
    ...Array(9).fill(12e3),
    ...Array(4).fill(14e3),
    3e4
  ],
  [...Array(12).fill(0), ...Array(5).fill(12e3), 16e3, 16e3, 1e5],
  [...Array(14).fill(0), ...Array(4).fill(11e3), 13e3, 135e3]
];
var MONEY_TABLE = [
  ...Array(24).fill(0),
  ...Array(18).fill(11e3),
  ...Array(8).fill(12e3),
  16e3,
  16e3,
  16e3,
  18e4
];
var KENO_TABLE = [
  [0, 38500],
  [0, 5500, 13e4],
  [0, 0, 48e3, 25e4],
  [0, 0, 23e3, 92e3, 47e4],
  [0, 0, 0, 72e3, 295e3, 295e4],
  [0, 0, 0, 32e3, 13e4, 97e4, 97e5]
];
var ORE_CUM = [
  [300, 4140, 9500],
  [800, 5367, 9200],
  [1500, 7550, 9e3],
  [2500, 8885, 9500],
  [4e3, 8929, 9600]
];
var ORE_BPS = [
  [0, 8e3, 10500, 2e4],
  [0, 5e3, 11e3, 4e4],
  [0, 3e3, 13e3, 6e4],
  [0, 2e3, 15e3, 15e4],
  [0, 1e3, 18e3, 2e5]
];
var SCRATCH_BPS = [0, 15e3, 3e4, 8e4, 2e5, 1e6];
var integerIn = (x, lo, hi) => typeof x === "number" && Number.isSafeInteger(x) && x >= lo && x <= hi;
function check(x, lo, hi, label) {
  if (!integerIn(x, lo, hi)) throw Error(`Choose a valid ${label}.`);
  return x;
}
function shuffle(a, rng2) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng2(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function threeRank(cards) {
  const r = cards.map((c) => c % 13).sort((a, b) => a - b), flush = cards.every(
    (c) => Math.floor(c / 13) === Math.floor(cards[0] / 13)
  );
  const straight = r[1] === r[0] + 1 && r[2] === r[1] + 1 || r[0] === 0 && r[1] === 11 && r[2] === 12;
  return flush && straight ? 5 : r[0] === r[2] ? 4 : straight ? 3 : flush ? 2 : new Set(r).size === 2 ? 1 : 0;
}
var threeHigh = (a) => Math.max(...a.map((c) => c % 13 === 0 ? 13 : c % 13));
function threeBps(p, d) {
  const pr = threeRank(p), dr = threeRank(d), diff = pr - dr || threeHigh(p) - threeHigh(d);
  return diff < 0 ? 0 : diff === 0 ? 1e4 : dr === 0 && threeHigh(d) < 11 ? 17500 : [2e4, 2e4, 2e4, 3e4, 5e4, 6e4][pr];
}
function redDogBps(a, b, c) {
  const diff = Math.abs(a - b);
  return diff === 0 ? c === a ? 12e4 : 1e4 : diff === 1 ? 1e4 : c > Math.min(a, b) && c < Math.max(a, b) ? [0, 6e4, 5e4, 4e4, 3e4][diff - 1] ?? 2e4 : 0;
}
function bankerDraws(score, third) {
  return third === null ? score <= 5 : score <= 2 || score === 3 && third !== 8 || score === 4 && third >= 2 && third <= 7 || score === 5 && third >= 4 && third <= 7 || score === 6 && (third === 6 || third === 7);
}
var baccaratScore = (a) => a.reduce((s, c) => s + (c % 13 >= 9 ? 0 : c % 13 + 1), 0) % 10;
function expandedOutcome(game, choice, source) {
  const rng2 = (n) => check(source(n), 0, n - 1, "random draw"), side = choice.side ?? 0, target = choice.target ?? 2;
  let values = [], bps = 0, label = "";
  const dice = (n) => Array.from({ length: n }, () => rng2(6) + 1);
  const deck = () => shuffle(
    Array.from({ length: 52 }, (_, i) => i),
    rng2
  );
  switch (game) {
    case "limbo":
    case "crash": {
      check(target, 101, 1e5, "target from 1.01\xD7 to 1,000\xD7");
      const roll = rng2(1e3) * 1e3 + rng2(1e3) + 1, crash = Math.min(1e7, Math.floor(98e8 / roll)), goal = target * 100;
      values = [crash, goal];
      bps = crash >= goal ? goal : 0;
      label = `${(crash / 1e4).toFixed(2)}\xD7 limit \xB7 ${(goal / 1e4).toFixed(2)}\xD7 target`;
      break;
    }
    case "diamonds": {
      values = Array.from({ length: 5 }, () => rng2(7));
      const best = Math.max(
        ...Array.from(
          { length: 7 },
          (_, i) => values.filter((v) => v === i).length
        )
      );
      bps = best === 5 ? 5e6 : best === 4 ? 3e5 : best === 3 ? 25500 : 0;
      label = `${best} matching signals`;
      break;
    }
    case "keno": {
      const picks = choice.picks ?? [];
      if (picks.length < 1 || picks.length > 6 || new Set(picks).size !== picks.length || picks.some((n) => !integerIn(n, 1, 40)))
        throw Error("Select 1\u20136 distinct numbers.");
      const drawn = shuffle(
        Array.from({ length: 40 }, (_, i) => i + 1),
        rng2
      ).slice(0, 10), hits = picks.filter((n) => drawn.includes(n)).length;
      values = [picks.length, ...picks, ...drawn];
      bps = KENO_TABLE[picks.length - 1][hits];
      label = `${hits} of ${picks.length} matched`;
      break;
    }
    case "sicbo": {
      check(side, 0, 4, "bet type");
      if (side === 2 || side === 3) check(target, 1, 6, "die face");
      values = dice(3);
      const sum2 = values.reduce((a, b) => a + b, 0), trip = new Set(values).size === 1, hits = values.filter((v) => v === target).length;
      bps = side === 0 ? !trip && sum2 <= 10 ? 2e4 : 0 : side === 1 ? !trip && sum2 >= 11 ? 2e4 : 0 : side === 2 ? hits ? (hits + 1) * 1e4 : 0 : side === 3 ? trip && hits === 3 ? 18e5 : 0 : trip ? 3e5 : 0;
      label = `${values.join(" + ")} = ${sum2}`;
      break;
    }
    case "double_dice":
    case "under_over_7": {
      check(side, 0, game === "double_dice" ? 4 : 2, "bet type");
      if (side === 4) check(target, 2, 12, "sum");
      values = dice(2);
      const sum2 = values[0] + values[1];
      bps = game === "under_over_7" ? side === 0 && sum2 < 7 || side === 2 && sum2 > 7 ? 23200 : side === 1 && sum2 === 7 ? 57e3 : 0 : side === 0 && sum2 < 7 || side === 1 && sum2 > 7 ? 23e3 : side === 2 && sum2 === 7 || side === 3 && values[0] === values[1] ? 55e3 : side === 4 && sum2 === target ? Math.floor(342e3 / (target <= 7 ? target - 1 : 13 - target)) : 0;
      label = `${values.join(" + ")} = ${sum2}`;
      break;
    }
    case "chuck_a_luck": {
      check(target, 1, 6, "die face");
      values = dice(3);
      const n = values.filter((v) => v === target).length;
      bps = [0, 19e3, 37e3, 12e4][n];
      label = `${n} matched \xB7 ${values.join(" / ")}`;
      break;
    }
    case "baccarat": {
      check(side, 0, 2, "bet side");
      const d = deck(), p = [d[0], d[2]], b = [d[1], d[3]];
      let cursor = 4, third = null;
      if (baccaratScore(p) < 8 && baccaratScore(b) < 8) {
        if (baccaratScore(p) <= 5) {
          const c = d[cursor++];
          p.push(c);
          third = c % 13 >= 9 ? 0 : c % 13 + 1;
        }
        if (bankerDraws(baccaratScore(b), third)) b.push(d[cursor]);
      }
      const ps = baccaratScore(p), bs = baccaratScore(b), winner = ps === bs ? 2 : ps > bs ? 0 : 1;
      bps = winner === side ? [2e4, 19500, 9e4][side] : winner === 2 && side !== 2 ? 1e4 : 0;
      values = [...p, -1, ...b];
      label = `Player ${ps} \xB7 Banker ${bs}`;
      break;
    }
    case "three_card_poker": {
      const d = deck(), p = [d[0], d[2], d[4]], b = [d[1], d[3], d[5]];
      values = [...p, -1, ...b];
      bps = threeBps(p, b);
      label = `${["High card", "Pair", "Flush", "Straight", "Three of a kind", "Straight flush"][threeRank(p)]} \xB7 ${bps === 1e4 ? "push" : bps ? "wins" : "dealer wins"}`;
      break;
    }
    case "dragon_tiger": {
      check(side, 0, 2, "bet side");
      const a = rng2(52), offset = rng2(51), b = offset < a ? offset : offset + 1;
      values = [Math.floor(a / 4), Math.floor(b / 4)];
      const winner = values[0] === values[1] ? 2 : values[0] > values[1] ? 0 : 1;
      bps = winner === side ? side === 2 ? 9e4 : 2e4 : winner === 2 ? 5e3 : 0;
      label = winner === 2 ? "Tie \xB7 side bets return half" : winner === 0 ? "Dragon wins" : "Tiger wins";
      break;
    }
    case "red_dog": {
      values = Array.from({ length: 3 }, () => rng2(13) + 1);
      bps = redDogBps(values[0], values[1], values[2]);
      label = bps === 1e4 ? "Push" : bps ? "Inside the spread" : "Outside the spread";
      break;
    }
    case "risk_wheel": {
      check(side, 0, 2, "risk profile");
      const segment = rng2(20);
      values = [segment, side];
      bps = RISK_TABLES[side][segment];
      label = `${bps / 1e4}\xD7 sector`;
      break;
    }
    case "money_wheel": {
      values = [rng2(54)];
      bps = MONEY_TABLE[values[0]];
      label = `${bps / 1e4}\xD7 sector`;
      break;
    }
    case "ore_refine": {
      check(side, 0, 4, "intensity");
      const n = rng2(1e4), i = ORE_CUM[side].findIndex((t) => n < t), outcome = i < 0 ? 3 : i;
      values = [outcome, side];
      bps = ORE_BPS[side][outcome];
      label = `${["Slag", "Partial recovery", "Refined yield", "Bonus yield"][outcome]} \xB7 ${bps / 1e4}\xD7`;
      break;
    }
    case "andar_bahar": {
      check(side, 0, 1, "side");
      const joker = rng2(13), log = [];
      let winner = 0;
      for (let i = 0; i < 52; i++) {
        const c = rng2(13);
        log.push(c);
        if (c === joker) {
          winner = i % 2;
          break;
        }
      }
      values = [joker, ...log];
      bps = side === winner ? [18800, 2e4][side] : 0;
      label = `${winner === 0 ? "Andar" : "Bahar"} \xB7 ${log[log.length - 1] === joker ? `${log.length} cards` : "52-card limit"}`;
      break;
    }
    case "scratch_cards": {
      const n = rng2(1e4), tier = [7e3, 9e3, 9700, 9950, 9980, 1e4].findIndex((t) => n < t);
      bps = SCRATCH_BPS[tier];
      let grid = [0, 0, 1, 1, 2, 2, 3, 4, 5];
      if (tier > 0) {
        const symbol = tier - 1, other = [0, 1, 2, 3, 4, 5].filter((n2) => n2 !== symbol);
        grid = [symbol, symbol, symbol, ...other, other[0]];
      }
      values = shuffle(grid, rng2);
      label = tier ? `Three matching symbols \xB7 ${bps / 1e4}\xD7` : "No triple";
      break;
    }
    default:
      throw Error("Unknown practice game.");
  }
  return { values, bps, label };
}

// cradleos-dapp/src/lib/casinoPractice.ts
var PRACTICE_GAMES = [
  "slots",
  "blackjack",
  "roulette",
  "coinflip",
  "dice",
  "wheel",
  "plinko",
  "war",
  ...EXPANDED_GAMES,
  ...FLEET_KEYS
];
var START_CHIPS = 1e6;
var MAX_BET = 1e5;
var SLOT_STRIP = [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 6];
var SLOT_BPS = [36e3, 5e4, 6e4, 12e4, 18e4, 36e4, 6e5];
var WHEEL_BPS = [
  ...Array(12).fill(0),
  ...Array(5).fill(12e3),
  16e3,
  16e3,
  1e5
];
var PLINKO_BPS = [
  5e4,
  2e4,
  15e3,
  12e3,
  1e4,
  8500,
  9e3,
  8500,
  1e4,
  12e3,
  15e3,
  2e4,
  5e4
];
var RED = [
  1,
  3,
  5,
  7,
  9,
  12,
  14,
  16,
  18,
  19,
  21,
  23,
  25,
  27,
  30,
  32,
  34,
  36
];
var integer2 = (n, min = 0, max = 1e12) => typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
function initialPractice() {
  return {
    version: 1,
    balance: START_CHIPS,
    sequence: 0,
    history: [],
    hand: null
  };
}
var randomInt = (bound) => {
  if (!integer2(bound, 1, 65536)) throw Error("Invalid random range.");
  const ceiling = Math.floor(4294967296 / bound) * bound;
  const a = new Uint32Array(1);
  do {
    crypto.getRandomValues(a);
  } while (a[0] >= ceiling);
  return a[0] % bound;
};
function draw(rng2, bound) {
  const n = rng2(bound);
  if (!integer2(n, 0, bound - 1)) throw Error("Invalid random draw.");
  return n;
}
function cardTotal(cards) {
  let aces = 0, total = 0;
  for (const c of cards) {
    const r = c % 13;
    total += r === 0 ? 11 : Math.min(r + 1, 10);
    if (r === 0) aces++;
  }
  while (total > 21 && aces-- > 0) total -= 10;
  return total;
}
function shuffledDeck(rng2 = randomInt) {
  const a = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = draw(rng2, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function money(stake, bps) {
  return Math.floor(stake * bps / 1e4);
}
function settle(s, game, stake, payout, values, label) {
  const balance = s.balance + payout;
  if (!integer2(balance) || !integer2(payout))
    throw Error("Practice balance limit reached. Reset your practice session.");
  const sequence = s.sequence + 1;
  return {
    ...s,
    balance,
    sequence,
    hand: null,
    history: [
      { id: sequence, game, stake, payout, values, label },
      ...s.history
    ].slice(0, 20)
  };
}
function playPractice(s, game, stake, choice = {}, rng2 = randomInt) {
  if (s.hand) throw Error("Finish your blackjack hand first.");
  if (isFleet(game))
    throw Error("Fleet slots require the saved-feature session engine.");
  if (!PRACTICE_GAMES.includes(game) || !integer2(stake, 100, MAX_BET))
    throw Error("Invalid practice stake or game.");
  if (stake > s.balance)
    throw Error("Not enough play chips. Refill from the lobby.");
  const next = { ...s, balance: s.balance - stake };
  let values = [], bps = 0, label = "";
  if (EXPANDED_GAMES.includes(game)) {
    const outcome = expandedOutcome(game, choice, rng2);
    return settle(
      next,
      game,
      stake,
      money(stake, outcome.bps),
      outcome.values,
      outcome.label
    );
  }
  switch (game) {
    case "blackjack": {
      const deck = shuffledDeck(rng2);
      const hand = {
        deck,
        cursor: 4,
        player: [deck[0], deck[2]],
        dealer: [deck[1], deck[3]],
        stake
      };
      const p = cardTotal(hand.player), d = cardTotal(hand.dealer);
      if (p === 21 || d === 21)
        return settle(
          next,
          game,
          stake,
          p === 21 ? d === 21 ? stake : money(stake, 25e3) : 0,
          [...hand.player, ...hand.dealer],
          p === d ? "Push" : p === 21 ? "Blackjack" : "Dealer blackjack"
        );
      return { ...next, hand };
    }
    case "slots":
      values = Array.from({ length: 3 }, () => SLOT_STRIP[draw(rng2, 16)]);
      bps = values.every((v) => v === values[0]) ? SLOT_BPS[values[0]] : new Set(values).size === 2 ? 18e3 : 0;
      label = bps ? "Reel match" : "No match";
      break;
    case "coinflip": {
      if (choice.side !== 0 && choice.side !== 1)
        throw Error("Choose heads or tails.");
      values = [draw(rng2, 2)];
      bps = values[0] === choice.side ? 19600 : 0;
      label = values[0] === 0 ? "Heads" : "Tails";
      break;
    }
    case "dice": {
      const target = choice.target ?? 50, over = choice.over ?? true;
      if (!integer2(target, 2, 98)) throw Error("Target must be 2\u201398.");
      const chance = over ? 100 - target : target - 1;
      if (chance < 2 || chance > 96) throw Error("Win chance must be 2\u201396%.");
      values = [draw(rng2, 100) + 1];
      const win = over ? values[0] > target : values[0] < target;
      const payout = win ? Math.floor(stake * 98 / chance) : 0;
      return settle(next, game, stake, payout, values, `Rolled ${values[0]}`);
    }
    case "roulette": {
      const side = choice.side ?? 0;
      if (!integer2(side, 0, 2) || side === 2 && !integer2(choice.target, 0, 36))
        throw Error("Choose a color or number.");
      values = [draw(rng2, 37)];
      const n = values[0];
      bps = side === 2 ? n === choice.target ? 36e4 : 0 : n !== 0 && (RED.includes(n) ? 0 : 1) === side ? 2e4 : 0;
      label = `${n} \xB7 ${n === 0 ? "Zero" : RED.includes(n) ? "Red" : "Black"}`;
      break;
    }
    case "wheel":
      values = [draw(rng2, 20)];
      bps = WHEEL_BPS[values[0]];
      label = `${bps / 1e4}\xD7 sector`;
      break;
    case "plinko":
      values = Array.from({ length: 12 }, () => draw(rng2, 2));
      bps = PLINKO_BPS[values.reduce((a, b) => a + b, 0)];
      label = `${bps / 1e4}\xD7 landing`;
      break;
    case "war":
      values = [draw(rng2, 13), draw(rng2, 13)];
      bps = values[0] > values[1] ? 2e4 : values[0] === values[1] ? 5e3 : 0;
      label = values[0] > values[1] ? "Your card wins" : values[0] === values[1] ? "Tie \xB7 half returned" : "Dealer wins";
      break;
  }
  return settle(next, game, stake, money(stake, bps), values, label);
}

// cradleos-dapp/src/lib/casinoFrontier.ts
var frontierPending = (s) => !!s && !s.current.collected;

// cradleos-dapp/src/lib/casinoCraps.ts
var POINTS = [4, 5, 6, 8, 9, 10];
var HARD = [4, 6, 8, 10];
var CRAPS_KEYS = [
  "pass",
  "dont",
  "passOdds",
  "dontOdds",
  "field",
  ...POINTS.map((n) => `place${n}`),
  ...HARD.map((n) => `hard${n}`)
];
function crapsReserve(t) {
  if (!t) return 0;
  return Object.entries(t.bets).reduce((total, [key, amount]) => {
    const stake = amount ?? 0, n = Number(key.replace(/^(place|hard)/, ""));
    let profit = stake;
    if (key === "field") profit = stake * 3;
    if (key.startsWith("hard")) profit = stake * (n === 6 || n === 8 ? 9 : 7);
    if (key.startsWith("place"))
      profit = stake * (n === 4 || n === 10 ? 9 : 7) / (n === 6 || n === 8 ? 6 : 5);
    if (key === "passOdds")
      profit = stake * (t.point === 4 || t.point === 10 ? 2 : t.point === 5 || t.point === 9 ? 3 : 6) / (t.point === 4 || t.point === 10 ? 1 : t.point === 5 || t.point === 9 ? 2 : 5);
    if (key === "dontOdds")
      profit = stake * (t.point === 4 || t.point === 10 ? 1 : t.point === 5 || t.point === 9 ? 2 : 5) / (t.point === 4 || t.point === 10 ? 2 : t.point === 5 || t.point === 9 ? 3 : 6);
    return total + stake + profit;
  }, 0);
}

// cradleos-dapp/src/lib/casinoBlackjackTable.ts
var natural = (h) => !h.split && h.cards.length === 2 && cardTotal(h.cards) === 21;
var integer3 = (n, min, max) => typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
var take = (t) => {
  if (t.cursor >= 52) throw Error("Practice shoe exhausted.");
  return t.deck[t.cursor++];
};
function advance(t) {
  const active = t.hands.findIndex((h) => !h.done);
  if (active >= 0) {
    t.active = active;
    return t;
  }
  if (t.hands.some((h) => !natural(h) && cardTotal(h.cards) <= 21))
    while (cardTotal(t.dealer) < 17) t.dealer.push(take(t));
  t.active = -1;
  t.complete = true;
  return t;
}
function dealTable(seats, stake, balance, rng2 = randomInt) {
  if (!integer3(seats, 1, 3) || !integer3(stake, 100, MAX_BET))
    throw Error("Choose 1\u20133 seats and a valid per-seat stake.");
  const debit = seats * stake;
  if (balance < debit) throw Error("Not enough chips for all seats.");
  return { table: startTable(shuffledDeck(rng2), seats, stake), debit };
}
function startTable(deck, seats, stake) {
  const t = {
    deck,
    seats,
    baseStake: stake,
    actions: [],
    cursor: 0,
    dealer: [],
    hands: Array.from({ length: seats }, (_, seat) => ({
      seat,
      cards: [],
      stake,
      split: false,
      splitAce: false,
      done: false
    })),
    active: 0,
    complete: false
  };
  for (let card = 0; card < 2; card++) {
    for (const h of t.hands) h.cards.push(take(t));
    t.dealer.push(take(t));
  }
  for (const h of t.hands) h.done = natural(h);
  if (cardTotal(t.dealer) === 21) {
    t.hands.forEach((h) => h.done = true);
    t.active = -1;
    t.complete = true;
  } else advance(t);
  return t;
}
function tableReturns(t) {
  if (!t.complete) throw Error("Finish every hand first.");
  const dealer = cardTotal(t.dealer), dealerNatural = t.dealer.length === 2 && dealer === 21;
  return t.hands.map((h) => {
    const p = cardTotal(h.cards);
    if (natural(h)) return dealerNatural ? h.stake : Math.floor(h.stake * 2.5);
    if (p > 21 || dealerNatural) return 0;
    return dealer > 21 || p > dealer ? h.stake * 2 : p === dealer ? h.stake : 0;
  });
}

// cradleos-dapp/src/lib/casinoSessions.ts
var PROFILES = {
  Classic: [
    13e5,
    6e4,
    3e4,
    16e3,
    12e3,
    5e3,
    4851,
    5e3,
    12e3,
    16e3,
    3e4,
    6e4,
    13e5
  ],
  Low: PLINKO_BPS,
  Medium: [
    1e6,
    1e5,
    3e4,
    15e3,
    11e3,
    8500,
    0,
    8500,
    11e3,
    15e3,
    3e4,
    1e5,
    1e6
  ],
  High: [
    5e6,
    5e5,
    5e4,
    1e4,
    5e3,
    1e3,
    0,
    1e3,
    5e3,
    1e4,
    5e4,
    5e5,
    5e6
  ]
};
var sum = (xs) => xs.reduce((a, b) => a + b, 0);
var integer4 = (n, min = 0, max = 1e12) => typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
var validStake = (n) => integer4(n, 100, MAX_BET);
var base = (s) => ({
  version: 1,
  balance: s.balance,
  sequence: s.sequence,
  history: s.history,
  hand: s.hand
});
var wrap = (s) => ({
  ...s,
  version: 2,
  table: null,
  pack: null
});
var initialSession = () => wrap(initialPractice());
var pendingSlot = (s) => !!s.pack?.slot && s.pack.slot.cursor < s.pack.slot.frames.length;
var pendingSpinRun = (s) => !!s.spinRun && !s.spinRun.stopped && s.spinRun.paid < s.spinRun.planned;
var pendingClassicSpin = (s) => s.spinRun?.game === "slots" && s.spinRun.shown < s.spinRun.paid;
var scratchRevealed = (s) => s.pack?.game === "scratch_cards" ? s.pack.revealed ?? s.pack.rounds.map((_, i) => i) : [];
var pendingScratch = (s) => s.pack?.game === "scratch_cards" && scratchRevealed(s).length < s.pack.rounds.length;
var activeSession = (s) => frontierPending(s.frontier) || !!s.craps?.pending || !!s.hand || !!s.table || pendingSlot(s) || pendingClassicSpin(s) || pendingScratch(s) || pendingSpinRun(s);
var packTotal = (p, key) => sum(p.rounds.map((r) => r[key]));
function rouletteBps(w, n) {
  if (w.kind === "straight") return n === w.value ? 36e4 : 0;
  if (n === 0) return 0;
  const yes = w.kind === "color" ? (RED.includes(n) ? 0 : 1) === w.value : w.kind === "parity" ? n % 2 === w.value : w.kind === "range" ? Math.floor((n - 1) / 18) === w.value : w.kind === "dozen" ? Math.floor((n - 1) / 12) === w.value : (n - 1) % 3 === w.value;
  return yes ? w.kind === "dozen" || w.kind === "column" ? 3e4 : 2e4 : 0;
}
function wagerLabel(w) {
  if (w.kind === "straight") return String(w.value);
  return {
    color: ["Red", "Black"],
    parity: ["Even", "Odd"],
    range: ["1\u201318", "19\u201336"],
    dozen: ["1st dozen", "2nd dozen", "3rd dozen"],
    column: ["Column 1", "Column 2", "Column 3"]
  }[w.kind][w.value];
}
function validWagers(ws) {
  const maxima = {
    straight: 36,
    color: 1,
    parity: 1,
    range: 1,
    dozen: 2,
    column: 2
  };
  return Array.isArray(ws) && ws.length > 0 && ws.length <= 49 && new Set(ws.map((w) => `${w.kind}:${w.value}`)).size === ws.length && ws.every(
    (w) => w && Object.prototype.hasOwnProperty.call(maxima, w.kind) && integer4(w.value, 0, maxima[w.kind]) && validStake(w.stake)
  );
}
function validTickets(ts, draft = false) {
  return Array.isArray(ts) && ts.length >= 1 && ts.length <= 4 && ts.every(
    (t) => t && validStake(t.stake) && Array.isArray(t.picks) && t.picks.length >= (draft ? 0 : 1) && t.picks.length <= 6 && new Set(t.picks).size === t.picks.length && t.picks.every((n) => integer4(n, 1, 40))
  );
}
function drawNumbers(size, count, rng2) {
  const pool = Array.from({ length: size }, (_, i) => i + 1);
  for (let i = size - 1; i > 0; i--) {
    const j = rng2(i + 1);
    if (!integer4(j, 0, i)) throw Error("Invalid random draw.");
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
var money2 = (stake, bps) => Math.floor(stake * bps / 1e4);
function ensureFree(s) {
  if (activeSession(s)) throw Error("Finish the current round first.");
}
function settle2(s, p) {
  const stake = packTotal(p, "stake"), payout = packTotal(p, "payout");
  if (!integer4(stake) || s.balance < stake)
    throw Error("Not enough chips for the total stake.");
  const balance = s.balance - stake + payout;
  if (!integer4(balance + crapsReserve(s.craps)) || !integer4(s.sequence + p.rounds.length))
    throw Error("Practice balance limit reached.");
  const rounds = p.rounds.map((r, i) => ({ ...r, id: s.sequence + i + 1 }));
  return {
    ...s,
    notice: void 0,
    spinRun: void 0,
    balance,
    sequence: s.sequence + rounds.length,
    hand: null,
    table: null,
    pack: { ...p, rounds },
    history: [...rounds].reverse().concat(s.history).slice(0, 20)
  };
}
function finishTable(s, t, debit) {
  if (s.balance < debit) throw Error("Not enough chips for this action.");
  if (!t.complete)
    return {
      ...s,
      notice: void 0,
      balance: s.balance - debit,
      table: t,
      pack: null
    };
  const payouts = tableReturns(t);
  const rounds = t.hands.map(
    (h, i) => ({
      id: 0,
      game: "blackjack",
      stake: h.stake,
      payout: payouts[i],
      values: [...h.cards, -1, ...t.dealer],
      label: `Seat ${h.seat + 1}${h.split ? " \xB7 split" : ""} \xB7 ${payouts[i] > h.stake ? "Win" : payouts[i] === h.stake ? "Push" : "Loss"}`
    })
  );
  return settle2(
    {
      ...s,
      balance: s.balance - debit + sum(rounds.map((r) => r.stake)),
      table: null
    },
    { game: "blackjack", rounds, table: t }
  );
}
function playSession(s, game, stake, choice = {}, options = {}, rng2 = randomInt) {
  ensureFree(s);
  s = { ...s, spinRun: void 0 };
  const source = rng2;
  rng2 = (bound) => {
    const n = source(bound);
    if (!integer4(n, 0, bound - 1)) throw Error("Invalid random draw.");
    return n;
  };
  if (!validStake(stake)) throw Error("Enter a stake from 1 to 1,000 chips.");
  if (isFleet(game)) {
    if (stake > s.balance) throw Error("Not enough chips for this spin.");
    const slot = spinFleet(game, stake, rng2);
    return settle2(s, {
      game,
      slot,
      rounds: [
        {
          id: 0,
          game,
          stake,
          payout: slot.payout,
          values: [1, slot.frames.length],
          label: `${slot.frames.length} stage${slot.frames.length === 1 ? "" : "s"} \xB7 ${slot.capReached ? "Cap reached" : slot.payout > stake ? "Win" : slot.payout === stake ? "Push" : slot.payout ? "Partial return" : "No return"}`
        }
      ]
    });
  }
  if (game === "blackjack") {
    const { table, debit } = dealTable(
      options.seats ?? 1,
      stake,
      s.balance,
      rng2
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
    const n = rng2(37);
    return settle2(s, {
      game,
      wagers: ws.map((w) => ({ ...w })),
      rounds: ws.map((w) => ({
        id: 0,
        game,
        stake: w.stake,
        payout: money2(w.stake, rouletteBps(w, n)),
        values: [n],
        label: `${wagerLabel(w)} \xB7 ball ${n}`
      }))
    });
  }
  if (game === "keno") {
    const ts = options.tickets ?? [
      { picks: choice.picks ?? [7, 17, 27], stake }
    ];
    if (!validTickets(ts))
      throw Error(
        "Use 1\u20134 tickets, each with 1\u20136 unique numbers and a valid stake."
      );
    if (s.balance < sum(ts.map((t) => t.stake)))
      throw Error("Not enough chips for all tickets.");
    const drawn = drawNumbers(40, 10, rng2);
    return settle2(s, {
      game,
      tickets: ts.map((t) => ({ ...t, picks: [...t.picks] })),
      rounds: ts.map((t, i) => {
        const hits = t.picks.filter((n) => drawn.includes(n)).length;
        return {
          id: 0,
          game,
          stake: t.stake,
          payout: money2(t.stake, KENO_TABLE[t.picks.length - 1][hits]),
          values: [t.picks.length, ...t.picks, ...drawn],
          label: `Ticket ${i + 1} \xB7 ${hits}/${t.picks.length} hits`
        };
      })
    });
  }
  if (!integer4(count, 1, 10) || !(game === "plinko" ? [1, 3, 5, 10] : game === "scratch_cards" ? [1, 3, 5] : [1]).includes(count))
    throw Error("Invalid pack size.");
  if (s.balance < stake * count)
    throw Error("Not enough chips for the entire pack.");
  if (game === "plinko") {
    const profile = options.profile ?? "Low";
    if (!Object.prototype.hasOwnProperty.call(PROFILES, profile))
      throw Error("Choose a Plinko risk profile.");
    return settle2(s, {
      game,
      profile,
      rounds: Array.from({ length: count }, () => {
        const values = Array.from({ length: 12 }, () => rng2(2)), bucket = sum(values);
        return {
          id: 0,
          game,
          stake,
          payout: money2(stake, PROFILES[profile][bucket]),
          values,
          label: `${profile} \xB7 bucket ${bucket} \xB7 ${PROFILES[profile][bucket] / 1e4}\xD7`
        };
      })
    });
  }
  let temporary = base(s);
  const rounds = [];
  for (let i = 0; i < count; i++) {
    temporary = playPractice(temporary, game, stake, choice, rng2);
    rounds.push(temporary.history[0]);
  }
  return settle2(s, {
    game,
    rounds,
    ...game === "scratch_cards" ? { revealed: [] } : {}
  });
}
function revealSlot(s, all = false) {
  if (!pendingSlot(s) || !s.pack?.slot)
    throw Error("No saved slot feature to reveal.");
  const complete = all || s.pack.slot.cursor + 1 === s.pack.slot.frames.length;
  return {
    ...s,
    ...complete && s.spinRun ? { spinRun: { ...s.spinRun, shown: s.spinRun.paid } } : {},
    pack: {
      ...s.pack,
      slot: {
        ...s.pack.slot,
        cursor: all ? s.pack.slot.frames.length : s.pack.slot.cursor + 1
      }
    }
  };
}

// deploy/xeroti-slot-20261012/fixtures.mjs
var rng = (seed) => (b) => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) % b;
};
var session = (r) => {
  let i = 0;
  return playSession(initialSession(), "slot_xeroti", 1e3, {}, {}, () => r.draws[i++]);
};
var result = { top: session(spinFleet("slot_xeroti", 1e3, () => 99)), full: session(spinFleet("slot_xeroti", 1e3, () => 0)) };
for (let seed = 1; seed < 1e3; seed++) {
  const r = spinFleet("slot_xeroti", 1e3, rng(seed));
  if (!r.payout && !result.loss) result.loss = session(r);
  if (r.frames.length > 1 && r.frames[0].wins.reduce((n, w) => n + w.cells.length, 0) < 25 && !result.partial) result.partial = session(r);
  if (result.loss && result.partial) break;
}
result.fullShown = revealSlot(result.full);
fs.writeFileSync(new URL("./qa/fixtures.json", import.meta.url), JSON.stringify(result, null, 2));
console.log(Object.fromEntries(Object.entries(result).map(([k, s]) => [k, { frames: s.pack.slot.frames.length, cursor: s.pack.slot.cursor, payout: s.pack.slot.payout }])));
