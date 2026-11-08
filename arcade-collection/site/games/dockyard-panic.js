import {
  base,
  tick,
  clamp,
  rand,
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
export const title = "Dockyard Panic";
const names = ["REPAIR", "FUEL", "RELOAD"],
  icons = ["hull.png", "fuel.png", "cannon.png"];
const shipPoint = (k) => ({ x: 140 + k * 220, y: 210 });
const bayPoint = (k) => ({ x: 140 + k * 220, y: 510 });
export function create(seed) {
  return {
    ...base(seed),
    ships: [],
    bays: [null, null, null],
    selected: null,
    nextId: 1,
    spawn: 0,
    served: 0,
    missed: 0,
    shiftTime: 0,
    spawned: 0,
    notice: "SELECT SHIP → SERVICE BAY",
    noticeTime: 3,
  };
}
function add(s) {
  const slot = [0, 1, 2].find((k) => !s.ships.some((q) => q.slot === k));
  if (slot === undefined) return false;
  const first = (s.spawned + s.stage) % 3,
    needs = s.stage >= 2 ? [first, (first + 1 + (s.spawned % 2)) % 3] : [first];
  s.ships.push({
    id: s.nextId++,
    slot,
    needs,
    patience: 23 + s.stage * 2,
    max: 23 + s.stage * 2,
    bay: -1,
    progress: 0,
  });
  s.spawned++;
  return true;
}
export function action(s, key) {
  if (s.state !== "playing") return;
  if (key.startsWith("ship:")) {
    const slot = Number(key.slice(5)) - 1,
      q = s.ships.find((q) => q.slot === slot);
    s.selected = q?.id ?? null;
    return;
  }
  if (key.startsWith("bay:")) {
    const k = Number(key.slice(4)),
      q = s.ships.find((q) => q.id === s.selected);
    if (!q || k < 0 || k > 2) return;
    if (q.bay >= 0) {
      s.notice = "SERVICE IN PROGRESS";
      s.noticeTime = 1;
      return;
    }
    if (s.bays[k] !== null) {
      s.notice = "BAY BUSY";
      s.noticeTime = 1;
      return;
    }
    if (!q.needs.includes(k)) {
      s.notice = "SERVICE NOT REQUIRED";
      s.noticeTime = 1;
      return;
    }
    q.bay = k;
    q.progress = 0;
    s.bays[k] = q.id;
    s.events.push("tap");
  }
}
export function update(s, dt, i) {
  if (s.state !== "playing") return;
  tick(s, dt);
  s.shiftTime += dt;
  s.noticeTime = Math.max(0, s.noticeTime - dt);
  if (!s.noticeTime) s.notice = "";
  s.spawn -= dt;
  if (s.spawn <= 0 && s.spawned < s.stage * 2 + 4) {
    if (add(s)) s.spawn = Math.max(3, 5 - s.stage * 0.5);
    else s.spawn = 0.5;
  }
  if (i.tap) {
    for (let k = 0; k < 3; k++) {
      const p = shipPoint(k),
        b = bayPoint(k);
      if (Math.abs(i.tap.x - p.x) < 85 && Math.abs(i.tap.y - p.y) < 95)
        action(s, "ship:" + (k + 1));
      if (Math.abs(i.tap.x - b.x) < 85 && Math.abs(i.tap.y - b.y) < 95)
        action(s, "bay:" + k);
    }
  }
  for (const q of [...s.ships]) {
    q.patience -= dt;
    if (q.bay >= 0) {
      q.progress += dt;
      const duration = [2.6, 2.2, 1.8][q.bay];
      if (q.progress >= duration) {
        const bay = q.bay;
        s.bays[bay] = null;
        q.needs = q.needs.filter((n) => n !== bay);
        q.bay = -1;
        q.progress = 0;
        s.score += 90;
        if (!q.needs.length) {
          s.served++;
          s.score += 200 + Math.floor(q.patience * 8);
          s.ships = s.ships.filter((v) => v.id !== q.id);
          if (s.selected === q.id) s.selected = null;
          s.events.push("upgrade");
          burst(s, shipPoint(q.slot).x, 200, "#a9e5cb");
        }
      }
    }
    if (q.patience <= 0 && s.ships.includes(q)) {
      if (q.bay >= 0) s.bays[q.bay] = null;
      s.ships = s.ships.filter((v) => v.id !== q.id);
      if (s.selected === q.id) s.selected = null;
      s.missed++;
      s.events.push("hit");
    }
  }
  if (s.missed >= 4) finish(s, false);
  if (
    s.spawned >= s.stage * 2 + 4 &&
    !s.ships.length &&
    s.state === "playing"
  ) {
    if (s.stage === 3) finish(s, true);
    else {
      s.stage++;
      s.spawned = 0;
      s.spawn = 1;
      s.shiftTime = 0;
      s.score += 500;
      s.events.push("upgrade");
    }
  }
}
export function controls() {
  return names.map((label, k) => ({
    id: "bay:" + k,
    label: ["Q · REPAIR", "W · FUEL", "E · RELOAD"][k],
  }));
}
export function hud(s) {
  return {
    goal: `SHIFT ${s.stage} / 3`,
    detail: `${s.served} SERVICED · ${s.missed} / 4 MISSED`,
    health: s.selected ? "SHIP SELECTED" : "SELECT A SHIP",
  };
}
export function render(c, s) {
  backdrop(c, s, "#3b2f23");
  text(c, "ARRIVALS", 360, 93, 16, "#bfab89");
  for (let k = 0; k < 3; k++) {
    const p = shipPoint(k),
      b = bayPoint(k);
    box(c, p.x - 85, p.y - 90, 170, 180, "#151f2b", "#455665");
    text(c, String(k + 1), p.x - 65, p.y - 64, 14, "#91a6b4");
    line(c, p.x, 310, p.x, 410, "#62786a", 3);
    for (let y = 330; y < 400; y += 20) {
      line(c, p.x - 7, y, p.x, y + 7, "#91ad90");
      line(c, p.x, y + 7, p.x + 7, y, "#91ad90");
    }
    box(
      c,
      b.x - 85,
      b.y - 90,
      170,
      180,
      s.bays[k] !== null ? "#30433c" : "#17252c",
      s.bays[k] !== null ? "#b7e3a0" : "#79959d",
    );
    sprite(c, icons[k], b.x, b.y - 18, 55);
    text(c, names[k], b.x, b.y + 37, 15, "#f5d6a5");
    text(
      c,
      s.bays[k] !== null ? "WORKING" : "READY",
      b.x,
      b.y + 65,
      11,
      "#a5cbb9",
    );
  }
  for (const q of s.ships) {
    const p = shipPoint(q.slot);
    sprite(c, q.slot % 2 ? "chumaq.png" : "lai.png", p.x, p.y - 20, 100);
    if (q.id === s.selected)
      box(c, p.x - 88, p.y - 93, 176, 186, "#ffffff00", "#ffc778");
    health(c, p.x - 65, p.y + 72, 130, q.patience / q.max);
    for (let j = 0; j < q.needs.length; j++)
      sprite(
        c,
        icons[q.needs[j]],
        p.x + (j - (q.needs.length - 1) / 2) * 35,
        p.y + 40,
        26,
      );
    if (q.bay >= 0) {
      const b = bayPoint(q.bay);
      line(c, p.x, p.y + 92, b.x, b.y - 92, "#ecc888", 3);
      health(c, b.x - 62, b.y + 75, 124, q.progress / [2.6, 2.2, 1.8][q.bay]);
    }
  }
  text(c, "RECLAIMED DOCK / ACTIVE SERVICE", 360, 660, 13, "#8e9d9e");
  particles(c, s);
}
