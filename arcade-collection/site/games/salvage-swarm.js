import {
  base,
  tick,
  move,
  rand,
  dist,
  hurt,
  finish,
  burst,
  backdrop,
  circle,
  line,
  text,
  sprite,
  ship,
  health,
  particles,
} from "../core.js";
export const title = "Salvage Swarm";
export function create(seed) {
  return {
    ...base(seed),
    hp: 5,
    player: { x: 360, y: 400 },
    enemies: [],
    scrap: [],
    beams: [],
    spawn: 0.5,
    shot: 0,
    arc: 0,
    stageTime: 0,
    collected: 0,
    weapon: 1,
    drones: 0,
    chains: 0,
    nova: 0,
    bossSpawned: false,
    bossKilled: false,
  };
}
export function choices(s) {
  return [
    {
      id: "upgrade:cutter",
      label: "Cutter array",
      detail: "More beam damage and range.",
    },
    {
      id: "upgrade:drones",
      label: "Orbit drones",
      detail: "Contact damage around your ship.",
    },
    {
      id: "upgrade:chain",
      label: "Arc relay",
      detail: "Periodic lightning strikes three ferals.",
    },
  ];
}
export function action(s, key) {
  if (s.state === "choice" && key.startsWith("upgrade:")) {
    if (key === "upgrade:cutter") s.weapon++;
    else if (key === "upgrade:drones") s.drones++;
    else if (key === "upgrade:chain") s.chains++;
    else return;
    s.stage++;
    s.stageTime = 0;
    s.enemies = [];
    s.scrap = [];
    s.beams = [];
    s.hp = Math.min(5, s.hp + 1);
    s.state = "playing";
    s.events.push("upgrade");
    return;
  }
  if (s.state !== "playing") return;
  if (key === "primary" && s.nova <= 0) {
    s.nova = 12;
    for (const e of s.enemies)
      if (e.age >= 0.6 && dist(e, s.player) < 185) e.hp -= 40;
    burst(s, s.player.x, s.player.y, "#9ef2ff", 40);
    s.events.push("launch");
    s.novaFlash = 0.25;
  }
}
function spawn(s, boss = false) {
  const edge = Math.floor(rand(s, 0, 4)),
    p =
      edge === 0
        ? { x: 20, y: rand(s, 25, 695) }
        : edge === 1
          ? { x: 700, y: rand(s, 25, 695) }
          : edge === 2
            ? { x: rand(s, 25, 695), y: 20 }
            : { x: rand(s, 25, 695), y: 700 };
  const hp = boss ? 180 : 8 + s.stage * 3;
  s.enemies.push({
    ...p,
    hp,
    max: hp,
    boss,
    speed: boss ? 26 : rand(s, 38, 60) + s.stage * 5,
    r: boss ? 44 : 17,
    age: 0,
    contact: 0,
  });
}
export function update(s, dt, i) {
  if (s.state !== "playing") return;
  tick(s, dt);
  s.stageTime += dt;
  s.shot -= dt;
  s.arc -= dt;
  s.spawn -= dt;
  s.nova = Math.max(0, s.nova - dt);
  s.novaFlash = Math.max(0, (s.novaFlash || 0) - dt);
  move(s, s.player, i, 185, dt);
  if (i.pressed) action(s, "primary");
  if (s.spawn <= 0 && s.enemies.length < 28) {
    spawn(s);
    s.spawn = Math.max(0.4, 0.95 - s.stage * 0.12);
  }
  if (s.stage === 3 && s.stageTime >= 18 && !s.bossSpawned) {
    spawn(s, true);
    s.bossSpawned = true;
  }
  const live = s.enemies
    .filter((e) => e.hp > 0 && e.age >= 0.6)
    .sort((a, b) => dist(a, s.player) - dist(b, s.player));
  if (
    s.shot <= 0 &&
    live.length &&
    dist(live[0], s.player) < 260 + s.weapon * 22
  ) {
    const e = live[0];
    e.hp -= 7 + s.weapon * 3;
    s.shot = 0.32;
    s.beams.push({
      x: s.player.x,
      y: s.player.y,
      xx: e.x,
      yy: e.y,
      life: 0.13,
      color: "#ffcf82",
    });
  }
  if (s.chains && s.arc <= 0) {
    const targets = live.filter((e) => dist(e, s.player) < 330).slice(0, 3);
    let prev = s.player;
    for (const e of targets) {
      e.hp -= 12 * s.chains;
      s.beams.push({
        x: prev.x,
        y: prev.y,
        xx: e.x,
        yy: e.y,
        life: 0.22,
        color: "#aeacff",
      });
      prev = e;
    }
    s.arc = 1.8;
  }
  for (const e of s.enemies) {
    e.age += dt;
    e.contact = Math.max(0, e.contact - dt);
    if (e.hp <= 0) continue;
    const dx = s.player.x - e.x,
      dy = s.player.y - e.y,
      d = Math.hypot(dx, dy);
    if (d) {
      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt;
    }
    if (e.age >= 0.6 && dist(e, s.player) < e.r + 16) {
      hurt(s);
      if (s.state !== "playing") return;
    }
    for (let k = 0; k < s.drones; k++) {
      const t = s.time * 2.4 + (k * Math.PI * 2) / s.drones,
        q = {
          x: s.player.x + Math.cos(t) * 75,
          y: s.player.y + Math.sin(t) * 75,
        };
      if (e.age >= 0.6 && dist(q, e) < e.r + 15 && e.contact <= 0) {
        e.hp -= 10;
        e.contact = 0.24;
      }
    }
  }
  for (const e of s.enemies)
    if (e.hp <= 0) {
      s.score += e.boss ? 1500 : 80;
      s.scrap.push({ x: e.x, y: e.y });
      burst(s, e.x, e.y);
      if (e.boss) s.bossKilled = true;
    }
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  for (const q of s.scrap) {
    const d = dist(q, s.player);
    if (d < 110) {
      q.x += (s.player.x - q.x) * Math.min(1, dt * 5);
      q.y += (s.player.y - q.y) * Math.min(1, dt * 5);
    }
    if (dist(q, s.player) < 25) {
      q.got = true;
      s.collected++;
      s.score += 35;
    }
  }
  s.scrap = s.scrap.filter((q) => !q.got).slice(-80);
  s.beams = s.beams.filter((b) => (b.life -= dt) > 0);
  if (s.state !== "playing") return;
  if (s.bossKilled) finish(s, true);
  else if (s.stage < 3 && s.stageTime >= 24) {
    s.state = "choice";
    s.score += 300;
  } else if (s.time > 150) finish(s, false);
}
export function hud(s) {
  return {
    goal: `WAVE ${s.stage} / 3`,
    detail: `SCRAP ${s.collected} · ${s.enemies.length} FERALS`,
    health: `HULL ${s.hp}`,
    action: s.nova > 0 ? `NOVA ${Math.ceil(s.nova)}s` : "NOVA READY",
  };
}
export function render(c, s) {
  backdrop(c, s, "#361d2d");
  sprite(c, "storage.png", 560, 160, 230, 0.2, 0.13);
  for (const q of s.scrap) sprite(c, "circuits.png", q.x, q.y, 22);
  for (const e of s.enemies) {
    sprite(
      c,
      e.boss ? "guardian.svg" : e.max % 2 ? "scavenger.svg" : "needler.svg",
      e.x,
      e.y,
      e.boss ? 116 : 46,
      Math.atan2(s.player.y - e.y, s.player.x - e.x),
      e.age < 0.6 ? 0.4 : 1,
    );
    health(c, e.x - e.r, e.y - e.r - 9, e.r * 2, e.hp / e.max);
  }
  for (const b of s.beams) line(c, b.x, b.y, b.xx, b.yy, b.color, 3);
  for (let k = 0; k < s.drones; k++) {
    const t = s.time * 2.4 + (k * Math.PI * 2) / s.drones;
    sprite(
      c,
      "wingdrone.svg",
      s.player.x + Math.cos(t) * 75,
      s.player.y + Math.sin(t) * 75,
      33,
      t,
    );
  }
  if (s.novaFlash > 0)
    circle(
      c,
      s.player.x,
      s.player.y,
      185 * (1 - s.novaFlash / 0.25),
      null,
      "#a3e9fc",
    );
  ship(c, s, s.player, 58);
  particles(c, s);
}
