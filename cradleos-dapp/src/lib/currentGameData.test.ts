import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CURRENT_WORLD } from "./cycle";
import {
  filterSchemas,
  filterItems,
  rangeLabel,
  rawUnitLabel,
  validateChemistryLinks,
  validateCurrentData,
  type DataFiles,
} from "./currentGameData";
const read = <K extends keyof DataFiles>(name: K) =>
  JSON.parse(
    readFileSync(
      new URL(
        `../../public/data/game-data-cycle7-3693609/${name}.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  ) as DataFiles[K];
const catalog = read("catalog"),
  chemistry = read("chemistry");
describe("current native reference snapshot", () => {
  it("prioritizes exact item names and treats numeric queries as IDs", () => {
    const all = read("catalog-all");
    expect(filterItems(all.items, "RASP")[0].id).toBe(98323);
    expect(filterItems(all.items, "0").map((x) => x.id)).toEqual([0]);
    expect(
      filterItems(all.items, "EREV")
        .slice(0, 2)
        .map((x) => x.id),
    ).toEqual([98269, 98460]);
  });

  it("keeps raw unit semantics instead of asserting display conversions", () => {
    const attrs = read("attributes");
    expect(rawUnitLabel(101, attrs.units)).toBe("Milliseconds (#101)");
    expect(rawUnitLabel(127, chemistry.units)).toBe("Absolute Percent (#127)");
    expect(rawUnitLabel(undefined, chemistry.units)).toBe("");
  });
  it("rejects malformed rendered text and numeric fields", () => {
    const mutations: [keyof DataFiles, (x: any) => void][] = [
      ["catalog", (x) => (x.items[0].category = {})],
      ["catalog", (x) => (x.items[0].group = {})],
      ["chemistry", (x) => (x.properties[7].kind = {})],
      ["chemistry", (x) => (x.properties[7].naturalMin = {})],
      ["chemistry", (x) => (x.traits[58].internalName = {})],
      ["attributes", (x) => (x.definitions[9].label = {})],
      ["attributes", (x) => (x.units[101].name = {})],
      ["changes", (x) => (x.typeDelta.added = {})],
    ];
    for (const [file, mutate] of mutations) {
      const value = read(file);
      mutate(value);
      expect(() => validateCurrentData(file, value)).toThrow();
    }
  });

  for (const file of [
    "meta",
    "catalog",
    "catalog-all",
    "chemistry",
    "attributes",
    "strings",
    "events",
    "changes",
  ] as const)
    it(`validates actual ${file} payload`, () => {
      expect(validateCurrentData(file, read(file)).build).toBe("3693609");
    });
  it("validates trait-only and fractional schema references", () => {
    validateChemistryLinks(chemistry, catalog);
    const lens = chemistry.schemas.find((r) => r.id === 112)!;
    expect(lens.duration).toBe(45);
    expect(lens.inputs.find((x) => x.index === 2)).toEqual({
      index: 2,
      typeID: null,
      quantity: 17.94,
      traits: [58],
    });
    expect(lens.inputs[0].traits).toEqual([95, 97, 177, 178, 179]);
    expect(lens.outputs[0].typeID).toBe(95639);
  });
  it("preserves recycled lens Cinderwrack and emergency facility", () => {
    const r = chemistry.schemas.find((r) => r.id === 111)!;
    expect(r.inputs.some((x) => x.typeID === 95345)).toBe(true);
    expect(r.facilities.some((x) => x.typeID === 95302)).toBe(true);
  });
  it("keeps duplicate names distinct and API-only types honest", () => {
    for (const id of [98269, 98324, 98460, 98461])
      expect(catalog.items.some((x) => x.id === id)).toBe(true);
    for (const id of [84556, 93228]) {
      const x = catalog.items.find((x) => x.id === id)!;
      expect(x.clientRecord).toBe(false);
      expect(x.mass).toBeNull();
      expect(x.api).not.toBeNull();
    }
  });
  it("retains native ID zero and only explicit quantity units", () => {
    expect(read("catalog-all").items.some((x) => x.id === 0)).toBe(true);
    expect(catalog.items.find((x) => x.id === 96713)?.quantityKind).toBe(
      "continuous",
    );
    expect(catalog.items.find((x) => x.id === 98269)?.quantityKind).toBeNull();
  });
  it("preserves absent bounds and real zero", () => {
    expect(rangeLabel({ propertyID: 1 })).toBe("Required");
    expect(rangeLabel({ propertyID: 1, minValue: 0 })).toBe("≥ 0");
    expect(rangeLabel({ propertyID: 1, maxValue: 0 })).toBe("≤ 0");
    expect(rangeLabel({ propertyID: 1, minValue: 0, maxValue: 0 })).toBe("0");
  });
  it("searches by schema, item, trait and exact ID", () => {
    const items = new Map(catalog.items.map((x) => [x.id, x]));
    expect(filterSchemas(chemistry, items, "112").map((x) => x.id)).toEqual([
      112,
    ]);
    expect(
      filterSchemas(chemistry, items, "95639").some((x) => x.id === 112),
    ).toBe(true);
    expect(
      filterSchemas(chemistry, items, chemistry.traits[58].name).some(
        (x) => x.id === 112,
      ),
    ).toBe(true);
  });
  for (const field of [
    "build",
    "world",
    "cycle",
    "schemaVersion",
    "server",
  ] as const)
    it(`rejects incorrect ${field} on every payload`, () => {
      for (const file of [
        "meta",
        "catalog",
        "chemistry",
        "attributes",
        "strings",
        "events",
        "changes",
      ] as const) {
        const value = read(file);
        Object.assign(value, {
          [field]: field === "world" ? CURRENT_WORLD + "bad" : "wrong",
        });
        expect(() => validateCurrentData(file, value)).toThrow();
      }
    });
  it("rejects malformed references without rounding quantities", () => {
    const d = structuredClone(chemistry);
    d.schemas[0].inputs[0].traits.push(999999);
    expect(() => validateCurrentData("chemistry", d)).toThrow();
    const missing = structuredClone(catalog);
    missing.items = missing.items.filter((x) => x.id !== 95639);
    expect(() => validateChemistryLinks(chemistry, missing)).toThrow();
  });
  it("rejects duplicate slots, nonfinite and zero quantities", () => {
    for (const q of [NaN, Infinity, 0, -1]) {
      const d = structuredClone(chemistry);
      d.schemas[0].inputs[0].quantity = q;
      expect(() => validateCurrentData("chemistry", d)).toThrow();
    }
    const d = structuredClone(chemistry);
    d.schemas[0].inputs.push(d.schemas[0].inputs[0]);
    expect(() => validateCurrentData("chemistry", d)).toThrow();
  });
  it("rejects inverted bounds but accepts absent limits", () => {
    const d = structuredClone(chemistry);
    d.traits[58].properties[0] = { propertyID: 7, minValue: 2, maxValue: 1 };
    expect(() => validateCurrentData("chemistry", d)).toThrow();
    d.traits[58].properties[0] = { propertyID: 7 };
    expect(() => validateCurrentData("chemistry", d)).not.toThrow();
  });
  it("keeps units outside traits when not specified", () => {
    const noUnit = Object.values(chemistry.properties).filter(
      (p) => p.unitID === undefined,
    );
    expect(noUnit).toHaveLength(99);
    expect(
      chemistry.neotypes[96052].properties.find((p) => p.propertyID === 3)
        ?.maxValue,
    ).toBeUndefined();
  });
});
