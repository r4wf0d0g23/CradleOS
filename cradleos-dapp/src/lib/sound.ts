// CradleOS power UI feedback — mp3 asset playback.
//
// Loads /CradleOS/sounds/power-{on,off}.mp3 once, then clones the buffer
// per playback so rapid toggles don't cut each other off.
//
// Webview safety:
//   - Audio.play() must be triggered by a user gesture; all callers fire from
//     onClick handlers, so autoplay policy is satisfied.
//   - Suspended AudioContext is auto-resumed.
//   - Falls back gracefully if Web Audio is unavailable.
//
// Mute persisted in localStorage["cradleos.sound.muted"].

const MUTE_KEY = "cradleos.sound.muted";

// vite serves /public at base — VITE_BASE in build sets the prefix.
// Use import.meta.env.BASE_URL so paths work whether base is "/" or "/CradleOS/".
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
const POWER_ON_URL = `${BASE.replace(/\/$/, "")}/sounds/power-on.mp3`;
const POWER_OFF_URL = `${BASE.replace(/\/$/, "")}/sounds/power-off.mp3`;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;

const buffers = new Map<string, AudioBuffer>();
const inflight = new Map<string, Promise<AudioBuffer>>();

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.85; // headroom for already-mixed mp3s
    masterGain.connect(ctx.destination);
    return ctx;
  } catch {
    return null;
  }
}

function ensureRunning(c: AudioContext) {
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }
}

async function loadBuffer(c: AudioContext, url: string): Promise<AudioBuffer> {
  const cached = buffers.get(url);
  if (cached) return cached;
  const pending = inflight.get(url);
  if (pending) return pending;

  const p = (async () => {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`sfx fetch failed: ${res.status} ${url}`);
    const arr = await res.arrayBuffer();
    // decodeAudioData has callback variant on Safari; promise variant works in modern Chromium/Firefox.
    const buf = await new Promise<AudioBuffer>((resolve, reject) => {
      const maybe = c.decodeAudioData(arr, resolve, reject);
      if (maybe && typeof (maybe as Promise<AudioBuffer>).then === "function") {
        (maybe as Promise<AudioBuffer>).then(resolve, reject);
      }
    });
    buffers.set(url, buf);
    inflight.delete(url);
    return buf;
  })();

  inflight.set(url, p);
  return p;
}

function playBuffer(c: AudioContext, buf: AudioBuffer): void {
  if (!masterGain) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(masterGain);
  src.start();
  src.onended = () => {
    try { src.disconnect(); } catch { /* noop */ }
  };
}

function play(url: string): void {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  ensureRunning(c);
  const cached = buffers.get(url);
  if (cached) {
    playBuffer(c, cached);
    return;
  }
  // First play: load + play once decoded. Subsequent plays hit cache instantly.
  loadBuffer(c, url).then(
    (buf) => {
      // Re-check mute state at decode time (user might have toggled mid-decode)
      if (!isMuted()) playBuffer(c, buf);
    },
    () => { /* swallow load errors silently */ },
  );
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* swallow */
  }
}

export function toggleMuted(): boolean {
  const next = !isMuted();
  setMuted(next);
  return next;
}

export function playPowerOn(): void {
  play(POWER_ON_URL);
}

export function playPowerOff(): void {
  play(POWER_OFF_URL);
}

/**
 * Optionally pre-warm the audio cache. Call once at first connect to avoid
 * a fetch+decode delay on the first toggle. Safe to call multiple times.
 */
export function preloadPowerSounds(): void {
  const c = getCtx();
  if (!c) return;
  // Fire-and-forget; ignore errors.
  loadBuffer(c, POWER_ON_URL).catch(() => {});
  loadBuffer(c, POWER_OFF_URL).catch(() => {});
}
