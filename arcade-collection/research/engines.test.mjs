import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "../site/catalog.js";
import { run } from "./pilots.mjs";
import { load, record, IDS } from "../site/profile.js";
import * as hook from "../site/games/voidhook.js";
import * as gate from "../site/games/gatebreaker.js";
import * as signal from "../site/games/signal-diver.js";
import * as wreck from "../site/games/wreck-runner.js";
import * as race from "../site/games/feral-circuit.js";
import * as dock from "../site/games/dockyard-panic.js";
import * as swarm from "../site/games/salvage-swarm.js";
import * as defense from "../site/games/scrapline-defense.js";
const step = (m, s, n = 1, i = {}) => {
  for (let k = 0; k < n; k++) m.update(s, 1 / 60, i);
};
for (const { id } of catalog) {
  test(`${id}: legal-input pilot reaches objective`, async () => {
    const r = await run(id);
    assert.equal(r.state, "won", JSON.stringify(r));
    assert(r.score > 0);
  });
  test(`${id}: terminal state immutable`, async () => {
    const m = await import(`../site/games/${id}.js`);
    for (const state of ["won", "lost"]) {
      const s = m.create(111);
      s.state = state;
      const before = JSON.stringify(s);
      step(m, s, 20, {
        action: true,
        pressed: true,
        dragging: true,
        pointer: { x: 500, y: 500 },
        tap: { x: 180, y: 225 },
      });
      m.action(s, "primary");
      assert.equal(JSON.stringify(s), before);
    }
  });
}
test("per-game records cannot clobber other games", () => {
  const map = new Map(),
    st = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
  record(st, "gatebreaker", 100, true);
  record(st, "voidhook", 300, true);
  record(st, "gatebreaker", 50, false);
  assert.deepEqual(load(st, "gatebreaker"), {
    version: 1,
    best: 100,
    wins: 1,
    plays: 2,
  });
  assert.equal(load(st, "voidhook").best, 300);
  assert.equal(map.size, 2);
});
test("corrupt/versioned/denied storage is safe", () => {
  for (const v of [
    "junk",
    '{"version":2,"best":200}',
    '{"version":1,"best":-2,"wins":1e300}',
  ])
    assert.equal(load({ getItem: () => v }, IDS[0]).best, 0);
  const st = {
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  };
  assert.equal(record(st, IDS[0], 50, true).saved, false);
  assert.equal(load(st, IDS[0]).wins, 0);
});
test("unknown game and nonfinite score never write", () => {
  let n = 0;
  const st = { getItem: () => null, setItem: () => n++ };
  record(st, "bad", 100, true);
  record(st, IDS[0], NaN, true);
  assert.equal(n, 0);
});
test("Hook thrust drains and tether recharges within rope limit", () => {
  const s = hook.create(2);
  step(hook, s, 100, { right: true });
  assert(s.energy < 80);
  const old = s.energy;
  step(hook, s, 50, { action: true });
  assert(s.energy > old);
  assert(s.hook >= 0);
  assert(
    Math.hypot(
      s.player.x - s.anchors[s.hook].x,
      s.player.y - s.anchors[s.hook].y,
    ) <=
      s.rope + 1e-6,
  );
  step(hook, s, 1);
  assert.equal(s.hook, -1);
});
test("Hook empty thrusters always have reachable anchor", () => {
  const s = hook.create(3);
  for (let x = 20; x <= 700; x += 20)
    for (let y = 20; y <= 700; y += 20)
      assert(
        Math.min(...s.anchors.map((a) => Math.hypot(a.x - x, a.y - y))) < 310,
      );
});
test("Hook lethal collision cannot deliver or advance", () => {
  const s = hook.create(2);
  s.hp = 1;
  s.carry = true;
  s.player = { x: 350, y: 390, vx: 0, vy: 0 };
  s.gate = { x: 350, y: 390 };
  hook.update(s, 1 / 60, {});
  assert.equal(s.state, "lost");
  assert.equal(s.hp, 0);
  assert.equal(s.score, 0);
  assert.equal(s.stage, 1);
});
test("Gate launch/pulse cost and cooldown", () => {
  const s = gate.create(5);
  gate.action(s, "primary");
  assert.equal(s.pulses, 2);
  s.ball.vy = 300;
  gate.action(s, "primary");
  assert.equal(s.pulses, 1);
  assert(s.ball.vy < 0);
  gate.action(s, "primary");
  assert.equal(s.pulses, 1);
  step(gate, s, 20);
  gate.action(s, "primary");
  assert.equal(s.pulses, 0);
});
test("Gate final reactor remains a required target", () => {
  const s = gate.create(5);
  s.stage = 2;
  s.launched = true;
  s.blocks.forEach((b) => (b.hp = 0));
  gate.update(s, 1 / 60, {});
  assert.equal(s.stage, 3);
  assert.equal(s.blocks.find((b) => b.reactor).hp, 8);
});
test("Gate loss cannot also clear deck", () => {
  const s = gate.create(3);
  s.hp = 1;
  s.launched = true;
  s.ball = { x: 500, y: 740, vx: 0, vy: 300 };
  s.blocks.forEach((b) => (b.hp = 0));
  gate.update(s, 1 / 60, {});
  assert.equal(s.state, "lost");
  assert.equal(s.score, 0);
});
test("Signal blind triple taps fail", () => {
  const s = signal.create(1);
  for (let k = 0; k < 4000 && s.state === "playing"; k++) {
    for (let l = 0; l < 3; l++) signal.action(s, "lane:" + l);
    signal.update(s, 1 / 60, {});
  }
  assert.equal(s.state, "lost");
  assert(s.bad > 100);
});
test("Signal exact note awards once; invalid lanes ignored", () => {
  const s = signal.create(1);
  s.time = s.notes[0].at;
  signal.action(s, "lane:0");
  const score = s.score;
  signal.action(s, "lane:0");
  signal.action(s, "lane:99");
  assert.equal(s.hit, 1);
  assert.equal(s.score, score);
});
test("Signal cues follow phrase note timestamps", () => {
  const s = signal.create(1);
  s.time = s.notes[25].at - 0.01;
  s.notes.slice(0, 25).forEach((n) => (n.cued = true));
  signal.update(s, 1 / 60, {});
  assert.equal(s.events.filter((e) => e === "beat").length, 1);
  assert(s.notes[25].cued);
});
test("Wreck edge shortcut loses; gate needs overlap", () => {
  const s = wreck.create(1);
  step(wreck, s, 500, { right: true });
  assert.equal(s.state, "lost");
  const q = wreck.create(2);
  q.player = { x: 600, y: 1740, vy: 100 };
  wreck.update(q, 1 / 60, {});
  assert.equal(q.stage, 1);
  q.player = { x: 360, y: 1740, vy: 100 };
  wreck.update(q, 1 / 60, {});
  assert.equal(q.stage, 2);
});
test("Wreck missed gate costs hull; death cannot advance", () => {
  const s = wreck.create(1);
  s.player = { x: 600, y: 1840, vy: 310 };
  wreck.update(s, 1 / 60, {});
  assert.equal(s.hp, 4);
  assert.equal(s.player.y, 1450);
  s.hp = 1;
  s.inv = 0;
  s.player = { x: 690, y: 1740, vy: 100 };
  wreck.update(s, 1 / 60, {});
  assert.equal(s.state, "lost");
  assert.equal(s.hp, 0);
});
test("Wreck finite ammo and landing reload", () => {
  const s = wreck.create(2);
  s.platforms = [];
  step(wreck, s, 90, { action: true });
  assert(s.ammo < 8);
  s.ammo = 0;
  s.platforms = [{ x: 300, y: 500, w: 120, danger: false }];
  s.player = { x: 360, y: 482, vy: 100 };
  wreck.update(s, 1 / 60, {});
  assert.equal(s.ammo, 8);
});
test("Race gate order cannot skip or repeat", () => {
  const s = race.create(1);
  s.player = { ...s.player, ...race.track(-Math.PI / 2 + Math.PI) };
  race.update(s, 1 / 60, {});
  assert.equal(s.passed, 0);
  s.player = { ...s.player, ...race.track(-Math.PI / 2 + Math.PI / 6) };
  race.update(s, 1 / 60, {});
  assert.equal(s.passed, 1);
  race.update(s, 1 / 60, {});
  assert.equal(s.passed, 1);
});
test("Race touch brake cools despite boost input", () => {
  const s = race.create(1);
  s.heat = 90;
  step(race, s, 30, { brake: true, action: true });
  assert(s.heat < 90);
  assert(race.controls().some((c) => c.id === "brake"));
});
test("Dock incorrect service is rejected", () => {
  const s = dock.create(1);
  dock.update(s, 1 / 60, {});
  const q = s.ships[0];
  dock.action(s, "ship:1");
  dock.action(s, "bay:" + ((q.needs[0] + 1) % 3));
  assert.equal(q.bay, -1);
  assert.equal(s.score, 0);
});
test("Dock busy bay rejects second ship and awards once", () => {
  const s = dock.create(1);
  s.ships = [
    { id: 1, slot: 0, needs: [0], patience: 20, max: 20, bay: -1, progress: 0 },
    { id: 2, slot: 1, needs: [0], patience: 20, max: 20, bay: -1, progress: 0 },
  ];
  s.spawn = 10;
  dock.action(s, "ship:1");
  dock.action(s, "bay:0");
  dock.action(s, "ship:2");
  dock.action(s, "bay:0");
  assert.equal(s.ships[1].bay, -1);
  step(dock, s, 160);
  assert.equal(s.served, 1);
  const score = s.score;
  step(dock, s, 5);
  assert.equal(s.score, score);
});
test("Dock neglected queue loses at four misses", () => {
  const s = dock.create(1);
  step(dock, s, 6000);
  assert.equal(s.state, "lost");
  assert.equal(s.missed, 4);
});
test("Swarm Nova honors arrival protection/cooldown", () => {
  const s = swarm.create(1);
  s.enemies = [
    { x: 365, y: 400, hp: 80, age: 0.1 },
    { x: 370, y: 400, hp: 80, age: 1 },
  ];
  swarm.action(s, "primary");
  assert.equal(s.enemies[0].hp, 80);
  assert.equal(s.enemies[1].hp, 40);
  swarm.action(s, "primary");
  assert.equal(s.enemies[1].hp, 40);
});
test("Swarm lethal frame cannot collect scrap", () => {
  const s = swarm.create(1);
  s.hp = 1;
  s.enemies = [
    { x: 360, y: 400, hp: 100, max: 100, age: 1, speed: 0, r: 20, contact: 0 },
  ];
  s.scrap = [{ x: 360, y: 400 }];
  s.shot = 1;
  swarm.update(s, 1 / 60, {});
  assert.equal(s.state, "lost");
  assert.equal(s.score, 0);
  assert.equal(s.collected, 0);
});
test("Swarm choices distinct and once-only", () => {
  for (const [key, field] of [
    ["upgrade:cutter", "weapon"],
    ["upgrade:drones", "drones"],
    ["upgrade:chain", "chains"],
  ]) {
    const s = swarm.create(1),
      old = s[field];
    s.state = "choice";
    swarm.action(s, key);
    assert.equal(s[field], old + 1);
    assert.equal(s.stage, 2);
    swarm.action(s, key);
    assert.equal(s[field], old + 1);
  }
});
test("Scrapline economy/power rejects overspend", () => {
  const s = defense.create(1);
  s.cash = 1000;
  s.capacity = 1;
  defense.action(s, "build:cutter");
  assert.equal(s.cash, 1000);
  assert.equal(s.power, 0);
  defense.action(s, "build:tractor");
  assert.equal(s.cash, 955);
  assert.equal(s.power, 1);
  s.selected = 1;
  defense.action(s, "build:tractor");
  assert.equal(s.cash, 955);
  defense.action(s, "generator");
  assert.equal(s.capacity, 4);
});
test("Scrapline loot travels before currency credit", () => {
  const s = defense.create(1);
  s.enemies = [{ ...defense.at(30), d: 30, hp: 0, max: 60, slow: 0, speed: 0 }];
  const cash = s.cash;
  defense.update(s, 1 / 60, {});
  assert.equal(s.cash, cash);
  assert.equal(s.parcels.length, 1);
  step(defense, s, 700);
  assert.equal(s.cash, cash + 24);
  assert.equal(s.parcels.length, 0);
});
test("Scrapline duplicate wave start ignored; core death loses", () => {
  const s = defense.create(1);
  defense.action(s, "wave");
  defense.action(s, "wave");
  assert.equal(s.wave, 1);
  s.hp = 1;
  s.enemies = [
    {
      ...defense.at(defense.pathLength),
      d: defense.pathLength,
      hp: 10,
      max: 10,
      slow: 0,
      speed: 0,
    },
  ];
  defense.update(s, 1 / 60, {});
  assert.equal(s.state, "lost");
  assert.equal(s.hp, 0);
});
