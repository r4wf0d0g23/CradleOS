import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { PRACTICE_CATALOG } from "./casinoExperienceCatalog";
import { CASINO_DISABLED_KEYS } from "./casinoCatalog";
describe("native station terminal identity", () => {
  it("maps every physical terminal to exactly one reviewed practice entry", () => {
    const catalog = JSON.parse(
      readFileSync("../services/casino-station/catalog.json", "utf8"),
    );
    const asset = JSON.parse(
      readFileSync(
        "../services/casino-station/native/assets/asset.json",
        "utf8",
      ),
    );
    expect(catalog.map((g: { key: string }) => g.key)).toEqual(
      PRACTICE_CATALOG.map((g) => g.key),
    );
    expect(asset.terminals.map((g: { key: string }) => g.key)).toEqual(
      PRACTICE_CATALOG.map((g) => g.key),
    );
    expect(asset.terminals).toHaveLength(34);
    expect(new Set(catalog.map((g: { key: string }) => g.key)).size).toBe(34);
    expect(
      catalog.some((g: { key: string }) => CASINO_DISABLED_KEYS.has(g.key)),
    ).toBe(false);
  });
});
