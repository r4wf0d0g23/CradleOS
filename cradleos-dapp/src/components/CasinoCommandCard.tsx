import { ItemIcon } from "./GameIcon";
import "../styles/casino-command-cards.css";
export const COMMAND_SUITS = ["Spades", "Hearts", "Clubs", "Diamonds"];
const GLYPHS = ["♠", "♥", "♣", "♦"];
const ART = [82425, 87848, 81611, 84955];
const SHIP = `${import.meta.env.BASE_URL}casino/lai-jump/lai-top.webp`;
/** Stateless card furniture. The parent owns decoding, concealment and motion. */
export function CommandCardFace({
  rank,
  suit,
  label = "",
}: {
  rank: string;
  suit?: number;
  label?: string;
}) {
  return (
    <div
      className={`command-card-face ${suit === 1 || suit === 3 ? "command-warm" : "command-cool"}`}
      aria-hidden="true"
    >
      <b className="command-rank command-top">
        {rank}
        {suit !== undefined && <em>{GLYPHS[suit]}</em>}
      </b>
      <div
        className={`command-card-art ${suit === undefined ? "command-wing" : ""}`}
      >
        {suit === undefined ? (
          <>
            {[0, 1, 2].map((i) => (
              <img
                key={i}
                className={`command-ship ship-${i}`}
                src={SHIP}
                alt=""
              />
            ))}
          </>
        ) : (
          <ItemIcon typeId={ART[suit]} size={64} />
        )}
      </div>
      <span className="command-card-rail" />
      <b className="command-rank command-bottom">
        {rank}
        {suit !== undefined && <em>{GLYPHS[suit]}</em>}
      </b>
      {label ? (
        <span className="command-card-label">{label}</span>
      ) : (
        <span className="command-card-bars">
          <i />
          <i />
          <i />
        </span>
      )}
    </div>
  );
}
export function CommandCardBack() {
  return (
    <div className="command-card-back" aria-hidden="true">
      <span className="command-card-seal">
        ◇<i />
        <i />
      </span>
      <span className="command-back-mark">CRADLE</span>
    </div>
  );
}
