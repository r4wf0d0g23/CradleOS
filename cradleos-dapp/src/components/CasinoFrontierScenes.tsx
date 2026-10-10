import { type CSSProperties } from "react";
import { MotionCard } from "./CasinoTableCard";
import { ItemIcon } from "./GameIcon";
import { chipLabel } from "../lib/casinoPractice";
import {
  frontierView,
  pusherOutcome,
  BROKER_VALUES,
  type FrontierRound,
  type FrontierView,
  type FrontierGame,
  FRONTIER_NAMES,
} from "../lib/casinoFrontier";
import {
  initialTray,
  PUSHER_RADIUS,
  PUSHER_SECONDS,
  type PusherToken,
} from "../lib/casinoFrontierPusher";
import { racePosition } from "../lib/casinoFrontierMotion";
const base = import.meta.env.BASE_URL;
export const RUNNERS = ["Ash", "Vesper", "Rook", "Sable"];
const color = ["#ea9f63", "#91c9d2", "#c6c3ad", "#b5a0d6"];
const clamp = (x: number) => Math.min(1, Math.max(0, x));
export function FrontierTile({ game }: { game: FrontierGame }) {
  const icon =
    game === "frontier_remainder"
      ? 78423
      : game === "frontier_broker"
        ? 72244
        : game === "frontier_pusher"
          ? 84180
          : 82425;
  return (
    <div className={`frontier-new-tile ${game}`}>
      <div className="fn-orbit" />
      <ItemIcon typeId={icon} size={88} />
      <span>
        {game === "frontier_race"
          ? "04 / RUNNERS"
          : game === "frontier_wing"
            ? "05 / 02"
            : game === "frontier_holdem"
              ? "A / K"
              : game === "frontier_remainder"
                ? "01 / 02 / 03 / 04"
                : game === "frontier_broker"
                  ? "12 / SEALED CARGO"
                  : "25 / DROP"}
      </span>
      <b>{FRONTIER_NAMES[game]}</b>
    </div>
  );
}
export function RemainderScene({
  r,
  p,
  show,
  pick,
}: {
  r?: FrontierRound;
  p: number;
  show: boolean;
  pick: number;
}) {
  const count = r?.draw[0] ?? 72,
    remainder = count % 4 || 4,
    groups = (count - remainder) / 4;
  const consumed = show ? groups : Math.floor(clamp(p / 0.92) * groups),
    sweeping = clamp(p / 0.92) * groups - consumed;
  return (
    <div className="fn-sorter">
      <header>
        <ItemIcon typeId={78423} size={40} />
        <span>ORE SEPARATOR</span>
        <b>{show ? `${remainder} REMAIN` : "BATCH / 4"}</b>
      </header>
      <svg
        viewBox="0 0 520 320"
        role="img"
        aria-label={show ? `Remainder ${remainder}` : "Ore separation chamber"}
      >
        <defs>
          <linearGradient id="fn-ore" x2=".8" y2="1">
            <stop stopColor="#c7d1ca" />
            <stop offset=".3" stopColor="#71857d" />
            <stop offset="1" stopColor="#273b3a" />
          </linearGradient>
          <linearGradient id="fn-metal">
            <stop stopColor="#162127" />
            <stop offset=".5" stopColor="#3b4749" />
            <stop offset="1" stopColor="#10191b" />
          </linearGradient>
        </defs>
        <rect
          x="18"
          y="22"
          width="484"
          height="268"
          rx="22"
          fill="#080e11"
          stroke="#55615d"
        />
        <rect
          x="35"
          y="40"
          width="335"
          height="228"
          rx="7"
          fill="url(#fn-metal)"
        />
        <path d="M378 54h100v200H378" fill="#171c1d" stroke="#796e55" />
        {Array.from({ length: count }, (_, i) => {
          const gone = i < consumed * 4,
            active = i >= consumed * 4 && i < consumed * 4 + 4,
            dx = active ? sweeping * 115 : 0;
          return (
            <path
              key={i}
              d="M-5 -7L4 -8L9 -1L3 7L-6 4L-8 -2Z"
              fill="url(#fn-ore)"
              stroke="#9cad9a"
              strokeWidth=".6"
              opacity={gone ? 0 : active ? 1 - sweeping * 0.6 : 1}
              transform={`translate(${52 + (i % 12) * 25 + dx},${60 + Math.floor(i / 12) * 25}) rotate(${i * 71})`}
            />
          );
        })}
        <path
          d={`M${385 + sweeping * 40} 60v185`}
          stroke="#e29c65"
          strokeWidth="5"
          opacity={p > 0 && p < 1 ? 0.8 : 0.25}
        />
        <path
          d="M421 48v210"
          stroke="#3b4848"
          strokeWidth="24"
          strokeDasharray="5 4"
        />
        <text x="433" y="280" textAnchor="middle" fill="#aeb8ae" fontSize="13">
          {show ? groups : "—"} × 4
        </text>
        {[1, 2, 3, 4].map((n, i) => (
          <g key={n}>
            <circle
              cx={65 + i * 87}
              cy="295"
              r="17"
              fill={(show ? remainder : pick) === n ? "#d9874e" : "#242e30"}
            />
            <text
              x={65 + i * 87}
              y="300"
              textAnchor="middle"
              fill={(show ? remainder : pick) === n ? "#11191b" : "#bdc9c1"}
              fontSize="15"
            >
              {n}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
export function BrokerScene({
  r,
  v,
  previous,
  p,
  show,
  busy,
  act,
}: {
  r?: FrontierRound;
  v?: FrontierView;
  previous?: FrontierRound;
  p: number;
  show: boolean;
  busy: boolean;
  act: (kind: string, ...values: number[]) => void;
}) {
  const old = previous && frontierView(previous),
    opened = busy && p < 0.6 ? (old?.opened ?? []) : (v?.opened ?? []),
    own = v?.own ?? -1;
  return (
    <div className="fn-broker">
      <header>
        <span>DERELICT / CARGO BAY</span>
        <b>
          {v?.phase === "offer"
            ? "BROKER ONLINE"
            : v?.phase === "final"
              ? "FINAL CARGO"
              : "SEALED FREIGHT"}
        </b>
      </header>
      <div className="fn-cargo-grid">
        {Array.from({ length: 12 }, (_, i) => {
          const revealed = opened.includes(i) || (show && i === own),
            canPick = v?.phase === "pick",
            canOpen = v?.phase === "open" && i !== own && !opened.includes(i);
          return (
            <button
              key={i}
              type="button"
              className={`fn-cargo ${i === own ? "owned" : ""} ${revealed ? "opened" : ""}`}
              disabled={busy || !r || (!canPick && !canOpen)}
              onClick={() => act(canPick ? "pick" : "open", i)}
              aria-label={
                revealed
                  ? `Cargo ${i + 1}: ${chipLabel(Math.floor((r!.stake * r!.draw[i]) / 10000))} chips`
                  : `${i === own ? "Your cargo" : "Cargo"} ${i + 1}`
              }
            >
              <i className="fn-cargo-latch" />
              <span>{String(i + 1).padStart(2, "0")}</span>
              <ItemIcon typeId={72244} size={42} />
              <b>
                {revealed
                  ? chipLabel(Math.floor((r!.stake * r!.draw[i]) / 10000))
                  : i === own
                    ? "YOURS"
                    : "SEALED"}
              </b>
              <i className="fn-cargo-latch" />
            </button>
          );
        })}
      </div>
      <div className="fn-cargo-values" aria-label="Cargo multipliers">
        {BROKER_VALUES.map((value) => {
          const found = opened.some((i) => r!.draw[i] === value);
          return (
            <span key={value} className={found ? "found" : ""}>
              {value / 10000}×
            </span>
          );
        })}
      </div>
    </div>
  );
}
function CardRow({
  cards,
  hidden = false,
  p = 1,
  label,
}: {
  cards: number[];
  hidden?: boolean;
  p?: number;
  label: string;
}) {
  return (
    <div className="fn-card-row">
      {cards.map((c, i) => (
        <MotionCard
          key={i}
          value={c}
          hidden={hidden}
          progress={clamp(p * 1.6 - i * 0.12)}
          label={label}
        />
      ))}
    </div>
  );
}
export function HoldemScene({
  r,
  v,
  p,
  busy,
  show,
  previous,
}: {
  r?: FrontierRound;
  v?: FrontierView;
  p: number;
  busy: boolean;
  show: boolean;
  previous?: FrontierRound;
}) {
  const prev = previous ? frontierView(previous).boardCount : 0,
    count = v?.boardCount ?? 0;
  return (
    <div className="fn-poker">
      <header>
        <span>COMMAND / HOLD’EM</span>
        <b>
          {v?.phase === "done"
            ? show
              ? "SHOWDOWN"
              : "AWAITING REVEAL"
            : (v?.phase?.toUpperCase() ?? "READY")}
        </b>
      </header>
      <section>
        <small>DEALER</small>
        <CardRow
          cards={r?.draw.slice(2, 4) ?? [0, 0]}
          hidden={!show}
          p={busy ? p : 1}
          label="Dealer"
        />
      </section>
      <section className="fn-community">
        <small>COMMUNITY</small>
        <div className="fn-card-row">
          {Array.from({ length: 5 }, (_, i) => (
            <MotionCard
              key={i}
              value={r?.draw[4 + i] ?? 0}
              hidden={
                !r ||
                i >= (v?.phase === "done" ? (show ? 5 : prev) : count) ||
                (busy && i >= prev && p < 0.5)
              }
              progress={
                busy && i >= prev ? clamp((p - 0.15) * 1.8 - i * 0.06) : 1
              }
              label="Community"
            />
          ))}
        </div>
      </section>
      <section>
        <small>COMMANDER</small>
        <CardRow
          cards={r?.draw.slice(0, 2) ?? [0, 0]}
          hidden={!r}
          p={busy && !previous ? p : 1}
          label="Player"
        />
      </section>
    </div>
  );
}
export function WingScene({
  r,
  v,
  selected,
  setSelected,
  busy,
  show,
}: {
  r?: FrontierRound;
  v?: FrontierView;
  selected: number[];
  setSelected: (n: number[]) => void;
  busy: boolean;
  show: boolean;
}) {
  const picked = v?.phase === "done" ? v.escort : selected;
  const toggle = (i: number) => {
    if (busy || v?.phase !== "split") return;
    setSelected(
      picked.includes(i)
        ? picked.filter((n) => n !== i)
        : picked.length < 2
          ? [...picked, i]
          : [picked[1], i],
    );
  };
  const rows = (dealer: boolean) => {
    const cards = dealer ? r?.draw.slice(7) : r?.draw.slice(0, 7),
      low = dealer ? (v?.dealerEscort ?? []) : picked,
      hide = dealer && !show;
    return (
      <div className="fn-wing-formation">
        <section>
          <small>MAIN FLEET / 5</small>
          <CardRow
            cards={
              cards
                ? hide
                  ? cards.slice(0, 5)
                  : cards.filter((_, i) => !low.includes(i))
                : [0, 0, 0, 0, 0]
            }
            hidden={!cards || hide}
            label={dealer ? "Dealer main" : "Player main"}
          />
        </section>
        <section
          className="fn-escort"
          onDragOver={(e) => {
            if (
              !dealer &&
              !busy &&
              v?.phase === "split" &&
              e.dataTransfer.types.includes("application/x-cradle-escort")
            )
              e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const raw = e.dataTransfer.getData("application/x-cradle-escort");
            if (dealer || !/^[0-6]$/.test(raw)) return;
            const i = Number(raw);
            if (Number.isInteger(i) && i >= 0 && i < 7 && !picked.includes(i))
              toggle(i);
          }}
        >
          <small>ESCORT / 2</small>
          <CardRow
            cards={
              cards
                ? hide
                  ? cards.slice(5)
                  : low.map((i) => cards[i])
                : [0, 0]
            }
            hidden={!cards || hide}
            label={dealer ? "Dealer escort" : "Player escort"}
          />
          {!dealer && picked.length < 2 && (
            <span className="fn-empty-slot">Select {2 - picked.length}</span>
          )}
        </section>
      </div>
    );
  };
  return (
    <div className="fn-poker fn-wing">
      <header>
        <span>WING / COMMAND</span>
        <b>{show ? "ENGAGEMENT COMPLETE" : "FORMATION"}</b>
      </header>
      <div className="fn-wing-dealer">
        <small>OPPOSING WING</small>
        {rows(true)}
      </div>
      {v?.phase === "split" ? (
        <div className="fn-wing-selection">
          <small>YOUR SEVEN / SELECT TWO ESCORTS</small>
          <div>
            {r!.draw.slice(0, 7).map((c, i) => (
              <button
                key={i}
                type="button"
                className={selected.includes(i) ? "assigned" : ""}
                disabled={busy}
                aria-label={`Assign card ${i + 1} to ${selected.includes(i) ? "main" : "escort"}`}
                aria-pressed={selected.includes(i)}
                draggable={!busy}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData(
                    "application/x-cradle-escort",
                    String(i),
                  );
                }}
                onClick={() => toggle(i)}
              >
                <MotionCard value={c} label="Player" />
                <span>{selected.includes(i) ? "ESCORT" : "MAIN"}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {rows(false)}
    </div>
  );
}
export function RaceScene({
  r,
  p,
  show,
  running,
  pick,
}: {
  r?: FrontierRound;
  p: number;
  show: boolean;
  running: boolean;
  pick: number;
}) {
  const time = show ? 6.5 : running ? p * 6.5 : 0;
  return (
    <div className="fn-race">
      <header>
        <span>GATE RUNNER / LAI CLASS</span>
        <b>{time ? `${time.toFixed(1)} s` : "GRID READY"}</b>
      </header>
      <div className="fn-race-course">
        <div className="fn-finish">
          <img src={`${base}casino/craps-orbit/mini-gate.webp`} alt="" />
          <span>GATE</span>
        </div>
        {RUNNERS.map((name, i) => {
          const rank = r?.draw.slice(0, 4).indexOf(i) ?? i,
            pos = r ? racePosition(time, rank, r.draw[4 + i]) : 0,
            finish = pos >= 1;
          return (
            <div
              key={name}
              className={`fn-race-lane ${pick === i ? "selected" : ""}`}
              style={{ "--runner-color": color[i] } as CSSProperties}
            >
              <span>
                {String(i + 1).padStart(2, "0")} / {name}
              </span>
              <div className="fn-runner-track">
                <div
                  className="fn-runner"
                  data-runner={i}
                  data-distance={pos.toFixed(4)}
                  style={{
                    left: `${Math.min(1.3, pos) * 86}%`,
                    opacity: pos > 1.16 ? 0 : 1,
                  }}
                >
                  <i
                    style={{
                      width:
                        time && !finish
                          ? `${25 + Math.min(30, time * 7)}px`
                          : 0,
                    }}
                  />
                  <img
                    src={`${base}casino/lai-jump/lai-top.webp`}
                    alt={`${name} Lai`}
                  />
                </div>
              </div>
              <b>{finish ? `#${rank + 1}` : "—"}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export function PusherScene({
  r,
  p,
  running,
  show,
  tray,
  drop,
  setDrop,
  disabled,
}: {
  r?: FrontierRound;
  p: number;
  running: boolean;
  show: boolean;
  tray?: PusherToken[];
  drop: number;
  setDrop: (x: number) => void;
  disabled: boolean;
}) {
  const out = r && (running || show) ? pusherOutcome(r) : undefined,
    time = p * PUSHER_SECONDS;
  const frames = out?.frames,
    idx = frames ? Math.min(frames.length - 1, Math.floor(time * 30)) : 0,
    f = frames?.[idx],
    next = frames?.[Math.min(frames.length - 1, idx + 1)],
    alpha =
      f && next && next.t > f.t ? clamp((time - f.t) / (next.t - f.t)) : 0;
  const tokens = show
    ? (out?.tray ?? tray ?? initialTray())
    : running && f
      ? f.tokens.map((t) => {
          const n = next?.tokens.find((n) => n.id === t.id);
          return n
            ? {
                ...t,
                x: t.x + (n.x - t.x) * alpha,
                y: t.y + (n.y - t.y) * alpha,
              }
            : t;
        })
      : r && !r.collected
        ? r.pusher!.tray
        : (tray ?? initialTray());
  const motor = running && f ? f.motor + (next!.motor - f.motor) * alpha : 65;
  return (
    <div className="fn-pusher">
      <header>
        <span>SALVAGE / PUSHER</span>
        <b>
          {running ? `${f?.collected.length ?? 0} COLLECTED` : "25 / TOKEN"}
        </b>
      </header>
      <svg
        viewBox="0 0 400 460"
        role="img"
        aria-label="Salvage token tray"
        onPointerDown={(e) => {
          if (disabled) return;
          const matrix = e.currentTarget.getScreenCTM();
          if (!matrix) return;
          const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(
            matrix.inverse(),
          );
          setDrop(Math.round(Math.min(324, Math.max(36, point.x - 20))));
        }}
      >
        <defs>
          <radialGradient id="fn-token">
            <stop stopColor="#b6a684" />
            <stop offset=".62" stopColor="#706952" />
            <stop offset=".82" stopColor="#d2b67e" />
            <stop offset="1" stopColor="#494639" />
          </radialGradient>
          <linearGradient id="fn-ram" x2="0" y2="1">
            <stop stopColor="#202e32" />
            <stop offset=".5" stopColor="#526164" />
            <stop offset="1" stopColor="#162329" />
          </linearGradient>
          <pattern
            id="fn-floor"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 0h18v18"
              fill="none"
              stroke="#213036"
              strokeWidth=".6"
            />
          </pattern>
        </defs>
        <rect
          x="13"
          y="8"
          width="374"
          height="414"
          rx="18"
          fill="#0a141b"
          stroke="#637075"
          strokeWidth="5"
        />
        <rect x="20" y="12" width="360" height="388" fill="url(#fn-floor)" />
        <path d="M43 30v290M357 30v290" stroke="#647174" strokeWidth="9" />
        <g transform="translate(20 0)">
          <rect
            x="0"
            y={motor - 52}
            width="360"
            height="52"
            fill="url(#fn-ram)"
            stroke="#aaac91"
          />
          <path d={`M5 ${motor - 5}h350`} stroke="#dd9e58" strokeWidth="3" />
          <text
            x="180"
            y={motor - 23}
            textAnchor="middle"
            fill="#d4dad1"
            fontSize="12"
            letterSpacing="4"
          >
            CRADLE / RECOVERY
          </text>
          {tokens.map((t) => (
            <g
              key={t.id}
              transform={`translate(${t.x} ${t.y})`}
              data-token={t.id}
            >
              <ellipse
                cy="3"
                rx={PUSHER_RADIUS + 1}
                ry={PUSHER_RADIUS}
                fill="#0009"
              />
              <circle
                r={PUSHER_RADIUS}
                fill="url(#fn-token)"
                stroke="#181c16"
              />
              <circle r="9" fill="none" stroke="#262d27" strokeWidth=".8" />
              <text
                textAnchor="middle"
                y="3"
                fontSize="8"
                fill="#15251f"
                fontWeight="bold"
              >
                25
              </text>
            </g>
          ))}
          <path
            d={`M${drop} 10v25m-6-6 6 6 6-6`}
            stroke="#bce0da"
            strokeWidth="2"
            fill="none"
          />
        </g>
        <path d="M56 390h288" stroke="#e8ad66" strokeWidth="4" />
        <rect
          x="57"
          y="414"
          width="286"
          height="31"
          rx="4"
          fill="#1a2927"
          stroke="#8f9776"
        />
        <text
          x="200"
          y="434"
          textAnchor="middle"
          fill="#c9d1b8"
          fontSize="12"
          letterSpacing="3"
        >
          COLLECTION
        </text>
        <text x="30" y="438" fill="#937c6e" fontSize="10">
          LOSS
        </text>
        <text x="351" y="438" fill="#937c6e" fontSize="10">
          LOSS
        </text>
      </svg>
    </div>
  );
}
