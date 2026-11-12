import { CURRENT_WORLD } from "./cycle";
export const CURRENT_DATA_BUILD = "3693609";
export const CURRENT_DATA_BASE = `${import.meta.env.BASE_URL ?? "/"}data/game-data-cycle7-${CURRENT_DATA_BUILD}`;
export type Envelope = {
  schemaVersion: 2;
  cycle: 7;
  server: "Stillness";
  world: string;
  build: string;
};
export type CurrentItem = {
  id: number;
  name: string;
  description: string;
  group: string | null;
  category: string | null;
  mass: number | null;
  volume: number | null;
  quantityKind: "continuous" | "discrete" | null;
  published: number | null;
  reference: boolean;
  clientRecord: boolean;
  api: {
    name: string;
    mass: number;
    volume: number;
    categoryName: string;
    groupName: string;
  } | null;
};
export type Unit = {
  name: string;
  label: string | null;
  description: string | null;
};
export type PropertyRange = {
  propertyID: number;
  minValue?: number;
  maxValue?: number;
};
export type Schema = {
  id: number;
  name: string;
  kind: "manufacturing" | "reprocessing";
  duration: number;
  inputs: {
    index: number;
    typeID: number | null;
    quantity: number;
    traits: number[];
  }[];
  outputs: { index: number; typeID: number; quantity: number }[];
  facilities: { typeID: number; maxMultiplier: number }[];
};
export type Catalog = Envelope & { items: CurrentItem[] };
export type Chemistry = Envelope & {
  schemas: Schema[];
  traits: Record<
    string,
    { name: string; internalName: string; properties: PropertyRange[] }
  >;
  properties: Record<
    string,
    {
      name: string;
      label: string;
      kind: string;
      mergeMethod?: string;
      unitID?: number;
      naturalMin?: number;
      naturalMax?: number;
    }
  >;
  units: Record<string, Unit>;
  neotypes: Record<string, { properties: PropertyRange[] }>;
};
export type Attributes = Envelope & {
  types: Record<string, { id: number; value: number }[]>;
  definitions: Record<
    string,
    { name: string; label: string | null; unitID?: number | null }
  >;
  units: Record<string, Unit>;
};
export type CurrentMeta = Envelope & {
  snapshotDate: string;
  latestPatch: string;
  counts: {
    items: number;
    clientTypes: number;
    referenceItems: number;
    apiItems: number;
    schemas: number;
    traits: number;
    properties: number;
    strings: number;
    events: number;
  };
  files: Record<string, { bytes: number; sha256: string }>;
};
export type Changes = Envelope & {
  latestPatch: string;
  baselineBuild: string;
  typeDelta: { added: number; removed: number; changed: number };
  patches: { version: string; date: string; url: string; changes: string[] }[];
};
export type DataFiles = {
  meta: CurrentMeta;
  catalog: Catalog;
  "catalog-all": Catalog;
  chemistry: Chemistry;
  attributes: Attributes;
  strings: Envelope & { strings: Record<string, string> };
  events: Envelope & { events: Record<string, { eventTypeName: string }> };
  changes: Changes;
};
function requireData(ok: unknown): asserts ok {
  if (!ok) throw new Error("Invalid current snapshot");
}
const record = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);
const id = (n: unknown): n is number =>
  Number.isSafeInteger(n) && Number(n) >= 0;
