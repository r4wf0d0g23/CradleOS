import { activeSession, type Session } from "./casinoSessions";
import { randomInt, type RandomInt } from "./casinoPractice";
import {
  newCraps,
  validCraps,
  validCrapsBets,
  CRAPS_KEYS,
  crapsEscrow,
  crapsReserve,
  crapsUnit,
  evaluateCraps,
  type CrapsKey,
} from "./casinoCraps";
const balanceOK = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 1e12;
function available(s: Session) {
  if (activeSession(s)) throw Error("Finish the saved round first.");
  const t = s.craps ?? newCraps();
  if (!validCraps(t)) throw Error("Craps save is invalid.");
  return t;
}
export function changeCrapsBet(
  s: Session,
  key: CrapsKey,
  delta: number,
): Session {
  const t = available(s);
  if (!CRAPS_KEYS.includes(key) || !Number.isSafeInteger(delta) || !delta)
    throw Error("Choose a chip or a bet to remove.");
  if (
    t.point &&
    (key === "pass" || key === "dont") &&
    (delta > 0 || key === "pass")
  )
    throw Error(
      "Line bets open on the come-out. Pass stays until the point resolves.",
    );
  if (delta > 0 && delta % crapsUnit(key, t.point))
    throw Error("Use the displayed chip increment for this bet.");
  const bets = { ...t.bets },
    before = crapsEscrow(t),
    amount = (bets[key] ?? 0) + delta;
  if (amount < 0) throw Error("That amount is not on the table.");
  if (amount) bets[key] = amount;
  else {
    delete bets[key];
    if (key === "dont") delete bets.dontOdds;
    if (key === "pass") delete bets.passOdds;
  }
  if (!validCrapsBets(bets, t.point))
    throw Error(
      "Check the odds limit, chip increment or 1,000-chip table limit.",
    );
  const balance = s.balance + before - crapsEscrow({ bets });
  if (
    !balanceOK(balance) ||
    !balanceOK(balance + crapsReserve({ bets, point: t.point }))
  )
    throw Error("Not enough available chips.");
  return { ...s, notice: undefined, balance, craps: { ...t, bets } };
}
export function rollCraps(s: Session, rng: RandomInt = randomInt): Session {
  const t = available(s);
  if (!crapsEscrow(t) && !t.point)
    throw Error("Place a bet for the come-out roll.");
  const dice = [rng(6), rng(6)];
  if (!dice.every((n) => Number.isSafeInteger(n) && n >= 0 && n < 6))
    throw Error("Invalid random draw.");
  const receipt = {
    id: t.sequence + 1,
    point: t.point,
    bets: { ...t.bets },
    dice: dice.map((n) => n + 1) as [number, number],
  };
  const e = evaluateCraps(receipt),
    balance = s.balance + e.payout;
  if (!balanceOK(balance + crapsReserve(e)) || !balanceOK(receipt.id))
    throw Error("Practice balance limit reached.");
  return {
    ...s,
    notice: undefined,
    balance,
    craps: {
      point: e.point,
      bets: e.bets,
      rolls: [receipt, ...t.rolls].slice(0, 8),
      sequence: receipt.id,
      pending: true,
    },
  };
}
export function revealCraps(s: Session, id: number): Session {
  if (!s.craps?.pending || s.craps.sequence !== id) return s;
  return { ...s, craps: { ...s.craps, pending: false } };
}
