import { ORE_BPS } from "../lib/casinoExpanded";
export function ExpandedOptions({
  game,
  side,
  setSide,
  target,
  setTarget,
  picks,
  setPicks,
}: {
  game: string;
  side: number;
  setSide: (v: number) => void;
  target: number;
  setTarget: (v: number) => void;
  picks: number[];
  setPicks: (v: number[]) => void;
}) {
  const options: Record<string, string[]> = {
    sicbo: ["Small", "Big", "Single face", "Specific triple", "Any triple"],
    double_dice: ["Under 7", "Over 7", "Seven", "Any double", "Exact sum"],
    under_over_7: ["Under 7", "Seven", "Over 7"],
    baccarat: ["Player", "Banker", "Tie"],
    dragon_tiger: ["Dragon", "Tiger", "Tie"],
    risk_wheel: ["Low", "Medium", "High"],
    ore_refine: ["Basic", "Standard", "Advanced", "Extreme", "Critical"],
    andar_bahar: ["Andar", "Bahar"],
  };
  if (game === "keno")
    return (
      <>
        <legend>Pick signals · {picks.length}/6</legend>
        <div className="casino-keno-picks">
          {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              aria-label={`Pick ${n}`}
              aria-pressed={picks.includes(n)}
              disabled={picks.length === 6 && !picks.includes(n)}
              onClick={() =>
                setPicks(
                  picks.includes(n)
                    ? picks.filter((x) => x !== n)
                    : [...picks, n],
                )
              }
            >
              {n}
            </button>
          ))}
        </div>
      </>
    );
  if (game === "crash" || game === "limbo")
    return (
      <>
        <legend>Auto-stop target</legend>
        <label>
          Multiplier
          <input
            aria-label="Target multiplier"
            type="number"
            min="1.01"
            max="1000"
            step="0.01"
            value={target / 100}
            onChange={(e) =>
              setTarget(Math.round(Number(e.target.value) * 100))
            }
          />
        </label>
        <p>Set before launch · no manual cash out</p>
      </>
    );
  const die =
      game === "chuck_a_luck" ||
      (game === "sicbo" && (side === 2 || side === 3)),
    sum = game === "double_dice" && side === 4;
  return (
    <>
      {options[game] && (
        <>
          <legend>
            {game === "ore_refine" ? "Refinery intensity" : "Your selection"}
          </legend>
          {options[game].map((label, i) => (
            <button
              key={label}
              aria-pressed={side === i}
              onClick={() => {
                setSide(i);
                setTarget(sum ? 7 : 2);
              }}
            >
              {label}
            </button>
          ))}
        </>
      )}
      {(die || sum) && (
        <label>
          {sum ? "Exact sum" : "Die face"}
          <input
            aria-label={sum ? "Exact sum" : "Die face"}
            type="number"
            min={sum ? 2 : 1}
            max={sum ? 12 : 6}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
        </label>
      )}
      {game === "ore_refine" && (
        <p>
          Slag 0× · Partial {ORE_BPS[side][1] / 10000}× · Yield{" "}
          {ORE_BPS[side][2] / 10000}× · Bonus {ORE_BPS[side][3] / 10000}×
        </p>
      )}
    </>
  );
}
