/**
 * CasinoAnimations — the anticipation layer. On-chain games know the result
 * the instant the tx settles; a real casino sells the three seconds BEFORE
 * the reveal. Each stage component receives the final outcome and animates
 * toward it (standard crypto-casino pattern), then fires onDone to reveal
 * the payout.
 *
 * CSS-only (no new deps). Webview-safe glyphs only.
 */
import { useEffect, useRef, useState } from "react";
import { SLOT_SYMBOLS, DIAMOND_GEMS, WAR_RANKS, HILO_RANKS } from "../lib/casinoGames";

const ACCENT = "#FF4700";
const GOLD = "#E8B84B";
const GREEN = "#3FCF6A";
const BLUE = "#7FC8FF";

// ── one-time keyframe injection ───────────────────────────────────────────────
let injected = false;
export function useCasinoKeyframes() {
  useEffect(() => {
    if (injected) return;
    injected = true;
    const el = document.createElement("style");
    el.textContent = `
      @keyframes cas-coin-spin { from { transform: rotateY(0deg); } to { transform: rotateY(1800deg); } }
      @keyframes cas-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.12); } 100% { transform: scale(1); } }
      @keyframes cas-flash { 0% { opacity: 0.9; } 100% { opacity: 0; } }
      @keyframes cas-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px) rotate(-4deg); } 40% { transform: translateX(6px) rotate(3deg); } 60% { transform: translateX(-4px) rotate(-2deg); } 80% { transform: translateX(3px) rotate(1deg); } }
      @keyframes cas-flip-in { 0% { transform: rotateY(90deg); opacity: 0; } 100% { transform: rotateY(0deg); opacity: 1; } }
      @keyframes cas-slide-in-left { 0% { transform: translateX(-40px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
      @keyframes cas-slide-in-right { 0% { transform: translateX(40px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
      @keyframes cas-slide-down { 0% { transform: translateY(-30px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
      @keyframes cas-pop { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.18); } 100% { transform: scale(1); opacity: 1; } }
      @keyframes cas-glow-gold { 0%,100% { box-shadow: 0 0 6px ${GOLD}55; } 50% { box-shadow: 0 0 22px ${GOLD}cc, 0 0 40px ${GOLD}66; } }
      @keyframes cas-glow-green { 0%,100% { box-shadow: 0 0 6px ${GREEN}55; } 50% { box-shadow: 0 0 22px ${GREEN}cc, 0 0 40px ${GREEN}66; } }
      @keyframes cas-glow-red { 0%,100% { box-shadow: 0 0 6px ${ACCENT}55; } 50% { box-shadow: 0 0 22px ${ACCENT}cc, 0 0 40px ${ACCENT}66; } }
      @keyframes cas-plinko-fall { 0% { transform: translateY(-12px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
      @keyframes cas-climb { 0% { transform: translateY(8px); opacity: 0.4; } 100% { transform: translateY(0); opacity: 1; } }
      @keyframes cas-rocket-bounce { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-4px) scale(1.04); } }
      @keyframes cas-crash-explode { 0% { transform: scale(1); opacity: 1; } 40% { transform: scale(1.5) rotate(15deg); } 100% { transform: scale(0.3) rotate(-20deg); opacity: 0; } }
      @keyframes cas-number-tick { 0% { transform: translateY(-6px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
      @keyframes cas-keno-light { 0% { transform: scale(1); background: #1a1a1a; } 40% { transform: scale(1.25); background: ${GOLD}44; } 100% { transform: scale(1.1); } }
      @keyframes cas-deal-card { 0% { transform: translateY(-20px) rotateX(30deg); opacity: 0; } 100% { transform: translateY(0) rotateX(0deg); opacity: 1; } }
      @keyframes cas-card-flip { 0% { transform: rotateY(0deg); } 50% { transform: rotateY(90deg); } 100% { transform: rotateY(0deg); } }
      @keyframes cas-multiplier-climb { 0% { transform: translateY(4px) scale(0.95); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
      @keyframes cas-tile-pop { 0% { transform: scale(0.8); opacity: 0.4; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
      @keyframes cas-mine-shake { 0%,100% { transform: translateX(0) translateY(0); } 25% { transform: translateX(-4px) translateY(-2px) rotate(-3deg); } 75% { transform: translateX(4px) translateY(2px) rotate(3deg); } }
      @keyframes cas-bar-fill { from { width: 0%; } to { width: 100%; } }
      @keyframes cas-ascend-row { 0% { transform: translateY(10px); opacity: 0.3; } 100% { transform: translateY(0); opacity: 1; } }
      @keyframes cas-held-pulse { 0%,100% { box-shadow: 0 0 8px ${GREEN}66; } 50% { box-shadow: 0 0 20px ${GREEN}cc; } }
      @keyframes cas-card-deal { 0% { transform: translateX(-30px) rotate(-5deg); opacity: 0; } 100% { transform: translateX(0) rotate(0deg); opacity: 1; } }
      @keyframes cas-win-hand { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
    `;
    document.head.appendChild(el);
  }, []);
}

// ── COINFLIP: 3D coin, five turns, lands on the result face ──────────────────
export function CoinFlipStage({ result, onDone }: { result: number; onDone: () => void }) {
  useCasinoKeyframes();
  const [spinning, setSpinning] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setSpinning(false); onDone(); }, 1900);
    return () => clearTimeout(t);
  }, []);
  const face = (label: string, glyph: string, back?: boolean) => (
    <div style={{
      position: "absolute", inset: 0, borderRadius: "50%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden",
      background: "radial-gradient(circle at 35% 30%, #f4d47a, #b8860b 70%, #7a5a06)",
      border: "4px solid #8a6a10", boxShadow: "inset 0 0 18px rgba(0,0,0,0.35)",
      transform: back ? "rotateY(180deg)" : undefined, color: "#4a3505", fontWeight: 900,
    }}>
      <div style={{ fontSize: 34 }}>{glyph}</div>
      <div style={{ fontSize: 11, letterSpacing: "0.2em" }}>{label}</div>
    </div>
  );
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "16px 0", perspective: 700 }}>
      <div style={{
        position: "relative", width: 110, height: 110, transformStyle: "preserve-3d",
        animation: spinning ? "cas-coin-spin 1.9s cubic-bezier(0.22, 0.9, 0.35, 1) forwards" : undefined,
        transform: !spinning ? (result === 0 ? "rotateY(1800deg)" : "rotateY(1980deg)") : undefined,
      }}>
        {face("HEADS", "◉")}
        {face("TAILS", "◎", true)}
      </div>
    </div>
  );
}

