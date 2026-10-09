import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ItemIcon } from "./GameIcon";
import { clamp } from "../lib/casinoTableMotion";
import { cardTotal } from "../lib/casinoPractice";
import "../styles/casino-astral-blackjack.css";

const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
const SUITS = ["Frigates", "Raiders", "Freighters", "Gates"];
const GLYPHS = ["◇", "✦", "◉", "▣"];
// Deterministic scenery, unrelated to the shoe or game RNG.
const STARS = Array.from({ length: 52 }, (_, i) => ({
  x: (i * 73 + 17) % 997,
  y: (i * i * 37 + 41) % 587,
  r: i % 9 === 0 ? 1.7 : 0.7,
  opacity: 0.22 + (i % 5) * 0.13,
}));

export function AstralTable({
  children,
  reduced = false,
  dealing = false,
  progress = 1,
}: {
  children: ReactNode;
  reduced?: boolean;
  dealing?: boolean;
  progress?: number;
}) {
  const [drift, setDrift] = useState(() => {
    try {
      return (
        sessionStorage.getItem("cradleos:casino:astral-drift:v1") !== "off"
      );
    } catch {
      return true;
    }
  });
  const [systemReduced, setSystemReduced] = useState(
    () =>
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setSystemReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const motionReduced = reduced || systemReduced;
  const toggleDrift = () =>
    setDrift((previous) => {
      const next = !previous;
      try {
        sessionStorage.setItem(
          "cradleos:casino:astral-drift:v1",
          next ? "on" : "off",
        );
      } catch {
        /* Cosmetic preference must not block play. */
      }
      return next;
    });
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  return (
    <div
      className="astral-table animated-blackjack"
      data-progress={progress}
      data-drift={drift && !motionReduced && visible ? "on" : "off"}
      data-dealing={dealing}
    >
      <div className="astral-space" aria-hidden="true">
        <div className="astral-nebula" />
        <svg
          className="astral-stars"
          viewBox="0 0 1000 600"
          preserveAspectRatio="xMidYMid slice"
        >
          {STARS.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="currentColor"
              opacity={s.opacity}
            />
          ))}
          <path
            d="M110 90l66 34 54-63M752 468l58-41 86 51M831 96l-38 58 69 25"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".1"
          />
        </svg>
        <div className="astral-eclipse" />
        <div className="astral-orbit astral-orbit-one" />
        <div className="astral-orbit astral-orbit-two" />
      </div>
      <header className="astral-heading">
        <div>
          <span>CRADLE / DEEP FIELD</span>
          <strong>ASTRAL DECK</strong>
          <small>BLACKJACK · ZERO GRAVITY</small>
        </div>
        <button
          type="button"
          className="astral-drift-toggle"
          aria-pressed={drift && !motionReduced}
          disabled={motionReduced}
          onClick={toggleDrift}
        >
          {motionReduced ? "Reduced motion" : drift ? "Pause drift" : "Resume drift"}
        </button>
      </header>
      <div className="astral-shoe" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>ORBITAL SHOE</span>
      </div>
      <div className="astral-hands">{children}</div>
      <div className="astral-coordinates" aria-hidden="true">
        <span>STILLNESS / OUTER ORBIT</span>
        <span>∴</span>
      </div>
    </div>
  );
}

/** Presentation only. The parent clock owns the deal; faces never reveal before its halfway point. */
export function AstralCard({
  value,
  hidden = false,
  progress = 1,
  fly = false,
  index = 0,
  runId = 0,
}: {
  value: number;
  hidden?: boolean;
  progress?: number;
  fly?: boolean;
  index?: number;
  runId?: number;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState({ x: 0, y: -130 });
  useLayoutEffect(() => {
    if (!fly || !slot.current) return;
    const element = slot.current,
      table = element.closest(".astral-table"),
      shoe = table?.querySelector(".astral-shoe");
    if (!table || !shoe) return;
    const measure = () => {
      const a = element.getBoundingClientRect(),
        b = shoe.getBoundingClientRect();
      setOrigin({
        x: b.left + b.width / 2 - a.left - a.width / 2,
        y: b.top + b.height / 2 - a.top - a.height / 2,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(table);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [fly, runId]);
  const p = clamp(progress),
    shown = !hidden && p >= 0.5,
    rank = RANKS[value % 13],
    suit = Math.floor(value / 13);
  // Smooth deceleration with a small curved lateral arc; orientation settles without a bounce.
  const remaining = Math.pow(1 - p, 3),
    arc = Math.sin(Math.PI * p),
    side = index % 2 ? -1 : 1;
  const flight = fly
    ? `translate3d(${origin.x * remaining + side * arc * 24}px,${origin.y * remaining - arc * 32}px,${arc * 65}px) rotateZ(${side * remaining * 24}deg) scale(${0.55 + 0.45 * (1 - remaining)})`
    : "none";
  const flip = p < 0.5 ? p * 180 : (1 - p) * -180;
  return (
    <div
      ref={slot}
      className="astral-slot"
      data-value={shown ? value : undefined}
      data-card-progress={p}
      data-flying={fly && p > 0 && p < 1}
      role="img"
      aria-label={shown ? `${rank} · ${SUITS[suit]}` : "Unrevealed card"}
      style={
        {
          "--float-delay": `${index * -0.8}s`,
          "--float-time": `${5.5 + (index % 4) * 0.6}s`,
        } as CSSProperties
      }
    >
      <div
        className="astral-flight"
        style={{ transform: flight, opacity: fly && p === 0 ? 0 : 1 }}
        aria-hidden="true"
      >
        <div
          className="astral-wake"
          style={{
            opacity: fly ? Math.sin(Math.PI * p) * 0.8 : 0,
            transform: `scaleY(${0.3 + remaining * 1.8})`,
          }}
        />
        <div className="astral-hover">
          <div
            className={`astral-token ${shown ? "astral-face" : "astral-back"}`}
            style={{ transform: `rotateY(${flip}deg)` }}
          >
            {shown ? (
              <>
                <b className="astral-rank">
                  {rank}
                  <small>{GLYPHS[suit]}</small>
                </b>
                <div className="astral-emblem">
                  <ItemIcon
                    typeId={[82425, 87848, 81611, 84955][suit]}
                    size={56}
                  />
                </div>
                <span className="astral-suit">{SUITS[suit]}</span>
                <b className="astral-rank astral-rank-bottom">
                  {rank}
                  <small>{GLYPHS[suit]}</small>
                </b>
              </>
            ) : (
              <>
                <span className="astral-seal">
                  <i />
                  <b>∴</b>
                </span>
                <span className="astral-back-mark">CRADLE</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AstralHand({
  label,
  cards,
  hidden = false,
}: {
  label: string;
  cards: number[];
  hidden?: boolean;
}) {
  const visible = cards.filter((_, i) => !hidden || i !== 1);
  return (
    <div className="astral-hand">
      <div className="astral-hand-label">
        {label}
        <b>
          {cards.length ? cardTotal(visible) : "—"}
          {hidden && cards.length > 1 ? " + ?" : ""}
        </b>
      </div>
      <div className="astral-fan">
        {cards.map((value, i) => (
          <AstralCard
            key={`${value}-${i}`}
            value={value}
            hidden={hidden && i === 1}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
