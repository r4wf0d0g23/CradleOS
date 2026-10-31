import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { resolveCurrentSystemName } from "../lib/currentSystemNames";
import {
  buildKnownSpaceGraph,
  fetchKnownSpace,
  knownSpaceHistoryRange,
  knownSpaceStatus,
  shortSpaceId,
  spaceNodeLabel,
  spaceNodeMatches,
  type KnownSpaceSnapshot,
  type SpaceEdge,
  type SpaceNode,
} from "../lib/knownSpace";
import "./KnownSpaceMap.css";

type Camera = { x: number; y: number; width: number };
type Selection = { kind: "node" | "edge"; id: string } | null;
const EMPTY_GRAPH = {
  nodes: [],
  edges: [],
  nodeByGate: new Map<string, string>(),
};
const date = (at: number) => new Date(at).toLocaleString();
const safeLabel = (text: string) =>
  text.length > 30 ? `${text.slice(0, 28)}…` : text;
const initialCamera: Camera = { x: -1000, y: -640, width: 2000 };
function fitCamera(nodes: SpaceNode[]): Camera {
  if (!nodes.length) return initialCamera;
  const xs = nodes.map((n) => n.x),
    ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const width = Math.max(380, maxX - minX + 280, (maxY - minY + 220) / 0.64);
  return {
    x: (minX + maxX) / 2 - width / 2,
    y: (minY + maxY) / 2 - width * 0.32,
    width,
  };
}
function TransactionLink({
  digest,
  children,
}: {
  digest: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={`https://suiscan.xyz/testnet/tx/${digest}`}
      target="_blank"
      rel="noreferrer"
    >
      {children} ↗
    </a>
  );
}