// ── DICE: ticker that decelerates onto the roll ──────────────────────────────
export function DiceRollStage({ roll, target, over, onDone }: { roll: number; target: number; over: boolean; onDone: () => void }) {
  useCasinoKeyframes();
  const [num, setNum] = useState(1);
  const [done, setDone] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    let delay = 45;
    const tick = () => {
      delay = Math.min(delay * 1.13, 260);
      if (delay >= 255) {
        setNum(roll); setDone(true); onDone();
      } else {
        setNum(1 + Math.floor(Math.random() * 100));
        t.current = setTimeout(tick, delay);
      }
    };
    t.current = setTimeout(tick, delay);
    return () => clearTimeout(t.current);
  }, []);
  const won = done && (over ? roll > target : roll < target);
  return (
    <div style={{ textAlign: "center", padding: "14px 0" }}>
      <div style={{
        display: "inline-block", minWidth: 130, padding: "16px 24px",
        background: "linear-gradient(160deg,#1c1712,#0d0b08)", border: `2px solid ${done ? (won ? "#3FCF6A" : ACCENT) : GOLD}66`,
        borderRadius: 10, animation: done ? "cas-pulse 0.4s ease" : undefined,
      }}>
        <div style={{ fontSize: 46, fontWeight: 900, color: done ? (won ? "#3FCF6A" : ACCENT) : GOLD, fontVariantNumeric: "tabular-nums" }}>{num}</div>
        <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.15em" }}>{over ? `NEED OVER ${target}` : `NEED UNDER ${target}`}</div>
      </div>
    </div>
  );
}

