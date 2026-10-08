import {
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { CasinoFeedback } from "../lib/casinoFeedback";
import {
  REEL_STOPS,
  CLEAR_MS,
  slotMotionPlan,
  reelStrip,
  reelTravelKeyframes,
  cascadePlacement,
  fallKeyframes,
  socketLanding,
  VAULT_SOCKET_MS,
  type SlotMotionRun,
} from "../lib/casinoSlotMotion";
import {
  WILD,
  SCATTER,
  COIN,
  type FleetKey,
  type SlotFrame,
} from "../lib/casinoSlotFleet";
import { SlotSymbolArt } from "./SlotIdentityArt";
import "../styles/casino-slot-motion.css";

/** Catch late layout work up to the SAME monotonic clock as the parent deadline. */
function animateAt(
  el: Element,
  frames: Keyframe[],
  duration: number,
  run: SlotMotionRun,
  delay = 0,
) {
  const animation = el.animate(frames, {
    duration,
    delay,
    fill: "both",
    easing: "linear",
  });
  animation.currentTime = Math.max(0, performance.now() - run.started);
  return animation;
}
export function useSlotMotion(
  game: FleetKey,
  frame: SlotFrame | undefined,
  previous: SlotFrame | undefined,
  busy: boolean,
  reduced: boolean,
  run: SlotMotionRun,
) {
  const cancelledRun = useRef(-1);
  const root = useRef<HTMLDivElement>(null),
    play = useContext(CasinoFeedback);
  const [state, setState] = useState({
    id: -1,
    stops: 0,
    sockets: 0,
    expanded: false,
    snapped: false,
    raw: false,
  });
  const plan = slotMotionPlan(game, frame, previous),
    current =
      state.id === run.id
        ? state
        : {
            id: run.id,
            stops: 0,
            sockets: 0,
            expanded: false,
            snapped: false,
            raw: false,
          };
  const active =
    busy && !reduced && !current.snapped && cancelledRun.current !== run.id;
  useLayoutEffect(() => {
    if (!busy) return;
    let alive = true,
      snapped = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    setState({
      id: run.id,
      stops: 0,
      sockets: 0,
      expanded: reduced || cancelledRun.current === run.id,
      snapped: reduced || cancelledRun.current === run.id,
      raw: reduced || cancelledRun.current === run.id,
    });
    if (reduced || cancelledRun.current === run.id) {
      cancelledRun.current = run.id;
      return () => {
        alive = false;
      };
    }
    const later = (at: number, fn: () => void) =>
      timers.push(
        setTimeout(
          () => {
            if (alive && !snapped) fn();
          },
          Math.max(0, run.started + at - performance.now()),
        ),
      );
    const snap = () => {
      if (!alive || snapped) return;
      snapped = true;
      cancelledRun.current = run.id;
      timers.forEach(clearTimeout);
      setState({
        id: run.id,
        stops: 31,
        sockets: 32767,
        expanded: true,
        snapped: true,
        raw: true,
      });
    };
    if (document.hidden) {
      snap();
      return () => {
        alive = false;
      };
    }
    if (plan.kind === "reels")
      REEL_STOPS.forEach((at, c) =>
        later(at + 20, () => {
          setState((s) =>
            s.id === run.id ? { ...s, stops: s.stops | (1 << c) } : s,
          );
          if (performance.now() - run.started < at + 160) play("stop", game);
        }),
      );
    else if (plan.kind === "hold") {
      for (let c = 0; c < 5; c++) {
        let lastStop = 0;
        for (let r = 0; r < 3; r++) {
          if (previous?.grid[c]?.[r] === COIN) continue;
          const at = socketLanding(c, r);
          lastStop = at + VAULT_SOCKET_MS;
          later(at, () =>
            setState((s) =>
              s.id === run.id
                ? { ...s, sockets: s.sockets | (1 << (c * 3 + r)) }
                : s,
            ),
          );
        }
        if (lastStop)
          later(lastStop, () => {
            if (performance.now() - run.started < lastStop + 160)
              play("stop", game);
          });
      }
    } else
      later(plan.rawStop, () => {
        if (performance.now() - run.started < plan.rawStop + 160)
          play(
            plan.kind === "cascade"
              ? "stop"
              : plan.kind === "collect"
                ? "coin"
                : "stop",
            game,
          );
      });
    later(plan.rawStop + 22, () =>
      setState((s) => (s.id === run.id ? { ...s, raw: true } : s)),
    );
    later(plan.expand, () =>
      setState((s) => (s.id === run.id ? { ...s, expanded: true } : s)),
    );
    const visibility = () => {
      if (document.hidden) snap();
    };
    document.addEventListener("visibilitychange", visibility);
    const grid = root.current?.querySelector(".fleet-grid");
    const initial = grid?.getBoundingClientRect();
    const observer =
      grid && initial
        ? new ResizeObserver((entries) => {
            const box = entries[0]?.target.getBoundingClientRect();
            if (
              box &&
              (Math.abs(box.width - initial.width) > 1 ||
                Math.abs(box.height - initial.height) > 1)
            )
              snap();
          })
        : null;
    if (grid) observer?.observe(grid);
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [
    busy,
    reduced,
    run.id,
    run.started,
    game,
    plan.kind,
    plan.rawStop,
    plan.expand,
    previous,
    play,
  ]);
  return {
    root,
    plan,
    active,
    rawStopped: !busy || reduced || current.snapped || current.raw,
    expanded: !busy || reduced || current.snapped || current.expanded,
    stopped: (column: number) => !active || !!(current.stops & (1 << column)),
    socketOpen: (column: number, row: number) =>
      !active || !!(current.sockets & (1 << (column * 3 + row))),
  };
}
function MotionSymbol({ game, n }: { game: FleetKey; n: number }) {
  return (
    <div
      className={`slot-motion-symbol ${n === WILD ? "fleet-wild" : n === SCATTER ? "fleet-scatter" : ""}`}
      data-motion-symbol={n}
    >
      <div className="slot-symbol-face">
        <SlotSymbolArt
          game={game}
          symbol={n}
          size={n === WILD || n === SCATTER ? 52 : 64}
          eager
        />
        {n === WILD ? <b>WILD</b> : n === SCATTER ? <b>SCATTER</b> : null}
      </div>
    </div>
  );
}
/** Five masked compositor strips; final window is exactly the saved ORIGINAL board. */
export function MotionReel({
  game,
  final,
  before,
  column,
  run,
  socket = false,
}: {
  game: FleetKey;
  final: number[];
  before?: number[];
  column: number;
  run: SlotMotionRun;
  socket?: boolean;
}) {
  const windowRef = useRef<HTMLDivElement>(null),
    stripRef = useRef<HTMLDivElement>(null);
  const symbols = reelStrip(final, column, before);
  useLayoutEffect(() => {
    const win = windowRef.current,
      strip = stripRef.current,
      parent = win?.parentElement;
    if (!win || !strip || !parent) return;
    const cells = socket
      ? [parent]
      : (Array.from(parent.children).filter((e) =>
          e.classList.contains("fleet-cell"),
        ) as HTMLElement[]);
    const first = cells[0],
      last = cells[cells.length - 1];
    if (!first || !last) return;
    const firstBox = first.getBoundingClientRect(),
      lastBox = last.getBoundingClientRect(),
      parentBox = parent.getBoundingClientRect();
    const h = firstBox.height,
      gap = socket ? 0 : parseFloat(getComputedStyle(parent).rowGap) || 0;
    Object.assign(win.style, {
      top: `${socket ? 0 : firstBox.top - parentBox.top - parent.clientTop}px`,
      left: `${socket ? 0 : firstBox.left - parentBox.left - parent.clientLeft}px`,
      width: `${firstBox.width}px`,
      height: `${socket ? h : lastBox.bottom - firstBox.top}px`,
    });
    strip.style.setProperty("--motion-cell-height", `${h}px`);
    strip.style.gap = `${gap}px`;
    const distance = (symbols.length - final.length) * (h + gap);
    const a = animateAt(
      strip,
      reelTravelKeyframes(distance),
      REEL_STOPS[column],
      run,
    );
    return () => a.cancel();
  }, [run.id, run.started, column, socket, symbols.length, final.length]);
  return (
    <div
      ref={windowRef}
      className={`slot-reel-window ${socket ? "slot-socket-window" : ""}`}
      aria-hidden="true"
    >
      <div ref={stripRef} className="slot-reel-strip">
        {symbols.map((n, i) => (
          <MotionSymbol key={i} game={game} n={n} />
        ))}
      </div>
      <i className="slot-reel-shade" />
    </div>
  );
}
/** New cells enter from above; survivors retain their exact prior row position until clearance. */
export function MotionFall({
  previous,
  column,
  row,
  run,
}: {
  previous: SlotFrame;
  column: number;
  row: number;
  run: SlotMotionRun;
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const cell = ref.current?.parentElement,
      col = cell?.parentElement;
    if (!cell || !col) return;
    const p = cascadePlacement(previous, column, row);
    if (p.distance === 0) return;
    const stride =
      cell.getBoundingClientRect().height +
      (parseFloat(getComputedStyle(col).rowGap) || 0);
    const a = animateAt(
      cell,
      fallKeyframes(p.distance * stride),
      p.duration,
      run,
      p.delay,
    );
    cell.dataset.motionSource = String(p.source);
    cell.dataset.motionDistance = String(p.distance);
    return () => {
      a.cancel();
      delete cell.dataset.motionSource;
      delete cell.dataset.motionDistance;
    };
  }, [previous, column, row, run.id, run.started]);
  return <i ref={ref} className="motion-marker" aria-hidden="true" />;
}
export function CascadeGhosts({
  game,
  previous,
  run,
}: {
  game: FleetKey;
  previous: SlotFrame;
  run: SlotMotionRun;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const wins = [...new Set(previous.wins.flatMap((w) => w.cells))];
  useLayoutEffect(() => {
    const layer = ref.current,
      grid = layer?.parentElement;
    if (!layer || !grid) return;
    const anims: Animation[] = [];
    for (const ghost of Array.from(layer.children) as HTMLElement[]) {
      const id = Number(ghost.dataset.ghost),
        c = Math.floor(id / 5);
      const col = grid.children[c] as HTMLElement,
        cell = col?.querySelector(`[data-cell="${id}"]`) as HTMLElement | null;
      if (!col || !cell) continue;
      const box = cell.getBoundingClientRect(),
        origin = grid.getBoundingClientRect();
      const transform = new DOMMatrixReadOnly(getComputedStyle(cell).transform);
      Object.assign(ghost.style, {
        left: `${box.left - transform.m41 - origin.left - grid.clientLeft}px`,
        top: `${box.top - transform.m42 - origin.top - grid.clientTop}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
      anims.push(
        animateAt(
          ghost,
          [
            { opacity: 1, transform: "scale(1)", offset: 0 },
            { opacity: 1, transform: "scale(1.035)", offset: 0.3 },
            { opacity: 0, transform: "scale(.65)", offset: 1 },
          ],
          CLEAR_MS,
          run,
        ),
      );
    }
    return () => anims.forEach((a) => a.cancel());
  }, [run.id, run.started, previous]);
  return (
    <div ref={ref} className="cascade-ghost-layer" aria-hidden="true">
      {wins.map((id) => (
        <div className="cascade-ghost" data-ghost={id} key={id}>
          <MotionSymbol
            game={game}
            n={previous.grid[Math.floor(id / 5)][id % 5]}
          />
        </div>
      ))}
    </div>
  );
}
export function MotionSocket({
  coin,
  column,
  row,
  run,
}: {
  coin: boolean;
  column: number;
  row: number;
  run: SlotMotionRun;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const shutter = ref.current;
    const face = shutter?.parentElement?.querySelector(".slot-symbol-face");
    const scan = shutter?.firstElementChild;
    if (!face || !shutter || !scan) return;
    const delay = socketLanding(column, row);
    const animations = [
      animateAt(
        face,
        [
          {
            opacity: 0,
            transform: "perspective(300px) rotateX(-85deg) scale(.82)",
            offset: 0,
          },
          {
            opacity: 0,
            transform: "perspective(300px) rotateX(-85deg) scale(.82)",
            offset: 0.35,
          },
          {
            opacity: 1,
            transform: "perspective(300px) rotateX(8deg) scale(1.035)",
            offset: 0.8,
          },
          {
            opacity: 1,
            transform: "perspective(300px) rotateX(0deg) scale(1)",
            offset: 1,
          },
        ],
        VAULT_SOCKET_MS,
        run,
        delay,
      ),
      animateAt(
        shutter,
        [
          {
            opacity: 1,
            transform: "perspective(300px) rotateX(0deg)",
            offset: 0,
          },
          {
            opacity: 1,
            transform: "perspective(300px) rotateX(0deg)",
            offset: 0.2,
          },
          {
            opacity: 0,
            transform: "perspective(300px) rotateX(90deg)",
            offset: 0.65,
          },
          {
            opacity: 0,
            transform: "perspective(300px) rotateX(90deg)",
            offset: 1,
          },
        ],
        VAULT_SOCKET_MS,
        run,
        delay,
      ),
      animateAt(
        scan,
        Array.from({ length: 9 }, (_, i) => ({
          transform: `translateY(${i % 2 ? 105 : -105}%)`,
          offset: i / 8,
          easing: "ease-in-out",
        })),
        delay + VAULT_SOCKET_MS,
        run,
      ),
    ];
    return () => animations.forEach((animation) => animation.cancel());
  }, [coin, column, row, run.id, run.started]);
  return (
    <div ref={ref} className="vault-socket-shutter" aria-hidden="true">
      <i />
    </div>
  );
}

export function GateSweep({
  origin,
  run,
  at,
}: {
  origin: number;
  run: SlotMotionRun;
  at: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const a = animateAt(
      ref.current,
      [
        { transform: "scaleY(.02)", opacity: 0, offset: 0 },
        { transform: "scaleY(.08)", opacity: 1, offset: 0.1 },
        { transform: "scaleY(1)", opacity: 0.8, offset: 0.48 },
        { transform: "scaleY(1)", opacity: 0, offset: 1 },
      ],
      520,
      run,
      at - 120,
    );
    return () => a.cancel();
  }, [run.id, run.started, at]);
  return (
    <div
      ref={ref}
      className="slot-gate-sweep"
      style={{ transformOrigin: `50% ${origin}%` } as CSSProperties}
      aria-hidden="true"
    />
  );
}
