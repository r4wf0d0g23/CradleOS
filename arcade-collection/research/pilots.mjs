import { catalog } from "../site/catalog.js";
import { writeFileSync } from "node:fs";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hookRoutes = new WeakMap();
export function pilot(id, m, s) {
  const i = {};
  if (id === "signal-diver") {
    for (const n of s.notes)
      if (!n.done && Math.abs(n.at - s.time) < 0.0085)
        m.action(s, "lane:" + n.lane);
  }
  if (id === "gatebreaker") {
    if (!s.launched) m.action(s, "primary");
    let x = s.ball.x;
    if (s.ball.vy > 0) {
      x += (s.ball.vx * (623 - s.ball.y)) / s.ball.vy;
      while (x < 12 || x > 708) {
        if (x < 12) x = 24 - x;
        if (x > 708) x = 1416 - x;
      }
    }
    i.dragging = true;
    i.pointer = { x: clamp(x - Math.sin(s.time * 1.7) * 38, 70, 650), y: 650 };
  }
  if (id === "feral-circuit") {
    i.dragging = true;
    i.pointer = m.track(-Math.PI / 2 + (s.next * Math.PI) / 6);
    i.action = s.heat < 70;
  }
  if (id === "dockyard-panic") {
    for (const q of s.ships) {
      if (q.bay < 0) {
        const k = q.needs.find((k) => s.bays[k] === null);
        if (k !== undefined) {
          m.action(s, "ship:" + (q.slot + 1));
          m.action(s, "bay:" + k);
          break;
        }
      }
    }
  }
  if (id === "wreck-runner") {
    const p = s.player;
    const f = s.platforms
      .filter((f) => f.y > p.y - 25 && f.y < p.y + 140)
      .sort((a, b) => a.y - b.y)[0];
    let target = 360;
    if (f && p.x > f.x - 25 && p.x < f.x + f.w + 25)
      target = f.x > 280 ? f.x - 45 : f.x + f.w + 45;
    else target = p.x;
    i.dragging = true;
    i.pointer = { x: clamp(p.y > 1640 ? 360 : target, 95, 625), y: 0 };
    i.action = s.enemies.some(
      (e) =>
        e.hp > 0 && e.y > p.y && e.y - p.y < 180 && Math.abs(e.x - p.x) < 40,
    );
  }
  if (id === "voidhook") {
    const p = s.player,
      t = s.carry ? s.gate : s.cargo[0],
      key = [s.stage, s.carry, s.delivered, t.x, t.y].join(":");
    let mem = hookRoutes.get(s);
    if (!mem || mem.key !== key) {
      let waypoints = [];
      if (t.x > 400 && t.y < 300) waypoints = [{ x: 90, y: 90 }, t];
      else if (t.x < 200 && s.player.x > 400 && s.player.y < 300)
        waypoints = [{ x: 90, y: 90 }, t];
      else if (t.x > 400 && t.y > 500)
        waypoints = [{ x: 90, y: 675 }, { x: 625, y: 675 }, t];
      else if (t.x < 200 && s.player.x > 400 && s.player.y > 450)
        waypoints = [{ x: 625, y: 675 }, { x: 90, y: 675 }, t];
      else waypoints = [t];
      mem = { key, waypoints, refuel: false };
      hookRoutes.set(s, mem);
    }
    while (
      mem.waypoints.length > 1 &&
      Math.hypot(p.x - mem.waypoints[0].x, p.y - mem.waypoints[0].y) < 45
    )
      mem.waypoints.shift();
    const target = mem.waypoints[0];
    if (s.energy < 15) mem.refuel = true;
    if (s.energy > 95) mem.refuel = false;
    i.action = mem.refuel;
    const dx = target.x - p.x,
      dy = target.y - p.y,
      d = Math.hypot(dx, dy),
      speed = Math.min(140, d * 1.5),
      vx = (dx / (d || 1)) * speed,
      vy = (dy / (d || 1)) * speed;
    i.right = vx - p.vx > 8;
    i.left = vx - p.vx < -8;
    i.down = vy - p.vy > 8;
    i.up = vy - p.vy < -8;
  }
  if (id === "salvage-swarm") {
    if (s.state === "choice")
      m.action(s, s.stage === 1 ? "upgrade:chain" : "upgrade:cutter");
    let ax = 0,
      ay = 0;
    for (const e of s.enemies) {
      const dx = s.player.x - e.x,
        dy = s.player.y - e.y,
        d = Math.max(15, Math.hypot(dx, dy));
      if (d < 240) {
        ax += ((dx / d) * 15000) / (d * d);
        ay += ((dy / d) * 15000) / (d * d);
      }
    }
    ax += (360 - s.player.x) / 600;
    ay += (360 - s.player.y) / 600;
    i.right = ax > 0.08;
    i.left = ax < -0.08;
    i.down = ay > 0.08;
    i.up = ay < -0.08;
    if (
      s.nova <= 0 &&
      s.enemies.some(
        (e) => Math.hypot(e.x - s.player.x, e.y - s.player.y) < 160,
      )
    )
      m.action(s, "primary");
  }
  if (id === "scrapline-defense") {
    if (s.intermission) {
      const order = [1, 0, 3, 4, 6, 7, 2, 5, 8];
      for (const k of order) {
        const p = s.plots[k];
        if (!p.type && s.cash >= 60) {
          m.update(s, 0, { tap: { x: p.x, y: p.y } });
          if (s.power + 2 > s.capacity) m.action(s, "generator");
          if (s.power + 2 <= s.capacity) m.action(s, "build:cutter");
        }
      }
      for (const k of order) {
        const p = s.plots[k];
        if (p.type && p.level < 3 && s.cash >= 50) {
          m.update(s, 0, { tap: { x: p.x, y: p.y } });
          if (s.power + 1 > s.capacity) m.action(s, "generator");
          if (s.power + 1 <= s.capacity) m.action(s, "upgrade");
        }
      }
      m.action(s, "wave");
    }
  }
  return i;
}
export async function run(id, seed = 12345) {
  const m = await import(`../site/games/${id}.js`),
    s = m.create(seed);
  let steps = 0;
  for (; steps < 60 * 1000 && !["won", "lost"].includes(s.state); steps++) {
    const i = pilot(id, m, s);
    m.update(s, 1 / 60, i);
    s.events.length = 0;
    s.particles.length = 0;
  }
  return {
    id,
    seed,
    state: s.state,
    seconds: +s.time.toFixed(2),
    score: s.score,
    hp: s.hp,
    stage: s.stage,
    steps,
    extra: {
      wave: s.wave,
      passed: s.passed,
      served: s.served,
      missed: s.missed,
      collected: s.collected,
      delivered: s.delivered,
      blocks: s.blocks?.filter((b) => b.hp > 0).length,
    },
  };
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const results = [];
  for (const g of catalog) {
    const r = await run(g.id);
    results.push(r);
    console.log(JSON.stringify(r));
  }
  writeFileSync(
    new URL("pilots.json", import.meta.url),
    JSON.stringify(results, null, 2),
  );
}
