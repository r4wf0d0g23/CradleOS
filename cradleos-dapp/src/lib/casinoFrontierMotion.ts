/** Presentation curves only. Finish times derive from the committed permutation. */
export function racePosition(
  seconds: number,
  place: number,
  profile: number,
): number {
  const s = Math.max(0, seconds) / (4.3 + place * 0.46),
    u = Math.min(1, s);
  const base =
    u ** 1.65 + Math.sin(Math.PI * u) ** 2 * ((profile / 999 - 0.5) * 0.035);
  return s <= 1 ? Math.max(0, base) : 1 + (s - 1) * 1.65;
}