// ── ROULETTE: authentic EU wheel, decelerating spin to the pocket ────────────
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function RouletteStage({ spin, onDone }: { spin: number; onDone: () => void }) {
  useCasinoKeyframes();
  const [angle, setAngle] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const idx = WHEEL_ORDER.indexOf(spin);
    const seg = 360 / 37;
    const target = 4 * 360 + (360 - (idx * seg + seg / 2));
    requestAnimationFrame(() => requestAnimationFrame(() => setAngle(target)));
    const t = setTimeout(() => { setDone(true); onDone(); }, 3100);
    return () => clearTimeout(t);
  }, []);
  const seg = 360 / 37;
  const stops = WHEEL_ORDER.map((n, i) => {
    const col = n === 0 ? "#1f7a3d" : RED_SET.has(n) ? "#a32222" : "#181818";
    return `${col} ${(i * seg).toFixed(3)}deg ${((i + 1) * seg).toFixed(3)}deg`;
  }).join(", ");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0" }}>
      <div style={{ color: GOLD, fontSize: 18, lineHeight: 1, marginBottom: -4, zIndex: 2 }}>▼</div>
      <div style={{ position: "relative", width: 190, height: 190 }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `conic-gradient(${stops})`,
          border: `6px solid #6a4a10`, boxShadow: "0 0 24px rgba(0,0,0,0.7), inset 0 0 30px rgba(0,0,0,0.55)",
          transform: `rotate(${angle}deg)`,
          transition: "transform 3s cubic-bezier(0.15, 0.85, 0.25, 1)",
        }} />
        <div style={{ position: "absolute", inset: 58, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #2a2118, #14100a)", border: "2px solid #6a4a1055", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {done && (
            <div style={{ textAlign: "center", animation: "cas-pulse 0.4s ease" }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: spin === 0 ? "#3FCF6A" : RED_SET.has(spin) ? "#ff6a5a" : "#ddd" }}>{spin}</div>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#888" }}>{spin === 0 ? "ZERO" : RED_SET.has(spin) ? "RED" : "BLACK"}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SLOTS: three reels, staggered deceleration ───────────────────────────────
const REEL_STRIP = [0, 4, 1, 5, 2, 6, 3, 0, 2, 1, 4, 3, 5, 0, 6, 2];
const CELL = 64;

function Reel({ symbol, duration, spinning }: { symbol: number; duration: number; spinning: boolean }) {
  const reps = 6;
  const strip: number[] = [];
  for (let r = 0; r < reps; r++) strip.push(...REEL_STRIP);
  const landIdxInStrip = (reps - 2) * REEL_STRIP.length + REEL_STRIP.indexOf(symbol);
  const offset = spinning ? 0 : -(landIdxInStrip * CELL - CELL);
  return (
    <div style={{ width: CELL, height: CELL * 3, overflow: "hidden", background: "linear-gradient(180deg,#0a0806, #171310 25%, #171310 75%, #0a0806)", border: `2px solid ${GOLD}44`, borderRadius: 8, position: "relative" }}>
      <div style={{
        transform: `translateY(${spinning ? -(landIdxInStrip - 14) * CELL : offset}px)`,
        transition: spinning ? undefined : `transform ${duration}ms cubic-bezier(0.18, 0.9, 0.32, 1.04)`,
      }}>
        {strip.map((s, i) => (
          <div key={i} style={{ height: CELL, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, color: s >= 5 ? GOLD : s >= 3 ? "#ff8a5a" : "#9fb4c8" }}>
            {SLOT_SYMBOLS[s]}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", top: CELL, left: 0, right: 0, height: CELL, border: `1px solid ${ACCENT}55`, borderLeft: "none", borderRight: "none", pointerEvents: "none" }} />
    </div>
  );
}

export function SlotsStage({ s1, s2, s3, onDone }: { s1: number; s2: number; s3: number; onDone: () => void }) {
  useCasinoKeyframes();
  const [spinning, setSpinning] = useState(true);
  useEffect(() => {
    const start = setTimeout(() => setSpinning(false), 60);
    const t = setTimeout(onDone, 2500);
    return () => { clearTimeout(start); clearTimeout(t); };
  }, []);
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", padding: "12px 0" }}>
      <Reel symbol={s1} duration={1300} spinning={spinning} />
      <Reel symbol={s2} duration={1800} spinning={spinning} />
      <Reel symbol={s3} duration={2300} spinning={spinning} />
    </div>
  );
}

// ── WHEEL: 20-segment fortune wheel with pointer ─────────────────────────────
const WHEEL_SEGMENTS_BPS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12000, 12000, 12000, 12000, 12000, 16000, 16000, 100000];

export function WheelStage({ segment, onDone }: { segment: number; onDone: () => void }) {
  useCasinoKeyframes();
  const [angle, setAngle] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const seg = 360 / 20;
    const target = 4 * 360 + (360 - (segment * seg + seg / 2));
    requestAnimationFrame(() => requestAnimationFrame(() => setAngle(target)));
    const t = setTimeout(() => { setDone(true); onDone(); }, 3100);
    return () => clearTimeout(t);
  }, []);
  const seg = 360 / 20;
  const colFor = (bps: number) => bps === 0 ? "#1c1712" : bps === 12000 ? "#274a63" : bps === 16000 ? "#3d2a63" : "#8a6a10";
  const stops = WHEEL_SEGMENTS_BPS.map((b, i) => `${colFor(b)} ${(i * seg).toFixed(2)}deg ${((i + 1) * seg).toFixed(2)}deg`).join(", ");
  const mult = WHEEL_SEGMENTS_BPS[segment] / 10000;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0" }}>
      <div style={{ color: GOLD, fontSize: 18, lineHeight: 1, marginBottom: -4, zIndex: 2 }}>▼</div>
      <div style={{ position: "relative", width: 190, height: 190 }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `conic-gradient(${stops})`,
          border: `6px solid #6a4a10`, boxShadow: "0 0 24px rgba(0,0,0,0.7), inset 0 0 30px rgba(0,0,0,0.55)",
          transform: `rotate(${angle}deg)`,
          transition: "transform 3s cubic-bezier(0.15, 0.85, 0.25, 1)",
        }} />
        <div style={{ position: "absolute", inset: 58, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #2a2118, #14100a)", border: "2px solid #6a4a1055", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {done && (
            <div style={{ textAlign: "center", animation: "cas-pulse 0.4s ease" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: mult > 0 ? GOLD : ACCENT }}>{mult > 0 ? `${mult}x` : "0x"}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── WIN/LOSS flash overlay ───────────────────────────────────────────────────
export function ResultFlash({ win }: { win: boolean }) {
  useCasinoKeyframes();
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none", borderRadius: 12,
      background: win ? "radial-gradient(ellipse, rgba(63,207,106,0.35), transparent 70%)" : "radial-gradient(ellipse, rgba(255,71,0,0.3), transparent 70%)",
      animation: "cas-flash 1.4s ease-out forwards",
    }} />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW STAGES — Part A
// ═══════════════════════════════════════════════════════════════════════════════

// ── CRASH: rocket climbs to crash point, explodes or soars past target ────────
export function CrashStage({ crashBps, targetBps, onDone }: { crashBps: number; targetBps: number; onDone: () => void }) {
  useCasinoKeyframes();

  const TOTAL_MS = 2800;
  const crashMult = crashBps / 10000;
  const targetMult = targetBps / 10000;
  const won = crashBps >= targetBps;

  // Displayed multiplier ticks from 1.00 up to crashMult
  const [displayMult, setDisplayMult] = useState(1.0);
  const [phase, setPhase] = useState<"climbing" | "crashed" | "won">("climbing");
  const animRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const startMult = 1.0;
    const endMult = crashMult;
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      // Ease-in: accelerate through most of the range, rapid in last 20%
      const progress = Math.min(elapsed / (TOTAL_MS * 0.8), 1);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const current = startMult + (endMult - startMult) * eased;
      setDisplayMult(current);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    };
    animRef.current = requestAnimationFrame(tick);

    // Crash/settle after animation
    const settleT = setTimeout(() => {
      setDisplayMult(crashMult);
      setPhase(won ? "won" : "crashed");
      setTimeout(onDone, 500);
    }, TOTAL_MS);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      clearTimeout(settleT);
    };
  }, []);

  const trackH = 130;
  // Ball Y position: bottom (100%) = 1.00x, top = crashMult
  const ballPct = Math.min(((displayMult - 1) / Math.max(crashMult - 1, 0.01)) * 100, 100);
  const ballY = trackH - (ballPct / 100) * trackH;
  const targetPct = Math.min(((targetMult - 1) / Math.max(crashMult - 1, 0.01)) * 100, 100);
  const targetY = trackH - (targetPct / 100) * trackH;

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {/* Track */}
        <div style={{ position: "relative", width: 36, height: trackH, background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, overflow: "visible" }}>
          {/* Track fill */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: `${ballPct}%`,
            background: phase === "crashed" ? `linear-gradient(to top, ${ACCENT}44, ${ACCENT}11)` : `linear-gradient(to top, ${GREEN}44, ${GREEN}11)`,
            transition: "height 0.05s linear",
          }} />
          {/* Target line */}
          <div style={{
            position: "absolute", left: -8, right: -8,
            top: targetY - 1,
            height: 2,
            background: GOLD,
            boxShadow: `0 0 6px ${GOLD}`,
          }} />
          {/* Ball / rocket */}
          <div style={{
            position: "absolute", left: "50%", top: ballY - 10,
            transform: "translateX(-50%)",
            fontSize: 18,
            color: phase === "crashed" ? ACCENT : GREEN,
            animation: phase === "climbing" ? "cas-rocket-bounce 0.4s ease infinite" : phase === "crashed" ? "cas-crash-explode 0.5s ease forwards" : "cas-pop 0.4s ease",
            textShadow: `0 0 10px ${phase === "crashed" ? ACCENT : GREEN}`,
            transition: "top 0.05s linear",
          }}>▲</div>
        </div>

        {/* Info */}
        <div style={{ textAlign: "left" }}>
          <div style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: phase === "climbing" ? 40 : 44,
            fontWeight: 900,
            color: phase === "crashed" ? ACCENT : phase === "won" ? GREEN : GOLD,
            animation: phase !== "climbing" ? "cas-pulse 0.45s ease" : "cas-number-tick 0.08s ease",
            minWidth: 100,
            lineHeight: 1,
          }}>{displayMult.toFixed(2)}x</div>
          <div style={{ color: "#666", fontSize: 10, marginTop: 4, letterSpacing: "0.1em" }}>
            {phase === "climbing" ? "CLIMBING…" : phase === "crashed" ? "CRASHED" : "SOARED"}
          </div>
          <div style={{ color: GOLD, fontSize: 10, marginTop: 2 }}>
            target {targetMult.toFixed(2)}x
          </div>
          {phase !== "climbing" && (
            <div style={{ color: phase === "won" ? GREEN : ACCENT, fontSize: 12, fontWeight: 800, marginTop: 4, animation: "cas-pop 0.4s ease" }}>
              {phase === "won" ? "FLEW ABOVE" : "CRASHED BELOW"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── LIMBO: same engine as Crash, themed as bar descending ────────────────────
export function LimboStage({ crashBps, targetBps, onDone }: { crashBps: number; targetBps: number; onDone: () => void }) {
  useCasinoKeyframes();

  const TOTAL_MS = 2600;
  const crashMult = crashBps / 10000;
  const targetMult = targetBps / 10000;
  const won = crashBps >= targetBps;

  const [displayMult, setDisplayMult] = useState(1.0);
  const [phase, setPhase] = useState<"climbing" | "settled">("climbing");
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / (TOTAL_MS * 0.8), 1);
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setDisplayMult(1.0 + (crashMult - 1) * eased);
      if (p < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    const settleT = setTimeout(() => {
      setDisplayMult(crashMult);
      setPhase("settled");
      setTimeout(onDone, 450);
    }, TOTAL_MS);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      clearTimeout(settleT);
    };
  }, []);

  const BAR_W = 220;
  const barPct = Math.min(((displayMult - 1.0) / Math.max(targetMult * 1.5 - 1.0, 0.5)) * 100, 100);
  const targetPct = Math.min(((targetMult - 1.0) / Math.max(targetMult * 1.5 - 1.0, 0.5)) * 100, 100);

  return (
    <div style={{ textAlign: "center", padding: "14px 0" }}>
      {/* Big multiplier display */}
      <div style={{
        fontSize: 52, fontWeight: 900, fontVariantNumeric: "tabular-nums",
        color: phase === "settled" ? (won ? GREEN : ACCENT) : GOLD,
        animation: phase === "settled" ? "cas-pulse 0.45s ease" : undefined,
        lineHeight: 1,
      }}>{displayMult.toFixed(2)}x</div>

      {/* Limbo bar track */}
      <div style={{ margin: "10px auto", position: "relative", height: 18, width: BAR_W, background: "#0a0a0a", border: "1px solid #333", borderRadius: 9 }}>
        {/* Fill */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${barPct}%`,
          background: won && phase === "settled" ? `linear-gradient(to right, ${GREEN}88, ${GREEN}cc)` : `linear-gradient(to right, ${ACCENT}66, ${ACCENT}aa)`,
          borderRadius: 9,
          transition: "width 0.05s linear",
        }} />
        {/* Target marker */}
        <div style={{
          position: "absolute", top: -4, bottom: -4,
          left: `calc(${targetPct}% - 1px)`,
          width: 2,
          background: GOLD,
          boxShadow: `0 0 6px ${GOLD}`,
          borderRadius: 2,
        }} />
        {/* Bar label */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", pointerEvents: "none",
        }}>LIMBO BAR</div>
      </div>
      <div style={{ color: "#666", fontSize: 10, marginTop: 2 }}>
        target <span style={{ color: GOLD }}>{targetMult.toFixed(2)}x</span>
        {phase === "settled" && (
          <span style={{ color: won ? GREEN : ACCENT, fontWeight: 800, marginLeft: 8 }}>
            {won ? " · FLEW ABOVE" : " · CRASHED BELOW"}
          </span>
        )}
      </div>
    </div>
  );
}

// ── DIAMONDS: 5 gem slots rolling left→right then settling, winner pulses ─────
const GEM_GLYPHS = DIAMOND_GEMS; // ["◆", "◇", "◈", "❖", "⬢", "⬡", "⚙"]

export function DiamondsStage({ gems, bestSet, onDone }: { gems: number[]; bestSet: number[]; onDone: () => void }) {
  useCasinoKeyframes();
  const [revealed, setRevealed] = useState<(number | null)[]>([null, null, null, null, null]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Each slot settles with a 300ms stagger
    gems.forEach((gem, i) => {
      const t = setTimeout(() => {
        setRevealed((prev) => {
          const next = [...prev];
          next[i] = gem;
          return next;
        });
        if (i === gems.length - 1) {
          setTimeout(() => { setDone(true); onDone(); }, 400);
        }
      }, 300 + i * 340);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "14px 0", flexWrap: "wrap" }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const isMatch = done && bestSet.includes(i);
        const gem = revealed[i];
        return (
          <div key={i} style={{
            width: 52, height: 60,
            background: isMatch ? "#1a1408" : gem !== null ? "#111" : "#0a0a0a",
            border: `2px solid ${isMatch ? GOLD : gem !== null ? "#444" : "#222"}`,
            borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28,
            color: isMatch ? GOLD : gem !== null ? "#9fc8e0" : "#333",
            animation: gem !== null ? (isMatch ? "cas-glow-gold 1.2s ease infinite, cas-pop 0.35s ease" : "cas-pop 0.35s ease") : undefined,
            transition: "border-color 0.3s, background 0.3s",
            position: "relative",
          }}>
            {gem !== null ? GEM_GLYPHS[gem] ?? "◆" : (
              // Spinning preview
              <GemSpinner idx={i} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function GemSpinner({ idx }: { idx: number }) {
  const [cur, setCur] = useState(0);
  const t = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    // Stagger the spin rate per slot
    const rate = 80 + idx * 20;
    t.current = setInterval(() => setCur((c) => (c + 1) % GEM_GLYPHS.length), rate);
    return () => { if (t.current) clearInterval(t.current); };
  }, [idx]);
  return <span style={{ color: "#4a6a7a" }}>{GEM_GLYPHS[cur]}</span>;
}

// ── DOUBLE DICE: two dice tumbling, settle staggered, show sum ────────────────
const PIP_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function SingleDie({ finalVal, delayMs, onSettled }: { finalVal: number; delayMs: number; onSettled?: () => void }) {
  useCasinoKeyframes();
  const [face, setFace] = useState(0);
  const [settled, setSettled] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let delay = 50;
    let totalTime = 0;
    const SETTLE_AT = 1100 + delayMs;
    const tick = () => {
      totalTime += delay;
      delay = Math.min(delay * 1.12, 240);
      if (totalTime >= SETTLE_AT) {
        setFace(finalVal - 1);
        setSettled(true);
        onSettled?.();
      } else {
        setFace(Math.floor(Math.random() * 6));
        t.current = setTimeout(tick, delay);
      }
    };
    t.current = setTimeout(tick, delayMs);
    return () => clearTimeout(t.current);
  }, []);

  return (
    <div style={{
      width: 64, height: 64,
      background: "linear-gradient(135deg, #1e1e2e, #0e0e1a)",
      border: `2px solid ${settled ? GOLD : "#444"}`,
      borderRadius: 12,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 38,
      color: settled ? GOLD : "#888",
      boxShadow: settled ? `0 0 14px ${GOLD}66` : "none",
      animation: settled ? "cas-pop 0.35s ease" : undefined,
      transition: "border-color 0.2s, box-shadow 0.2s",
    }}>
      {PIP_FACES[face]}
    </div>
  );
}

export function DoubleDiceStage({ d1, d2, kind: _kind, target: _target, onDone }: { d1: number; d2: number; kind: number; target: number; onDone: () => void }) {
  useCasinoKeyframes();
  const [bothDone, setBothDone] = useState(0);

  useEffect(() => {
    // onDone fires 600ms after both dice settle (~1100 + 400 = 1500ms + 600ms buffer)
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, []);

  const sum = d1 + d2;
  const allSettled = bothDone >= 2;

  return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "center" }}>
        <SingleDie finalVal={d1} delayMs={0} onSettled={() => setBothDone((p) => p + 1)} />
        <div style={{ color: "#444", fontSize: 20, fontWeight: 900 }}>+</div>
        <SingleDie finalVal={d2} delayMs={350} onSettled={() => setBothDone((p) => p + 1)} />
      </div>
      {allSettled && (
        <div style={{ marginTop: 10, animation: "cas-pop 0.4s ease" }}>
          <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.1em" }}>SUM</div>
          <div style={{ color: GOLD, fontSize: 36, fontWeight: 900 }}>{sum}</div>
        </div>
      )}
    </div>
  );
}

// ── WAR: two cards flip face-down → face-up, higher one glows ────────────────
function WarCard({ rank, delayMs, isWinner, isTie }: { rank: number; label?: string; delayMs: number; isWinner: boolean; isTie: boolean }) {
  useCasinoKeyframes();
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), delayMs);
    return () => clearTimeout(t);
  }, []);

  const borderColor = !flipped ? "#333" : isWinner ? GREEN : isTie ? GOLD : ACCENT;
  const glowAnim = !flipped ? undefined : isWinner ? "cas-glow-green 1s ease infinite" : isTie ? "cas-glow-gold 1s ease infinite" : undefined;

  return (
    <div style={{ perspective: 400, width: 72, height: 96 }}>
      <div style={{
        position: "relative", width: "100%", height: "100%",
        transformStyle: "preserve-3d",
        transform: flipped ? "rotateY(0deg)" : "rotateY(180deg)",
        transition: `transform 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${delayMs}ms`,
      }}>
        {/* Face */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          background: "linear-gradient(135deg, #1a1a2e, #0f0f1a)",
          border: `2px solid ${borderColor}`,
          borderRadius: 8,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          boxShadow: isWinner && flipped ? `0 0 18px ${GREEN}88` : "none",
          animation: glowAnim,
          transition: "border-color 0.3s",
        }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: isWinner ? GREEN : isTie ? GOLD : "#ccc" }}>
            {WAR_RANKS[rank] ?? "?"}
          </div>
          <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.1em", marginTop: 2 }}>RANK {rank + 1}</div>
        </div>
        {/* Back */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          background: "repeating-linear-gradient(45deg, #1a0a04 0px, #1a0a04 4px, #0d0504 4px, #0d0504 8px)",
          border: `2px solid ${ACCENT}44`,
          borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, color: `${ACCENT}44`,
        }}>◈</div>
      </div>
    </div>
  );
}

export function WarStage({ playerCard, dealerCard, onDone }: { playerCard: number; dealerCard: number; onDone: () => void }) {
  useCasinoKeyframes();
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, []);

  const playerWins = playerCard > dealerCard;
  const isTie = playerCard === dealerCard;

  return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div style={{ display: "flex", gap: 24, justifyContent: "center", alignItems: "center" }}>
        <div>
          <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.08em", marginBottom: 6 }}>YOU</div>
          <WarCard rank={playerCard} label={WAR_RANKS[playerCard] ?? "?"} delayMs={100} isWinner={playerWins} isTie={isTie} />
        </div>
        <div style={{ color: "#333", fontSize: 22, fontWeight: 900, marginTop: 20 }}>VS</div>
        <div>
          <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.08em", marginBottom: 6 }}>DEALER</div>
          <WarCard rank={dealerCard} label={WAR_RANKS[dealerCard] ?? "?"} delayMs={550} isWinner={!playerWins && !isTie} isTie={isTie} />
        </div>
      </div>
      <div style={{ color: "#777", fontSize: 10, marginTop: 8, animation: "cas-slide-down 0.4s ease 0.9s both" }}>
        {isTie ? "TIE · HALF RETURNED" : playerWins ? "HIGHER · WIN" : "LOWER · LOSS"}
      </div>
    </div>
  );
}

// ── Shared card rendering for Baccarat / Three Card ──────────────────────────
const CARD_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUIT_GLYPHS = ["◆", "▣", "❖", "◯"]; // red, red-dark, blue, blue-light
const SUIT_COLORS = ["#e84a4a", "#c43a3a", "#7FC8FF", "#a8d8f0"];

function PokerCard({ cardIdx, delayMs, faceDown, highlight }: { cardIdx: number; delayMs: number; faceDown?: boolean; highlight?: "green" | "red" | "gold" }) {
  useCasinoKeyframes();
  const [visible, setVisible] = useState(false);
  const [face, setFace] = useState(faceDown ?? false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (!faceDown && face) {
      // flip from face-down to face-up
      const t = setTimeout(() => setFace(false), 50);
      return () => clearTimeout(t);
    }
  }, [faceDown]);

  const rank = cardIdx % 13;
  const suit = Math.floor(cardIdx / 13);
  const borderCol = highlight === "green" ? GREEN : highlight === "red" ? ACCENT : highlight === "gold" ? GOLD : "#333";

  if (!visible) return <div style={{ width: 46, height: 64, opacity: 0 }} />;

  return (
    <div style={{ perspective: 300, width: 46, height: 64 }}>
      <div style={{
        position: "relative", width: "100%", height: "100%",
        transformStyle: "preserve-3d",
        transform: face ? "rotateY(180deg)" : "rotateY(0deg)",
        transition: "transform 0.4s ease",
        animation: `cas-deal-card 0.3s ease both`,
      }}>
        {/* Face */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          background: "#181828",
          border: `1px solid ${borderCol}`,
          borderRadius: 5,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          boxShadow: highlight ? `0 0 10px ${borderCol}66` : "0 2px 6px rgba(0,0,0,0.5)",
          animation: highlight ? (highlight === "green" ? "cas-glow-green 1.2s ease infinite" : highlight === "gold" ? "cas-glow-gold 1.2s ease infinite" : "cas-glow-red 1.2s ease infinite") : undefined,
        }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: SUIT_COLORS[suit] ?? "#ccc", lineHeight: 1 }}>{CARD_RANKS[rank]}</div>
          <div style={{ fontSize: 11, color: SUIT_COLORS[suit] ?? "#aaa" }}>{SUIT_GLYPHS[suit]}</div>
        </div>
        {/* Back */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          background: "repeating-linear-gradient(45deg, #1a0a04 0px, #1a0a04 4px, #0d0504 4px, #0d0504 8px)",
          border: `1px solid ${ACCENT}33`,
          borderRadius: 5,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, color: `${ACCENT}33`,
        }}>◈</div>
      </div>
    </div>
  );
}

// ── BACCARAT: deal P,B,P,B then optional 3rd cards, reveal scores ─────────────
export function BaccaratStage({ playerCards, bankerCards, playerScore, bankerScore, result, onDone }: {
  playerCards: number[];
  bankerCards: number[];
  playerScore: number;
  bankerScore: number;
  result: number; // contract baccarat.move: 0=player win, 1=banker win, 2=tie
  onDone: () => void;
}) {
  useCasinoKeyframes();

  // Deal order: P0, B0, P1, B1, [P2], [B2]
  const dealOrder: Array<{ side: "P" | "B"; idx: number }> = [
    { side: "P", idx: 0 }, { side: "B", idx: 0 },
    { side: "P", idx: 1 }, { side: "B", idx: 1 },
  ];
  if (playerCards.length > 2) dealOrder.push({ side: "P", idx: 2 });
  if (bankerCards.length > 2) dealOrder.push({ side: "B", idx: 2 });

  useEffect(() => {
    // Total deal time + settle pause
    const totalMs = dealOrder.length * 350 + 800;
    const t = setTimeout(onDone, totalMs);
    return () => clearTimeout(t);
  }, []);

  // Contract result enum: 0=player win, 1=banker win, 2=tie.
  const playerHighlight = (): "green" | "red" | "gold" | undefined => {
    if (result === 2) return "gold";   // tie
    if (result === 0) return "green";  // player wins
    return "red";
  };
  const bankerHighlight = (): "green" | "red" | "gold" | undefined => {
    if (result === 2) return "gold";   // tie
    if (result === 1) return "green";  // banker wins
    return "red";
  };
  const resultLabel = result === 0 ? "PLAYER WINS" : result === 1 ? "BANKER WINS" : "TIE";
  const resultColor = result === 2 ? GOLD : result === 0 ? GREEN : ACCENT;

  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 8 }}>
        {/* Player side */}
        <div style={{ textAlign: "center" }}>
          <div style={{ color: BLUE, fontSize: 10, letterSpacing: "0.08em", marginBottom: 6 }}>PLAYER</div>
          <div style={{ display: "flex", gap: 4 }}>
            {playerCards.map((c, i) => (
              <PokerCard key={i} cardIdx={c} delayMs={i * 700} highlight={playerHighlight()} />
            ))}
          </div>
          <div style={{ color: BLUE, fontSize: 14, fontWeight: 900, marginTop: 4 }}>{playerScore}</div>
        </div>
        <div style={{ color: "#333", fontSize: 16, alignSelf: "center", fontWeight: 900, marginTop: 10 }}>VS</div>
        {/* Banker side */}
        <div style={{ textAlign: "center" }}>
          <div style={{ color: ACCENT, fontSize: 10, letterSpacing: "0.08em", marginBottom: 6 }}>BANKER</div>
          <div style={{ display: "flex", gap: 4 }}>
            {bankerCards.map((c, i) => (
              <PokerCard key={i} cardIdx={c} delayMs={350 + i * 700} highlight={bankerHighlight()} />
            ))}
          </div>
          <div style={{ color: ACCENT, fontSize: 14, fontWeight: 900, marginTop: 4 }}>{bankerScore}</div>
        </div>
      </div>
      {/* Result banner */}
      <div style={{ textAlign: "center", marginTop: 6, animation: `cas-slide-down 0.4s ease ${dealOrder.length * 350 + 200}ms both` }}>
        <div style={{ color: resultColor, fontSize: 18, fontWeight: 900, letterSpacing: "0.06em" }}>{resultLabel}</div>
      </div>
    </div>
  );
}

// ── THREE CARD POKER: 3 player + 3 dealer (face down → flip), qualify badge ──
export function ThreeCardStage({ playerCards, dealerCards, result, dealerQualified, onDone }: {
  playerCards: number[];
  dealerCards: number[];
  result: number; // 0=loss, 1=push, 2=win
  dealerQualified: boolean;
  onDone: () => void;
}) {
  useCasinoKeyframes();
  const [dealerFlipped, setDealerFlipped] = useState(false);

  useEffect(() => {
    // Dealer cards flip up after 1.4s
    const t1 = setTimeout(() => setDealerFlipped(true), 1400);
    const t2 = setTimeout(onDone, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const resColor = result === 0 ? ACCENT : result === 1 ? GOLD : GREEN;
  const resLabel = result === 0 ? "LOSS" : result === 1 ? "PUSH" : "WIN";

  const playerHighlight = (result === 2 ? "green" : result === 1 ? "gold" : "red") as "green" | "gold" | "red";
  const dealerHighlight = (result === 0 ? "green" : result === 1 ? "gold" : "red") as "green" | "gold" | "red";

  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 8 }}>
        {/* Player hand */}
        <div style={{ textAlign: "center" }}>
          <div style={{ color: BLUE, fontSize: 10, letterSpacing: "0.08em", marginBottom: 6 }}>YOU</div>
          <div style={{ display: "flex", gap: 3 }}>
            {playerCards.map((c, i) => (
              <PokerCard key={i} cardIdx={c} delayMs={i * 200} highlight={playerHighlight} />
            ))}
          </div>
        </div>
        <div style={{ color: "#333", fontSize: 14, alignSelf: "center", fontWeight: 900, marginTop: 10 }}>VS</div>
        {/* Dealer hand (start face-down, flip after delay) */}
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: 10, letterSpacing: "0.08em", marginBottom: 6 }}>DEALER</div>
          <div style={{ display: "flex", gap: 3 }}>
            {dealerCards.map((c, i) => (
              <PokerCard key={i} cardIdx={c} delayMs={800 + i * 200} faceDown={!dealerFlipped} highlight={dealerHighlight} />
            ))}
          </div>
        </div>
      </div>
      {/* Qualify + result */}
      <div style={{ textAlign: "center", animation: "cas-slide-down 0.4s ease 2s both" }}>
        <div style={{ color: dealerQualified ? "#888" : GOLD, fontSize: 9, letterSpacing: "0.1em", marginBottom: 3 }}>
          {dealerQualified ? "DEALER QUALIFIES" : "DEALER NO QUALIFY"}
        </div>
        <div style={{ color: resColor, fontSize: 20, fontWeight: 900 }}>{resLabel}</div>
      </div>
    </div>
  );
}

// ── HILO: base card visible, drawn card flips in, arrow shows call ─────────────
export function HiLoStage({ base, drawn, higher, onDone }: { base: number; drawn: number; higher: boolean; onDone: () => void }) {
  useCasinoKeyframes();
  const [drawnVisible, setDrawnVisible] = useState(false);
  const won = higher ? drawn > base : drawn < base;
  const isPush = drawn === base;

  useEffect(() => {
    const t1 = setTimeout(() => setDrawnVisible(true), 900);
    const t2 = setTimeout(onDone, 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const rankColor = (r: number) => (r <= 1 ? "#e84a4a" : r >= 11 ? GOLD : "#bbb");

  return (
    <div style={{ textAlign: "center", padding: "14px 0" }}>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "center" }}>
        {/* Base card */}
        <div>
          <div style={{ color: "#666", fontSize: 9, letterSpacing: "0.1em", marginBottom: 4 }}>BASE</div>
          <div style={{
            width: 58, height: 76, background: "#181828", border: `2px solid ${GOLD}66`,
            borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: rankColor(base) }}>{HILO_RANKS[base] ?? "?"}</div>
          </div>
        </div>

        {/* Arrow */}
        <div style={{ fontSize: 26, color: GOLD, animation: "cas-rocket-bounce 0.5s ease infinite" }}>
          {higher ? "▲" : "▼"}
        </div>

        {/* Drawn card */}
        <div>
          <div style={{ color: "#666", fontSize: 9, letterSpacing: "0.1em", marginBottom: 4 }}>DRAWN</div>
          <div style={{
            width: 58, height: 76,
            background: drawnVisible ? "#181828" : "#0a0a12",
            border: `2px solid ${drawnVisible ? (isPush ? GOLD : won ? GREEN : ACCENT) : "#333"}`,
            borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            animation: drawnVisible ? "cas-card-flip 0.4s ease, cas-pop 0.3s ease 0.15s both" : undefined,
            boxShadow: drawnVisible ? `0 0 14px ${isPush ? GOLD : won ? GREEN : ACCENT}55` : "none",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}>
            {drawnVisible
              ? <div style={{ fontSize: 24, fontWeight: 900, color: isPush ? GOLD : won ? GREEN : ACCENT }}>{HILO_RANKS[drawn] ?? "?"}</div>
              : <div style={{ fontSize: 22, color: "#333" }}>◈</div>
            }
          </div>
        </div>
      </div>
      {drawnVisible && (
        <div style={{ marginTop: 8, color: isPush ? GOLD : won ? GREEN : ACCENT, fontSize: 11, fontWeight: 800, animation: "cas-slide-down 0.3s ease" }}>
          {isPush ? "PUSH — EQUAL" : won ? "CORRECT" : "WRONG"}
        </div>
      )}
    </div>
  );
}

// ── PLINKO: ball drops through 12 rows, bounces per path bits, lands in bucket ─
const PLINKO_ROWS = 12;
const PLINKO_BUCKETS = 13;

// Bucket multiplier display values (approximate — match contract odds)
const PLINKO_BUCKET_MULTS = [130, 27, 8, 4, 2, 1, 0.3, 1, 2, 4, 8, 27, 130];

export function PlinkoStage({ path, bucket, mults, onDone }: { path: number; bucket: number; mults?: number[]; onDone: () => void }) {
  const bucketMults = mults ?? PLINKO_BUCKET_MULTS;
  useCasinoKeyframes();

  // Track ball position: [row, col] starting at center top
  const [ballRow, setBallRow] = useState(-1);
  const [ballCol, setBallCol] = useState(PLINKO_ROWS / 2); // center
  const [landed, setLanded] = useState(false);
  const animRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let col = PLINKO_ROWS / 2; // start center (float)
    let row = 0;

    const drop = () => {
      if (row >= PLINKO_ROWS) {
        setBallRow(PLINKO_ROWS);
        setBallCol(bucket);
        setLanded(true);
        setTimeout(onDone, 600);
        return;
      }
      // bit row of path: 0 = left, 1 = right
      const goRight = ((path >> row) & 1) === 1;
      col = col + (goRight ? 0.5 : -0.5);
      setBallRow(row);
      setBallCol(col);
      row++;
      // Accelerate: starts slow, speeds up
      const delay = Math.max(60, 220 - row * 13);
      animRef.current = setTimeout(drop, delay);
    };

    animRef.current = setTimeout(drop, 200);
    return () => clearTimeout(animRef.current);
  }, []);

  const cellW = 24; // px per column unit
  const rowH = 20;  // px per row
  const boardW = PLINKO_BUCKETS * cellW;
  const boardH = (PLINKO_ROWS + 2) * rowH;

  // Ball pixel position
  const ballX = ballCol * cellW;
  const ballY = ballRow === -1 ? -rowH : (ballRow + 0.5) * rowH;

  const bucketMult = bucketMults[bucket] ?? 0;
  const bucketColor = bucketMult >= 8 ? GOLD : bucketMult >= 2 ? GREEN : "#888";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0" }}>
      <div style={{ position: "relative", width: boardW, height: boardH, overflow: "hidden", background: "#080810", border: `1px solid #222`, borderRadius: 8 }}>

        {/* Pegs */}
        {Array.from({ length: PLINKO_ROWS }, (_, row) =>
          Array.from({ length: row + 2 }, (_, pegIdx) => {
            const pegX = (PLINKO_ROWS / 2 - row / 2 + pegIdx) * cellW;
            const pegY = (row + 0.5) * rowH - 3;
            return (
              <div key={`${row}-${pegIdx}`} style={{
                position: "absolute",
                left: pegX - 3, top: pegY,
                width: 6, height: 6,
                borderRadius: "50%",
                background: "#334",
                boxShadow: "0 0 3px #556",
              }} />
            );
          })
        )}

        {/* Ball */}
        <div style={{
          position: "absolute",
          left: ballX - 7,
          top: ballY - 7,
          width: 14, height: 14,
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #ff9966, #cc3300)",
          boxShadow: `0 0 8px ${ACCENT}`,
          animation: "cas-plinko-fall 0.08s ease",
          transition: "top 0.12s cubic-bezier(0.25, 0.46, 0.45, 0.94), left 0.12s ease",
          zIndex: 10,
        }}>
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "#fff" }}>◉</div>
        </div>

        {/* Buckets */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: rowH,
          display: "flex",
        }}>
          {Array.from({ length: PLINKO_BUCKETS }, (_, b) => {
            const isLanded = landed && b === bucket;
            const mult = bucketMults[b] ?? 0;
            const col = mult >= 8 ? GOLD : mult >= 2 ? GREEN : "#555";
            return (
              <div key={b} style={{
                flex: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isLanded ? `${col}33` : "transparent",
                border: `1px solid ${isLanded ? col : "#1a1a2a"}`,
                borderRadius: 3,
                animation: isLanded ? "cas-glow-gold 0.8s ease infinite, cas-pop 0.4s ease" : undefined,
                transition: "background 0.2s",
                fontSize: 7, color: col, fontWeight: 800,
              }}>
                {mult >= 1 ? `${mult}x` : mult > 0 ? `${mult.toFixed(2).replace(/^0/, "").replace(/0+$/, "")}x` : "0"}
              </div>
            );
          })}
        </div>
      </div>

      {landed && (
        <div style={{ marginTop: 8, textAlign: "center", animation: "cas-pop 0.4s ease" }}>
          <div style={{ color: "#666", fontSize: 9, letterSpacing: "0.1em" }}>BUCKET {bucket}</div>
          <div style={{ color: bucketColor, fontSize: 28, fontWeight: 900 }}>{bucketMult}x</div>
        </div>
      )}
    </div>
  );
}

