import {
  base,
  tick,
  dist,
  clamp,
  finish,
  burst,
  backdrop,
  box,
  circle,
  line,
  text,
  sprite,
  health,
  particles,
} from "../core.js";
export const title = "Scrapline Defense";
export const path = [
  { x: 20, y: 140 },
  { x: 560, y: 140 },
  { x: 560, y: 330 },
  { x: 150, y: 330 },
  { x: 150, y: 550 },
  { x: 690, y: 550 },
];
const lengths = path.slice(1).map((p, k) => dist(p, path[k]));
export const pathLength = lengths.reduce((a, b) => a + b, 0);
export function at(distance) {
  let d = clamp(distance, 0, pathLength);
  for (let k = 0; k < lengths.length; k++) {
    if (d <= lengths[k]) {
      const t = d / lengths[k];
      return {
        x: path[k].x + (path[k + 1].x - path[k].x) * t,
        y: path[k].y + (path[k + 1].y - path[k].y) * t,
      };
    }
    d -= lengths[k];
  }
  return { ...path.at(-1) };
}
export const types = {
  cutter: { cost: 60, power: 2, range: 155, damage: 14, rate: 0.7 },
  arc: { cost: 90, power: 3, range: 135, damage: 12, rate: 1.1 },
  tractor: { cost: 45, power: 1, range: 140, damage: 3, rate: 0.5 },
};
const plotPositions = [
  [180, 225],
  [360, 225],
  [645, 225],
  [460, 415],
  [280, 415],
  [65, 435],
  [260, 635],
  [460, 635],
  [640, 635],
];
export function create(seed) {
  return {
    ...base(seed),
    hp: 12,
    cash: 180,
    power: 0,
    capacity: 6,
    generator: 0,
    plots: plotPositions.map(([x, y]) => ({
      x,
      y,
      type: null,
      level: 0,
      cooldown: 0,
    })),
    selected: 0,
    enemies: [],
    parcels: [],
    beams: [],
    wave: 0,
    spawned: 0,
    spawn: 0,
    intermission: true,
    notice: "BUILD DEFENSES · START WAVE",
    noticeTime: 3,
  };
}
export function action(s, key) {
  if (s.state !== "playing") return;
  s.noticeTime = 1.5;
  const plot = s.plots[s.selected];
  if (key === "wave") {
    if (s.intermission) {
      s.wave++;
      s.intermission = false;
      s.spawned = 0;
      s.spawn = 0;
      s.notice = "";
    }
    return;
  }
  if (key === "generator") {
    const cost = 80 + s.generator * 40;
    if (s.cash < cost) {
      s.notice = "NOT ENOUGH SALVAGE";
      return;
    }
    s.cash -= cost;
    s.generator++;
    s.capacity += 3;
    s.notice = "POWER +3";
    return;
  }
  if (key === "upgrade") {
    if (!plot?.type) {
      s.notice = "SELECT A TOWER";
      return;
    }
    if (plot.level >= 3) {
      s.notice = "MAX LEVEL";
      return;
    }
    if (s.cash < 50) {
      s.notice = "NOT ENOUGH SALVAGE";
      return;
    }
    if (s.power + 1 > s.capacity) {
      s.notice = "NEEDS POWER";
      return;
    }
    s.cash -= 50;
    s.power++;
    plot.level++;
    s.notice = "TOWER UPGRADED";
    return;
  }
  if (key.startsWith("build:")) {
    const type = key.slice(6),
      cfg = types[type];
    if (!cfg || !plot) return;
    if (plot.type) {
      s.notice = "PLOT OCCUPIED";
      return;
    }
    if (s.cash < cfg.cost) {
      s.notice = "NOT ENOUGH SALVAGE";
      return;
    }
    if (s.power + cfg.power > s.capacity) {
      s.notice = "NEEDS POWER";
      return;
    }
    s.cash -= cfg.cost;
    s.power += cfg.power;
    plot.type = type;
    plot.level = 1;
    s.notice = "TOWER ONLINE";
    s.events.push("upgrade");
  }
}
export function update(s, dt, i) {
  if (s.state !== "playing") return;
  tick(s, dt);
  s.noticeTime = Math.max(0, s.noticeTime - dt);
  if (!s.noticeTime) s.notice = "";
  if (i.tap) {
    let nearest = -1,
      d = 52;
    for (let k = 0; k < s.plots.length; k++) {
      const n = dist(i.tap, s.plots[k]);
      if (n < d) {
        d = n;
        nearest = k;
      }
    }
    if (nearest >= 0) s.selected = nearest;
  }
  if (!s.intermission) {
    s.spawn -= dt;
    if (s.spawn <= 0 && s.spawned < 5 + s.wave) {
      const hp = 40 + s.wave * 20;
      const p = at(0);
      s.enemies.push({
        ...p,
        d: 0,
        hp,
        max: hp,
        slow: 0,
        speed: 40 + s.wave * 4,
      });
      s.spawned++;
      s.spawn = 1.5;
    }
  }
  for (const e of s.enemies) {
    e.slow = Math.max(0, e.slow - dt);
    e.d += e.speed * (e.slow > 0 ? 0.42 : 1) * dt;
    Object.assign(e, at(e.d));
  }
  for (const p of s.plots) {
    p.cooldown -= dt;
    if (!p.type || p.cooldown > 0) continue;
    const t = types[p.type],
      targets = s.enemies
        .filter((e) => e.hp > 0 && dist(p, e) < t.range)
        .sort((a, b) => b.d - a.d);
    if (!targets.length) continue;
    const chosen = targets.slice(0, p.type === "arc" ? 3 : 1);
    let prev = p;
    for (const e of chosen) {
      e.hp -= t.damage * (1 + (p.level - 1) * 0.65);
      if (p.type === "tractor") e.slow = 1.2;
      s.beams.push({
        x: prev.x,
        y: prev.y,
        xx: e.x,
        yy: e.y,
        life: 0.15,
        color:
          p.type === "arc"
            ? "#b7a5ff"
            : p.type === "tractor"
              ? "#8ce5dc"
              : "#ffd39a",
      });
      prev = e;
    }
    p.cooldown = t.rate;
  }
  for (const e of s.enemies) {
    if (e.hp <= 0) {
      s.score += 100;
      s.parcels.push({ d: e.d, value: 24 });
      burst(s, e.x, e.y);
    } else if (e.d >= pathLength) {
      s.hp--;
      s.events.push("hit");
    }
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0 && e.d < pathLength);
  // Loot is not spendable until it physically reaches the core along the conveyor.
  for (const q of s.parcels) {
    q.d += 190 * dt;
    if (q.d >= pathLength) {
      s.cash += q.value;
      q.delivered = true;
      s.events.push("tap");
    }
  }
  s.parcels = s.parcels.filter((q) => !q.delivered);
  s.beams = s.beams.filter((b) => (b.life -= dt) > 0);
  if (s.hp <= 0) {
    s.hp = 0;
    finish(s, false);
    return;
  }
  if (
    !s.intermission &&
    s.spawned >= 5 + s.wave &&
    !s.enemies.length &&
    !s.parcels.length
  ) {
    if (s.wave >= 6) {
      s.score += s.hp * 250 + s.cash;
      finish(s, true);
    } else {
      s.intermission = true;
      s.cash += 60;
      s.score += 300;
      s.notice = "WAVE CLEARED · BUILD / UPGRADE";
      s.noticeTime = 5;
    }
  }
  if (s.time > 600) finish(s, false);
}
export function controls() {
  return [
    { id: "build:cutter", label: "CUTTER · 60" },
    { id: "build:arc", label: "ARC · 90" },
    { id: "build:tractor", label: "TRACTOR · 45" },
    { id: "upgrade", label: "UPGRADE · 50" },
    { id: "generator", label: "POWER" },
    { id: "wave", label: "START WAVE" },
  ];
}
export function hud(s) {
  return {
    goal: `WAVE ${s.wave} / 6`,
    detail: `SALVAGE ${s.cash} · POWER ${s.power} / ${s.capacity}`,
    health: `CORE ${s.hp} / 12`,
  };
}
export function render(c, s) {
  backdrop(c, s, "#1d3145");
  for (let k = 0; k < path.length - 1; k++) {
    line(c, path[k].x, path[k].y, path[k + 1].x, path[k + 1].y, "#253647", 36);
    line(c, path[k].x, path[k].y, path[k + 1].x, path[k + 1].y, "#63727c", 2);
  }
  for (let d = (s.time * 40) % 45; d < pathLength; d += 45) {
    const p = at(d);
    circle(c, p.x, p.y, 3, "#a5bda0");
  }
  for (let k = 0; k < s.plots.length; k++) {
    const p = s.plots[k];
    box(
      c,
      p.x - 30,
      p.y - 30,
      60,
      60,
      k === s.selected ? "#314659" : "#172532",
      k === s.selected ? "#ffe0a0" : "#6b889a",
    );
    if (p.type) {
      sprite(
        c,
        p.type === "cutter"
          ? "cannon.png"
          : p.type === "arc"
            ? "circuits.png"
            : "scan.png",
        p.x,
        p.y,
        42,
      );
      text(c, "I".repeat(p.level), p.x, p.y + 47, 13, "#ffd49a");
    } else text(c, "+", p.x, p.y + 9, 28, "#6f8a9a");
    if (k === s.selected) {
      circle(
        c,
        p.x,
        p.y,
        p.type ? types[p.type].range : 140,
        null,
        "#9fc5e32b",
      );
    }
  }
  for (const q of s.parcels) {
    const p = at(q.d);
    sprite(c, "hermetite.png", p.x, p.y, 25);
  }
  for (const e of s.enemies) {
    sprite(c, e.slow ? "bulwark.svg" : "scavenger.svg", e.x, e.y, 40);
    health(c, e.x - 20, e.y - 26, 40, e.hp / e.max);
  }
  for (const b of s.beams) line(c, b.x, b.y, b.xx, b.yy, b.color, 3);
  sprite(c, "storage.png", 674, 550, 70);
  text(c, "CORE", 670, 600, 13, "#bfdbea");
  text(
    c,
    "POWER +3 · " + (80 + s.generator * 40) + " SALVAGE",
    360,
    700,
    13,
    "#b6c5ce",
  );
  particles(c, s);
}
