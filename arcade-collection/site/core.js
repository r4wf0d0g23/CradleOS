export const SIZE = 720;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
export function rng(s) {
  let n = s.seed | 0;
  n ^= n << 13;
  n ^= n >>> 17;
  n ^= n << 5;
  s.seed = n >>> 0;
  return s.seed / 4294967296;
}
export const rand = (s, a, b) => a + rng(s) * (b - a);
export const base = (seed = 12345) => ({
  seed: seed || 12345,
  state: "playing",
  time: 0,
  score: 0,
  hp: 3,
  stage: 1,
  particles: [],
  events: [],
});
export function finish(s, win) {
  if (s.state === "won" || s.state === "lost") return;
  s.state = win ? "won" : "lost";
  s.events.push(win ? "win" : "lose");
}
export function hurt(s, amount = 1) {
  if (s.inv > 0 || s.state !== "playing") return;
  s.hp = Math.max(0, s.hp - amount);
  s.inv = 1;
  s.events.push("hit");
  if (!s.hp) finish(s, false);
}
export function tick(s, dt) {
  s.time += dt;
  s.inv = Math.max(0, (s.inv || 0) - dt);
  for (const p of s.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  s.particles = s.particles.filter((p) => p.life > 0);
}
export function burst(s, x, y, color = "#ff9b50", n = 10) {
  for (let i = 0; i < n && s.particles.length < 180; i++) {
    const a = rand(s, 0, Math.PI * 2),
      v = rand(s, 35, 140);
    s.particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0.5,
      color,
    });
  }
}
export function move(s, p, i, speed, dt) {
  let x = (i.right ? 1 : 0) - (i.left ? 1 : 0),
    y = (i.down ? 1 : 0) - (i.up ? 1 : 0);
  if (i.dragging && i.pointer) {
    x = i.pointer.x - p.x;
    y = i.pointer.y - p.y;
    const d = Math.hypot(x, y);
    if (d < 5) {
      x = 0;
      y = 0;
    } else {
      x /= d;
      y /= d;
    }
  }
  const d = Math.hypot(x, y);
  if (d > 1) {
    x /= d;
    y /= d;
  }
  p.x = clamp(p.x + x * speed * dt, 24, 696);
  p.y = clamp(p.y + y * speed * dt, 24, 696);
}
export function circle(c, x, y, r, fill, stroke) {
  c.beginPath();
  c.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 2;
    c.stroke();
  }
}
export function line(c, x, y, xx, yy, color = "#80dfff", width = 2) {
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(xx, yy);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
export function text(
  c,
  str,
  x,
  y,
  size = 18,
  color = "#fafae5",
  align = "center",
) {
  c.fillStyle = color;
  c.font = `600 ${size}px system-ui`;
  c.textAlign = align;
  c.fillText(str, x, y);
}
export function box(c, x, y, w, h, fill = "#131c2a", stroke = "#4d6579") {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
  c.strokeStyle = stroke;
  c.lineWidth = 2;
  c.strokeRect(x, y, w, h);
}
export function health(c, x, y, w, ratio) {
  box(c, x, y, w, 5, "#171923", "#171923");
  c.fillStyle = "#ff986e";
  c.fillRect(x, y, w * clamp(ratio, 0, 1), 5);
}
export const art = {};
export async function loadArt() {
  await Promise.all(
    [
      "scan.png",
      "lai.png",
      "chumaq.png",
      "storage.png",
      "gate.png",
      "fuel.png",
      "hull.png",
      "cannon.png",
      "circuits.png",
      "ice.png",
      "hermetite.png",
      "scavenger.svg",
      "needler.svg",
      "bulwark.svg",
      "guardian.svg",
      "wingdrone.svg",
      "rock-ore.svg",
      "rock-dense.svg",
      "rock-volatile.svg",
      "rock-ice.svg",
    ].map(
      (name) =>
        new Promise((resolve) => {
          const im = new Image();
          im.onload = () => {
            art[name] = im;
            resolve();
          };
          im.onerror = resolve;
          im.src = new URL("assets/" + name, import.meta.url).href;
        }),
    ),
  );
}
export function sprite(c, name, x, y, size = 50, rot = 0, alpha = 1) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.globalAlpha = alpha;
  const im = art[name];
  if (im) {
    const k = size / Math.max(im.width, im.height);
    c.drawImage(
      im,
      (-im.width * k) / 2,
      (-im.height * k) / 2,
      im.width * k,
      im.height * k,
    );
  } else {
    circle(c, 0, 0, size * 0.35, "#809ab0", "#cce9ff");
    line(c, -size * 0.25, 0, size * 0.25, 0);
  }
  c.restore();
}
export function backdrop(c, s, tint = "#101a2d") {
  c.fillStyle = "#050811";
  c.fillRect(0, 0, 720, 720);
  const g = c.createRadialGradient(570, 160, 12, 470, 270, 620);
  g.addColorStop(0, tint);
  g.addColorStop(1, "#050811");
  c.fillStyle = g;
  c.fillRect(0, 0, 720, 720);
  for (let i = 0; i < 90; i++) {
    const x = (i * 137.51) % 720,
      y = (i * i * 19.31) % 720;
    c.fillStyle = i % 4 ? "#74869c" : "#d0e9ff";
    c.globalAlpha = 0.22 + (i % 5) * 0.1;
    c.fillRect(x, y, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
  }
  c.globalAlpha = 1;
  c.strokeStyle = "#ffffff08";
  c.lineWidth = 1;
  for (let a = 0; a < 720; a += 60) {
    line(c, a, 0, a, 720, "#ffffff06", 1);
    line(c, 0, a, 720, a, "#ffffff06", 1);
  }
  c.strokeStyle = "#3a5166";
  c.strokeRect(2, 2, 716, 716);
}
export function particles(c, s) {
  for (const p of s.particles) {
    c.globalAlpha = clamp(p.life * 2, 0, 1);
    circle(c, p.x, p.y, 3, p.color);
  }
  c.globalAlpha = 1;
}
export function ship(c, s, p, size = 54, rot = -Math.PI / 2) {
  sprite(
    c,
    "lai.png",
    p.x,
    p.y,
    size,
    rot,
    s.inv > 0 && Math.floor(s.time * 14) % 2 ? 0.35 : 1,
  );
  circle(c, p.x, p.y, size * 0.47, null, s.inv > 0 ? "#9ce8ff" : "#a5d8fa22");
}
export function reflect(vx, vy, nx, ny) {
  const dot = vx * nx + vy * ny;
  return { vx: vx - 2 * dot * nx, vy: vy - 2 * dot * ny };
}
