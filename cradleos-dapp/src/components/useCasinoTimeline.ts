import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { CasinoFeedback, type CasinoCue } from "../lib/casinoFeedback";
import { clamp, type TableRun } from "../lib/casinoTableMotion";
/** One clock supplied by the action owner; cancellation is sticky for that generation. */
export function useCasinoTimeline(
  run: TableRun,
  busy: boolean,
  reduced: boolean,
  overrideSystemReduction = false,
) {
  const cancelled = useRef(-1),
    [frame, setFrame] = useState({ id: -1, t: 1 });
  useLayoutEffect(() => {
    if (!busy || !run.id) return;
    let raf = 0,
      alive = true;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const snap = () => {
      cancelled.current = run.id;
      cancelAnimationFrame(raf);
      if (alive) setFrame({ id: run.id, t: 1 });
    };
    const preference = () => {
        if (media.matches && !overrideSystemReduction) snap();
      },
      visibility = () => {
        if (document.hidden) snap();
      };
    const tick = (now: number) => {
      if (!alive || cancelled.current === run.id) return;
      const t = clamp((now - run.started) / Math.max(1, run.duration - 100));
      setFrame({ id: run.id, t });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    media.addEventListener("change", preference);
    document.addEventListener("visibilitychange", visibility);
    if (
      reduced ||
      (media.matches && !overrideSystemReduction) ||
      document.hidden ||
      cancelled.current === run.id
    )
      snap();
    else {
      tick(performance.now());
    }
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      media.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [run, busy, reduced, overrideSystemReduction]);
  const snapped = reduced || cancelled.current === run.id;
  return {
    t: !busy || snapped ? 1 : frame.id === run.id ? frame.t : 0,
    animated: busy && !snapped && !!run.id,
  };
}
export type MotionCue = { at: number; cue: CasinoCue };
export function useTableCues(
  run: TableRun,
  t: number,
  animated: boolean,
  cues: MotionCue[],
) {
  const play = useContext(CasinoFeedback),
    cursor = useRef({ id: -1, at: 0 });
  useEffect(() => {
    if (cursor.current.id !== run.id)
      cursor.current = {
        id: run.id,
        at: Math.max(0, performance.now() - run.started - 80),
      };
    const elapsed = t * Math.max(1, run.duration - 100),
      before = cursor.current.at;
    cursor.current.at = Math.max(before, elapsed);
    if (
      !animated ||
      document.hidden ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    // A late/background frame never replays a burst of missed impacts.
    const events = cues.filter(
      (c) => c.at > before && c.at <= elapsed && elapsed - c.at < 110,
    );
    events.slice(-1).forEach((c) => play(c.cue));
  }, [run, t, animated, cues, play]);
}
