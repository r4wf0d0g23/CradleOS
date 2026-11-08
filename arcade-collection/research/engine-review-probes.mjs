import * as wreck from "../site/games/wreck-runner.js";
import * as signal from "../site/games/signal-diver.js";
import * as hook from "../site/games/voidhook.js";
import * as swarm from "../site/games/salvage-swarm.js";
import * as gate from "../site/games/gatebreaker.js";
import * as race from "../site/games/feral-circuit.js";
import * as dock from "../site/games/dockyard-panic.js";
import * as tower from "../site/games/scrapline-defense.js";
const dt = 1 / 60,
  results = [];
const summarize = (name, s, extra = {}) =>
  results.push({
    name,
    state: s.state,
    time: s.time,
    hp: s.hp,
    score: s.score,
    stage: s.stage,
    ...extra,
  });
let s = wreck.create(123);
for (let k = 0; k < 60 * 300 && s.state === "playing"; k++)
  wreck.update(s, dt, { right: true });
summarize("legal: Wreck hold right only", s);
for (const hz of [2, 3, 5]) {
  s = signal.create(123);
  let last = -1;
  for (let k = 0; k < 60 * 100 && s.state === "playing"; k++) {
    const beat = Math.floor(s.time * hz);
    if (beat !== last) {
      last = beat;
      for (let lane = 0; lane < 3; lane++) signal.action(s, "lane:" + lane);
    }
    signal.update(s, dt, {});
  }
  summarize("legal: Signal blind triple tap " + hz + "Hz", s, {
    hit: s.hit,
    miss: s.miss,
    maxCombo: s.maxCombo,
  });
}
s = gate.create(123);
for (let k = 0; k < 60 * 600 && s.state === "playing"; k++) {
  if (!s.launched) gate.action(s, "primary");
  gate.update(s, dt, {
    dragging: true,
    pointer: { x: s.ball.x + Math.sin(s.time * 0.7) * 45, y: 640 },
  });
}
summarize("legal: Gate angled paddle follower", s);
s = race.create(123);
for (let k = 0; k < 60 * 110 && s.state === "playing"; k++)
  race.update(s, dt, {
    dragging: true,
    pointer: race.track(-Math.PI / 2 + (s.next * Math.PI) / 6),
    action: true,
  });
summarize("legal: Circuit waypoint pilot", s, {
  rank: s.rank,
  passed: s.passed,
});
s = dock.create(123);
for (let k = 0; k < 60 * 500 && s.state === "playing"; k++) {
  for (const q of s.ships)
    if (q.bay < 0) {
      dock.action(s, "ship:" + (q.slot + 1));
      for (const bay of q.needs) dock.action(s, "bay:" + bay);
    }
  dock.update(s, dt, {});
}
summarize("legal: Dock matching scheduler", s, {
  served: s.served,
  missed: s.missed,
});
s = tower.create(123);
for (const plot of [0, 1, 3]) {
  tower.update(s, 0, { tap: s.plots[plot] });
  tower.action(s, "build:cutter");
}
for (let k = 0; k < 60 * 650 && s.state === "playing"; k++) {
  if (s.intermission) {
    for (const p of s.plots) {
      tower.update(s, 0, { tap: p });
      if (p.type) {
        if (s.power + 1 > s.capacity) tower.action(s, "generator");
        tower.action(s, "upgrade");
      } else {
        if (s.power + 2 > s.capacity) tower.action(s, "generator");
        tower.action(s, "build:cutter");
      }
    }
    tower.action(s, "wave");
  }
  tower.update(s, dt, {});
}
summarize("legal: Scrapline cutter build pilot", s, {
  wave: s.wave,
  cash: s.cash,
  power: s.power,
  capacity: s.capacity,
});
for (const seed of [123, 414, 917]) {
  s = swarm.create(seed);
  for (let k = 0; k < 60 * 170 && !["won", "lost"].includes(s.state); k++) {
    if (s.state === "choice") {
      swarm.action(s, "upgrade:chain");
      continue;
    }
    if (s.nova <= 0) swarm.action(s, "primary");
    const a = s.time * 0.65;
    swarm.update(s, dt, {
      dragging: true,
      pointer: { x: 360 + 240 * Math.cos(a), y: 360 + 240 * Math.sin(a) },
    });
  }
  summarize("legal: Swarm circle/chain/Nova seed" + seed, s, {
    bossKilled: s.bossKilled,
  });
}
s = hook.create(123);
let path = [],
  previousStage = 0,
  previousCargo = false,
  previousDelivered = -1;
for (let k = 0; k < 60 * 430 && s.state === "playing"; k++) {
  if (
    s.stage !== previousStage ||
    s.carry !== previousCargo ||
    s.delivered !== previousDelivered
  ) {
    previousStage = s.stage;
    previousCargo = s.carry;
    previousDelivered = s.delivered;
    if (s.carry)
      path =
        s.player.x > 400
          ? [{ x: 650, y: 650 }, { x: 100, y: 650 }, { ...s.gate }]
          : [{ x: 75, y: 350 }, { ...s.gate }];
    else {
      const q = s.cargo[0];
      path =
        q.x > 400
          ? [{ x: 75, y: 75 }, { x: 650, y: 75 }, { ...q }]
          : [{ x: 75, y: 350 }, { ...q }];
    }
  }
  const q = path[0] || s.gate,
    p = s.player;
  if (Math.hypot(q.x - p.x, q.y - p.y) < 35 && path.length > 1) path.shift();
  const ax = 2 * (q.x - p.x) - 1.8 * p.vx,
    ay = 2 * (q.y - p.y) - 1.8 * p.vy;
  hook.update(s, dt, {
    right: ax > 10,
    left: ax < -10,
    down: ay > 10,
    up: ay < -10,
  });
}
summarize("legal: Hook route without tether", s, { delivered: s.delivered });
// The following are explicitly synthetic invariant fixtures, not natural completion proof.
s = hook.create(123);
s.hp = 1;
s.player = { x: 350, y: 390, vx: 0, vy: 0 };
s.cargo = [{ x: 350, y: 390 }];
s.gate = { x: 350, y: 390 };
hook.update(s, dt, {});
summarize("fixture: Hook lethal contact plus delivery", s);
s = wreck.create(123);
s.hp = 1;
s.player = { x: 360, y: 1739, vy: 310 };
s.enemies = [{ x: 360, y: 1740, hp: 2 }];
wreck.update(s, dt, {});
summarize("fixture: Wreck lethal contact plus exit", s);
s = swarm.create(123);
s.hp = 1;
s.scrap = [{ x: 360, y: 400 }];
s.enemies = [
  { x: 360, y: 400, hp: 100, max: 100, r: 17, speed: 0, age: 2, contact: 0 },
];
swarm.update(s, dt, {});
summarize("fixture: Swarm lethal contact plus pickup", s, {
  collected: s.collected,
});
console.log(JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