export function KnownSpaceMap() {
  const [snapshot, setSnapshot] = useState<KnownSpaceSnapshot | null>(null);
  const [requestedAt, setRequestedAt] = useState<number | null>(null);
  const [historyRange, setHistoryRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(true),
    [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now()),
    [query, setQuery] = useState("");
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [selection, setSelection] = useState<Selection>(null),
    [camera, setCamera] = useState<Camera>(initialCamera);
  const sequence = useRef(0),
    controller = useRef<AbortController | null>(null),
    fitted = useRef(false);
  const svg = useRef<SVGSVGElement>(null),
    pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false),
    gesture = useRef<{ x: number; y: number; distance: number } | null>(null);
  const tapTarget = useRef<Selection>(null),
    pointerStart = useRef({ x: 0, y: 0 });
  const markerId = `known-space-arrow-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const generation = ++sequence.current;
    controller.current?.abort();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    let timedOut = false;
    const delay = setTimeout(
      async () => {
        if (document.visibilityState === "hidden") {
          setBusy(false);
          return;
        }
        request = new AbortController();
        controller.current = request;
        setBusy(true);
        setFailed(false);
        timeout = setTimeout(() => {
          timedOut = true;
          request?.abort();
        }, 20_000);
        try {
          const next = await fetchKnownSpace(requestedAt, request.signal);
          if (generation !== sequence.current || request.signal.aborted) return;
          if (next.status === "unavailable") throw new Error("Unavailable");
          setSnapshot(next);
          setNow(Date.now());
          if (requestedAt === null) {
            setHistoryRange(knownSpaceHistoryRange(next));
          }
        } catch {
          if (
            generation === sequence.current &&
            (!request.signal.aborted || timedOut)
          )
            setFailed(true);
        } finally {
          clearTimeout(timeout);
          if (generation === sequence.current) setBusy(false);
        }
      },
      requestedAt === null ? 0 : 300,
    );
    return () => {
      ++sequence.current;
      clearTimeout(delay);
      clearTimeout(timeout);
      request?.abort();
    };
  }, [requestedAt, refresh]);

  useEffect(() => {
    const visible = () => {
      setNow(Date.now());
      if (document.visibilityState === "hidden") controller.current?.abort();
      else setRefresh((n) => n + 1);
    };
    const timer = setInterval(() => {
      if (document.visibilityState !== "hidden") {
        setNow(Date.now());
        if (requestedAt === null) setRefresh((n) => n + 1);
      }
    }, 60_000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [requestedAt]);

  const graph = useMemo(
    () => (snapshot ? buildKnownSpaceGraph(snapshot) : EMPTY_GRAPH),
    [snapshot],
  );
  const nodes = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph],
  );
  useEffect(() => {
    if (!fitted.current && graph.nodes.length) {
      fitted.current = true;
      setCamera(fitCamera(graph.nodes));
    }
  }, [graph]);
  useEffect(() => {
    let cancelled = false;
    const ids = [
      ...new Set(
        graph.nodes.flatMap((n) => (n.systemId === null ? [] : [n.systemId])),
      ),
    ];
    Promise.all(
      ids.map(
        async (id) => [id, await resolveCurrentSystemName(Number(id))] as const,
      ),
    )
      .then((values) => {
        if (!cancelled)
          setNames(
            new Map(
              values.filter(
                (v): v is readonly [string, string] => v[1] !== null,
              ),
            ),
          );
      })
      .catch(() => {
        if (!cancelled) setNames(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [graph]);
  useEffect(() => {
    if (
      selection &&
      !(selection.kind === "node"
        ? nodes.has(selection.id)
        : graph.edges.some((e) => e.id === selection.id))
    )
      setSelection(null);
  }, [graph, nodes, selection]);

  const matches = useMemo(
    () => graph.nodes.filter((n) => spaceNodeMatches(n, query, names)),
    [graph, query, names],
  );
  const matchedIds = useMemo(
    () => new Set(matches.map((n) => n.id)),
    [matches],
  );
  const selectedNode =
    selection?.kind === "node" ? nodes.get(selection.id) : undefined;
  const selectedEdge =
    selection?.kind === "edge"
      ? graph.edges.find((e) => e.id === selection.id)
      : undefined;
  const incident = useMemo(
    () =>
      selectedNode
        ? graph.edges.filter(
            (e) => e.source === selectedNode.id || e.target === selectedNode.id,
          )
        : [],
    [graph, selectedNode],
  );
  const stale =
    failed || (!!snapshot && knownSpaceStatus(snapshot, now) === "Stale");
  const mismatch = !!snapshot && snapshot.coverage.requestedAt !== requestedAt;
  const replay =
    requestedAt !== null ||
    (!!snapshot && snapshot.coverage.requestedAt !== null);
  const shownAt = snapshot?.coverage.requestedAt;
  const status = !snapshot
    ? failed
      ? "Unavailable"
      : "Loading…"
    : stale
      ? "Stale"
      : knownSpaceStatus(snapshot, now);
  const focus = (node: SpaceNode) => {
    setSelection({ kind: "node", id: node.id });
    setCamera({ x: node.x - 260, y: node.y - 166.4, width: 520 });
  };
  const zoom = (factor: number) =>
    setCamera((c) => {
      const width = Math.max(120, Math.min(8000, c.width * factor));
      return {
        x: c.x + (c.width - width) / 2,
        y: c.y + (c.width - width) * 0.32,
        width,
      };
    });
  const pan = (x: number, y: number) =>
    setCamera((c) => ({ ...c, x: c.x + x * c.width, y: c.y + y * c.width }));
  useEffect(() => {
    const element = svg.current;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(e.deltaY > 0 ? 1.12 : 0.89);
    };
    element?.addEventListener("wheel", wheel, { passive: false });
    return () => element?.removeEventListener("wheel", wheel);
  }, []);
  const gestureState = () => {
    const p = [...pointers.current.values()];
    return p.length
      ? {
          x: p.reduce((n, v) => n + v.x, 0) / p.length,
          y: p.reduce((n, v) => n + v.y, 0) / p.length,
          distance:
            p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0,
        }
      : null;
  };
  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!pointers.current.size) {
      moved.current = false;
      pointerStart.current = { x: e.clientX, y: e.clientY };
      const target = (e.target as Element).closest(
        "[data-node-id],[data-edge-id]",
      );
      tapTarget.current = target?.getAttribute("data-node-id")
        ? { kind: "node", id: target.getAttribute("data-node-id")! }
        : target?.getAttribute("data-edge-id")
          ? { kind: "edge", id: target.getAttribute("data-edge-id")! }
          : null;
    } else {
      moved.current = true;
      tapTarget.current = null;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current = gestureState();
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const before = gesture.current,
      after = gestureState(),
      bounds = svg.current?.getBoundingClientRect();
    gesture.current = after;
    if (!before || !after || !bounds) return;
    const dx = after.x - before.x,
      dy = after.y - before.y;
    if (
      Math.hypot(
        e.clientX - pointerStart.current.x,
        e.clientY - pointerStart.current.y,
      ) > 3 ||
      after.distance > 0
    )
      moved.current = true;
    setCamera((c) => {
      const ratio =
        before.distance > 0 && after.distance > 0
          ? before.distance / after.distance
          : 1;
      const width = Math.max(120, Math.min(8000, c.width * ratio));
      const scale = c.width / bounds.width;
      return {
        x: c.x - dx * scale + (c.width - width) / 2,
        y: c.y - dy * scale + (c.width - width) * 0.32,
        width,
      };
    });
  };
  const up = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (pointers.current.size === 1 && !moved.current && tapTarget.current)
      setSelection(tapTarget.current);
    pointers.current.delete(e.pointerId);
    gesture.current = gestureState();
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const choose = (kind: "node" | "edge", id: string) => {
    if (!moved.current) setSelection({ kind, id });
  };
  const path = (edge: SpaceEdge) => {
    const a = nodes.get(edge.source)!,
      b = nodes.get(edge.target)!;
    if (a.id === b.id)
      return `M ${a.x - 9} ${a.y - 6} C ${a.x - 90} ${a.y - 110}, ${a.x + 90} ${a.y - 110}, ${a.x + 9} ${a.y - 6}`;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy) || 1;
    return `M ${a.x + (dx / length) * 11} ${a.y + (dy / length) * 11} Q ${(a.x + b.x) / 2 - dy * 0.04} ${(a.y + b.y) / 2 + dx * 0.04}, ${b.x - (dx / length) * 14} ${b.y - (dy / length) * 14}`;
  };

  return (
    <section className="known-space" aria-label="Known Space">
      <header className="known-space-header">
        <h2>Known Space</h2>
        <span>Schematic</span>
        <span>Stillness · Testnet</span>
        <button disabled={busy} onClick={() => setRefresh((n) => n + 1)}>
          {busy ? "Loading…" : "Refresh"}
        </button>
      </header>
      <div className="known-space-status" role="status">
        <span data-warning={status === "Stale" || status === "Unavailable"}>
          {status}
        </span>
        <span>Retained history</span>
        {snapshot &&
          (!snapshot.backfillComplete || snapshot.status === "backfilling") &&
          status !== "Backfilling" && <span>Backfilling</span>}
        {snapshot &&
          (snapshot.coverage.gaps > 0 || snapshot.coverage.rejected > 0) && (
            <span>Partial history</span>
          )}
        {snapshot?.indexedAt && <span>Indexed {date(snapshot.indexedAt)}</span>}
        {mismatch && (
          <span>
            {failed ? "Previous snapshot" : "Loading snapshot…"} · Shown{" "}
            {shownAt === null ? "Live" : date(shownAt!)}
          </span>
        )}
      </div>
      <div className="known-space-toolbar">
        <input
          aria-label="Search systems or gates"
          placeholder="Search system or gate…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && <button onClick={() => setQuery("")}>Clear</button>}
        <button aria-label="Zoom in" onClick={() => zoom(0.75)}>
          +
        </button>
        <button aria-label="Zoom out" onClick={() => zoom(1.33)}>
          −
        </button>
        <button onClick={() => setCamera(fitCamera(graph.nodes))}>Fit</button>
        <button aria-label="Pan left" onClick={() => pan(-0.15, 0)}>
          ←
        </button>
        <button aria-label="Pan up" onClick={() => pan(0, -0.15)}>
          ↑
        </button>
        <button aria-label="Pan down" onClick={() => pan(0, 0.15)}>
          ↓
        </button>
        <button aria-label="Pan right" onClick={() => pan(0.15, 0)}>
          →
        </button>
      </div>
      <div className="known-space-timeline">
        <label htmlFor={`${markerId}-time`}>
          {requestedAt === null ? "Live" : date(requestedAt)}
        </label>
        <input
          id={`${markerId}-time`}
          aria-label="Discovery replay time"
          type="range"
          min={historyRange?.start ?? 0}
          max={historyRange?.end ?? 1}
          step="1"
          value={requestedAt ?? historyRange?.end ?? 1}
          disabled={!historyRange}
          onChange={(e) => setRequestedAt(Number(e.target.value))}
        />
        <button
          disabled={requestedAt === null}
          onClick={() => {
            setRequestedAt(null);
            setRefresh((n) => n + 1);
          }}
        >
          Live
        </button>
      </div>
      <div className="known-space-counts">
        <span>
          {snapshot
            ? graph.nodes.filter((n) => n.systemId !== null).length
            : "—"}{" "}
          systems
        </span>
        <span>
          {snapshot
            ? graph.nodes.filter((n) => n.systemId === null).length
            : "—"}{" "}
          unresolved gates
        </span>
        <span>
          {snapshot ? snapshot.coverage.jumpCount.toLocaleString() : "—"}{" "}
          observed jumps
        </span>
      </div>
      {query && (
        <div className="known-space-results" aria-label="Search results">
          {matches.length ? (
            <>
              <span>{matches.length} matches</span>
              {matches.slice(0, 30).map((n) => (
                <button key={n.id} onClick={() => focus(n)}>
                  {spaceNodeLabel(n, names)}
                </button>
              ))}
            </>
          ) : (
            <span>No matches</span>
          )}
        </div>
      )}
      <div className="known-space-layout">
        <div className="known-space-stage">
          <svg
            ref={svg}
            viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.width * 0.64}`}
            aria-label="Observed gate jump schematic"
            role="group"
            tabIndex={0}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={(e) => {
              moved.current = true;
              tapTarget.current = null;
              up(e);
            }}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "+" || e.key === "=") zoom(0.75);
              else if (e.key === "-") zoom(1.33);
              else if (
                ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  e.key,
                )
              ) {
                e.preventDefault();
                setCamera((c) => ({
                  ...c,
                  x:
                    c.x +
                    (e.key === "ArrowLeft"
                      ? -0.1
                      : e.key === "ArrowRight"
                        ? 0.1
                        : 0) *
                      c.width,
                  y:
                    c.y +
                    (e.key === "ArrowUp"
                      ? -0.1
                      : e.key === "ArrowDown"
                        ? 0.1
                        : 0) *
                      c.width,
                }));
              }
            }}
          >
            <defs>
              <marker
                id={markerId}
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6" fill="#566575" />
              </marker>
              <marker
                id={`${markerId}-selected`}
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6" fill="#d9b474" />
              </marker>
            </defs>
            {graph.edges.map((edge) => (
              <g
                key={edge.id}
                data-edge-id={edge.id}
                className="known-space-edge"
                data-selected={selectedEdge?.id === edge.id}
                data-related={
                  selectedNode?.id === edge.source ||
                  selectedNode?.id === edge.target
                }
                data-dim={
                  !!query &&
                  !matchedIds.has(edge.source) &&
                  !matchedIds.has(edge.target)
                }
                role="button"
                tabIndex={0}
                aria-label={`${spaceNodeLabel(nodes.get(edge.source)!, names)} to ${spaceNodeLabel(nodes.get(edge.target)!, names)} · ${edge.count} observed jumps`}
                onClick={() => choose("edge", edge.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelection({ kind: "edge", id: edge.id });
                  }
                }}
              >
                <path className="known-space-edge-hit" d={path(edge)} />
                <path
                  className="known-space-edge-line"
                  d={path(edge)}
                  markerEnd={`url(#${markerId}${selectedEdge?.id === edge.id || selectedNode?.id === edge.source || selectedNode?.id === edge.target ? "-selected" : ""})`}
                />
              </g>
            ))}
            {graph.nodes.map((node) => (
              <g
                key={node.id}
                data-node-id={node.id}
                transform={`translate(${node.x} ${node.y})`}
                className="known-space-node"
                data-identified={node.systemId !== null}
                data-selected={selectedNode?.id === node.id}
                data-label-visible={
                  node.systemId !== null ||
                  camera.width <= 800 ||
                  selectedNode?.id === node.id ||
                  (!!query && matchedIds.has(node.id))
                }
                data-dim={!!query && !matchedIds.has(node.id)}
                role="button"
                tabIndex={0}
                aria-label={`${spaceNodeLabel(node, names)} · ${node.systemId === null ? "Unresolved system" : `${node.gates.length} gates`}`}
                onClick={() => choose("node", node.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelection({ kind: "node", id: node.id });
                  }
                }}
              >
                <circle className="known-space-node-hit" r="24" />
                <circle r={node.systemId !== null ? 10 : 7} />
                <text y="-17" textAnchor="middle">
                  {safeLabel(spaceNodeLabel(node, names))}
                </text>
              </g>
            ))}
          </svg>
          {!graph.nodes.length && (
            <div className="known-space-empty">
              {snapshot
                ? "No observed gates in this snapshot"
                : failed
                  ? "Known space unavailable"
                  : "Loading known space…"}
            </div>
          )}
          <div className="known-space-legend">
            <span>● Identified system</span>
            <span>○ Unresolved gate</span>
            <span>→ Observed jumps</span>
          </div>
        </div>
        <aside className="known-space-details" aria-label="Map details">
          {selection && (
            <button
              className="known-space-close"
              onClick={() => setSelection(null)}
            >
              Close
            </button>
          )}
          {selectedNode ? (
            <>
              <h3>{spaceNodeLabel(selectedNode, names)}</h3>
              <span>
                {selectedNode.systemId === null
                  ? "System unresolved"
                  : `System ${selectedNode.systemId}`}
              </span>
              <span>{selectedNode.gates.length} gates</span>
              <strong>
                {incident.reduce((n, e) => n + e.count, 0).toLocaleString()}{" "}
                observed jumps
              </strong>
              {incident.length > 0 && (
                <>
                  <span>
                    First {date(Math.min(...incident.map((e) => e.firstSeen)))}
                  </span>
                  <span>
                    Last {date(Math.max(...incident.map((e) => e.lastSeen)))}
                  </span>
                </>
              )}
              {selectedNode.gates.map((g) => (
                <div className="known-space-gate" key={g.id}>
                  <strong>{g.name ?? `Gate ${g.itemId}`}</strong>
                  <code>{g.id}</code>
                  <span>Item {g.itemId}</span>
                  {!replay && g.checkedAt !== null && (
                    <span>
                      {stale || now - g.checkedAt > 180_000
                        ? "Status stale"
                        : g.status}{" "}
                      · {date(g.checkedAt)}
                    </span>
                  )}
                  {g.locationAt !== null && (
                    <span>Located {date(g.locationAt)}</span>
                  )}
                  {g.locationDigest && (
                    <TransactionLink digest={g.locationDigest}>
                      Location disclosure
                    </TransactionLink>
                  )}
                </div>
              ))}
              <h4>Observed routes</h4>
              {incident.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelection({ kind: "edge", id: e.id })}
                >
                  {spaceNodeLabel(nodes.get(e.source)!, names)} →{" "}
                  {spaceNodeLabel(nodes.get(e.target)!, names)} · {e.count}
                </button>
              ))}
            </>
          ) : selectedEdge ? (
            <>
              <h3>Observed jumps</h3>
              <span>
                {spaceNodeLabel(nodes.get(selectedEdge.source)!, names)} →{" "}
                {spaceNodeLabel(nodes.get(selectedEdge.target)!, names)}
              </span>
              <strong>{selectedEdge.count.toLocaleString()} jumps</strong>
              <span>First {date(selectedEdge.firstSeen)}</span>
              <span>Last {date(selectedEdge.lastSeen)}</span>
              {selectedEdge.gates.map((e) => (
                <div className="known-space-gate" key={e.id}>
                  <code>
                    {shortSpaceId(e.source)} → {shortSpaceId(e.target)}
                  </code>
                  <span>{e.count.toLocaleString()} jumps</span>
                  <TransactionLink digest={e.firstDigest}>
                    First · {date(e.firstSeen)}
                  </TransactionLink>
                  <TransactionLink digest={e.lastDigest}>
                    Last · {date(e.lastSeen)}
                  </TransactionLink>
                  <details>
                    <summary>Gate IDs</summary>
                    <code>{e.source}</code>
                    <code>{e.target}</code>
                  </details>
                </div>
              ))}
            </>
          ) : (
            <>
              <h3>Recent jumps</h3>
              {snapshot?.recentJumps
                .slice()
                .sort((a, b) => b.at - a.at)
                .slice(0, 8)
                .map((j) => (
                  <div className="known-space-gate" key={j.id}>
                    <button
                      onClick={() => {
                        const id = graph.nodeByGate.get(j.source);
                        if (id) focus(nodes.get(id)!);
                      }}
                    >
                      {spaceNodeLabel(
                        nodes.get(graph.nodeByGate.get(j.source)!)!,
                        names,
                      )}{" "}
                      →{" "}
                      {spaceNodeLabel(
                        nodes.get(graph.nodeByGate.get(j.target)!)!,
                        names,
                      )}
                    </button>
                    <TransactionLink digest={j.digest}>
                      {date(j.at)}
                    </TransactionLink>
                  </div>
                ))}
              {snapshot && !snapshot.recentJumps.length && (
                <span>No jumps in this snapshot</span>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
