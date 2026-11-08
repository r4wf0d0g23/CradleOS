import {
  base,
  tick,
  finish,
  clamp,
  backdrop,
  box,
  circle,
  line,
  text,
  particles,
  burst,
} from "../core.js";
export const title = "Signal Diver";
export function create(seed) {
  const s = {
    ...base(seed),
    notes: [],
    hit: 0,
    miss: 0,
    bad: 0,
    lastTap: [-1, -1, -1],
    combo: 0,
    maxCombo: 0,
    flash: [0, 0, 0],
    judgment: "SYNC READY",
    beat: -1,
  };
  for (let k = 0; k < 72; k++)
    s.notes.push({
      at: 2.5 + k * (k < 24 ? 0.72 : k < 48 ? 0.62 : 0.52),
      lane: 0,
      done: false,
    });
  let at = 2.5;
  for (let k = 0; k < 72; k++) {
    s.notes[k].at = at;
    s.notes[k].lane = (k * 5 + Math.floor(k / 4)) % 3;
    at += k < 24 ? 0.72 : k < 48 ? 0.62 : 0.52;
  }
  s.end = at + 1.5;
  return s;
}
export function action(s, key) {
  if (s.state !== "playing" || !key.startsWith("lane:")) return;
  const lane = Number(key.slice(5));
  if (
    !Number.isInteger(lane) ||
    lane < 0 ||
    lane > 2 ||
    s.time - s.lastTap[lane] < 0.12
  )
    return;
  s.lastTap[lane] = s.time;
  s.flash[lane] = 0.15;
  const n = s.notes
    .filter(
      (n) => !n.done && n.lane === lane && Math.abs(n.at - s.time) <= 0.19,
    )
    .sort((a, b) => Math.abs(a.at - s.time) - Math.abs(b.at - s.time))[0];
  if (!n) {
    s.bad++;
    s.combo = 0;
    s.judgment = "EARLY / LATE";
    return;
  }
  n.done = true;
  const error = Math.abs(n.at - s.time),
    perfect = error <= 0.085;
  s.hit++;
  s.combo++;
  s.maxCombo = Math.max(s.maxCombo, s.combo);
  s.score += (perfect ? 150 : 90) + Math.min(20, s.combo) * 5;
  s.judgment = perfect ? "PERFECT" : "LINKED";
  s.events.push("tap");
  burst(s, 180 + lane * 180, 580, ["#81e6f5", "#cba4ff", "#ffcc83"][lane]);
}
export function update(s, dt, i) {
  if (s.state !== "playing") return;
  tick(s, dt);
  for (let l = 0; l < 3; l++) s.flash[l] = Math.max(0, s.flash[l] - dt);
  s.stage = Math.min(3, 1 + Math.floor((s.hit + s.miss) / 24));
  for (const n of s.notes)
    if (!n.done && s.time > n.at + 0.19) {
      n.done = true;
      s.miss++;
      s.combo = 0;
      s.judgment = "LINK LOST";
    }
  // The simulation chart clock drives both visuals and generated beat cues.
  for (const n of s.notes)
    if (!n.cued && s.time >= n.at) {
      n.cued = true;
      s.events.push("beat");
    }
  if (s.time >= s.end) finish(s, s.hit >= 47 && s.hit / (72 + s.bad) >= 0.65);
}
export function hud(s) {
  return {
    goal: `PHRASE ${s.stage} / 3`,
    detail: `${s.hit} / 72 LINKED · COMBO ${s.combo}`,
    health: `ACCURACY ${s.hit + s.miss + s.bad ? Math.round((s.hit / (s.hit + s.miss + s.bad)) * 100) : 100}%`,
  };
}
export function controls() {
  return [
    { id: "lane:0", label: "A · CYAN", tone: "cyan" },
    { id: "lane:1", label: "S · VIOLET", tone: "violet" },
    { id: "lane:2", label: "D · GOLD", tone: "gold" },
  ];
}
export function render(c, s) {
  backdrop(c, s, "#2b1e44");
  for (let l = 0; l < 3; l++) {
    const x = 100 + l * 180,
      col = ["#81e6f5", "#cba4ff", "#ffcc83"][l];
    box(c, x, 70, 160, 570, s.flash[l] ? "#314256" : "#101522", col + "55");
    for (let y = 100; y < 600; y += 50)
      line(c, x + 10, y, x + 150, y, "#ffffff0c");
    circle(c, x + 80, 580, 27, s.flash[l] ? col : "#18283a", col);
    text(c, ["A", "S", "D"][l], x + 80, 588, 23, s.flash[l] ? "#10141c" : col);
  }
  for (const n of s.notes) {
    if (n.done) continue;
    const y = 580 - (n.at - s.time) * 230;
    if (y < 65 || y > 630) continue;
    const x = 180 + n.lane * 180;
    box(
      c,
      x - 52,
      y - 12,
      104,
      24,
      ["#81e6f5", "#cba4ff", "#ffcc83"][n.lane],
      "#fafae5",
    );
    line(c, x - 36, y, x + 36, y, "#141520", 3);
  }
  line(c, 85, 580, 635, 580, "#ffe0a6", 3);
  text(c, s.judgment, 360, 42, 20, "#d5c5ef");
  text(c, "REACTOR LOCK", 360, 684, 16, "#9185ae");
  particles(c, s);
}
