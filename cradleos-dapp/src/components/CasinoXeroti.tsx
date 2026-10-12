import { useLayoutEffect, useRef, useState } from "react";
import type { SlotFrame } from "../lib/casinoSlotFleet";
import { XEROTI_CLEAR_MS, type SlotMotionRun } from "../lib/casinoSlotMotion";

/** Native hull portrait; feeding is cosmetic and only follows already revealed wins. */
export function XerotiEntity({
  frame,
  consuming,
  run,
}: {
  frame?: SlotFrame;
  consuming: boolean;
  run: SlotMotionRun;
}) {
  const [failed, setFailed] = useState(false);
  const pulse = useRef<HTMLSpanElement>(null);
  const stage = frame?.multiplier ?? 0;
  useLayoutEffect(() => {
    if (!consuming || !pulse.current) return;
    const a = pulse.current.animate(
      [
        { opacity: 0, transform: "translate(-50%,-50%) scale(.45)" },
        {
          opacity: 0.35,
          transform: "translate(-50%,-50%) scale(.65)",
          offset: 0.55,
        },
        {
          opacity: 0.85,
          transform: "translate(-50%,-50%) scale(1.2)",
          offset: 0.86,
        },
        { opacity: 0, transform: "translate(-50%,-50%) scale(1.4)" },
      ],
      { duration: XEROTI_CLEAR_MS + 220, fill: "both" },
    );
    a.currentTime = Math.max(0, performance.now() - run.started);
    return () => a.cancel();
  }, [consuming, run.id, run.started]);
  return (
    <div
      className={`xeroti-entity ${consuming ? "xeroti-feeding" : ""}`}
      data-hunger-stage={stage}
      aria-hidden="true"
    >
      <div className="xeroti-orbit" />
      {!failed && (
        <img
          src={`${import.meta.env.BASE_URL}assets/casino/xeroti/xeroti-hero.webp`}
          alt=""
          onError={() => setFailed(true)}
        />
      )}
      {failed && <span className="xeroti-hull-fallback">XEROTI</span>}
      <span className="xeroti-mouth" />
      <span ref={pulse} className="xeroti-feed-pulse" />
      <div className="xeroti-distance-mark">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

/** Measured cell centers keep connecting veins aligned with responsive grid gutters. */
export function XerotiConnections({
  frame,
  visible,
}: {
  frame?: SlotFrame;
  visible: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [geometry, setGeometry] = useState<{
    width: number;
    height: number;
    points: Record<number, [number, number]>;
  }>({ width: 1, height: 1, points: {} });
  useLayoutEffect(() => {
    const svg = ref.current,
      parent = svg?.parentElement;
    if (!svg || !parent || !visible) return;
    const measure = () => {
      const box = svg.getBoundingClientRect(),
        points: Record<number, [number, number]> = {};
      parent
        .querySelectorAll<HTMLElement>(".fleet-cell[data-cell]")
        .forEach((cell) => {
          const b = cell.getBoundingClientRect();
          points[Number(cell.dataset.cell)] = [
            b.left + b.width / 2 - box.left,
            b.top + b.height / 2 - box.top,
          ];
        });
      setGeometry({ width: box.width || 1, height: box.height || 1, points });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [frame, visible]);
  if (!frame || !visible) return null;
  return (
    <svg
      ref={ref}
      className="feral-connections xeroti-connections"
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {frame.wins.flatMap((win, group) => {
        const ids = new Set(win.cells);
        return win.cells.flatMap((id) =>
          [id + 5, ...(id % 5 < 4 ? [id + 1] : [])].flatMap((next) => {
            const a = geometry.points[id],
              b = geometry.points[next];
            return ids.has(next) && a && b
              ? [
                  <line
                    key={`${group}-${id}-${next}`}
                    data-from={id}
                    data-to={next}
                    x1={a[0]}
                    y1={a[1]}
                    x2={b[0]}
                    y2={b[1]}
                  />,
                ]
              : [];
          }),
        );
      })}
    </svg>
  );
}
