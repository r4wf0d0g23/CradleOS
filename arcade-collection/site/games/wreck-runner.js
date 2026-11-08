import {
  base,
  tick,
  clamp,
  rand,
  hurt,
  finish,
  burst,
  backdrop,
  box,
  line,
  circle,
  text,
  sprite,
  ship,
  particles,
} from "../core.js";
export const title = "Wreck Runner";
function shaft(s) {
  s.player = { x: 360, y: 90, vy: 0 };
  s.camera = 0;
  s.platforms = [];
  s.enemies = [];
  s.scrap = [];
  s.shots = [];
  s.ammo = 8;
  s.fire = 0;
  for (let k = 0; k < 15; k++) {
    const y = 220 + k * 100,
      x = 70 + ((k * 193 + s.stage * 67) % 450);
    s.platforms.push({ x, y, w: 155, danger: k % 6 === 4 });
    s.scrap.push({ x: 100 + ((k * 237) % 520), y: y - 45, taken: false });
    if (k % 3 === 1)
      s.enemies.push({ x: 120 + ((k * 73) % 480), y: y + 35, hp: 2 });
  }
  s.depth = 1800;
  s.gate = { x: 360, y: 1760 };
}
export function create(seed) {
  const s = { ...base(seed), hp: 5 };
  shaft(s);
  return s;
}
export function action() {}
export function update(s, dt, i) {
  if (s.state !== "playing") return;
  tick(s, dt);
  s.fire = Math.max(0, s.fire - dt);
  const p = s.player,
    oldY = p.y;
  if (p.x < 75 || p.x > 645) {
    hurt(s);
    if (s.state !== "playing") return;
  }
  let dx = ((i.right ? 1 : 0) - (i.left ? 1 : 0)) * 230;
  if (i.dragging && i.pointer) dx = clamp((i.pointer.x - p.x) * 6, -230, 230);
  p.x = clamp(p.x + dx * dt, 32, 688);
  p.vy = Math.min(310, p.vy + 270 * dt);
  if (i.action && s.ammo > 0 && s.fire <= 0) {
    s.ammo--;
    s.fire = 0.16;
    p.vy = Math.max(-65, p.vy - 75);
    s.shots.push({ x: p.x, y: p.y + 20 });
    s.events.push("tap");
  }
  p.y += p.vy * dt;
  for (const f of s.platforms)
    if (
      p.vy > 0 &&
      oldY + 17 <= f.y &&
      p.y + 17 >= f.y &&
      p.x > f.x - 10 &&
      p.x < f.x + f.w + 10
    ) {
      p.y = f.y - 17;
      p.vy = 0;
      s.ammo = 8;
      if (f.danger) {
        hurt(s);
        if (s.state !== "playing") return;
        p.vy = -160;
      }
      break;
    }
  for (const b of s.shots) {
    b.y += 620 * dt;
    for (const e of s.enemies)
      if (e.hp > 0 && Math.abs(b.x - e.x) < 27 && Math.abs(b.y - e.y) < 32) {
        e.hp--;
        b.y = s.depth + 200;
        if (!e.hp) {
          s.score += 180;
          burst(s, e.x, e.y - s.camera);
        }
      }
  }
  s.shots = s.shots
    .filter((b) => b.y < s.depth + 100 && b.y > s.camera - 30)
    .slice(-50);
  for (const e of s.enemies)
    if (e.hp > 0 && Math.hypot(p.x - e.x, p.y - e.y) < 37) {
      hurt(s);
      if (s.state !== "playing") return;
      e.hp = 0;
    }
  for (const q of s.scrap)
    if (!q.taken && Math.hypot(p.x - q.x, p.y - q.y) < 34) {
      q.taken = true;
      s.score += 75;
      s.events.push("tap");
    }
  s.camera = clamp(p.y - 210, 0, s.depth - 640);
  if (Math.hypot(p.x - s.gate.x, p.y - s.gate.y) < 74) {
    s.score += 800 + s.ammo * 20;
    if (s.stage === 3) {
      finish(s, true);
    } else {
      s.stage++;
      s.hp = Math.min(5, s.hp + 1);
      shaft(s);
      s.events.push("upgrade");
    }
  }
  if (p.y > s.depth + 30 && s.state === "playing") {
    hurt(s);
    if (s.state !== "playing") return;
    p.y = 1450;
    p.vy = 0;
    s.ammo = 8;
  }
  if (s.time > 300) finish(s, false);
}
export function hud(s) {
  return {
    goal: `SHAFT ${s.stage} / 3`,
    detail: `DEPTH ${Math.floor(s.player.y)} / 1800 · AMMO ${s.ammo}`,
    health: `HULL ${s.hp}`,
    action: `FIRE · ${s.ammo}`,
  };
}
export function render(c, s) {
  backdrop(c, s, "#322631");
  box(c, 28, 0, 47, 720, "#4a202033", "#a94c3c");
  box(c, 645, 0, 47, 720, "#4a202033", "#a94c3c");
  for (let y = -s.camera % 100; y < 720; y += 100) {
    box(c, 0, y, 28, 80, "#283441", "#57606b");
    box(c, 692, y, 28, 80, "#283441", "#57606b");
    line(c, 32, y + 25, 688, y + 25, "#b8a08812");
  }
  for (const f of s.platforms) {
    const y = f.y - s.camera;
    if (y < -30 || y > 740) continue;
    box(
      c,
      f.x,
      y,
      f.w,
      18,
      f.danger ? "#672e2d" : "#2d4350",
      f.danger ? "#ff7167" : "#8aadb9",
    );
    for (let x = f.x + 6; x < f.x + f.w; x += 26)
      line(c, x, y + 3, x + 12, y + 15, f.danger ? "#ffb062" : "#b7c7c555", 3);
  }
  for (const q of s.scrap)
    if (!q.taken && q.y - s.camera < 730 && q.y - s.camera > 0)
      sprite(c, "circuits.png", q.x, q.y - s.camera, 28);
  for (const e of s.enemies)
    if (e.hp > 0)
      sprite(c, "needler.svg", e.x, e.y - s.camera, 54, Math.PI / 2);
  for (const b of s.shots)
    line(c, b.x, b.y - s.camera, b.x, b.y - s.camera + 18, "#ffcf86", 4);
  sprite(c, "gate.png", 360, s.gate.y - s.camera, 150);
  if (s.gate.y - s.camera < 700)
    text(c, "RECOVERY GATE", 360, s.gate.y - s.camera + 85, 17, "#b3eefa");
  ship(c, s, { x: s.player.x, y: s.player.y - s.camera }, 55, Math.PI / 2);
  particles(c, s);
}
