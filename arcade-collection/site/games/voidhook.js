import {
  base,
  tick,
  clamp,
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
  particles,
} from "../core.js";
export const title = "Voidhook";
function field(s) {
  s.player = { x: 100, y: 580, vx: 85, vy: -40 };
  s.anchors = [
    { x: 190, y: 410 },
    { x: 380, y: 240 },
    { x: 560, y: 410 },
    { x: 340, y: 570 },
    { x: 110, y: 120 },
    { x: 610, y: 120 },
    { x: 600, y: 630 },
    { x: 110, y: 620 },
  ];
  s.cargo = [
    { x: 120, y: 150 },
    { x: 570, y: 150 },
    { x: 570, y: 600 },
  ].slice(0, s.stage);
  s.gate = { x: 100, y: 600 };
  s.carry = false;
  s.delivered = 0;
  s.hook = -1;
  s.rope = 0;
  s.debris = [
    { x: 350, y: 390, r: 36 },
    { x: 220, y: 240, r: 24 },
    { x: 500, y: 540, r: 27 },
  ];
  s.fieldTime = 0;
  s.energy = 100;
}
export function create(seed) {
  const s = { ...base(seed), hp: 5 };
  field(s);
  return s;
}
export function action(s, key) {
  if (key === "primary" && s.state === "playing") s.toggle = !s.toggle;
}
export function update(s, dt, i) {
  if (s.state !== "playing") return;
  tick(s, dt);
  s.fieldTime += dt;
  const p = s.player,
    held = i.action || s.toggle;
  if (held && s.hook < 0) {
    let best = Infinity;
    for (let k = 0; k < s.anchors.length; k++) {
      const a = s.anchors[k],
        d = dist(p, a);
      if (d < best && d < 310) {
        best = d;
        s.hook = k;
        s.rope = Math.max(60, d);
      }
    }
  }
  if (!held) {
    s.hook = -1;
    s.toggle = false;
  }
  let ax = ((i.right ? 1 : 0) - (i.left ? 1 : 0)) * 150,
    ay = ((i.down ? 1 : 0) - (i.up ? 1 : 0)) * 150;
  if (i.dragging && i.pointer) {
    const dx = i.pointer.x - p.x,
      dy = i.pointer.y - p.y,
      d = Math.hypot(dx, dy);
    if (d > 8) {
      ax = (dx / d) * 150;
      ay = (dy / d) * 150;
    }
  }
  if (s.hook >= 0) s.energy = Math.min(100, s.energy + 55 * dt);
  else if (ax || ay) s.energy = Math.max(0, s.energy - 28 * dt);
  if (s.energy <= 0) {
    ax = 0;
    ay = 0;
  }
  p.vx = (p.vx + ax * dt) * Math.exp(-0.24 * dt);
  p.vy = (p.vy + ay * dt) * Math.exp(-0.24 * dt);
  const v = Math.hypot(p.vx, p.vy);
  if (v > 280) {
    p.vx *= 280 / v;
    p.vy *= 280 / v;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (s.hook >= 0) {
    const a = s.anchors[s.hook],
      dx = p.x - a.x,
      dy = p.y - a.y,
      d = Math.hypot(dx, dy);
    if (d > s.rope) {
      const nx = dx / d,
        ny = dy / d;
      p.x = a.x + nx * s.rope;
      p.y = a.y + ny * s.rope;
      const radial = p.vx * nx + p.vy * ny;
      if (radial > 0) {
        p.vx -= radial * nx;
        p.vy -= radial * ny;
      }
    }
  }
  for (const axis of ["x", "y"]) {
    const vel = axis === "x" ? "vx" : "vy";
    if (p[axis] < 20) {
      p[axis] = 20;
      p[vel] = Math.abs(p[vel]) * 0.6;
    }
    if (p[axis] > 700) {
      p[axis] = 700;
      p[vel] = -Math.abs(p[vel]) * 0.6;
    }
  }
  for (const d of s.debris) {
    const dx = p.x - d.x,
      dy = p.y - d.y,
      r = Math.hypot(dx, dy);
    if (r < d.r + 16) {
      const nx = dx / (r || 1),
        ny = dy / (r || 1);
      p.x = d.x + nx * (d.r + 17);
      p.y = d.y + ny * (d.r + 17);
      p.vx = nx * 140;
      p.vy = ny * 140;
      s.hook = -1;
      s.toggle = false;
      hurt(s);
      if (s.state !== "playing") return;
      burst(s, p.x, p.y);
    }
  }
  if (!s.carry) {
    const k = s.cargo.findIndex((c) => dist(p, c) < 36);
    if (k >= 0) {
      s.cargo.splice(k, 1);
      s.carry = true;
      s.events.push("tap");
    }
  }
  if (s.carry && dist(p, s.gate) < 58) {
    s.carry = false;
    s.delivered++;
    s.score += 600;
    s.events.push("upgrade");
    burst(s, p.x, p.y, "#87efff", 18);
    if (s.delivered >= s.stage) {
      if (s.stage === 3) {
        s.score += Math.floor(Math.max(0, 420 - s.time) * 5);
        finish(s, true);
      } else {
        s.stage++;
        s.hp = Math.min(5, s.hp + 1);
        s.toggle = false;
        field(s);
      }
    }
  }
  if (s.time > 420) finish(s, false);
}
export function hud(s) {
  return {
    goal: `FIELD ${s.stage} / 3`,
    detail: `CARGO ${s.delivered} / ${s.stage} · ${s.carry ? "DELIVER TO GATE" : "RECOVER CARGO"}`,
    health: `HULL ${s.hp} · THRUST ${Math.round(s.energy)}%`,
    action: s.hook >= 0 ? "TETHERED" : "TETHER",
  };
}
export function render(c, s) {
  backdrop(c, s, "#153749");
  circle(c, 620, 80, 105, "#091720", "#41666c");
  circle(c, 620, 80, 118, null, "#6a9b8c33");
  for (const a of s.anchors) {
    sprite(c, "storage.png", a.x, a.y, 65);
    circle(c, a.x, a.y, 44, null, "#79d5df66");
    circle(c, a.x, a.y, 52, null, "#79d5df22");
  }
  for (const d of s.debris)
    sprite(c, "rock-dense.svg", d.x, d.y, d.r * 2.4, s.time * 0.04);
  for (const q of s.cargo) {
    sprite(c, "circuits.png", q.x, q.y, 46);
    circle(c, q.x, q.y, 30, null, "#ffd58c");
    text(c, "CARGO", q.x, q.y + 47, 12, "#ffd58c");
  }
  sprite(c, "gate.png", s.gate.x, s.gate.y, 98, s.time * 0.1);
  circle(c, s.gate.x, s.gate.y, 58, null, s.carry ? "#fff3ba" : "#5c9eaf");
  text(c, "RECOVERY", s.gate.x, s.gate.y + 68, 12, "#98e5ef");
  if (s.hook >= 0) {
    const a = s.anchors[s.hook];
    line(c, s.player.x, s.player.y, a.x, a.y, "#96edfa", 3);
  }
  ship(c, s, s.player, 55, Math.atan2(s.player.vy, s.player.vx));
  if (s.carry) sprite(c, "circuits.png", s.player.x - 24, s.player.y + 25, 25);
  particles(c, s);
}
