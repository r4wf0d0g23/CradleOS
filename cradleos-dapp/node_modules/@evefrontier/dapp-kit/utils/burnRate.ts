const MS_PER_HOUR = 3600000;

/**
 * Result of adjusting raw burn time for efficiency.
 * - burnTimePerUnitMs: efficiency-adjusted milliseconds to burn one unit
 * - unitsPerHour: how many units are burned per hour at this rate
 */
export interface AdjustedBurnRate {
  burnTimePerUnitMs: number;
  unitsPerHour: number;
}

/**
 * Takes raw burn time (ms per unit at 100%) and efficiency (0–100 scale),
 * returns efficiency-adjusted burn time per unit and units burned per hour.
 * E.g. raw 3600000 ms, 90% efficient → burn time 3240000 ms, ~1.11 units/hour.
 *
 * @param rawBurnTimeMs - Milliseconds to burn one unit at 100% efficiency. If non-finite or negative, treated as 0 so both returned fields are finite and consistent.
 * @param efficiencyPercent - Efficiency as percentage on a 0–100 scale (e.g. 90 for 90%). Values outside [0, 100] are treated as invalid; when null/undefined, not finite, ≤0, or >100, raw is used as-is for burn time.
 * @returns { burnTimePerUnitMs, unitsPerHour }
 * @category Utilities - Formatting
 */
export function getAdjustedBurnRate(
  rawBurnTimeMs: number,
  efficiencyPercent: number | null | undefined,
): AdjustedBurnRate {
  const raw =
    Number.isFinite(rawBurnTimeMs) && rawBurnTimeMs >= 0 ? rawBurnTimeMs : 0;

  const validEfficiency =
    efficiencyPercent != null &&
    Number.isFinite(efficiencyPercent) &&
    efficiencyPercent > 0 &&
    efficiencyPercent <= 100;

  const burnTimePerUnitMs = validEfficiency
    ? raw * (efficiencyPercent / 100)
    : raw;

  const unitsPerHour =
    burnTimePerUnitMs > 0 && Number.isFinite(burnTimePerUnitMs)
      ? MS_PER_HOUR / burnTimePerUnitMs
      : 0;

  return { burnTimePerUnitMs, unitsPerHour };
}
