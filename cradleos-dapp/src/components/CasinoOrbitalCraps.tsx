import { useEffect, useRef, useState, type ReactNode } from "react";
import "../styles/casino-orbital-craps.css";

const DRIFT_KEY = "cradleos:casino:orbital-craps:drift:v1";
const ART = `${import.meta.env.BASE_URL}casino/`;
const STARS = Array.from({ length: 95 }, (_, i) => ({
  x: (i * 137.508 + 31) % 1000,
  y: (i * i * 29.41 + 47) % 1000,
  r: i % 11 === 0 ? 1.4 : 0.65,
  opacity: 0.2 + (i % 5) * 0.12,
}));

/** Cosmetic only. Owns no bets, outcomes, clocks or game-session data. */
export function CasinoOrbitalCraps({
  children,
  reduced,
  busy,
}: {
  children: ReactNode;
  reduced: boolean;
  busy: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Set<number>());
  const [holding, setHolding] = useState(false);
  const [drift, setDrift] = useState(() => {
    try {
      return sessionStorage.getItem(DRIFT_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const clear = () => {
      pointers.current.clear();
      setHolding(false);
    };
    const release = (event: PointerEvent) => {
      pointers.current.delete(event.pointerId);
      setHolding(pointers.current.size > 0);
    };
    const change = () => {
      setVisible(!document.hidden);
      if (document.hidden) clear();
    };
    document.addEventListener("visibilitychange", change);
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", release);
    window.addEventListener("blur", clear);
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
        : null;
    if (root.current) observer?.observe(root.current);
    return () => {
      document.removeEventListener("visibilitychange", change);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", clear);
      observer?.disconnect();
    };
  }, []);
  const toggle = () => {
    const next = !drift;
    setDrift(next);
    try {
      sessionStorage.setItem(DRIFT_KEY, next ? "on" : "off");
    } catch {
      /* Cosmetic persistence failure never affects play. */
    }
  };
  return (
    <div
      ref={root}
      className="orbital-craps"
      onPointerDownCapture={(event) => {
        if ((event.target as Element).closest(".craps-table")) {
          pointers.current.add(event.pointerId);
          setHolding(true);
        }
      }}
      data-holding={holding}
      data-drift={drift && !reduced && visible && inView ? "on" : "off"}
      data-rolling={busy}
    >
      <div className="craps-orbit-space" aria-hidden="true">
        <div className="craps-orbit-haze" />
        <svg
          className="craps-orbit-stars"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMin slice"
        >
          {STARS.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              opacity={s.opacity}
              fill="#d5e3dd"
            />
          ))}
        </svg>
        <div className="craps-orbit-world" />
        <img
          className="craps-orbit-gate"
          src={`${ART}craps-orbit/mini-gate.webp`}
          alt=""
          decoding="async"
        />
        <img
          className="craps-orbit-lai"
          src={`${ART}lai-jump/lai-hull.webp`}
          alt=""
          decoding="async"
        />
        <div className="craps-orbit-orbit" />
      </div>
      <div className="craps-orbit-toolbar">
        <span>CRDL / ORBITAL DECK</span>
        <button
          type="button"
          className="craps-orbit-drift"
          onClick={toggle}
          disabled={reduced}
          aria-label="Table drift"
          aria-pressed={drift && !reduced}
        >
          <span aria-hidden="true">{drift && !reduced ? "Ⅱ" : "▷"}</span>
          Drift {drift && !reduced ? "on" : "off"}
        </button>
      </div>
      {children}
    </div>
  );
}
