import { activeSession, type Session } from "./casinoSessions";
import { crapsEscrow } from "./casinoCraps";
import { isPracticeTerminal } from "./casinoExperienceCatalog";

/** A terminal is a presentation request, never permission to skip a paid round.
 * Pure selection: do not mutate, settle, cancel, refill, or resample the ledger.
 * Parked craps bets need not lock the rest of the floor; pending rolls do.
 */
export function casinoLaunchGame(
  s: Session,
  requested?: string,
): string | null {
  if (s.craps?.pending) return "craps";
  if (s.hand || s.table) return "blackjack";
  if (activeSession(s)) return s.pack?.game ?? null;
  if (isPracticeTerminal(requested)) return requested;
  if (crapsEscrow(s.craps) || s.craps?.point) return "craps";
  return s.pack?.game ?? null;
}