const nullableText = (x: unknown) => x === null || typeof x === "string";
function validateUnits(units: Record<string, Unit>) {
  for (const u of Object.values(units))
    requireData(
      u &&
        typeof u.name === "string" &&
        nullableText(u.label) &&
        nullableText(u.description),
    );
}
export function rawUnitLabel(
  unitID: number | null | undefined,
  units: Record<string, Unit>,
): string {
  return unitID == null ? "" : `${units[unitID]?.name || "Unit"} (#${unitID})`;
}
export function validateCurrentData<K extends keyof DataFiles>(
  file: K,
  value: unknown,
): DataFiles[K] {
  requireData(
    record(value) &&
      value.schemaVersion === 2 &&
      value.cycle === 7 &&
      value.server === "Stillness" &&
      value.world === CURRENT_WORLD &&
      value.build === CURRENT_DATA_BUILD,
  );
  if (file === "catalog" || file === "catalog-all") {
    const d = value as Catalog;
    requireData(Array.isArray(d.items));
    const ids = new Set<number>();
    for (const x of d.items) {
      requireData(
        x &&
          id(x.id) &&
          !ids.has(x.id) &&
          typeof x.name === "string" &&
          typeof x.description === "string" &&
          nullableText(x.category) &&
          nullableText(x.group) &&
          typeof x.reference === "boolean" &&
          typeof x.clientRecord === "boolean" &&
          [null, "continuous", "discrete"].includes(x.quantityKind) &&
          (x.mass === null || finite(x.mass)) &&
          (x.volume === null || finite(x.volume)) &&
          (x.api === null ||
            (record(x.api) &&
              typeof x.api.name === "string" &&
              finite(x.api.mass) &&
              finite(x.api.volume))),
      );
      ids.add(x.id);
    }
  } else if (file === "chemistry") {
    const d = value as Chemistry;
    requireData(
      Array.isArray(d.schemas) &&
        record(d.traits) &&
        record(d.properties) &&
        record(d.units) &&
        record(d.neotypes),
    );
    validateUnits(d.units);
    const ids = new Set<number>();
    const range = (x: PropertyRange) => {
      requireData(
        x &&
          id(x.propertyID) &&
          d.properties[x.propertyID] &&
          (x.minValue === undefined || finite(x.minValue)) &&
          (x.maxValue === undefined || finite(x.maxValue)) &&
          !(
            x.minValue !== undefined &&
            x.maxValue !== undefined &&
            x.minValue > x.maxValue
          ),
      );
    };
    for (const p of Object.values(d.properties))
      requireData(
        p &&
          typeof p.label === "string" &&
          typeof p.name === "string" &&
          typeof p.kind === "string" &&
          (p.mergeMethod === undefined || typeof p.mergeMethod === "string") &&
          (p.naturalMin === undefined || finite(p.naturalMin)) &&
          (p.naturalMax === undefined || finite(p.naturalMax)) &&
          (p.unitID === undefined || d.units[p.unitID]),
      );
    for (const t of Object.values(d.traits)) {
      requireData(
        t &&
          typeof t.name === "string" &&
          typeof t.internalName === "string" &&
          Array.isArray(t.properties),
      );
      t.properties.forEach(range);
    }
    for (const t of Object.values(d.neotypes)) {
      requireData(t && Array.isArray(t.properties));
      t.properties.forEach(range);
    }
    for (const r of d.schemas) {
      requireData(
        r &&
          id(r.id) &&
          r.id > 0 &&
          !ids.has(r.id) &&
          typeof r.name === "string" &&
          ["manufacturing", "reprocessing"].includes(r.kind) &&
          finite(r.duration) &&
          r.duration >= 0 &&
          Array.isArray(r.inputs) &&
          r.inputs.length &&
          Array.isArray(r.outputs) &&
          r.outputs.length &&
          Array.isArray(r.facilities),
      );
      ids.add(r.id);
      for (const side of [r.inputs, r.outputs]) {
        const indices = new Set<number>();
        for (const x of side) {
          requireData(
            x &&
              id(x.index) &&
              !indices.has(x.index) &&
              finite(x.quantity) &&
              x.quantity > 0,
          );
          indices.add(x.index);
        }
      }
      for (const x of r.inputs)
        requireData(
          (x.typeID === null || id(x.typeID)) &&
            Array.isArray(x.traits) &&
            x.traits.every((t) => id(t) && !!d.traits[t]) &&
            (x.typeID !== null || x.traits.length),
        );
      for (const x of r.outputs) requireData(id(x.typeID));
      for (const f of r.facilities)
        requireData(id(f.typeID) && id(f.maxMultiplier) && f.maxMultiplier > 0);
    }
  } else if (file === "attributes") {
    const d = value as Attributes;
    requireData(record(d.types) && record(d.definitions) && record(d.units));
    validateUnits(d.units);
    for (const def of Object.values(d.definitions))
      requireData(
        def &&
          typeof def.name === "string" &&
          nullableText(def.label) &&
          (def.unitID == null || d.units[def.unitID]),
      );
    for (const rows of Object.values(d.types)) {
      requireData(Array.isArray(rows));
      const ids = new Set<number>();
      for (const a of rows) {
        requireData(
          id(a.id) && !ids.has(a.id) && finite(a.value) && d.definitions[a.id],
        );
        ids.add(a.id);
      }
    }
  } else if (file === "meta") {
    const d = value as CurrentMeta;
    requireData(
      typeof d.snapshotDate === "string" &&
        typeof d.latestPatch === "string" &&
        record(d.counts) &&
        record(d.files),
    );
    for (const key of [
      "items",
      "clientTypes",
      "referenceItems",
      "apiItems",
      "schemas",
      "traits",
      "properties",
      "strings",
      "events",
    ] as const)
      requireData(id(d.counts[key]));
  } else if (file === "strings")
    requireData(
      record(value.strings) &&
        Object.values(value.strings).every((v) => typeof v === "string"),
    );
  else if (file === "events")
    requireData(
      record(value.events) &&
        Object.values(value.events).every(
          (v) => record(v) && typeof v.eventTypeName === "string",
        ),
    );
  else if (file === "changes") {
    const d = value as Changes;
    requireData(
      Array.isArray(d.patches) &&
        record(d.typeDelta) &&
        typeof d.baselineBuild === "string" &&
        typeof d.latestPatch === "string" &&
        id(d.typeDelta.added) &&
        id(d.typeDelta.removed) &&
        id(d.typeDelta.changed),
    );
    for (const p of d.patches)
      requireData(
        typeof p.version === "string" &&
          typeof p.date === "string" &&
          /^https:\/\/evefrontier\.com\/en\/news\//.test(p.url) &&
          Array.isArray(p.changes) &&
          p.changes.every((s) => typeof s === "string"),
      );
  }
  return value as DataFiles[K];
}
export function validateChemistryLinks(
  data: Chemistry,
  catalog: Catalog,
): void {
  const ids = new Set(
    catalog.items.filter((x) => x.clientRecord).map((x) => x.id),
  );
  for (const r of data.schemas)
    for (const x of [...r.inputs, ...r.outputs, ...r.facilities])
      requireData(x.typeID === null || ids.has(x.typeID));
}
export function rangeLabel(p: PropertyRange): string {
  if (p.minValue === undefined && p.maxValue === undefined) return "Required";
  if (p.minValue === undefined) return `≤ ${p.maxValue}`;
  if (p.maxValue === undefined) return `≥ ${p.minValue}`;
  return p.minValue === p.maxValue
    ? String(p.minValue)
    : `${p.minValue} – ${p.maxValue}`;
}
export function filterSchemas(
  data: Chemistry,
  items: Map<number, CurrentItem>,
  query: string,
): Schema[] {
  const q = query.trim().toLowerCase();
  if (!q) return data.schemas;
  return data.schemas.filter(
    (r) =>
      String(r.id) === q ||
      r.name.toLowerCase().includes(q) ||
      [...r.inputs, ...r.outputs].some(
        (x) =>
          x.typeID !== null &&
          (String(x.typeID) === q ||
            items.get(x.typeID)?.name.toLowerCase().includes(q)),
      ) ||
      r.inputs.some((x) =>
        x.traits.some((t) => data.traits[t].name.toLowerCase().includes(q)),
      ),
  );
}

export function filterItems(
  items: CurrentItem[],
  query: string,
  category = "All",
): CurrentItem[] {
  const q = query.trim().toLowerCase(),
    numeric = /^\d+$/.test(q);
  const matches = items.filter(
    (x) =>
      (category === "All" || (x.category || "Unknown") === category) &&
      (!q ||
        (numeric
          ? String(x.id) === q
          : `${x.name} ${x.description} ${x.group ?? ""}`
              .toLowerCase()
              .includes(q))),
  );
  if (!q || numeric) return matches;
  const rank = (x: CurrentItem) =>
    x.name.toLowerCase() === q ? 0 : x.name.toLowerCase().includes(q) ? 1 : 2;
  return matches.sort((a, b) => rank(a) - rank(b));
}
