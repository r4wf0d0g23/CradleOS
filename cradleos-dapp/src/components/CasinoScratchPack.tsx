import { useEffect, useRef } from "react";
import { chipLabel, type Round } from "../lib/casinoPractice";
import { CASINO_SYMBOLS } from "../lib/casinoLounge";
import { ItemIcon } from "./GameIcon";
function ScratchTicket({
  round,
  index,
  reveal,
  onReveal,
  busy,
}: {
  round: Round;
  index: number;
  reveal: boolean;
  onReveal: () => boolean;
  busy: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    cells = useRef(new Set<string>()),
    last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvas.current,
      ctx = c?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-over";
    const metal = ctx.createLinearGradient(0, 0, 300, 230);
    metal.addColorStop(0, "#77837a");
    metal.addColorStop(0.25, "#394a4a");
    metal.addColorStop(0.48, "#697970");
    metal.addColorStop(0.52, "#344447");
    metal.addColorStop(1, "#172b32");
    ctx.fillStyle = metal;
    ctx.fillRect(0, 0, 300, 230);
    for (let y = 0; y < 230; y += 2) {
      ctx.strokeStyle = y % 6 === 0 ? "#d5ddc514" : "#050f1a1a";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(300, y + 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = "#b8bba0";
    ctx.lineWidth = 2;
    ctx.strokeRect(7, 7, 286, 216);
    ctx.strokeStyle = "#182d36";
    ctx.strokeRect(12, 12, 276, 206);
    for (const x of [18, 282])
      for (const y of [18, 212]) {
        ctx.fillStyle = "#182a31";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#9ba68d";
        ctx.beginPath();
        ctx.moveTo(x - 2, y);
        ctx.lineTo(x + 2, y);
        ctx.stroke();
      }
    ctx.save();
    ctx.translate(150, 99);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = "#c4bc8c";
    ctx.lineWidth = 2;
    ctx.strokeRect(-24, -24, 48, 48);
    ctx.strokeRect(-17, -17, 34, 34);
    ctx.restore();
    ctx.fillStyle = "#e4ddba";
    ctx.textAlign = "center";
    ctx.font = "12px monospace";
    ctx.fillText("SEALED SALVAGE", 150, 157);
  }, []);
  const uncovered = reveal;
  return (
    <article
      className={`casino-scratch-ticket ${uncovered ? "scratch-ticket-open" : ""}`}
      data-revealed={uncovered}
    >
      <h4>Ticket {index + 1}</h4>
      <div className="casino-scratch-area">
        <i className="scratch-tool" aria-hidden="true" />
        <div className="casino-scratch-symbols" aria-hidden={!uncovered}>
          {round.values.map((n, i) => (
            <span
              key={i}
              className={
                uncovered && round.values.filter((x) => x === n).length >= 3
                  ? "scratch-matches"
                  : ""
              }
            >
              <ItemIcon typeId={CASINO_SYMBOLS[n].id} size={48} />
            </span>
          ))}
        </div>
        {!uncovered && (
          <canvas
            ref={canvas}
            width={300}
            height={230}
            aria-label={`Scratch ticket ${index + 1} or use the Reveal ticket button`}
            onPointerDown={(e) => {
              if (busy) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              last.current = null;
              const area = e.currentTarget.parentElement!;
              area.dataset.scratching = "true";
            }}
            onPointerMove={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              const rect = e.currentTarget.getBoundingClientRect(),
                x = ((e.clientX - rect.left) / rect.width) * 300,
                y = ((e.clientY - rect.top) / rect.height) * 230,
                ctx = e.currentTarget.getContext("2d");
              if (!ctx) return;
              const area = e.currentTarget.parentElement!;
              area.style.setProperty("--tool-x", `${e.clientX - rect.left}px`);
              area.style.setProperty("--tool-y", `${e.clientY - rect.top}px`);
              ctx.globalCompositeOperation = "destination-out";
              ctx.lineWidth = 32;
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(last.current?.x ?? x, last.current?.y ?? y);
              ctx.lineTo(x, y);
              ctx.stroke();
              // Deterministic rough edge follows the pointer; no additional reveal or randomness.
              for (let i = 0; i < 5; i++) {
                const a = ((i * 71 + x + y) * Math.PI) / 180;
                ctx.beginPath();
                ctx.arc(
                  x + Math.cos(a) * 17,
                  y + Math.sin(a) * 17,
                  1.5 + (i % 2),
                  0,
                  Math.PI * 2,
                );
                ctx.fill();
              }
              last.current = { x, y };
              cells.current.add(`${Math.floor(x / 25)}:${Math.floor(y / 25)}`);
              if (cells.current.size > 42 && !onReveal()) cells.current.clear();
            }}
            onPointerUp={(e) => {
              e.currentTarget.parentElement!.dataset.scratching = "false";
              e.currentTarget.releasePointerCapture(e.pointerId);
              last.current = null;
            }}
            onLostPointerCapture={(e) => {
              e.currentTarget.parentElement!.dataset.scratching = "false";
              last.current = null;
            }}
            onPointerCancel={(e) => {
              e.currentTarget.parentElement!.dataset.scratching = "false";
              last.current = null;
            }}
          />
        )}
      </div>
      <button disabled={uncovered || busy} onClick={onReveal}>
        {uncovered
          ? `Return ${chipLabel(round.payout)} chips`
          : "Reveal ticket"}
      </button>
    </article>
  );
}
export function CasinoScratchPack({
  rounds,
  revealed,
  busy,
  onReveal,
}: {
  rounds: Round[];
  revealed: number[];
  busy: boolean;
  onReveal: (index?: number) => boolean;
}) {
  return (
    <div className="casino-scratch-pack">
      <button
        onClick={() => onReveal()}
        disabled={busy || revealed.length === rounds.length}
      >
        Reveal all tickets
      </button>
      <div className="casino-ticket-grid">
        {rounds.map((r, i) => (
          <ScratchTicket
            key={r.id}
            round={r}
            index={i}
            reveal={revealed.includes(i)}
            busy={busy}
            onReveal={() => onReveal(i)}
          />
        ))}
      </div>
    </div>
  );
}