// ── KENO: 40-number grid, picks highlighted, drawn numbers light up ───────────
export function KenoStage({ picks, drawn, matches: _matches, onDone }: { picks: number[]; drawn: number[]; matches: number; onDone: () => void }) {
  useCasinoKeyframes();
  const [revealedDrawn, setRevealedDrawn] = useState<Set<number>>(new Set());
  const pickSet = new Set(picks);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Reveal one drawn number every 120ms
    drawn.forEach((n, i) => {
      const t = setTimeout(() => {
        setRevealedDrawn((prev) => new Set([...prev, n]));
      }, 300 + i * 140);
      timers.push(t);
    });
    // Done after all drawn + settle pause
    const doneT = setTimeout(onDone, 300 + drawn.length * 140 + 600);
    timers.push(doneT);
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 3 }}>
        {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => {
          const isPick = pickSet.has(n);
          const isDrawn = revealedDrawn.has(n);
          const isMatch = isPick && isDrawn;
          const bg = isMatch ? "#1a1408" : isPick ? "#1a0808" : isDrawn ? "#0a1a10" : "#111";
          const borderCol = isMatch ? GOLD : isPick ? ACCENT : isDrawn ? GREEN : "#222";
          const color = isMatch ? GOLD : isPick ? ACCENT : isDrawn ? GREEN : "#555";
          return (
            <div key={n} style={{
              background: bg,
              border: `1px solid ${borderCol}`,
              color,
              fontSize: 10, fontWeight: isMatch ? 900 : isPick ? 700 : 400,
              padding: "5px 0",
              textAlign: "center",
              borderRadius: 3,
              animation: isDrawn ? (isMatch ? "cas-glow-gold 1s ease infinite, cas-pop 0.3s ease" : "cas-pop 0.25s ease") : undefined,
              transition: "background 0.2s, border-color 0.2s",
            }}>{n}</div>
          );
        })}
      </div>
    </div>
  );
}

