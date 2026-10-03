import { describe, expect, it } from "vitest";
import meta from "../../public/data/game-data-cycle7-3573151/meta.json";
import items from "../../public/data/game-data-cycle7-3573151/items.json";
import events from "../../public/data/game-data-cycle7-3573151/events.json";
import { itemLabel, validateGameDataMeta } from "./gameData";
import nativeJSON from "../../public/data/game-data-cycle7-3573151/native-v1.json";
import { validateNativeSnapshot, filterNativeRecipes, type NativeSnapshot } from "./gameData";

describe("current Game Data snapshot", () => {
  it("rejects snapshots from a retired world, cycle, or client build", () => {
    expect(validateGameDataMeta(meta)).toBe(meta);
    for (const wrong of [{ cycle: 6 }, { world: "0xretired" }, { build: "3388875" }, { server: "Utopia" }]) {
      expect(() => validateGameDataMeta({ ...meta, ...wrong })).toThrow(/does not match/);
    }
  });
  it("uses real item type IDs instead of the old localization message ID", () => {
    expect(items.find(x => x.id === 77917)?.name).toBe("Heavy Storage");
    expect(items.some(x => x.id === 1032759)).toBe(false);
    expect(items.find(x => x.id === 96676)?.name).toBe("Docking Clamp");
    expect(new Set(items.map(x => x.id)).size).toBe(items.length);
    expect(items.length).toBe(meta.counts.items);
    expect(Object.keys(events).length).toBe(meta.counts.eventTypes);
  });
  it("shows an honest label for the API's unnamed item, without guessing", () => {
    const item = items.find(x => x.id === 95936)!;
    expect(item.name).toBe("");
    expect(itemLabel(item)).toBe("Unnamed type #95936");
  });
});

describe("native current-client reference", () => {
  const native = nativeJSON as unknown as NativeSnapshot;
  it("retains complete recipe sides and documented fuel quantities", () => {
    expect(validateNativeSnapshot(native)).toBe(native);
    expect(native.recipes.length).toBe(299);
    expect(native.recipes.find(x => x.id === 1627)?.inputs).toEqual([{ typeID: 89258, quantity: 21 }]);
    expect(native.recipes.find(x => x.id === 1627)?.outputs).toEqual([{ typeID: 88335, quantity: 75 }]);
    expect(native.recipes.find(x => x.id === 1181)?.inputs).toEqual([{ typeID: 78423, quantity: 208 }]);
    expect(native.recipes.find(x => x.id === 1200)?.outputs).toHaveLength(2);
    expect(native.recipes.find(x => x.id === 1200)?.primaryTypeID).toBe(78449);
  });
  it("searches ingredients and product IDs without conflating recipe and localization IDs", () => {
    expect(filterNativeRecipes(native, "Hydrocarbon Residue").some(x => x.id === 1627)).toBe(true);
    expect(filterNativeRecipes(native, "88335").some(x => x.id === 1181)).toBe(true);
    expect(filterNativeRecipes(native, "1627").map(x => x.id)).toContain(1627);
    expect(filterNativeRecipes(native, "not a real material")).toEqual([]);
  });
  it("keeps same-name ships distinct and does not invent missing records", () => {
    expect(native.types[97520].graphicID).toBe(34876);
    expect(native.types[87848].graphicID).toBe(26977);
    expect(native.types[84556].clientRecord).toBe(false);
    expect(native.types[93228].attributes).toEqual([]);
    expect(Object.values(native.types).filter(x => !x.apiPublished)).toHaveLength(28);
  });
  it("retains raw unit names and source disagreements", () => {
    expect(native.units[11].label).toBe("m/sec");
    expect(native.units[11].name).toBe("Acceleration");
    expect(native.apiDifferences.some(x => x.typeID === 88765 && x.client === "Mummified Corpse")).toBe(true);
  });
  it("rejects wrong-cycle, incomplete and broken reference snapshots", () => {
    for (const wrong of [{ cycle: 6 }, { build: "3502403" }, { world: "0xretired" }, { recipes: [] }]) {
      expect(() => validateNativeSnapshot({ ...native, ...wrong })).toThrow();
    }
    const missing = structuredClone(native);
    delete missing.types[89258];
    expect(() => validateNativeSnapshot(missing)).toThrow(/recipe/);
    const invalid = structuredClone(native);
    invalid.recipes[0].inputs[0].quantity = -1;
    expect(() => validateNativeSnapshot(invalid)).toThrow(/quantity/);
    const unit = structuredClone(native);
    delete unit.units[11];
    expect(() => validateNativeSnapshot(unit)).toThrow(/unit/);
  });
});
