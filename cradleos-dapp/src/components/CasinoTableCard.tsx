import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ItemIcon } from "./GameIcon";
import { clamp } from "../lib/casinoTableMotion";
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
const HIGH = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUITS = ["♠", "♥", "♣", "♦"],
  SUIT_NAMES = ["Spades", "Hearts", "Clubs", "Diamonds"];
export function TableShoe() {
  return (
    <div className="table-shoe" aria-hidden="true">
      <i />
      <i />
      <i />
      <b>◇</b>
    </div>
  );
}
export function MotionCard({
  value,
  progress = 1,
  hidden = false,
  rankOnly = false,
  aceFirst = false,
  label = "",
  winner = false,
  fly = false,
  index = 0,
  runId = 0,
}: {
  value: number;
  progress?: number;
  hidden?: boolean;
  rankOnly?: boolean;
  aceFirst?: boolean;
  label?: string;
  winner?: boolean;
  fly?: boolean;
  index?: number;
  runId?: number;
}) {
  const slot = useRef<HTMLDivElement>(null),
    [origin, setOrigin] = useState({ x: 75, y: -100 });
  useLayoutEffect(() => {
    const el = slot.current,
      table = el?.closest(".casino-card-stage,.andar-table"),
      shoe = table?.querySelector(".table-shoe");
    if (!el || !table || !shoe || !fly) return;
    const measure = () => {
      const a = el.getBoundingClientRect(),
        b = shoe.getBoundingClientRect();
      setOrigin({
        x: b.left + b.width / 2 - a.left - a.width / 2,
        y: b.top + b.height / 2 - a.top - a.height / 2,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(table);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [fly, runId]);
  const p = clamp(progress),
    shown = !hidden && p >= 0.5,
    rank = rankOnly && !aceFirst ? HIGH[value] : RANKS[value % 13],
    suit = rankOnly ? 0 : Math.floor(value / 13),
    remaining = (1 - p) ** 3,
    lift = Math.sin(p * Math.PI),
    fan = (index - 1) * 5;
  const transform = fly
    ? `translate3d(${origin.x * remaining}px,${origin.y * remaining - lift * 15}px,${lift * 25}px) rotateZ(${remaining * -14 + (1 - remaining) * fan}deg) rotateY(${p < 0.5 ? p * 180 : (1 - p) * -180}deg)`
    : `rotateY(${p < 0.5 ? p * 180 : (1 - p) * -180}deg)`;
  return (
    <div
      ref={slot}
      className="table-card-slot"
      style={{ "--card-lift": `${3 + lift * 18}px` } as CSSProperties}
    >
      <div
        className={`casino-dealt-card motion-card ${shown ? "revealed" : "covered"} ${winner && p === 1 ? "card-winner" : ""}`}
        role="img"
        data-value={shown ? value : undefined}
        data-suit={shown && !rankOnly ? suit : undefined}
        data-card-progress={p}
        aria-label={
          shown
            ? `${label || "Card"}: ${rank}${rankOnly ? "" : ` of ${SUIT_NAMES[suit]}`}`
            : "Unrevealed card"
        }
        style={{ transform, opacity: p === 0 && fly ? 0 : 1 }}
      >
        {shown ? (
          <>
            <b className="table-card-rank">
              {rank}
              {!rankOnly && <em>{SUITS[suit]}</em>}
            </b>
            <ItemIcon typeId={[82425, 87848, 81611, 84955][suit]} size={46} />
            <b className="table-card-rank table-card-bottom">
              {rank}
              {!rankOnly && <em>{SUITS[suit]}</em>}
            </b>
            {label && <small>{label}</small>}
          </>
        ) : (
          <>
            <span className="table-card-seal">◇</span>
            <small>CRADLE</small>
          </>
        )}
      </div>
    </div>
  );
}
