import { describe, expect, it } from "vitest";
import { getAdjustedBurnRate } from "../burnRate";

describe("getAdjustedBurnRate", () => {
  const MS_PER_HOUR = 3600000;

  it("returns ~1.11 units/hour when raw is 1h and efficiency is 90%", () => {
    const raw = MS_PER_HOUR;
    const result = getAdjustedBurnRate(raw, 90);
    expect(result.burnTimePerUnitMs).toBe(3240000); // 3600000 * 0.9
    expect(result.unitsPerHour).toBeCloseTo(1.111111, 4);
  });

  it("returns burnTimePerUnitMs = raw and 1 unit/hour when efficiency is 100% and raw is 1h", () => {
    const raw = MS_PER_HOUR;
    const result = getAdjustedBurnRate(raw, 100);
    expect(result.burnTimePerUnitMs).toBe(raw);
    expect(result.unitsPerHour).toBe(1);
  });

  it("returns 2.5 units/hour when raw is 1h and efficiency is 40%", () => {
    const raw = MS_PER_HOUR;
    const result = getAdjustedBurnRate(raw, 40);
    expect(result.burnTimePerUnitMs).toBe(1440000); // 3600000 * 0.4
    expect(result.unitsPerHour).toBe(2.5);
  });

  it("returns 1.25 units/hour when raw is 1h and efficiency is 80%", () => {
    const raw = MS_PER_HOUR;
    const result = getAdjustedBurnRate(raw, 80);
    expect(result.burnTimePerUnitMs).toBe(2880000); // 3600000 * 0.8
    expect(result.unitsPerHour).toBe(1.25);
  });

  it("returns ~6.67 units/hour when raw is 1h and efficiency is 15%", () => {
    const raw = MS_PER_HOUR;
    const result = getAdjustedBurnRate(raw, 15);
    expect(result.burnTimePerUnitMs).toBe(540000); // 3600000 * 0.15
    expect(result.unitsPerHour).toBeCloseTo(6.666667, 4);
  });

  it("returns 10 units/hour when raw is 1h and efficiency is 10%", () => {
    const raw = MS_PER_HOUR;
    const result = getAdjustedBurnRate(raw, 10);
    expect(result.burnTimePerUnitMs).toBe(360000); // 3600000 * 0.1
    expect(result.unitsPerHour).toBe(10);
  });

  it("uses raw as burn time and derives unitsPerHour when efficiency is null", () => {
    const raw = MS_PER_HOUR;
    const result = getAdjustedBurnRate(raw, null);
    expect(result.burnTimePerUnitMs).toBe(raw);
    expect(result.unitsPerHour).toBe(1);
  });

  it("uses raw as burn time when efficiency is undefined", () => {
    const raw = 1800000;
    const result = getAdjustedBurnRate(raw, undefined);
    expect(result.burnTimePerUnitMs).toBe(raw);
    expect(result.unitsPerHour).toBe(2);
  });

  it("uses raw as burn time when efficiency is 0", () => {
    const raw = MS_PER_HOUR;
    const result = getAdjustedBurnRate(raw, 0);
    expect(result.burnTimePerUnitMs).toBe(raw);
    expect(result.unitsPerHour).toBe(1);
  });

  it("returns unitsPerHour 0 when raw is 0", () => {
    const result = getAdjustedBurnRate(0, 90);
    expect(result.burnTimePerUnitMs).toBe(0);
    expect(result.unitsPerHour).toBe(0);
  });

  it("normalizes invalid raw (NaN) to 0 and returns (0, 0)", () => {
    const result = getAdjustedBurnRate(Number.NaN, 90);
    expect(result.burnTimePerUnitMs).toBe(0);
    expect(result.unitsPerHour).toBe(0);
  });

  it("normalizes invalid raw (Infinity) to 0 and returns (0, 0)", () => {
    const result = getAdjustedBurnRate(Number.POSITIVE_INFINITY, 90);
    expect(result.burnTimePerUnitMs).toBe(0);
    expect(result.unitsPerHour).toBe(0);
  });

  it("normalizes invalid raw (negative) to 0 and returns (0, 0)", () => {
    const result = getAdjustedBurnRate(-1000, 90);
    expect(result.burnTimePerUnitMs).toBe(0);
    expect(result.unitsPerHour).toBe(0);
  });

  it("handles negative efficiency by using raw (fallback)", () => {
    const raw = MS_PER_HOUR;
    const result = getAdjustedBurnRate(raw, -10);
    expect(result.burnTimePerUnitMs).toBe(raw);
    expect(result.unitsPerHour).toBe(1);
  });

  it("handles NaN efficiency by using raw", () => {
    const raw = MS_PER_HOUR;
    const result = getAdjustedBurnRate(raw, Number.NaN);
    expect(result.burnTimePerUnitMs).toBe(raw);
    expect(result.unitsPerHour).toBe(1);
  });

  it("treats efficiency > 100 as invalid and uses raw (fallback)", () => {
    const raw = MS_PER_HOUR;
    const result = getAdjustedBurnRate(raw, 250);
    expect(result.burnTimePerUnitMs).toBe(raw);
    expect(result.unitsPerHour).toBe(1);
  });

  it("computes correct unitsPerHour for 10 units/hour (6 min per unit)", () => {
    const sixMinutesMs = 6 * 60 * 1000;
    const result = getAdjustedBurnRate(sixMinutesMs, 100);
    expect(result.burnTimePerUnitMs).toBe(sixMinutesMs);
    expect(result.unitsPerHour).toBe(10);
  });
});
