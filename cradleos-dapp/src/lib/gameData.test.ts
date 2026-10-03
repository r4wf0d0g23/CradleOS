import { describe, expect, it } from "vitest";
import meta from "../../public/data/game-data-cycle7-3573151/meta.json";
import items from "../../public/data/game-data-cycle7-3573151/items.json";
import events from "../../public/data/game-data-cycle7-3573151/events.json";
import { itemLabel, validateGameDataMeta } from "./gameData";

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
