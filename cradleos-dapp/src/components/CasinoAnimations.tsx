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
import { SLOT_SYMBOLS } from "../lib/casinoGames";

const ACCENT = "#FF4700";
const GOLD = "#E8B84B";

// ── one-time keyframe injection ───────────────────────────────────────────────
let injected = false;
function useCasinoKeyframes() {
  useEffect(() => {
    if (injected) return;
    injected = true;
    const el = document.createElement("style");
    el.textContent = `
      @keyframes cas-coin-spin { from { transform: rotateY(0deg); } to { transform: rotateY(1800deg); } }
      @keyframes cas-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.12); } 100% { transform: scale(1); } }
      @keyframes cas-flash { 0% { opacity: 0.9; } 100% { opacity: 0; } }
      @keyframes cas-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px) rotate(-4deg); } 40% { transform: translateX(6px) rotate(3deg); } 60% { transform: translateX(-4px) rotate(-2deg); } 80% { transform: translateX(3px) rotate(1deg); } }
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
    // pocket center must end under the top pointer: rotate wheel so that
    // idx*seg + seg/2 lands at 0deg (top), plus 4 full turns for drama.
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
const REEL_STRIP = [0, 4, 1, 5, 2, 6, 3, 0, 2, 1, 4, 3, 5, 0, 6, 2]; // display order, all symbols present
const CELL = 64;

function Reel({ symbol, duration, spinning }: { symbol: number; duration: number; spinning: boolean }) {
  // strip repeated 6x; land on an instance of `symbol` deep into the strip.
  const reps = 6;
  const strip: number[] = [];
  for (let r = 0; r < reps; r++) strip.push(...REEL_STRIP);
  const landIdxInStrip = (reps - 2) * REEL_STRIP.length + REEL_STRIP.indexOf(symbol);
  const offset = spinning ? 0 : -(landIdxInStrip * CELL - CELL); // symbol centered (1 cell above/below visible)
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
      {/* center row marker */}
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
