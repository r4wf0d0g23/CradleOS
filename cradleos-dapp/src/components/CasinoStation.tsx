import { useCallback, useEffect, useRef, useState } from "react";
import { CasinoExperience } from "./CasinoExperience";
import { PRACTICE_CATALOG } from "../lib/casinoExperienceCatalog";
import {
  StationStream,
  stationary,
  type StationInput,
  type StationStatus,
} from "../lib/casinoStationStream";
import "./CasinoStation.css";
const STREAM =
  import.meta.env.VITE_STATION_STREAM_URL ||
  "https://spark-2def.tail587192.ts.net:10000";
export function CasinoStation() {
  const canvas = useRef<HTMLCanvasElement>(null),
    stream = useRef<StationStream | null>(null),
    controls = useRef<StationInput>(stationary());
  const keys = useRef(new Set<string>()),
    stick = useRef<number | null>(null),
    look = useRef<{ id: number; x: number; y: number } | null>(null);
  const [state, setState] = useState<StationStatus>("offline"),
    [message, setMessage] = useState("Native station"),
    [near, setNear] = useState<number | null>(null);
  const [game, setGame] = useState<string | null>(null),
    [directory, setDirectory] = useState(false),
    [help, setHelp] = useState(false),
    [search, setSearch] = useState("");
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const reset = useCallback(() => {
    keys.current.clear();
    controls.current = stationary();
    stream.current?.setInput(controls.current);
    stick.current = null;
    look.current = null;
    setKnob({ x: 0, y: 0 });
  }, []);
  const release = useCallback(() => {
    reset();
    stream.current?.close();
    setState("offline");
    setNear(null);
  }, [reset]);
  useEffect(() => {
    if (!canvas.current || !STREAM) {
      setMessage(
        "Station renderer is not configured. Explore the game directory.",
      );
      return;
    }
    const s = new StationStream(
      canvas.current,
      STREAM,
      (state, message) => {
        setState(state);
        setMessage(message);
      },
      setNear,
    );
    stream.current = s;
    if (!document.hidden) void s.join();
    return () => {
      s.close();
      stream.current = null;
    };
  }, []);
  useEffect(() => {
    const update = () => {
      const k = keys.current;
      controls.current = {
        forward:
          Number(k.has("w") || k.has("ArrowUp")) -
          Number(k.has("s") || k.has("ArrowDown")),
        strafe: Number(k.has("d")) - Number(k.has("a")),
        turn: Number(k.has("ArrowRight")) - Number(k.has("ArrowLeft")),
        look: 0,
      };
      stream.current?.setInput(controls.current);
    };
    const down = (e: KeyboardEvent) => {
      if (
        game ||
        directory ||
        help ||
        state !== "walking" ||
        e.target instanceof HTMLInputElement
      )
        return;
      const key = e.key.toLowerCase().startsWith("arrow")
        ? e.key
        : e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(key)
      ) {
        e.preventDefault();
        keys.current.add(key);
        update();
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.key);
      keys.current.delete(e.key.toLowerCase());
      update();
    };
    const hidden = () => {
      if (document.hidden && !game) {
        release();
        setMessage("Paused while away. Rejoin when ready.");
      } else reset();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [game, directory, help, state, reset, release]);
  const open = (key: string) => {
    release();
    setDirectory(false);
    setGame(key);
  };
  const returnToStation = () => {
    setGame(null);
    setMessage("Rejoining station");
    void stream.current?.join();
  };
  const openDirectory = () => {
    release();
    setHelp(false);
    setDirectory(true);
  };
  const closeDirectory = () => {
    setDirectory(false);
    if (STREAM) void stream.current?.join();
  };
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void document.documentElement
        .requestFullscreen?.()
        .catch(() => setMessage("Use your browser’s fullscreen control."));
  };
  const terminal = near === null ? null : PRACTICE_CATALOG[near];
  return (
    <section className="casino-station" aria-label="Cradle Casino Station">
      <canvas
        ref={canvas}
        width={960}
        height={540}
        aria-label="Native Carbon station view"
        onPointerDown={(e) => {
          if (game || directory || help || state !== "walking" || look.current)
            return;
          look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const p = look.current;
          if (p?.id !== e.pointerId) return;
          controls.current = {
            ...controls.current,
            turn: Math.max(-1, Math.min(1, (e.clientX - p.x) / 65)),
            look: Math.max(-1, Math.min(1, (p.y - e.clientY) / 65)),
          };
          stream.current?.setInput(controls.current);
        }}
        onPointerUp={(e) => {
          if (look.current?.id === e.pointerId) {
            look.current = null;
            controls.current = { ...controls.current, turn: 0, look: 0 };
            stream.current?.setInput(controls.current);
          }
        }}
        onPointerCancel={(e) => {
          if (look.current?.id === e.pointerId) reset();
        }}
        onLostPointerCapture={(e) => {
          if (look.current?.id === e.pointerId) reset();
        }}
      />
      {!game && (
        <>
          <header className="station-bar">
            <a href="#/casino" onClick={release} className="station-wordmark">
              CRADLE <span>/ STATION</span>
            </a>
            <nav aria-label="Station">
              <button onClick={openDirectory}>
                Games <span>34</span>
              </button>
              <button
                onClick={() => {
                  reset();
                  setHelp(!help);
                }}
                aria-label="Station controls"
              >
                ?
              </button>
              <button onClick={fullscreen} aria-label="Toggle fullscreen">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
                </svg>
              </button>
            </nav>
          </header>
          {!directory && (
            <>
              <div className="station-status" role="status">
                <i data-ready={state === "walking"} />
                {message}
              </div>
              {state !== "walking" && (
                <div className="station-entry">
                  <small>NATIVE CARBON · TWO-VISITOR PILOT</small>
                  <h1>Enter the station.</h1>
                  <p>
                    {state === "joining"
                      ? "Allocating your own view…"
                      : "Walk the floor or go straight to a game."}
                  </p>
                  {state !== "joining" && STREAM && (
                    <button
                      className="station-primary"
                      onClick={() => void stream.current?.join()}
                    >
                      Join station
                    </button>
                  )}
                  <button onClick={openDirectory}>Game directory →</button>
                </div>
              )}
              {state === "walking" && !help && (
                <>
                  <span className="station-crosshair" aria-hidden="true">
                    ·
                  </span>
                  {terminal && (
                    <button
                      className="station-play station-primary"
                      onClick={() => open(terminal.key)}
                    >
                      Play {terminal.name} →
                    </button>
                  )}
                  <div
                    className="station-joystick"
                    role="group"
                    aria-label="Analog movement"
                    onPointerDown={(e) => {
                      if (stick.current !== null) return;
                      stick.current = e.pointerId;
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (stick.current !== e.pointerId) return;
                      const r = e.currentTarget.getBoundingClientRect(),
                        x = (e.clientX - r.left - r.width / 2) / 40,
                        y = (e.clientY - r.top - r.height / 2) / 40,
                        n = Math.max(1, Math.hypot(x, y));
                      setKnob({ x: (x / n) * 30, y: (y / n) * 30 });
                      controls.current = {
                        ...controls.current,
                        forward: -y / n,
                        strafe: x / n,
                      };
                      stream.current?.setInput(controls.current);
                    }}
                    onPointerUp={(e) => {
                      if (stick.current === e.pointerId) {
                        stick.current = null;
                        setKnob({ x: 0, y: 0 });
                        controls.current = {
                          ...controls.current,
                          forward: 0,
                          strafe: 0,
                        };
                        stream.current?.setInput(controls.current);
                      }
                    }}
                    onPointerCancel={(e) => {
                      if (stick.current === e.pointerId) reset();
                    }}
                    onLostPointerCapture={(e) => {
                      if (stick.current === e.pointerId) reset();
                    }}
                  >
                    <b
                      style={{
                        transform: `translate(${knob.x}px,${knob.y}px)`,
                      }}
                    >
                      ✥
                    </b>
                  </div>
                  <span className="station-look">Drag to look</span>
                </>
              )}
            </>
          )}
          {help && (
            <aside className="station-help">
              <button
                onClick={() => setHelp(false)}
                aria-label="Close controls"
              >
                ×
              </button>
              <h2>On the floor</h2>
              <p>WASD to walk. Arrow keys or drag to look.</p>
              <p>Touch: left stick to move, drag the view to look.</p>
              <p>
                Approach a terminal, then Play. Games opens every table without
                walking.
              </p>
              <p>
                Each visitor has an independent view. No shared desktop or
                wallet.
              </p>
            </aside>
          )}
          {directory && (
            <section className="station-directory" aria-label="Game directory">
              <div className="station-directory-heading">
                <h1>Choose your table.</h1>
                <button onClick={closeDirectory}>Back to floor</button>
              </div>
              <input
                aria-label="Find a game"
                placeholder="Find a game…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="station-games">
                {PRACTICE_CATALOG.filter((g) =>
                  (g.name + " " + g.category)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                ).map((g) => (
                  <button key={g.key} onClick={() => open(g.key)}>
                    <span>{g.category}</span>
                    <strong>{g.name}</strong>
                    <small>{g.hook}</small>
                    <b>Play →</b>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      {game && (
        <div className="station-game">
          <CasinoExperience
            key="single-ledger-owner"
            initialGame={game}
            onReturnToStation={returnToStation}
          />
        </div>
      )}
    </section>
  );
}