// ── SIC BO: three dice tumbling + settling ────────────────────────────────────
export function SicBoStage({ d1, d2, d3, kind: _kind, target: _target, onDone }: { d1: number; d2: number; d3: number; kind: number; target: number; onDone: () => void }) {
  useCasinoKeyframes();
  const [settledCount, setSettledCount] = useState(0);

  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, []);

  const sum = d1 + d2 + d3;
  const allSettled = settledCount >= 3;

  return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center" }}>
        <SingleDie finalVal={d1} delayMs={0} onSettled={() => setSettledCount((p) => p + 1)} />
        <SingleDie finalVal={d2} delayMs={280} onSettled={() => setSettledCount((p) => p + 1)} />
        <SingleDie finalVal={d3} delayMs={560} onSettled={() => setSettledCount((p) => p + 1)} />
      </div>
      {allSettled && (
        <div style={{ marginTop: 10, animation: "cas-pop 0.4s ease" }}>
          <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.1em" }}>TOTAL</div>
          <div style={{ color: GOLD, fontSize: 36, fontWeight: 900 }}>{sum}</div>
          <div style={{ color: "#666", fontSize: 10 }}>
            {sum <= 10 ? "SMALL" : sum >= 11 ? "BIG" : ""}
          </div>
        </div>
      )}
    </div>
  );
}

