/**
 * FlappyFrontier — EVE Frontier themed Flappy Bird
 * Ship navigates through Smart Gates. Local dev only.
 */
import { useEffect, useRef, useState } from "react";

const W = 480;
const H = 520;
const GRAVITY = 0.45;
const FLAP = -8.5;
const GATE_SPEED = 2.8;
const GATE_GAP = 130;
const GATE_INTERVAL = 140;
const SHIP_X = 80;
const SHIP_SIZE = 22;

type Gate = { x: number; top: number; scored: boolean };

function drawStars(ctx: CanvasRenderingContext2D, stars: { x: number; y: number; r: number; a: number }[]) {
  for (const s of stars) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawShip(ctx: CanvasRenderingContext2D, y: number, vel: number, dead: boolean) {
  const angle = dead ? Math.PI / 2 : Math.max(-0.4, Math.min(0.4, vel * 0.04));
  ctx.save();
  ctx.translate(SHIP_X, y);
  ctx.rotate(angle);
  // Ship body — sleek frigate silhouette
  ctx.strokeStyle = dead ? "#ff4444" : "#FF4700";
  ctx.fillStyle = dead ? "rgba(255,68,68,0.15)" : "rgba(255,71,0,0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(SHIP_SIZE, 0);
  ctx.lineTo(-SHIP_SIZE * 0.6, -SHIP_SIZE * 0.45);
  ctx.lineTo(-SHIP_SIZE * 0.3, 0);
  ctx.lineTo(-SHIP_SIZE * 0.6, SHIP_SIZE * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Engine glow
  if (!dead) {
    ctx.fillStyle = "rgba(255,200,50,0.9)";
    ctx.beginPath();
    ctx.ellipse(-SHIP_SIZE * 0.35, 0, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Thruster trail
    const grad = ctx.createLinearGradient(-SHIP_SIZE * 0.35, 0, -SHIP_SIZE * 1.1, 0);
    grad.addColorStop(0, "rgba(255,140,0,0.8)");
    grad.addColorStop(1, "rgba(255,50,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(-SHIP_SIZE * 0.7, 0, SHIP_SIZE * 0.6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGate(ctx: CanvasRenderingContext2D, g: Gate) {
  const gateColor = "#00ccff";
  
  // Top gate
  ctx.fillStyle = "rgba(0,30,50,0.85)";
  ctx.fillRect(g.x - 18, 0, 36, g.top);
  ctx.strokeStyle = gateColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(g.x - 18, 0, 36, g.top);
  // Gate ring top
  ctx.strokeStyle = gateColor;
  ctx.lineWidth = 3;
  ctx.shadowBlur = 12;
  ctx.shadowColor = gateColor;
  ctx.beginPath();
  ctx.arc(g.x, g.top, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Bottom gate
  const botY = g.top + GATE_GAP;
  ctx.fillStyle = "rgba(0,30,50,0.85)";
  ctx.fillRect(g.x - 18, botY, 36, H - botY);
  ctx.strokeStyle = gateColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(g.x - 18, botY, 36, H - botY);
  // Gate ring bottom
  ctx.lineWidth = 3;
  ctx.shadowBlur = 12;
  ctx.shadowColor = gateColor;
  ctx.beginPath();
  ctx.arc(g.x, botY, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Energy field between rings
  const fieldGrad = ctx.createLinearGradient(g.x - 18, g.top, g.x - 18, botY);
  fieldGrad.addColorStop(0, "rgba(0,200,255,0.08)");
  fieldGrad.addColorStop(0.5, "rgba(0,200,255,0.03)");
  fieldGrad.addColorStop(1, "rgba(0,200,255,0.08)");
  ctx.fillStyle = fieldGrad;
  ctx.fillRect(g.x - 18, g.top, 36, GATE_GAP);
}

export function FlappyFrontierPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    y: H / 2,
    vel: 0,
    gates: [] as Gate[],
    score: 0,
    best: 0,
    frame: 0,
    phase: "idle" as "idle" | "playing" | "dead",
    stars: Array.from({ length: 80 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random() * 0.7 + 0.2,
    })),
    deadTimer: 0,
  });
  const [displayScore, setDisplayScore] = useState(0);
  const [displayBest, setDisplayBest] = useState(0);
  const [, setPhase] = useState<"idle" | "playing" | "dead">("idle");
  const rafRef = useRef<number>(0);

  const flap = () => {
    const s = stateRef.current;
    if (s.phase === "idle") {
      s.phase = "playing";
      s.vel = FLAP;
      setPhase("playing");
    } else if (s.phase === "playing") {
      s.vel = FLAP;
    } else if (s.phase === "dead" && s.deadTimer > 30) {
      // restart
      s.y = H / 2;
      s.vel = 0;
      s.gates = [];
      s.score = 0;
      s.frame = 0;
      s.phase = "playing";
      s.deadTimer = 0;
      setDisplayScore(0);
      setPhase("playing");
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const loop = () => {
      const s = stateRef.current;
      ctx.clearRect(0, 0, W, H);

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#000308");
      bg.addColorStop(1, "#001018");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      drawStars(ctx, s.stars);

      if (s.phase === "playing") {
        s.frame++;
        // Physics
        s.vel += GRAVITY;
        s.y += s.vel;

        // Spawn gates
        if (s.frame % GATE_INTERVAL === 0) {
          const top = 60 + Math.random() * (H - GATE_GAP - 120);
          s.gates.push({ x: W + 20, top, scored: false });
        }

        // Move & score gates
        for (const g of s.gates) {
          g.x -= GATE_SPEED;
          if (!g.scored && g.x < SHIP_X) {
            g.scored = true;
            s.score++;
            if (s.score > s.best) s.best = s.score;
            setDisplayScore(s.score);
            setDisplayBest(s.best);
          }
        }
        s.gates = s.gates.filter(g => g.x > -60);

        // Collision
        const hit =
          s.y < SHIP_SIZE || s.y > H - SHIP_SIZE ||
          s.gates.some(g => {
            const dx = Math.abs(g.x - SHIP_X);
            if (dx > SHIP_SIZE + 18) return false;
            return s.y < g.top || s.y > g.top + GATE_GAP;
          });

        if (hit) {
          s.phase = "dead";
          s.deadTimer = 0;
          setPhase("dead");
        }
      } else if (s.phase === "dead") {
        s.deadTimer++;
        s.vel += GRAVITY * 0.5;
        s.y = Math.min(s.y + s.vel, H - SHIP_SIZE);
      }

      // Draw gates
      for (const g of s.gates) drawGate(ctx, g);

      // Draw ship
      drawShip(ctx, s.y, s.vel, s.phase === "dead");

      // HUD
      ctx.fillStyle = "#FF4700";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      if (s.phase === "playing" || s.phase === "dead") {
        ctx.fillText(String(s.score), W / 2, 50);
      }

      // Overlays
      if (s.phase === "idle") {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#FF4700";
        ctx.font = "bold 32px monospace";
        ctx.textAlign = "center";
        ctx.fillText("FLAPPY FRONTIER", W / 2, H / 2 - 60);
        ctx.fillStyle = "rgba(0,200,255,0.9)";
        ctx.font = "14px monospace";
        ctx.fillText("Navigate your ship through Smart Gates", W / 2, H / 2 - 20);
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "13px monospace";
        ctx.fillText("CLICK or SPACE to warp", W / 2, H / 2 + 20);
        ctx.fillStyle = "rgba(255,71,0,0.4)";
        ctx.font = "11px monospace";
        ctx.fillText("ERA 6: AWAKENING  ·  CYCLE 5: SHROUD OF FEAR", W / 2, H / 2 + 50);
      }

      if (s.phase === "dead" && s.deadTimer > 20) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#ff4444";
        ctx.font = "bold 28px monospace";
        ctx.textAlign = "center";
        ctx.fillText("HULL BREACH", W / 2, H / 2 - 50);
        ctx.fillStyle = "#FF4700";
        ctx.font = "18px monospace";
        ctx.fillText(`Gates Cleared: ${s.score}`, W / 2, H / 2 - 10);
        ctx.fillStyle = "rgba(0,200,255,0.8)";
        ctx.font = "16px monospace";
        ctx.fillText(`Best: ${s.best}`, W / 2, H / 2 + 20);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "13px monospace";
        ctx.fillText("CLICK to respawn", W / 2, H / 2 + 55);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); flap(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px", gap: 12 }}>
      <div style={{ display: "flex", gap: 24, marginBottom: 4 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "rgba(107,107,94,0.5)", fontSize: 10, letterSpacing: "0.12em" }}>GATES CLEARED</div>
          <div style={{ color: "#FF4700", fontSize: 28, fontWeight: 700, fontFamily: "monospace" }}>{displayScore}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "rgba(107,107,94,0.5)", fontSize: 10, letterSpacing: "0.12em" }}>BEST RUN</div>
          <div style={{ color: "#00ccff", fontSize: 28, fontWeight: 700, fontFamily: "monospace" }}>{displayBest}</div>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={flap}
        style={{
          cursor: "pointer",
          border: "1px solid rgba(255,71,0,0.3)",
          boxShadow: "0 0 30px rgba(255,71,0,0.1)",
          display: "block",
          maxWidth: "100%",
        }}
      />
      <div style={{ color: "rgba(107,107,94,0.4)", fontSize: 11, letterSpacing: "0.08em" }}>
        CLICK or SPACE to warp · navigate Smart Gates · don't die
      </div>
    </div>
  );
}
