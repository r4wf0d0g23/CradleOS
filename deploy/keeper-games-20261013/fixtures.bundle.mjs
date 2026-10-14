// deploy/keeper-games-20261013/fixtures.mjs
import fs from "node:fs";

// cradleos-dapp/src/lib/casinoKeeper.ts
var KEEPER_KEYS = [
  "keeper_cipher",
  "keeper_archive",
  "keeper_passage"
];
var isKeeperGame = (x) => typeof x === "string" && KEEPER_KEYS.includes(x);
var KEEPER_NAMES = {
  keeper_cipher: "Keeper\u2019s Cipher",
  keeper_archive: "Archive Resonance",
  keeper_passage: "Keeper\u2019s Passage"
};
var CIPHER_BPS = [18e4, 45e3, 18e3];
var ARCHIVE_BPS = {
  five: 18e4,
  four: 3e4,
  full: 12e3,
  three: 6e3,
  two: 3e3,
  none: 0
};
var ARCHIVE_LABELS = {
  five: "Five matching",
  four: "Four matching",
  full: "Full house",
  three: "Three matching",
  two: "Two pairs",
  none: "No resonance"
};
var integer = (x, lo, hi) => typeof x === "number" && Number.isSafeInteger(x) && x >= lo && x <= hi;
var distinct = (a, n, max) => a.length === n && a.every((x) => integer(x, 0, max)) && new Set(a).size === n;
function cipherClue(secret, guess) {
  const exact = secret.filter((x, i) => guess[i] === x).length;
  return {
    exact,
    misplaced: guess.filter((x) => secret.includes(x)).length - exact
  };
}
function archiveCategory(symbols) {
  const counts = Array.from(
    { length: 6 },
    (_, i) => symbols.filter((x) => x === i).length
  ).sort((a, b) => b - a);
  return counts[0] === 5 ? "five" : counts[0] === 4 ? "four" : counts[0] === 3 ? counts[1] === 2 ? "full" : "three" : counts[0] === 2 && counts[1] === 2 ? "two" : "none";
}
function passageReturn(stake, risks) {
  if (!risks.length) return stake;
  let numerator = BigInt(stake) * 96n, denominator = 100n;
  for (const risk of risks) {
    numerator *= 4n;
    denominator *= BigInt(risk === 0 ? 3 : 2);
  }
  return Number(numerator / denominator);
}
function keeperDraw(game, rng) {
  if (game === "keeper_archive")
    return Array.from({ length: 10 }, () => rng(6));
  const shuffle = (n) => {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = rng(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  return game === "keeper_cipher" ? shuffle(6).slice(0, 3) : Array.from({ length: 5 }, () => shuffle(4)).flat();
}
function keeperView(r) {
  if (!isKeeperGame(r.game) || !integer(r.stake, 100, 1e5) || !Array.isArray(r.choice) || r.choice.length || !Array.isArray(r.draw) || !Array.isArray(r.actions) || r.actions.length > 6)
    throw Error("Invalid Keeper round.");
  if (r.game === "keeper_cipher" && !distinct(r.draw, 3, 5))
    throw Error("Invalid cipher.");
  if (r.game === "keeper_archive" && (r.draw.length !== 10 || r.draw.some((n) => !integer(n, 0, 5))))
    throw Error("Invalid archive.");
  if (r.game === "keeper_passage" && (r.draw.length !== 20 || Array.from({ length: 5 }, (_, i) => r.draw.slice(i * 4, i * 4 + 4)).some(
    (a) => !distinct(a, 4, 3)
  )))
    throw Error("Invalid passage.");
  const v = {
    phase: r.game === "keeper_cipher" ? "guess" : r.game === "keeper_archive" ? "hold" : "cross",
    payout: 0,
    label: "",
    clues: [],
    symbols: r.game === "keeper_archive" ? r.draw.slice(0, 5) : [],
    held: [],
    steps: [],
    bank: r.stake,
    next: [passageReturn(r.stake, [0]), passageReturn(r.stake, [1])]
  };
  for (const a of r.actions) {
    if (v.phase === "done" || !a || typeof a.kind !== "string" || !Array.isArray(a.values) || a.values.some((x) => !integer(x, 0, 5)))
      throw Error("Invalid Keeper action.");
    if (r.game === "keeper_cipher") {
      if (a.kind === "end" && !a.values.length) {
        v.phase = "done";
        v.label = "Trial ended";
        continue;
      }
      if (a.kind !== "guess" || !distinct(a.values, 3, 5) || v.clues.some((c) => c.guess.join() === a.values.join()))
        throw Error("Choose three different glyphs and a new code.");
      const clue = { guess: [...a.values], ...cipherClue(r.draw, a.values) };
      v.clues.push(clue);
      if (clue.exact === 3) {
        v.phase = "done";
        v.payout = Math.floor(
          r.stake * CIPHER_BPS[v.clues.length - 1] / 1e4
        );
        v.label = "Cipher unlocked";
      } else if (v.clues.length === 3) {
        v.phase = "done";
        v.label = "Signal lost";
      }
    } else if (r.game === "keeper_archive") {
      if (a.kind !== "draw" || a.values.length > 5 || new Set(a.values).size !== a.values.length || a.values.some((x) => x > 4))
        throw Error("Invalid held glyphs.");
      v.held = [...a.values];
      v.symbols = r.draw.slice(0, 5).map((n, i) => v.held.includes(i) ? n : r.draw[i + 5]);
      const category = archiveCategory(v.symbols);
      v.payout = Math.floor(r.stake * ARCHIVE_BPS[category] / 1e4);
      v.label = ARCHIVE_LABELS[category];
      v.phase = "done";
    } else {
      if (a.kind === "bank" && !a.values.length) {
        v.phase = "done";
        v.payout = v.bank;
        v.label = v.steps.length ? "Passage banked" : "Stake returned";
        continue;
      }
      if (a.kind !== "cross" || a.values.length !== 2 || !integer(a.values[0], 0, 1) || !integer(a.values[1], 0, 3))
        throw Error("Choose a route and gate.");
      const [risk, gate] = a.values, safe = r.draw.slice(
        v.steps.length * 4,
        v.steps.length * 4 + (risk === 0 ? 3 : 2)
      ), success = safe.includes(gate);
      v.steps.push({ risk, gate, safe, success });
      if (!success) {
        v.bank = 0;
        v.phase = "done";
        v.label = "Passage closed";
      } else {
        const risks = v.steps.map((s) => s.risk);
        v.bank = passageReturn(r.stake, risks);
        v.next = [0, 1].map((n) => passageReturn(r.stake, [...risks, n]));
        if (v.steps.length === 5) {
          v.phase = "done";
          v.payout = v.bank;
          v.label = "Passage complete";
        }
      }
    }
  }
  return v;
}
function validKeeperRound(r) {
  try {
    keeperView(r);
    return true;
  } catch {
    return false;
  }
}

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
var WHEEL_BPS = [
  ...Array(12).fill(0),
  ...Array(5).fill(12e3),
  16e3,
  16e3,
  1e5
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
function draw(rng, bound) {
  const n = rng(bound);
  if (!integer2(n, 0, bound - 1)) throw Error("Invalid random draw.");
  return n;
}
function shuffledDeck(rng = randomInt) {
  const a = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = draw(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// cradleos-dapp/src/lib/casinoFrontierPoker.ts
var names = [
  "High card",
  "Pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush"
];
var cardRank = (c) => c % 13 === 0 ? 14 : c % 13 + 1;
function comparePoker(a, b) {
  if (a.category !== b.category) return Math.sign(a.category - b.category);
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const d = (a.kickers[i] ?? 0) - (b.kickers[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}
function rankPoker(cards) {
  if (![2, 5].includes(cards.length) || new Set(cards).size !== cards.length || cards.some((c) => !Number.isInteger(c) || c < 0 || c > 51))
    throw Error("Invalid poker hand.");
  const ranks = cards.map(cardRank).sort((a, b) => b - a);
  const groups = [...new Set(ranks)].map((r) => ({ r, n: ranks.filter((v) => v === r).length })).sort((a, b) => b.n - a.n || b.r - a.r);
  const flush = cards.length === 5 && cards.every((c) => Math.floor(c / 13) === Math.floor(cards[0] / 13));
  const straight = cards.length === 5 && groups.length === 5 ? ranks[0] - ranks[4] === 4 ? ranks[0] : ranks.join(",") === "14,5,4,3,2" ? 5 : 0 : 0;
  let category = 0, kickers = ranks;
  if (flush && straight) {
    category = 8;
    kickers = [straight];
  } else if (groups[0].n === 4) {
    category = 7;
    kickers = groups.map((g) => g.r);
  } else if (groups[0].n === 3 && groups[1]?.n === 2) {
    category = 6;
    kickers = groups.map((g) => g.r);
  } else if (flush) category = 5;
  else if (straight) {
    category = 4;
    kickers = [straight];
  } else if (groups[0].n === 3) {
    category = 3;
    kickers = groups.map((g) => g.r);
  } else if (groups[0].n === 2 && groups[1]?.n === 2) {
    category = 2;
    kickers = groups.map((g) => g.r);
  } else if (groups[0].n === 2) {
    category = 1;
    kickers = groups.map((g) => g.r);
  }
  return {
    category,
    kickers,
    name: category === 8 && kickers[0] === 14 ? "Royal flush" : names[category]
  };
}
function bestPoker(cards) {
  if (cards.length !== 7 || new Set(cards).size !== 7)
    throw Error("Invalid seven-card hand.");
  let best;
  for (let a = 0; a < 6; a++)
    for (let b = a + 1; b < 7; b++) {
      const rank = rankPoker(cards.filter((_, i) => i !== a && i !== b));
      if (!best || comparePoker(rank, best) > 0) best = rank;
    }
  return best;
}
function splitWing(cards, escort) {
  if (cards.length !== 7 || escort.length !== 2 || new Set(escort).size !== 2 || escort.some((i) => !Number.isInteger(i) || i < 0 || i > 6))
    throw Error("Select two escort cards.");
  const main = cards.filter((_, i) => !escort.includes(i)), low = escort.map((i) => cards[i]);
  const mainRank = rankPoker(main), escortRank = rankPoker(low);
  return {
    main,
    escort: low,
    mainRank,
    escortRank,
    legal: comparePoker(mainRank, escortRank) >= 0
  };
}
function houseWing(cards) {
  let best;
  for (let a = 0; a < 6; a++)
    for (let b = a + 1; b < 7; b++) {
      const next = splitWing(cards, [a, b]);
      if (!next.legal) continue;
      const old = best ? splitWing(cards, best) : null;
      if (!old || comparePoker(next.escortRank, old.escortRank) > 0 || comparePoker(next.escortRank, old.escortRank) === 0 && comparePoker(next.mainRank, old.mainRank) > 0)
        best = [a, b];
    }
  return best;
}

// cradleos-dapp/src/lib/casinoFrontierPusher.ts
var PUSHER_COST = 2500;
var PUSHER_RADIUS = 13;
var PUSHER_SECONDS = 7.2;
var initialTray = () => Array.from({ length: 81 }, (_, i) => ({
  id: i + 1,
  x: 68 + i % 9 * 28 + Math.floor(i / 9) % 2 * 2,
  y: 164 + Math.floor(i / 9) * 27
}));
function validTray(tray) {
  return Array.isArray(tray) && tray.length <= 100 && new Set(tray.map((t) => t?.id)).size === tray.length && tray.every(
    (t) => t && Number.isSafeInteger(t.id) && t.id > 0 && t.id < 1e9 && Number.isFinite(t.x) && t.x >= PUSHER_RADIUS && t.x <= 360 - PUSHER_RADIUS && Number.isFinite(t.y) && t.y >= 0 && t.y <= 400
  );
}
var quantize = (n) => Math.round(n * 1e6) / 1e6;
var motorPosition = (phase) => quantize(65 + 135 * (1 - Math.cos(phase * 2 * Math.PI)) / 2);
function simulatePusher(tray, x, phase, id, record = false) {
  if (!validTray(tray) || tray.length >= 100 || !Number.isFinite(x) || x < 36 || x > 324 || !Number.isFinite(phase) || phase < 0 || phase >= 1 || !Number.isSafeInteger(id) || id <= 0 || tray.some((t) => t.id === id))
    throw Error("Invalid pusher drop.");
  const r = PUSHER_RADIUS, dt = 1 / 120, ticks = PUSHER_SECONDS / dt;
  const tokens = tray.map((t) => ({ ...t, vx: 0, vy: 0 }));
  let dropped = false;
  const collected = [], missed = [], frames = [];
  let last = motorPosition(0);
  for (let step = 0; step <= ticks; step++) {
    const t = step * dt, motor = motorPosition(t / 3.6 % 1), speed = (motor - last) / dt;
    last = motor;
    if (!dropped && t >= phase * 3.6) {
      tokens.push({ id, x, y: motor + r + 1, vx: 0, vy: 32 });
      dropped = true;
    }
    for (const p of tokens) {
      p.vx *= Math.exp(-5 * dt);
      p.vy *= Math.exp(-5 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let iteration = 0; iteration < 7; iteration++) {
      for (const p of tokens) {
        if (p.y - r < motor) {
          p.y = motor + r;
          p.vy = Math.max(p.vy, Math.max(0, speed) * 0.75);
        }
        if (p.x < r) {
          p.x = r;
          p.vx = Math.abs(p.vx) * 0.15;
        }
        if (p.x > 360 - r) {
          p.x = 360 - r;
          p.vx = -Math.abs(p.vx) * 0.15;
        }
      }
      for (let a = 0; a < tokens.length; a++)
        for (let b = a + 1; b < tokens.length; b++) {
          const p = tokens[a], q = tokens[b], dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
          if (d2 >= 4 * r * r) continue;
          const d = Math.sqrt(d2);
          const nx = d > 1e-8 ? dx / d : 1, ny = d > 1e-8 ? dy / d : 0, overlap = 2 * r - d;
          p.x -= nx * overlap * 0.5;
          p.y -= ny * overlap * 0.5;
          q.x += nx * overlap * 0.5;
          q.y += ny * overlap * 0.5;
          const closing = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
          if (closing < 0) {
            const impulse = -closing * 0.55;
            p.vx -= impulse * nx;
            p.vy -= impulse * ny;
            q.vx += impulse * nx;
            q.vy += impulse * ny;
          }
        }
    }
    for (const p of tokens) {
      p.x = quantize(p.x);
      p.y = quantize(p.y);
      p.vx = quantize(p.vx);
      p.vy = quantize(p.vy);
    }
    for (let i = tokens.length - 1; i >= 0; i--) {
      const p = tokens[i];
      if (p.y > 390) {
        (p.x >= 36 && p.x <= 324 ? collected : missed).push(p.id);
        tokens.splice(i, 1);
      } else if (p.y > 355 && (p.x < 27 || p.x > 333)) {
        missed.push(p.id);
        tokens.splice(i, 1);
      }
    }
    if (record && (step % 4 === 0 || step === ticks))
      frames.push({
        t,
        motor,
        tokens: tokens.map(({ id: id2, x: x2, y }) => ({ id: id2, x: x2, y })),
        collected: [...collected],
        missed: [...missed]
      });
  }
  const next = tokens.map(({ id: id2, x: x2, y }) => ({
    id: id2,
    x: Math.max(r, Math.min(360 - r, x2)),
    y: Math.max(0, Math.min(400, y))
  }));
  if (!validTray(next)) throw Error("Pusher simulation unavailable.");
  return { tray: next, collected, missed, frames };
}

// cradleos-dapp/src/lib/casinoFrontier.ts
var FRONTIER_KEYS = [
  ...KEEPER_KEYS,
  "frontier_remainder",
  "frontier_broker",
  "frontier_holdem",
  "frontier_wing",
  "frontier_race",
  "frontier_pusher"
];
var isFrontierGame = (x) => typeof x === "string" && FRONTIER_KEYS.includes(x);
var FRONTIER_NAMES = {
  ...KEEPER_NAMES,
  frontier_remainder: "Reactor Remainder",
  frontier_broker: "Derelict Broker",
  frontier_holdem: "Command Hold\u2019em",
  frontier_wing: "Wing Command",
  frontier_race: "Gate Runner",
  frontier_pusher: "Salvage Pusher"
};
var BROKER_VALUES = [
  0,
  100,
  300,
  700,
  1400,
  2500,
  5e3,
  8e3,
  12e3,
  18e3,
  27e3,
  40200
];
var int = (n, min = 0, max = 1e12) => typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
var bps = (stake, b) => Math.floor(stake * b / 1e4);
var pusherCache = /* @__PURE__ */ new WeakMap();
function pusherOutcome(r) {
  let out = pusherCache.get(r);
  if (!out) {
    if (!r.pusher) throw Error("Missing tray.");
    out = simulatePusher(
      r.pusher.tray,
      r.choice[0],
      r.choice[1] / 1e3,
      r.pusher.tokenId,
      true
    );
    pusherCache.set(r, out);
  }
  return out;
}
function holdemResult(r, v) {
  const player = bestPoker([...r.draw.slice(0, 2), ...r.draw.slice(4)]), dealer = bestPoker([...r.draw.slice(2, 4), ...r.draw.slice(4)]), cmp = comparePoker(player, dealer), qualifies = dealer.category >= 1;
  const blindProfit = player.category === 8 ? player.kickers[0] === 14 ? 500 : 50 : { 4: 1, 5: 1.5, 6: 3, 7: 10 }[player.category] ?? 0;
  v.payout = cmp === 0 ? v.wager : cmp < 0 ? qualifies ? 0 : r.stake : Math.floor(
    r.stake * ((qualifies ? 2 : 1) + 1 + blindProfit + v.raise * 2)
  );
  v.label = cmp > 0 ? `${player.name} \xB7 Win` : cmp === 0 ? "Tie" : `${dealer.name} \xB7 Dealer`;
  v.phase = "done";
  v.boardCount = 5;
}
function frontierView(r) {
  const v = {
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
    boardCount: 0
  };
  if (isKeeperGame(r.game)) return { ...v, ...keeperView(r) };
  if (r.game === "frontier_remainder") {
    const result = r.draw[0] % 4 || 4;
    v.payout = result === r.choice[0] ? bps(r.stake, 38e3) : 0;
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
    v.payout = pos < (r.choice[1] === 0 ? 1 : 2) ? bps(r.stake, r.choice[1] === 0 ? 38e3 : 19e3) : 0;
    v.label = `Runner ${r.choice[0] + 1} \xB7 #${pos + 1}`;
  }
  if (r.game === "frontier_pusher") {
    const out = pusherOutcome(r);
    v.payout = out.collected.length * PUSHER_COST;
    v.label = `${out.collected.length} collected \xB7 ${out.missed.length} lost`;
  }
  for (const a of r.actions) {
    if (v.phase === "done" || !a || typeof a.kind !== "string" || !Array.isArray(a.values) || a.values.some((x) => !int(x, 0, 100)))
      throw Error("Invalid round action.");
    const noValues = a.values.length === 0, n = a.values[0];
    if (r.game === "frontier_broker") {
      if (a.kind === "pick" && v.phase === "pick" && a.values.length === 1 && int(n, 0, 11)) {
        v.own = n;
        v.phase = "open";
      } else if (a.kind === "open" && v.phase === "open" && a.values.length === 1 && int(n, 0, 11) && n !== v.own && !v.opened.includes(n)) {
        v.opened.push(n);
        const stage = [3, 6, 8, 10].indexOf(v.opened.length);
        if (stage >= 0) {
          const remaining = r.draw.filter((_, i) => !v.opened.includes(i));
          const total = remaining.reduce((a2, b) => a2 + b, 0);
          v.offer = Math.floor(
            r.stake * total * [85, 90, 95, 98][stage] / (remaining.length * 1e6)
          );
          v.phase = "offer";
        }
      } else if (a.kind === "accept" && v.phase === "offer" && noValues) {
        v.payout = v.offer;
        v.label = "Offer accepted";
        v.phase = "done";
      } else if (a.kind === "reject" && v.phase === "offer" && noValues) {
        v.phase = v.opened.length === 10 ? "final" : "open";
      } else if ((a.kind === "keep" || a.kind === "swap") && v.phase === "final" && noValues) {
        if (a.kind === "swap")
          v.own = r.draw.findIndex(
            (_, i) => i !== v.own && !v.opened.includes(i)
          );
        v.payout = bps(r.stake, r.draw[v.own]);
        v.label = a.kind === "keep" ? "Cargo retained" : "Cargo exchanged";
        v.phase = "done";
      } else throw Error("Invalid cargo action.");
    } else if (r.game === "frontier_holdem") {
      if (a.kind === "check" && noValues && (v.phase === "preflop" || v.phase === "flop")) {
        v.checks++;
        v.phase = v.checks === 1 ? "flop" : "river";
        v.boardCount = v.checks === 1 ? 3 : 5;
      } else if (a.kind === "raise" && a.values.length === 1 && (v.phase === "preflop" && [3, 4].includes(n) || v.phase === "flop" && n === 2 || v.phase === "river" && n === 1)) {
        v.raise = n;
        v.wager += n * r.stake;
        holdemResult(r, v);
      } else if (a.kind === "fold" && v.phase === "river" && noValues) {
        v.phase = "done";
        v.label = "Fold";
        v.boardCount = 5;
      } else throw Error("Invalid Hold\u2019em action.");
    } else if (r.game === "frontier_wing" && a.kind === "split" && a.values.length === 2) {
      const player = splitWing(r.draw.slice(0, 7), a.values);
      if (!player.legal) throw Error("Main fleet must outrank escort.");
      v.escort = [...a.values];
      v.dealerEscort = houseWing(r.draw.slice(7));
      const dealer = splitWing(r.draw.slice(7), v.dealerEscort);
      const wins = Number(comparePoker(player.mainRank, dealer.mainRank) > 0) + Number(comparePoker(player.escortRank, dealer.escortRank) > 0);
      v.payout = bps(r.stake, [0, 1e4, 19500][wins]);
      v.label = ["Both hands lost", "Split \xB7 Push", "Both hands won"][wins];
      v.phase = "done";
    } else throw Error("Invalid game action.");
  }
  return v;
}
function makeFrontierRound(game, stake, choice, id, previous, rng = randomInt) {
  if (!isFrontierGame(game) || !int(stake, 100, MAX_BET) || !int(id, 1) || !Array.isArray(choice))
    throw Error("Invalid wager.");
  if (game === "frontier_pusher" && (previous?.nextToken ?? 82) >= 999999999) throw Error("Tray drop limit reached. Refill chips to reset.");
  const sample = (n) => {
    const v = rng(n);
    if (!int(v, 0, n - 1)) throw Error("Invalid random draw.");
    return v;
  };
  let draw2 = [];
  if (isKeeperGame(game)) draw2 = keeperDraw(game, sample);
  if (game === "frontier_remainder") draw2 = [48 + sample(48)];
  if (game === "frontier_broker") {
    draw2 = [...BROKER_VALUES];
    for (let i = 11; i > 0; i--) {
      const j = sample(i + 1);
      [draw2[i], draw2[j]] = [draw2[j], draw2[i]];
    }
  }
  if (game === "frontier_holdem" || game === "frontier_wing")
    draw2 = shuffledDeck(sample).slice(0, game === "frontier_holdem" ? 9 : 14);
  if (game === "frontier_race") {
    draw2 = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) {
      const j = sample(i + 1);
      [draw2[i], draw2[j]] = [draw2[j], draw2[i]];
    }
    draw2.push(...Array.from({ length: 4 }, () => sample(1e3)));
  }
  const r = {
    id,
    game,
    stake,
    draw: draw2,
    choice: [...choice],
    actions: [],
    collected: false,
    ...game === "frontier_pusher" ? {
      pusher: {
        tray: previous?.tray ?? initialTray(),
        tokenId: previous?.nextToken ?? 82
      }
    } : {}
  };
  if (!validFrontierRound(r)) throw Error("Invalid game selection.");
  return r;
}
function validFrontierRound(r) {
  try {
    const q = r;
    if (!q || !isFrontierGame(q.game) || !int(q.id, 1) || !int(q.stake, 100, MAX_BET) || typeof q.collected !== "boolean" || !Array.isArray(q.draw) || !Array.isArray(q.choice) || !Array.isArray(q.actions) || q.actions.length > 24)
      return false;
    if (isKeeperGame(q.game) && !validKeeperRound(q)) return false;
    const d = q.draw, c = q.choice;
    if (q.game === "frontier_remainder" && (d.length !== 1 || !int(d[0], 48, 95) || c.length !== 1 || !int(c[0], 1, 4)))
      return false;
    if (q.game === "frontier_broker" && (c.length !== 0 || JSON.stringify([...d].sort((a, b) => a - b)) !== JSON.stringify(BROKER_VALUES)))
      return false;
    if ((q.game === "frontier_holdem" || q.game === "frontier_wing") && (c.length !== 0 || d.length !== (q.game === "frontier_holdem" ? 9 : 14) || new Set(d).size !== d.length || d.some((n) => !int(n, 0, 51))))
      return false;
    if (q.game === "frontier_race" && (d.length !== 8 || d.slice(0, 4).some((n) => !int(n, 0, 3)) || [...d.slice(0, 4)].sort().join() !== "0,1,2,3" || d.slice(4).some((n) => !int(n, 0, 999)) || c.length !== 2 || !int(c[0], 0, 3) || !int(c[1], 0, 1)))
      return false;
    if (q.game === "frontier_pusher") {
      if (d.length !== 0 || q.stake !== PUSHER_COST || c.length !== 2 || !int(c[0], 36, 324) || !int(c[1], 0, 999) || !q.pusher || !validTray(q.pusher.tray) || q.pusher.tray.length >= 100 || !int(q.pusher.tokenId, 1, 999999999) || q.pusher.tray.some((t) => t.id >= q.pusher.tokenId))
        return false;
    } else if (q.pusher !== void 0) return false;
    const v = frontierView(q);
    return !q.collected || v.phase === "done";
  } catch {
    return false;
  }
}
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

// cradleos-dapp/src/lib/casinoSessions.ts
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

// cradleos-dapp/src/lib/casinoFrontierSession.ts
var cap = (s, extra) => {
  if (!Number.isSafeInteger(s.balance + crapsReserve(s.craps) + extra) || s.balance + crapsReserve(s.craps) + extra > 1e12)
    throw Error("Practice balance limit reached.");
};
function startFrontier(s, game, stake, choice, rng = randomInt) {
  if (activeSession(s)) throw Error("Finish the current round first.");
  const required = stake * (game === "frontier_holdem" ? 6 : 1);
  if (!Number.isSafeInteger(required) || s.balance < required)
    throw Error(
      game === "frontier_holdem" ? "Reserve 6\xD7 ante for all raises." : "Not enough chips."
    );
  cap(
    s,
    stake * (game === "frontier_holdem" ? 511 : game === "frontier_pusher" ? 101 : isKeeperGame(game) ? 32 : 5)
  );
  const f = s.frontier, r = makeFrontierRound(game, stake, choice, (f?.sequence ?? 0) + 1, f, rng), v = frontierView(r);
  return {
    ...s,
    notice: void 0,
    balance: s.balance - v.wager,
    frontier: {
      version: 1,
      sequence: r.id,
      current: r,
      history: f?.history ?? [],
      ...f?.tray ? { tray: f.tray, nextToken: f.nextToken } : {},
      ...r.pusher ? { tray: pusherOutcome(r).tray, nextToken: r.pusher.tokenId + 1 } : {}
    }
  };
}
function current(s, id, revision) {
  const r = s.frontier?.current;
  if (!r || !frontierPending(s.frontier) || r.id !== id || r.actions.length !== revision)
    throw Error("Round already changed.");
  return r;
}
function actFrontier(s, id, revision, action) {
  const old = current(s, id, revision), before = frontierView(old), r = { ...old, actions: [...old.actions, action] }, v = frontierView(r), debit = v.wager - before.wager;
  if (!Number.isSafeInteger(debit) || debit < 0 || debit > s.balance)
    throw Error("Not enough chips.");
  cap(s, Math.max(0, v.payout - debit));
  return {
    ...s,
    balance: s.balance - debit,
    frontier: { ...s.frontier, current: r }
  };
}

// deploy/keeper-games-20261013/fixtures.mjs
var set = (game, draw2) => {
  const s = startFrontier(initialSession(), game, 2500, [], () => 0);
  s.frontier.current.draw = draw2;
  return s;
};
var passage = Array.from({ length: 5 }, () => [0, 1, 2, 3]).flat();
var fixtures = { cipher: set("keeper_cipher", [0, 1, 2]), archive: set("keeper_archive", [0, 0, 0, 1, 2, 3, 4, 5, 0, 0]), archiveLoss: set("keeper_archive", [0, 1, 2, 3, 4, 1, 2, 3, 4, 5]), passage: set("keeper_passage", passage) };
fixtures.cipherDone = actFrontier(fixtures.cipher, 1, 0, { kind: "guess", values: [0, 1, 2] });
fixtures.archiveDone = actFrontier(fixtures.archive, 1, 0, { kind: "draw", values: [0, 1, 2] });
fixtures.passageLoss = actFrontier(fixtures.passage, 1, 0, { kind: "cross", values: [1, 3] });
fs.writeFileSync(new URL("./qa/fixtures.json", import.meta.url), JSON.stringify(fixtures, null, 2));