// ── DRAGON TIGER: two cards flip, Dragon vs Tiger ────────────────────────────
const DT_RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

function DuelCard({ rank, label, delayMs, isWinner, isTie }: {
  rank: number; label: string; delayMs: number; isWinner: boolean; isTie: boolean;
}) {
  useCasinoKeyframes();
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), delayMs);
    return () => clearTimeout(t);
  }, []);
  const borderColor = !flipped ? "#333" : isWinner ? GREEN : isTie ? GOLD : ACCENT;
  const glowAnim = !flipped ? undefined : isWinner ? "cas-glow-green 1s ease infinite" : isTie ? "cas-glow-gold 1s ease infinite" : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ fontSize: 10, color: "#777", letterSpacing: "0.12em", fontWeight: 700 }}>{label}</div>
      <div style={{ perspective: 400, width: 72, height: 96 }}>
        <div style={{
          position: "relative", width: "100%", height: "100%",
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(0deg)" : "rotateY(180deg)",
          transition: `transform 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${delayMs}ms`,
        }}>
          <div style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden",
            background: "linear-gradient(135deg, #1a1a2e, #0f0f1a)",
            border: `2px solid ${borderColor}`, borderRadius: 8,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            boxShadow: isWinner && flipped ? `0 0 18px ${GREEN}88` : "none",
            animation: glowAnim, transition: "border-color 0.3s",
          }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: isWinner ? GREEN : isTie ? GOLD : "#ccc" }}>
              {DT_RANKS[rank] ?? "?"}
            </div>
            <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.1em", marginTop: 2 }}>RANK {rank + 1}</div>
          </div>
          <div style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: "repeating-linear-gradient(45deg, #1a0a04 0px, #1a0a04 4px, #0d0504 4px, #0d0504 8px)",
            border: `2px solid ${ACCENT}44`, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, color: `${ACCENT}44`,
          }}>◈</div>
        </div>
      </div>
    </div>
  );
}

