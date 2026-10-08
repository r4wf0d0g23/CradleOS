import { createContext, useCallback, useEffect, useRef, useState } from "react";
export type CasinoCue = "select" | "deal" | "spin" | "win" | "loss";
export const CasinoFeedback = createContext<(cue: CasinoCue) => void>(() => {});
/** Original synthesized cues, plus the existing Frontier power sample. Opt-in only. */
export function useCasinoFeedback() {
  const [enabled, setEnabled] = useState(false),
    [error, setError] = useState("");
  const ctx = useRef<AudioContext | null>(null),
    active = useRef(false),
    generation = useRef(0),
    mounted = useRef(true),
    sample = useRef<HTMLAudioElement | null>(null);
  const play = useCallback((cue: CasinoCue) => {
    const c = ctx.current;
    if (!active.current || !c || c.state !== "running" || document.hidden)
      return;
    const notes =
      cue === "win"
        ? [261.63, 329.63, 392]
        : cue === "loss"
          ? [110, 82.41]
          : cue === "spin"
            ? [146.83, 220]
            : cue === "deal"
              ? [392]
              : [660];
    notes.forEach((hz, i) => {
      const o = c.createOscillator(),
        g = c.createGain(),
        t = c.currentTime + i * 0.09;
      o.type = cue === "spin" ? "triangle" : "sine";
      o.frequency.setValueAtTime(hz, t);
      o.frequency.exponentialRampToValueAtTime(hz * 0.8, t + 0.16);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + 0.25);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    });
  }, []);
  const silence = useCallback(() => {
    generation.current++;
    active.current = false;
    sample.current?.pause();
    sample.current = null;
    if (ctx.current) {
      void ctx.current.close().catch(() => {});
      ctx.current = null;
    }
  }, []);
  const toggle = useCallback(async () => {
    if (active.current) {
      silence();
      setEnabled(false);
      return;
    }
    if (document.hidden || !mounted.current) return;
    // Claim the opt-in synchronously. A second click cancels even while resume waits.
    active.current = true;
    const ticket = ++generation.current;
    setEnabled(true);
    let c: AudioContext | null = null;
    try {
      c = new AudioContext();
      ctx.current = c;
      await c.resume();
      if (
        ticket !== generation.current ||
        !mounted.current ||
        !active.current ||
        document.hidden
      ) {
        if (c.state !== "closed") void c.close().catch(() => {});
        return;
      }
      setError("");
      const a = new Audio(`${import.meta.env.BASE_URL}sounds/power-on.mp3`);
      a.volume = 0.16;
      sample.current = a;
      void a.play().catch(() => {});
      play("select");
    } catch {
      if (c && c.state !== "closed") void c.close().catch(() => {});
      if (ticket !== generation.current || !mounted.current) return;
      silence();
      setEnabled(false);
      setError("Sound is unavailable in this browser.");
    }
  }, [play, silence]);
  useEffect(() => {
    mounted.current = true;
    const visibility = () => {
      if (document.hidden) {
        // Close rather than suspend: queued victory notes must not replay later.
        silence();
        setEnabled(false);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", visibility);
      silence();
    };
  }, [silence]);
  return { enabled, toggle, play, error };
}
