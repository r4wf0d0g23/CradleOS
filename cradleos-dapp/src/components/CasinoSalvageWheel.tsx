import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { MONEY_TABLE } from "../lib/casinoExpanded";
import type { Round } from "../lib/casinoPractice";
import type { TableRun } from "../lib/casinoTableMotion";
import {
  salvageMotion,
  salvageTravel,
  salvagePocket,
  salvagePointer,
  SALVAGE_STEP,
  SALVAGE_PULL_PX,
} from "../lib/casinoSalvageWheel";
import { useTableCues } from "./useCasinoTimeline";
import "../styles/casino-salvage-wheel.css";
const PAYOUTS = [0, 11000, 12000, 16000, 180000];
const COLORS = ["#253233", "#77887b", "#a79d76", "#b47946", "#df9a56"];
const point = (radius: number, angle: number) => [
  180 + radius * Math.cos((angle * Math.PI) / 180),
  180 + radius * Math.sin((angle * Math.PI) / 180),
];
const sector = (i: number) => {
  const a = i * SALVAGE_STEP - 90 - SALVAGE_STEP / 2,
    b = a + SALVAGE_STEP;
  return `M${point(143, a)}A143 143 0 0 1 ${point(143, b)}L${point(102, b)}A102 102 0 0 0 ${point(102, a)}Z`;
};
export function CasinoSalvageWheel({
  round,
  t,
  animated,
  run,
  busy,
  onSpin,
  stake,
}: {
  round: Round | null;
  t: number;
  animated: boolean;
  run: TableRun;
  busy: boolean;
  onSpin?: () => void;
  stake?: string;
}) {
  const id = useId().replace(/:/g, ""),
    has = !!round,
    done = has && t === 1,
    previous = run.previous?.history[0],
    index = round?.values[0] ?? 0,
    previousIndex = previous?.game === "money_wheel" ? previous.values[0] : 0;
  const motion = useMemo(
    () => salvageMotion(index, previousIndex),
    [index, previousIndex],
  );
  const angle = has ? motion.start + motion.travel * salvageTravel(t) : 0,
    pocket = salvagePocket(angle),
    duration = Math.max(1, run.duration - 100);
  const cues = useMemo(
    () =>
      motion.contacts.map((c) => ({
        at: c * duration,
        cue: "salvage_tick" as const,
      })),
    [motion, duration],
  );
  useTableCues(run, t, animated, cues);
  const [inspect, setInspect] = useState<number | null>(null),
    [pull, setPull] = useState(0);
  const gesture = useRef<{
      id: number;
      x: number;
      y: number;
      distance: number;
      max: number;
    } | null>(null),
    suppressClick = useRef(false);
  const locked = busy || !onSpin;
  useEffect(() => {
    if (busy) {
      setInspect(null);
      setPull(0);
      gesture.current = null;
    }
  }, [busy]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        gesture.current = null;
        suppressClick.current = true;
        setPull(0);
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      gesture.current = null;
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  const cancel = () => {
    gesture.current = null;
    suppressClick.current = true;
    setPull(0);
  };
  function down(e: PointerEvent<HTMLButtonElement>) {
    if (locked || e.button !== 0 || !e.isPrimary) return;
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      distance: 0,
      max: 0,
    };
    suppressClick.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    g.distance = e.clientY - g.y;
    g.max = Math.max(g.max, Math.hypot(e.clientX - g.x, g.distance));
    setPull(Math.max(0, Math.min(1, g.distance / SALVAGE_PULL_PX)));
  }
  function up(e: PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    g.distance = e.clientY - g.y;
    g.max = Math.max(g.max, Math.hypot(e.clientX - g.x, g.distance));
    gesture.current = null;
    setPull(0);
    suppressClick.current = g.max > 6;
    if (!locked && g.distance >= SALVAGE_PULL_PX) {
      suppressClick.current = true;
      onSpin?.();
    }
    // Release's ensuing lostcapture is intentionally a no-op, not a second activation.
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  const flex = animated ? salvagePointer(t, duration, motion.contacts) : 0,
    inspecting = !busy && inspect !== null,
    value = inspecting
      ? inspect!
      : has
        ? MONEY_TABLE[done ? index : pocket]
        : null;
  return (
    <div
      className="casino-orbit-stage table-wheel salvage-wheel-stage"
      data-progress={t}
      data-landed={done ? index : undefined}
    >
      <div className="salvage-faceplate">
        <svg
          viewBox="0 0 360 440"
          role="img"
          aria-label={`Salvage wheel${done ? `: ${round!.label}` : busy ? ": spinning" : ""}`}
        >
          <defs>
            <linearGradient id={`${id}-metal`} x1="0" y1="0" x2=".8" y2="1">
              <stop stopColor="#a3aba1" />
              <stop offset=".18" stopColor="#34423f" />
              <stop offset=".52" stopColor="#151f22" />
              <stop offset=".77" stopColor="#687570" />
              <stop offset="1" stopColor="#1c2829" />
            </linearGradient>
            <radialGradient id={`${id}-plate`} cx="36%" cy="24%">
              <stop stopColor="#68756c" />
              <stop offset=".4" stopColor="#32403d" />
              <stop offset="1" stopColor="#172224" />
            </radialGradient>
            <pattern
              id={`${id}-wear`}
              width="51"
              height="43"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M4 6l12-2m21 18 8-1M7 39l20-3"
                stroke="#d9dec2"
                strokeOpacity=".1"
                strokeWidth=".6"
              />
            </pattern>
          </defs>
          <path
            d="M52 268L25 388h310l-28-120-26 54H80Z"
            fill={`url(#${id}-metal)`}
            stroke="#0c1416"
            strokeWidth="4"
          />
          <path d="M45 382h270" stroke="#7c8271" strokeWidth="5" />
          <circle cx="180" cy="189" r="161" fill="#060c0e" />
          <circle
            cx="180"
            cy="180"
            r="161"
            fill={`url(#${id}-metal)`}
            stroke="#728379"
            strokeWidth="2"
          />
          <circle
            cx="180"
            cy="180"
            r="152"
            fill="#080f11"
            stroke="#121b1c"
            strokeWidth="4"
          />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const [x, y] = point(156, a);
            return (
              <g key={a} transform={`translate(${x} ${y}) rotate(${a})`}>
                <circle r="3" fill="#9b9e85" stroke="#141e20" />
                <path d="M-1.6 0h3.2" stroke="#233333" />
              </g>
            );
          })}
          <g
            className="wheel-rotor salvage-rotor"
            transform={`rotate(${angle} 180 180)`}
          >
            <circle
              cx="180"
              cy="180"
              r="148"
              fill={`url(#${id}-plate)`}
              stroke="#58665c"
              strokeWidth="3"
            />
            {MONEY_TABLE.map((bps, i) => {
              const [x, y] = point(128, i * SALVAGE_STEP - 90);
              const pin = point(148, (i + 0.5) * SALVAGE_STEP - 90);
              return (
                <g
                  key={i}
                  className="salvage-sector"
                  data-sector={i}
                  data-payout={bps}
                >
                  <path
                    d={sector(i)}
                    fill={COLORS[PAYOUTS.indexOf(bps)]}
                    stroke="#0e181a"
                    strokeWidth="1.1"
                    opacity={inspecting && bps !== inspect ? 0.3 : 1}
                  />
                  {(inspecting ? bps === inspect : done && i === index) && (
                    <path
                      className="salvage-sector-highlight"
                      d={sector(i)}
                      fill="none"
                      stroke="#ead2a0"
                      strokeWidth="1.4"
                    />
                  )}
                  <text
                    x={x}
                    y={y + 2.4}
                    transform={`rotate(${i * SALVAGE_STEP} ${x} ${y})`}
                    textAnchor="middle"
                    fill={bps === 0 ? "#b2c0b4" : "#101b1d"}
                    fontSize="6.2"
                    fontWeight="700"
                  >
                    {bps / 10000}
                  </text>
                  <circle
                    className="salvage-peg"
                    cx={pin[0]}
                    cy={pin[1]}
                    r="2.2"
                    fill="#bdbea4"
                    stroke="#1b2827"
                    strokeWidth=".8"
                  />
                </g>
              );
            })}
            {Array.from({ length: 8 }, (_, i) => (
              <g key={i} transform={`rotate(${i * 45} 180 180)`}>
                <path
                  d="M172 85h16l13 42-21 21-21-21Z"
                  fill={`url(#${id}-metal)`}
                  stroke="#101b1d"
                  strokeWidth="2"
                />
                <path d="M175 88h10" stroke="#b2baa650" />
              </g>
            ))}
            <circle
              cx="180"
              cy="180"
              r="143"
              fill={`url(#${id}-wear)`}
              pointerEvents="none"
            />
            <circle
              cx="180"
              cy="180"
              r="99"
              fill="none"
              stroke="#909b7b"
              strokeWidth="3"
            />
          </g>
          <g
            className="salvage-drive-gear"
            transform={`rotate(${-angle * 6} 180 353)`}
          >
            {Array.from({ length: 9 }, (_, i) => (
              <path
                key={i}
                d="M177 328h6v7h-6Z"
                fill="#809083"
                stroke="#121d20"
                transform={`rotate(${i * 40} 180 353)`}
              />
            ))}
            <circle
              cx="180"
              cy="353"
              r="19"
              fill={`url(#${id}-metal)`}
              stroke="#101b1d"
              strokeWidth="3"
            />
            <circle cx="180" cy="353" r="7" fill="#0d1719" stroke="#a0a791" />
          </g>
          <path
            d="M148 338h64v33h-64Z"
            fill="#142021"
            fillOpacity=".36"
            stroke="#7d8b7244"
          />
          <circle
            cx="180"
            cy="180"
            r="60"
            fill={`url(#${id}-metal)`}
            stroke="#afaf8d"
            strokeWidth="2"
          />
          <circle
            cx="180"
            cy="180"
            r="51"
            fill="#101b1d"
            stroke="#47564b"
            strokeWidth="3"
          />
          <g className="salvage-pointer" transform={`rotate(${flex} 180 9)`}>
            <path
              d="M173 8h14l-3 26-4 5-4-5Z"
              fill="#d2b982"
              stroke="#182523"
              strokeWidth="1.5"
            />
            <path d="M180 15v16" stroke="#f3e2b0" strokeWidth="1" />
          </g>
          <rect
            x="168"
            y="1"
            width="24"
            height="14"
            rx="4"
            fill={`url(#${id}-metal)`}
            stroke="#94a38d"
          />
          <circle cx="180" cy="8" r="3" fill="#a1a68b" stroke="#182523" />
          <path d="M300 339v67" stroke="#080f11" strokeWidth="16" />
          <path d="M302 342v60" stroke="#8c937644" strokeWidth="3" />
          <text x="55" y="376" fill="#a7b09b" fontSize="8" letterSpacing="2">
            CRDL / WINCH
          </text>
        </svg>
        <button
          type="button"
          className="salvage-hub"
          disabled={locked}
          onClick={() => onSpin?.()}
          aria-label="Spin Salvage Wheel"
        >
          <span>{busy ? "SPINNING" : "SPIN"}</span>
          {stake && <small>{stake} chips</small>}
        </button>
        <button
          type="button"
          className="salvage-lever"
          disabled={locked}
          aria-label="Pull Salvage Wheel handle"
          style={{
            transform: `translateY(calc(${pull} * var(--lever-travel)))`,
          }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={cancel}
          onLostPointerCapture={() => {
            if (gesture.current) cancel();
          }}
          onClick={(e) => {
            if (!locked && (e.detail === 0 || !suppressClick.current))
              onSpin?.();
          }}
        >
          <span>PULL</span>
        </button>
      </div>
      <div className="salvage-readout">
        <span>
          {inspecting
            ? "SECTORS"
            : done
              ? "RECOVERED"
              : busy
                ? "PASSING"
                : "READY"}
        </span>
        <b>{value === null ? "—" : `${value / 10000}×`}</b>
        <small>
          {inspecting
            ? `${MONEY_TABLE.filter((n) => n === inspect).length} / 54`
            : done
              ? `${index + 1} / 54`
              : "54 SECTORS"}
        </small>
      </div>
      <div
        className="salvage-inspector"
        role="group"
        aria-label="Inspect payout sectors"
      >
        {PAYOUTS.map((bps, i) => (
          <button
            type="button"
            key={bps}
            disabled={busy}
            aria-label={`Inspect ${bps / 10000}× sectors`}
            aria-pressed={inspect === bps}
            onClick={() => setInspect(inspect === bps ? null : bps)}
            style={{ "--sector-color": COLORS[i] } as React.CSSProperties}
          >
            {bps / 10000}×
          </button>
        ))}
      </div>
    </div>
  );
}