export function DragonTigerStage({
  dragonRank, tigerRank, betType, onDone,
}: { dragonRank: number; tigerRank: number; betType: number; onDone: () => void }) {
  useCasinoKeyframes();
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, []);
  const dragonWins = dragonRank > tigerRank;
  const tigerWins  = tigerRank > dragonRank;
  const isTie      = dragonRank === tigerRank;
  const betDragon  = betType === 0;
  const betTiger   = betType === 1;
  const betTieSide = betType === 2;
  const dragonIsWinner = betDragon ? dragonWins : betTieSide ? isTie : false;
  const tigerIsWinner  = betTiger  ? tigerWins  : betTieSide ? isTie : false;
  let outcome: string;
  if (isTie)           outcome = betTieSide ? "TIE  9x WIN" : "TIE  HALF RETURNED";
  else if (dragonWins) outcome = betDragon  ? "DRAGON WINS" : betTieSide ? "TIE BUST" : "TIGER LOSES";
  else                 outcome = betTiger   ? "TIGER WINS"  : betTieSide ? "TIE BUST" : "DRAGON LOSES";
  return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div style={{ display: "flex", gap: 24, justifyContent: "center", alignItems: "flex-start" }}>
        <DuelCard rank={dragonRank} label="DRAGON" delayMs={100} isWinner={dragonIsWinner} isTie={isTie} />
        <div style={{ color: "#333", fontSize: 22, fontWeight: 900, marginTop: 32 }}>VS</div>
        <DuelCard rank={tigerRank}  label="TIGER"  delayMs={550} isWinner={tigerIsWinner}  isTie={isTie} />
      </div>
      <div style={{ color: "#777", fontSize: 10, marginTop: 8, animation: "cas-slide-down 0.4s ease 0.9s both" }}>
        {outcome}
      </div>
    </div>
  );
}

