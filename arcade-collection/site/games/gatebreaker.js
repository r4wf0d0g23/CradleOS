import {
  base,
  tick,
  clamp,
  rand,
  burst,
  finish,
  backdrop,
  box,
  circle,
  line,
  text,
  sprite,
  particles,
} from "../core.js";
export const title = "Gatebreaker";
function deck(s) {
  s.blocks = [];
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 7; col++) {
      const armored = (row + col + s.stage) % 4 === 0,
        volatile = (row * 7 + col) % 8 === 2;
      s.blocks.push({
        x: 38 + col * 94,
        y: 90 + row * 55,
        w: 84,
        h: 42,
        hp: armored ? 2 : 1,
        max: armored ? 2 : 1,
        volatile,
      });
    }
  if (s.stage === 3)
    s.blocks.push({
      x: 270,
      y: 40,
      w: 180,
      h: 34,
      hp: 8,
      max: 8,
      reactor: true,
    });
  s.pulses = 2;
  s.pulseCooldown = 0;
  s.ball = { x: s.paddle, y: 615, vx: 0, vy: 0 };
  s.launched = false;
  s.shield = 360;
  s.shieldDir = 1;
  s.stageTime = 0;
}
export function create(seed) {
  const s = {
    ...base(seed),
    paddle: 360,
    hp: 4,
    blocks: [],
    ball: {},
    launched: false,
  };
  deck(s);
  return s;
}
export function action(s, key) {
  if (s.state !== "playing" || key !== "primary") return;
  if (!s.launched) {
    s.launched = true;
    s.ball.vx = 110;
    s.ball.vy = -335;
    s.events.push("launch");
  } else if (s.pulses > 0 && s.pulseCooldown <= 0) {
    s.pulses--;
    s.pulseCooldown = 0.3;
    s.ball.vy = -Math.abs(s.ball.vy);
    for (const block of s.blocks)
      if (
        block.hp > 0 &&
        Math.hypot(
          block.x + block.w / 2 - s.ball.x,
          block.y + block.h / 2 - s.ball.y,
        ) < 120
      )
        damage(s, block);
    burst(s, s.ball.x, s.ball.y, "#b4f5ff", 24);
    s.events.push("launch");
  }
}
function damage(s, b) {
  if (b.hp <= 0) return;
  b.hp--;
  s.score += 25;
  if (b.hp === 0) {
    s.score += 75;
    burst(s, b.x + b.w / 2, b.y + b.h / 2, b.volatile ? "#ff7b47" : "#86e1ed");
    s.events.push("hit");
    if (b.volatile) {
      for (const other of s.blocks)
        if (
          other !== b &&
          other.hp > 0 &&
          Math.hypot(other.x - b.x, other.y - b.y) < 115
        ) {
          other.hp = other.reactor ? Math.max(0, other.hp - 1) : 0;
          s.score += other.reactor ? 25 : 100;
          burst(s, other.x + 42, other.y + 21);
        }
    }
  }
}
export function update(s, dt, i) {
  if (s.state !== "playing") return;
  tick(s, dt);
  s.stageTime += dt;
  s.pulseCooldown = Math.max(0, s.pulseCooldown - dt);
  const previous = s.paddle;
  s.paddle = clamp(
    i.dragging && i.pointer
      ? i.pointer.x
      : s.paddle + ((i.right ? 1 : 0) - (i.left ? 1 : 0)) * 500 * dt,
    70,
    650,
  );
  s.shield = 360 + Math.sin(s.stageTime * 0.7) * 170;
  if (i.pressed) action(s, "primary");
  if (!s.launched) {
    s.ball.x = s.paddle;
    s.ball.y = 615;
    return;
  }
  const b = s.ball;
  // Microsteps bound travel below the thinnest collider, including late-deck speeds.
  const n = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 9));
  for (let k = 0; k < n; k++) {
    const old = { x: b.x, y: b.y };
    b.x += (b.vx * dt) / n;
    b.y += (b.vy * dt) / n;
    if (b.x < 12) {
      b.x = 12;
      b.vx = Math.abs(b.vx);
    }
    if (b.x > 708) {
      b.x = 708;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y < 20) {
      b.y = 20;
      b.vy = Math.abs(b.vy);
    }
    if (
      b.vy > 0 &&
      old.y <= 623 &&
      b.y >= 623 &&
      Math.abs(b.x - s.paddle) < 76
    ) {
      const offset = clamp((b.x - s.paddle) / 76, -1, 1),
        speed = Math.min(520, 365 + s.stage * 25);
      b.vx = offset * speed * 0.85 + (s.paddle - previous) * 1.5;
      b.vx = clamp(b.vx, -speed * 0.88, speed * 0.88);
      b.vy = -Math.sqrt(speed * speed - b.vx * b.vx);
      b.y = 622;
      s.events.push("tap");
    }
    if (
      s.stage >= 2 &&
      b.y > 344 &&
      b.y < 368 &&
      Math.abs(b.x - s.shield) < 74 &&
      ((old.y <= 344 && b.vy > 0) || (old.y >= 368 && b.vy < 0))
    ) {
      b.vy = -b.vy;
      b.y = old.y;
    }
    for (const block of s.blocks) {
      if (block.hp <= 0) continue;
      if (
        b.x + 10 > block.x &&
        b.x - 10 < block.x + block.w &&
        b.y + 10 > block.y &&
        b.y - 10 < block.y + block.h
      ) {
        damage(s, block);
        if (old.y + 10 <= block.y || old.y - 10 >= block.y + block.h)
          b.vy = -b.vy;
        else b.vx = -b.vx;
        b.x = old.x;
        b.y = old.y;
        break;
      }
    }
    if (b.y > 735) {
      s.hp--;
      if (!s.hp) {
        finish(s, false);
        return;
      }
      s.launched = false;
      b.x = s.paddle;
      b.y = 615;
      b.vx = 0;
      b.vy = 0;
      break;
    }
  }
  if (s.blocks.every((b) => !b.hp)) {
    s.score += 500;
    if (s.stage === 3) finish(s, true);
    else {
      s.stage++;
      deck(s);
      s.events.push("upgrade");
    }
  }
}
export function hud(s) {
  return {
    goal: `DECK ${s.stage} / 3`,
    detail: `${s.blocks.filter((b) => b.hp > 0).length} HULL BLOCKS`,
    health: `CHARGES ${s.hp}`,
    action: s.launched ? `PULSE · ${s.pulses}` : "LAUNCH",
  };
}
export function render(c, s) {
  backdrop(c, s, "#3b2520");
  sprite(c, "storage.png", 360, 235, 400, 0, 0.12);
  for (const b of s.blocks) {
    if (!b.hp) continue;
    box(
      c,
      b.x,
      b.y,
      b.w,
      b.h,
      b.volatile ? "#6b2d18" : b.max > 1 ? "#384758" : "#1b3444",
      b.volatile ? "#ffac6a" : "#7faabb",
    );
    line(c, b.x + 8, b.y + 8, b.x + b.w - 8, b.y + 8, "#ffffff33");
    text(
      c,
      b.reactor ? "REACTOR " + b.hp : b.volatile ? "⚡" : b.hp > 1 ? "II" : "I",
      b.x + b.w / 2,
      b.y + 28,
      17,
      b.volatile ? "#ffd494" : "#c1dce5",
    );
  }
  if (s.stage >= 2) {
    box(c, s.shield - 64, 350, 128, 12, "#53698d", "#a1c7ff");
    text(c, "SHIELD", s.shield, 338, 12, "#9eb4ce");
  }
  circle(c, s.ball.x, s.ball.y, 12, "#fff0b4", "#ff9c43");
  circle(c, s.ball.x, s.ball.y, 21, null, "#ffab5038");
  box(c, s.paddle - 66, 635, 132, 14, "#8dc6ce", "#d7faff");
  line(c, 0, 704, 720, 704, "#e7675a", 3);
  if (!s.launched) text(c, "LAUNCH CHARGE", 360, 550, 19, "#ffd599");
  particles(c, s);
}
