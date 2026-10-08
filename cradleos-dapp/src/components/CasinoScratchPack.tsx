import { useEffect, useRef, useState } from "react";
import { chipLabel, type Round } from "../lib/casinoPractice";
import { CASINO_SYMBOLS } from "../lib/casinoLounge";
import { ItemIcon } from "./GameIcon";
function ScratchTicket({
  round,
  index,
  reveal,
}: {
  round: Round;
  index: number;
  reveal: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    cells = useRef(new Set<string>()),
    last = useRef<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(reveal);
  useEffect(() => {
    const c = canvas.current,
      ctx = c?.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#33392e";
    ctx.fillRect(0, 0, 300, 230);
    ctx.strokeStyle = "#a58d5e";
    ctx.strokeRect(4, 4, 292, 222);
    ctx.fillStyle = "#e2d1a1";
    ctx.textAlign = "center";
    ctx.font = "15px monospace";
    ctx.fillText("SCRATCH TO SALVAGE", 150, 115);
  }, []);
  const uncovered = open || reveal;
  return (
    <article className="casino-scratch-ticket" data-revealed={uncovered}>
      <h4>Ticket {index + 1}</h4>
      <div className="casino-scratch-area">
        <div className="casino-scratch-symbols" aria-hidden={!uncovered}>
          {round.values.map((n, i) => (
            <ItemIcon key={i} typeId={CASINO_SYMBOLS[n].id} size={48} />
          ))}
        </div>
        {!uncovered && (
          <canvas
            ref={canvas}
            width={300}
            height={230}
            aria-label={`Scratch ticket ${index + 1} or use the Reveal ticket button`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              last.current = null;
            }}
            onPointerMove={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              const rect = e.currentTarget.getBoundingClientRect(),
                x = ((e.clientX - rect.left) / rect.width) * 300,
                y = ((e.clientY - rect.top) / rect.height) * 230,
                ctx = e.currentTarget.getContext("2d");
              if (!ctx) return;
              ctx.globalCompositeOperation = "destination-out";
              ctx.lineWidth = 36;
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(last.current?.x ?? x, last.current?.y ?? y);
              ctx.lineTo(x, y);
              ctx.stroke();
              last.current = { x, y };
              cells.current.add(`${Math.floor(x / 25)}:${Math.floor(y / 25)}`);
              if (cells.current.size > 42) setOpen(true);
            }}
            onPointerUp={(e) => {
              e.currentTarget.releasePointerCapture(e.pointerId);
              last.current = null;
            }}
            onPointerCancel={() => {
              last.current = null;
            }}
          />
        )}
      </div>
      <button disabled={uncovered} onClick={() => setOpen(true)}>
        {uncovered
          ? `Return ${chipLabel(round.payout)} chips`
          : "Reveal ticket"}
      </button>
    </article>
  );
}
export function CasinoScratchPack({
  rounds,
  reduced,
}: {
  rounds: Round[];
  reduced: boolean;
}) {
  const [all, setAll] = useState(false);
  return (
    <div className="casino-scratch-pack">
      <button onClick={() => setAll(true)} disabled={all || reduced}>
        Reveal all tickets
      </button>
      <div className="casino-ticket-grid">
        {rounds.map((r, i) => (
          <ScratchTicket
            key={r.id}
            round={r}
            index={i}
            reveal={all || reduced}
          />
        ))}
      </div>
    </div>
  );
}