// ── UNDER/OVER 7: two dice tumble, sum with zone label ───────────────────────
export function UnderOver7Stage({
  d1, d2, kind, onDone,
}: { d1: number; d2: number; kind: number; onDone: () => void }) {
  useCasinoKeyframes();
  const [bothDone, setBothDone] = useState(0);
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, []);
  const sum = d1 + d2;
  const allSettled = bothDone >= 2;
  const isUnder = sum >= 2 && sum <= 6;
  const isSeven = sum === 7;
  const won = (kind === 0 && isUnder) || (kind === 1 && isSeven) || (kind === 2 && sum >= 8);
  const kindLabel = ["UNDER","EXACTLY 7","OVER"][kind] ?? "?";
  const zoneColor = isSeven ? GOLD : isUnder ? GREEN : ACCENT;
  const zoneLabel = isSeven ? "SEVEN" : isUnder ? "UNDER" : "OVER";
  return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "center" }}>
        <SingleDie finalVal={d1} delayMs={0}   onSettled={() => setBothDone((p) => p + 1)} />
        <div style={{ color: "#444", fontSize: 20, fontWeight: 900 }}>+</div>
        <SingleDie finalVal={d2} delayMs={350} onSettled={() => setBothDone((p) => p + 1)} />
      </div>
      {allSettled && (
        <div style={{ marginTop: 10, animation: "cas-pop 0.4s ease" }}>
          <div style={{ color: "#666", fontSize: 10, letterSpacing: "0.1em" }}>SUM</div>
          <div style={{ color: GOLD, fontSize: 36, fontWeight: 900 }}>{sum}</div>
          <div style={{ fontSize: 10, color: zoneColor, letterSpacing: "0.1em", fontWeight: 700 }}>
            {zoneLabel}  {kindLabel} bet  {won ? "WIN" : "LOSS"}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ORE REFINE: EVE-native refinery processing bar ───────────────────────────
const ORE_OUTCOME_COLORS = ["#cc3333", "#cc8833", GREEN, GOLD];
const ORE_OUTCOME_LABELS = ["CONTAMINATED", "PARTIAL YIELD", "CLEAN EXTRACTION", "RARE ISOTOPE"];
const ORE_TIER_LABELS    = ["BASIC","STANDARD","ADVANCED","INDUSTRIAL","CRITICAL"];

export function OreRefineStage({
  tier, outcome, onDone,
}: { tier: number; outcome: number; onDone: () => void }) {
  useCasinoKeyframes();
  const [phase, setPhase] = useState<"processing" | "reveal">("processing");
  const processDuration = 800 + tier * 400;
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("reveal"), processDuration);
    const t2 = setTimeout(onDone, processDuration + 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const col   = ORE_OUTCOME_COLORS[outcome] ?? GOLD;
  const label = ORE_OUTCOME_LABELS[outcome] ?? "UNKNOWN";
  const tLabel = ORE_TIER_LABELS[tier - 1] ?? "?";
  return (
    <div style={{ textAlign: "center", padding: "16px 0" }}>
      <div style={{ color: "#777", fontSize: 10, letterSpacing: "0.12em", marginBottom: 10 }}>
        REFINE INTENSITY: <span style={{ color: GOLD, fontWeight: 700 }}>{tLabel}</span>
      </div>
      {phase === "processing" && (
        <div style={{ padding: "0 16px" }}>
          <div style={{ height: 8, background: "#111", borderRadius: 4, border: "1px solid #333", overflow: "hidden" }}>
            <div style={{
              height: "100%", background: `linear-gradient(90deg, ${ACCENT}, ${GOLD})`,
              borderRadius: 4,
              animation: `cas-bar-fill ${processDuration}ms linear forwards`,
            }} />
          </div>
          <div style={{ color: "#555", fontSize: 10, marginTop: 6 }}>PROCESSING ORE...</div>
        </div>
      )}
      {phase === "reveal" && (
        <div style={{ animation: "cas-pop 0.4s ease" }}>
          <div style={{ fontSize: 28, color: col, fontWeight: 900, letterSpacing: "0.05em" }}>
            {outcome === 0 ? "\u2717" : outcome === 3 ? "\u25c6" : "\u25a3"}
          </div>
          <div style={{ color: col, fontSize: 14, fontWeight: 700, letterSpacing: "0.08em", marginTop: 4 }}>
            {label}
          </div>
          {outcome === 3 && (
            <div style={{ color: GOLD, fontSize: 10, marginTop: 4, animation: "cas-glow-gold 1.5s ease infinite" }}>
              ISOTOPE DETECTED
            </div>
          )}
        </div>
      )}
    </div>
  );
}
