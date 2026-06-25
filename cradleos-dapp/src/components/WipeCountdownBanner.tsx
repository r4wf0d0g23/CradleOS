/**
 * WipeCountdownBanner — landing-page countdown to the next Cycle wipe.
 *
 * Targets:
 *   - Gates open (primary):    2026-06-25 14:00 UTC
 *   - Server shutdown window:  2026-06-25 09:00 UTC
 *
 * Source: FC Overload (Fenris) in the official Frontier Discord on
 * 2026-06-20: "we will likely go down at 0900 UTC and aim to open
 * the gates at 1400 UTC". Cycle 6 / Sanctuary patch notes confirmed
 * 2026-06-24. Raw confirmed wipe date is 2026-06-25.
 *
 * After the gates-open moment passes, the banner switches to a
 * "Sanctuary is live" mode for 24h, then auto-hides.
 *
 * Dismissible via localStorage so once a user has seen it they can
 * close it and it stays closed until the next wipe milestone changes.
 */
import { useEffect, useState } from "react";

// Hard target moments (UTC). Update these on the next cycle.
const SHUTDOWN_MS  = Date.UTC(2026, 5, 25,  9, 0, 0); // Jun 25 09:00 UTC
const GATES_OPEN_MS = Date.UTC(2026, 5, 25, 14, 0, 0); // Jun 25 14:00 UTC
const POST_WIPE_DISPLAY_MS = 24 * 60 * 60 * 1000;       // keep "live" banner for 24h after gates open
const DISMISS_KEY = "cradleos:wipe-countdown-dismissed:cycle6";

type Phase = "before-shutdown" | "shutdown-window" | "live" | "expired";

function classifyPhase(now: number): Phase {
  if (now >= GATES_OPEN_MS + POST_WIPE_DISPLAY_MS) return "expired";
  if (now >= GATES_OPEN_MS)                       return "live";
  if (now >= SHUTDOWN_MS)                         return "shutdown-window";
  return "before-shutdown";
}

function formatCountdown(ms: number): { d: string; h: string; m: string; s: string } {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d: String(d), h: pad(h), m: pad(m), s: pad(s) };
}

export function WipeCountdownBanner() {
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  // Tick every second while the banner is on-screen.
  useEffect(() => {
    if (dismissed) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [dismissed]);

  const phase = classifyPhase(now);
  if (phase === "expired" || dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* */ }
  }

  // ── Phase 1: counting down to the 09:00 UTC shutdown ───────────────────
  if (phase === "before-shutdown") {
    const toGates = GATES_OPEN_MS - now;
    const t = formatCountdown(toGates);
    return (
      <Frame onDismiss={handleDismiss}>
        <Headline>CYCLE 6 — SANCTUARY</Headline>
        <Sub>Sanctuary gates open in</Sub>
        <CountdownRow t={t} />
        <Meta>
          Server down: <strong style={{ color: "#ffcc44" }}>25 Jun 09:00 UTC</strong> &nbsp;·&nbsp;
          Gates open: <strong style={{ color: "#44ffaa" }}>25 Jun 14:00 UTC</strong>
        </Meta>
      </Frame>
    );
  }

  // ── Phase 2: in the shutdown window, counting down to gates ────────────
  if (phase === "shutdown-window") {
    const toGates = GATES_OPEN_MS - now;
    const t = formatCountdown(toGates);
    return (
      <Frame onDismiss={handleDismiss} accent="#ffcc44">
        <Headline accent="#ffcc44">⚠ FRONTIER OFFLINE</Headline>
        <Sub>Sanctuary gates open in</Sub>
        <CountdownRow t={t} accent="#ffcc44" />
        <Meta>
          Servers went down at 09:00 UTC for the Cycle 6 wipe.
          Gates open at <strong style={{ color: "#44ffaa" }}>25 Jun 14:00 UTC</strong>.
        </Meta>
      </Frame>
    );
  }

  // ── Phase 3: live, post-wipe ───────────────────────────────────────────
  return (
    <Frame onDismiss={handleDismiss} accent="#44ffaa">
      <Headline accent="#44ffaa">✦ SANCTUARY IS LIVE</Headline>
      <Sub>Cycle 6 gates have opened. Welcome back, pilot.</Sub>
    </Frame>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────

function Frame({ children, onDismiss, accent = "#FF4700" }: {
  children: React.ReactNode;
  onDismiss: () => void;
  accent?: string;
}) {
  return (
    <div style={{
      position: "relative",
      marginBottom: 12,
      padding: "14px 16px 12px",
      background: `linear-gradient(135deg, rgba(5,3,2,0.6) 0%, rgba(${hexToRgb(accent)},0.06) 100%)`,
      border: `1px solid ${accent}55`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 2,
      fontFamily: "inherit",
    }}>
      <button
        onClick={onDismiss}
        title="Dismiss"
        aria-label="Dismiss"
        style={{
          position: "absolute", top: 6, right: 8,
          background: "none", border: "none",
          color: "rgba(255,255,255,0.35)", fontSize: 16,
          cursor: "pointer", padding: "0 4px", lineHeight: 1,
        }}
      >×</button>
      {children}
    </div>
  );
}

function Headline({ children, accent = "#FF4700" }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 800, letterSpacing: "0.18em",
      textTransform: "uppercase", color: accent, marginBottom: 4,
    }}>
      {children}
    </div>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, letterSpacing: "0.08em",
      color: "rgba(220,220,200,0.7)", marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function CountdownRow({ t, accent = "#FF4700" }: {
  t: { d: string; h: string; m: string; s: string };
  accent?: string;
}) {
  return (
    <div style={{
      display: "flex", gap: 8, marginBottom: 10,
      flexWrap: "wrap", alignItems: "baseline",
    }}>
      <Cell label="DAYS"  value={t.d} accent={accent} />
      <Cell label="HOURS" value={t.h} accent={accent} />
      <Cell label="MIN"   value={t.m} accent={accent} />
      <Cell label="SEC"   value={t.s} accent={accent} />
    </div>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      minWidth: 56, padding: "6px 10px",
      background: "rgba(5,3,2,0.5)",
      border: `1px solid ${accent}33`,
      textAlign: "center",
      fontFamily: "monospace",
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 8, color: "rgba(175,175,155,0.6)", letterSpacing: "0.14em", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, color: "rgba(175,175,155,0.65)",
      letterSpacing: "0.05em",
    }}>
      {children}
    </div>
  );
}

// Tiny helper — accent colors come in as hex; we want rgb tuple for the
// background gradient so the tint stays subtle.
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3
    ? h.split("").map(c => c + c).join("")
    : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
