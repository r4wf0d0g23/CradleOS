import {
  base,
  tick,
  clamp,
  dist,
  finish,
  backdrop,
  circle,
  line,
  text,
  box,
  sprite,
  particles,
  burst,
} from "../core.js";
export const title = "Feral Circuit";
export function track(t) {
  return { x: 360 + 260 * Math.cos(t), y: 360 + 235 * Math.sin(t) };
}
export function create(seed) {
  return {
    ...base(seed),
    player: { ...track(-Math.PI / 2), vx: 0, vy: 0, angle: 0 },
    next: 1,
    passed: 0,
    lap: 1,
    heat: 0,
    locked: false,
    limit: 95,
    offroad: false,
    rivals: [
      { progress: 0, speed: 165 },
      { progress: -80, speed: 152 },
    ],
    notice: "",
  };
}
export function action() {}
export function controls() {
  return [
    { id: "brake", label: "BRAKE" },
    { id: "primary", label: "BOOST" },
  ];
}
export function update(s, dt, i) {
  if (s.state !== "playing") return;
  tick(s, dt);
  const p = s.player;
  let steer = (i.right ? 1 : 0) - (i.left ? 1 : 0);
  if (i.dragging && i.pointer) {
    const desired = Math.atan2(i.pointer.y - p.y, i.pointer.x - p.x),
      diff = Math.atan2(
        Math.sin(desired - p.angle),
        Math.cos(desired - p.angle),
      );
    steer = clamp(diff * 2.7, -1, 1);
  }
  p.angle += steer * 2.35 * dt;
  const braking = i.down || i.brake,
    boost = i.action && !s.locked && !braking;
  s.heat = clamp(s.heat + (boost ? 42 : -25) * dt, 0, 100);
  if (s.heat >= 100) s.locked = true;
  if (s.heat <= 35) s.locked = false;
  const q = Math.sqrt(((p.x - 360) / 260) ** 2 + ((p.y - 360) / 235) ** 2);
  s.offroad = q < 0.76 || q > 1.23;
  const target = braking ? 65 : boost ? 330 : 210,
    drag = s.offroad ? 3.5 : 1.8,
    accel = target * drag;
  p.vx += (Math.cos(p.angle) * accel - p.vx * drag) * dt;
  p.vy += (Math.sin(p.angle) * accel - p.vy * drag) * dt;
  if (s.offroad) {
    p.vx *= Math.exp(-2.5 * dt);
    p.vy *= Math.exp(-2.5 * dt);
  }
  p.x = clamp(p.x + p.vx * dt, 20, 700);
  p.y = clamp(p.y + p.vy * dt, 20, 700);
  const checkpoint = track(-Math.PI / 2 + (s.next * Math.PI) / 6);
  if (dist(p, checkpoint) < 64) {
    s.passed++;
    s.score += 120;
    s.next = (s.next + 1) % 12;
    s.lap = Math.min(3, 1 + Math.floor(s.passed / 12));
    s.events.push("tap");
    if (s.passed >= 36) {
      const rank = 1 + s.rivals.filter((r) => r.progress > 3 * 1560).length;
      s.rank = rank;
      s.score += Math.floor((s.limit - s.time) * 100) + (4 - rank) * 600;
      finish(s, true);
    }
  }
  for (const r of s.rivals) r.progress += r.speed * dt;
  s.notice = s.offroad ? "OFF TRACK" : s.locked ? "BOOST COOLING" : "";
  if (s.time >= s.limit) finish(s, false);
}
export function hud(s) {
  return {
    goal: `LAP ${s.lap} / 3`,
    detail: `GATE ${s.passed % 12} / 12 · ${Math.max(0, Math.ceil(s.limit - s.time))}s`,
    health: `HEAT ${Math.round(s.heat)}%`,
    action: s.locked ? "COOLING" : "BOOST",
  };
}
export function render(c, s) {
  backdrop(c, s, "#1e352b");
  c.save();
  c.translate(360, 360);
  c.scale(1, 235 / 260);
  circle(c, 0, 0, 260, null, "#293f43");
  c.lineWidth = 105;
  c.strokeStyle = "#18272c";
  c.beginPath();
  c.arc(0, 0, 260, 0, Math.PI * 2);
  c.stroke();
  for (const r of [202, 320]) {
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.strokeStyle = "#607f72";
    c.lineWidth = 4;
    c.stroke();
  }
  c.setLineDash([20, 20]);
  circle(c, 0, 0, 260, null, "#86ad9144");
  c.restore();
  sprite(c, "storage.png", 360, 360, 210, s.time * 0.015, 0.65);
  text(c, "FERAL CIRCUIT", 360, 355, 20, "#b4ccad");
  text(c, "THREE LAPS", 360, 384, 12, "#779b85");
  for (let k = 0; k < 12; k++) {
    const p = track(-Math.PI / 2 + (k * Math.PI) / 6);
    circle(
      c,
      p.x,
      p.y,
      k === s.next ? 38 : 13,
      k === s.next ? "#99e89622" : "#395746",
      k === s.next ? "#c7ff97" : "#779c78",
    );
    if (k === s.next) text(c, "NEXT", p.x, p.y + 5, 14, "#d5ffaa");
  }
  for (const r of s.rivals) {
    const t = -Math.PI / 2 + (r.progress / 1560) * Math.PI * 2,
      p = track(t);
    sprite(c, "scavenger.svg", p.x, p.y, 45, t + Math.PI / 2);
  }
  sprite(c, "chumaq.png", s.player.x, s.player.y, 61, s.player.angle);
  if (s.heat > 65) circle(c, s.player.x, s.player.y, 35, null, "#ff9c6a");
  particles(c, s);
}
