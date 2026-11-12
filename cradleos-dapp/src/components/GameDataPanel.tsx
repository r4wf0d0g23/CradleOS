import { useEffect, useMemo, useRef, useState } from "react";
import {
  CURRENT_DATA_BASE,
  CURRENT_DATA_BUILD,
  validateCurrentData,
  validateChemistryLinks,
  rangeLabel,
  filterSchemas,
  filterItems,
  rawUnitLabel,
  type DataFiles,
  type CurrentItem,
  type Chemistry,
  type Catalog,
  type PropertyRange,
} from "../lib/currentGameData";
import { IconGallery } from "./IconGallery";
import "./GameDataPanel.css";

type Tab =
  | "items"
  | "schemas"
  | "traits"
  | "properties"
  | "strings"
  | "events"
  | "changes"
  | "icons"
  | "sources";
const tabs: [Tab, string][] = [
  ["items", "Items"],
  ["schemas", "Schemas"],
  ["traits", "Traits"],
  ["properties", "Properties"],
  ["strings", "Client text"],
  ["events", "Events"],
  ["changes", "Changes"],
  ["icons", "Icons"],
  ["sources", "Sources"],
];
function useData<K extends keyof DataFiles>(file: K, enabled = true) {
  const [state, setState] = useState<{
    file: K;
    data: DataFiles[K] | null;
    error: boolean;
  }>({ file, data: null, error: false });
  const [attempt, setAttempt] = useState(0);
  const cache = useRef(new Map<K, DataFiles[K]>());
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const cached = cache.current.get(file);
    if (cached) {
      setState({ file, data: cached, error: false });
      return;
    }
    setState({ file, data: null, error: false });
    fetch(`${CURRENT_DATA_BASE}/${file}.json`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error("Unavailable");
        return r.json();
      })
      .then((v) => {
        const data = validateCurrentData(file, v);
        if (!controller.signal.aborted) {
          cache.current.set(file, data);
          setState({ file, data, error: false });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({ file, data: null, error: true });
      });
    return () => controller.abort();
  }, [file, enabled, attempt]);
  return {
    data: state.file === file ? state.data : null,
    error: state.file === file && state.error,
    retry: () => {
      cache.current.delete(file);
      setAttempt((x) => x + 1);
    },
  };
}
type LoadState = { error: boolean; retry: () => void };
function Status({ error, retry }: LoadState) {
  return (
    <p role="status" className="gd-muted">
      {error ? (
        <>
          Unavailable <button onClick={retry}>Retry</button>
        </>
      ) : (
        "Loading…"
      )}
    </p>
  );
}
const num = (x: number) =>
  x.toLocaleString(undefined, { maximumFractionDigits: 12 });
const unit = (id: number | undefined, data: Chemistry) =>
  rawUnitLabel(id, data.units);
function Ranges({ rows, data }: { rows: PropertyRange[]; data: Chemistry }) {
  return (
    <dl className="gd-values">
      {rows.map((p, i) => (
        <div key={`${p.propertyID}-${i}`}>
          <dt>
            {data.properties[p.propertyID]?.label || `Property ${p.propertyID}`}
          </dt>
          <dd>
            {rangeLabel(p)} {unit(data.properties[p.propertyID]?.unitID, data)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function ItemDetails({
  item,
  chemistry,
  state,
  request,
}: {
  item: CurrentItem;
  state: ReturnType<typeof useData<"attributes">>;
  request: () => void;
  chemistry: Chemistry | null;
}) {
  const rows = state.data?.types[item.id] ?? [];
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open && item.clientRecord) request();
      }}
    >
      <summary>Details</summary>
      {item.description && <p className="gd-description">{item.description}</p>}
      {item.api && (
        <details>
          <summary>API values · November 11</summary>
          <dl className="gd-values">
            <div>
              <dt>Name</dt>
              <dd>{item.api.name || "Unnamed"}</dd>
            </div>
            <div>
              <dt>Base mass</dt>
              <dd>{num(item.api.mass)} kg</dd>
            </div>
            <div>
              <dt>Base volume</dt>
              <dd>{num(item.api.volume)} m³</dd>
            </div>
          </dl>
        </details>
      )}
      {chemistry?.neotypes[item.id] && (
        <details>
          <summary>Base properties</summary>
          <Ranges
            rows={chemistry.neotypes[item.id].properties}
            data={chemistry}
          />
        </details>
      )}
      {item.clientRecord ? (
        <details>
          <summary>Raw base attributes</summary>
          {!state.data ? (
            <Status {...state} />
          ) : rows.length ? (
            <dl className="gd-values">
              {rows.map((a) => {
                const d = state.data!.definitions[a.id],
                  u = d.unitID == null ? null : state.data!.units[d.unitID];
                return (
                  <div key={a.id}>
                    <dt>
                      {d.label || d.name}
                      <small>#{a.id}</small>
                    </dt>
                    <dd>
                      {num(a.value)}{" "}
                      {u ? rawUnitLabel(d.unitID, state.data!.units) : ""}
                    </dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <p className="gd-muted">Unavailable</p>
          )}
        </details>
      ) : (
        <p className="gd-muted">Client attributes unavailable</p>
      )}
    </details>
  );
}
function Items({
  catalog,
  all,
  setAll,
  chemistry,
}: {
  catalog: ReturnType<typeof useData<"catalog" | "catalog-all">>;
  all: boolean;
  setAll: (v: boolean) => void;
  chemistry: Chemistry | null;
}) {
  const [wantAttributes, setWantAttributes] = useState(false);
  const attributes = useData("attributes", wantAttributes);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [limit, setLimit] = useState(40);
  const categories = useMemo(
    () =>
      [
        ...new Set(
          catalog.data?.items.map((x) => x.category || "Unknown") ?? [],
        ),
      ].sort(),
    [catalog.data],
  );
  const rows = useMemo(
    () => filterItems(catalog.data?.items ?? [], query, category),
    [catalog.data, query, category],
  );
  return (
    <section aria-label="Item catalog">
      <div className="gd-controls">
        <input
          aria-label="Search items"
          placeholder="Name or type ID"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(40);
          }}
        />
        <select
          aria-label="Catalog scope"
          value={all ? "all" : "reference"}
          onChange={(e) => {
            setAll(e.target.value === "all");
            setCategory("All");
            setLimit(40);
          }}
        >
          <option value="reference">Reference items</option>
          <option value="all">All client types</option>
        </select>
        <select
          aria-label="Item category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setLimit(40);
          }}
        >
          <option>All</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      {!catalog.data ? (
        <Status {...catalog} />
      ) : (
        <>
          <p className="gd-muted">
            {rows.length.toLocaleString()} matches · Client catalog · Live
            availability unverified
          </p>
          <div className="gd-grid">
            {rows.slice(0, limit).map((x) => (
              <article className="gd-card" key={x.id}>
                <h3>{x.name}</h3>
                <p className="gd-id">
                  Type {x.id} · {x.clientRecord ? "Client" : "API only"}
                </p>
                <p className="gd-muted">
                  {x.category || "Unknown"} · {x.group || "Unknown"}
                </p>
                <dl className="gd-values">
                  <div>
                    <dt>Quantity</dt>
                    <dd>
                      {x.quantityKind === "continuous"
                        ? "Mass"
                        : x.quantityKind === "discrete"
                          ? "Units"
                          : "Unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt>Base mass</dt>
                    <dd>
                      {x.quantityKind === "continuous"
                        ? "Variant"
                        : x.mass === null
                          ? "Unknown"
                          : `${num(x.mass)} kg`}
                    </dd>
                  </div>
                  <div>
                    <dt>Base volume</dt>
                    <dd>
                      {x.quantityKind === "continuous"
                        ? "Variant"
                        : x.volume === null
                          ? "Unknown"
                          : `${num(x.volume)} m³`}
                    </dd>
                  </div>
                </dl>
                <ItemDetails
                  item={x}
                  chemistry={chemistry}
                  state={attributes}
                  request={() => setWantAttributes(true)}
                />
              </article>
            ))}
          </div>
          {!rows.length && <p>No matches</p>}
          {limit < rows.length && (
            <button onClick={() => setLimit((x) => x + 40)}>
              Show more items
            </button>
          )}
        </>
      )}
    </section>
  );
}
function ChemistryView({
  data,
  catalog,
  tab,
  retry,
}: {
  retry: () => void;
  data: Chemistry;
  catalog: Catalog;
  tab: "schemas" | "traits" | "properties";
}) {
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("All"),
    [limit, setLimit] = useState(30);
  const items = useMemo(
    () => new Map(catalog.items.map((x) => [x.id, x])),
    [catalog],
  );
  const linkError = useMemo(() => {
    try {
      validateChemistryLinks(data, catalog);
      return false;
    } catch {
      return true;
    }
  }, [data, catalog]);
  const schema = useMemo(
    () =>
      filterSchemas(data, items, query).filter(
        (r) => kind === "All" || r.kind === kind,
      ),
    [data, items, query, kind],
  );
  if (linkError) return <Status error={true} retry={retry} />;
  const label = (id: number) => items.get(id)?.name || `Type ${id}`;
  const quantity = (q: number, id: number | null) =>
    `${num(q)}${id === null ? "" : items.get(id)?.quantityKind === "continuous" ? " kg" : items.get(id)?.quantityKind === "discrete" ? " ×" : ""}`;
  const rows =
    tab === "traits"
      ? Object.entries(data.traits).filter(
          ([id, x]) =>
            !query ||
            id === query ||
            `${x.name} ${x.internalName}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
      : Object.entries(data.properties).filter(
          ([id, x]) =>
            !query ||
            id === query ||
            `${x.name} ${x.label}`.toLowerCase().includes(query.toLowerCase()),
        );
  return (
    <section aria-label={tab}>
      <div className="gd-controls">
        <input
          aria-label={`Search ${tab}`}
          placeholder={
            tab === "schemas" ? "Schema, material, trait or ID" : "Name or ID"
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(30);
          }}
        />
        {tab === "schemas" && (
          <select
            aria-label="Schema kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setLimit(30);
            }}
          >
            <option>All</option>
            <option value="manufacturing">Manufacturing</option>
            <option value="reprocessing">Reprocessing</option>
          </select>
        )}
      </div>
      <p className="gd-muted">
        {tab === "schemas"
          ? `${schema.length} schemas · Base quantities · Duration: raw`
          : `${rows.length} ${tab}`}
      </p>
      <div className="gd-grid">
        {tab === "schemas"
          ? schema.slice(0, limit).map((r) => (
              <article className="gd-card" key={r.id}>
                <h3>{r.name}</h3>
                <p className="gd-id">
                  Schema {r.id} · {r.kind} · Duration {r.duration} raw
                </p>
                <h4>Inputs</h4>
                <ul className="gd-lines">
                  {r.inputs.map((x) => (
                    <li key={x.index}>
                      <strong>
                        {quantity(x.quantity, x.typeID)}{" "}
                        {x.typeID === null
                          ? "Qualifying material"
                          : label(x.typeID)}
                      </strong>
                      <small>
                        Slot {x.index}
                        {x.typeID !== null
                          ? ` · Type ${x.typeID}`
                          : " · Unit: material-dependent"}
                      </small>
                      {x.traits.map((t) => (
                        <details key={t}>
                          <summary>
                            {data.traits[t].name} · Trait {t}
                          </summary>
                          <Ranges
                            rows={data.traits[t].properties}
                            data={data}
                          />
                        </details>
                      ))}
                    </li>
                  ))}
                </ul>
                <h4>Base outputs</h4>
                <ul className="gd-lines">
                  {r.outputs.map((x) => (
                    <li key={x.index}>
                      <strong>
                        {quantity(x.quantity, x.typeID)} {label(x.typeID)}
                      </strong>
                      <small>Type {x.typeID}</small>
                    </li>
                  ))}
                </ul>
                <details>
                  <summary>Facilities · {r.facilities.length}</summary>
                  <ul className="gd-lines">
                    {r.facilities.map((f) => (
                      <li key={f.typeID}>
                        {label(f.typeID)}
                        <small>
                          Type {f.typeID} · Max multiplier {f.maxMultiplier}
                        </small>
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            ))
          : rows.slice(0, limit).map(([id]) =>
              tab === "traits" ? (
                <article className="gd-card" key={id}>
                  <h3>{data.traits[id].name}</h3>
                  <p className="gd-id">Trait {id}</p>
                  <Ranges rows={data.traits[id].properties} data={data} />
                </article>
              ) : (
                <article className="gd-card" key={id}>
                  <h3>{data.properties[id].label}</h3>
                  <p className="gd-id">
                    Property {id} · {data.properties[id].kind}
                  </p>
                  <dl className="gd-values">
                    <div>
                      <dt>Unit</dt>
                      <dd>
                        {unit(data.properties[id].unitID, data) ||
                          "Unspecified"}
                      </dd>
                    </div>
                    <div>
                      <dt>Minimum</dt>
                      <dd>{data.properties[id].naturalMin ?? "Unspecified"}</dd>
                    </div>
                    <div>
                      <dt>Maximum</dt>
                      <dd>{data.properties[id].naturalMax ?? "Unspecified"}</dd>
                    </div>
                    <div>
                      <dt>Blend</dt>
                      <dd>
                        {data.properties[id].mergeMethod || "Unspecified"}
                      </dd>
                    </div>
                  </dl>
                </article>
              ),
            )}
      </div>
      {(tab === "schemas" ? schema.length : rows.length) === 0 && (
        <p>No matches</p>
      )}
      {limit < (tab === "schemas" ? schema.length : rows.length) && (
        <button onClick={() => setLimit((x) => x + 30)}>Show more {tab}</button>
      )}
    </section>
  );
}
function TextView() {
  const state = useData("strings");
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q.length < 2
      ? []
      : Object.entries(state.data?.strings ?? {})
          .filter(([id, s]) => id === q || s.toLowerCase().includes(q))
          .slice(0, 100);
  }, [state.data, query]);
  return (
    <section>
      <input
        aria-label="Search client text"
        placeholder="Text or message ID"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!state.data ? (
        <Status {...state} />
      ) : (
        <>
          <p className="gd-muted">
            {query.trim().length < 2
              ? "Enter two characters"
              : `${matches.length} results · Limit 100`}
          </p>
          {matches.map(([id, s]) => (
            <details className="gd-card" key={id}>
              <summary>
                Message {id} · {s.slice(0, 140)}
              </summary>
              <p className="gd-description">{s}</p>
            </details>
          ))}
        </>
      )}
    </section>
  );
}
function EventsView() {
  const state = useData("events");
  return !state.data ? (
    <Status {...state} />
  ) : (
    <div className="gd-grid">
      {Object.entries(state.data.events).map(([id, x]) => (
        <article className="gd-card" key={id}>
          <h3>{x.eventTypeName}</h3>
          <small>Client event {id}</small>
        </article>
      ))}
    </div>
  );
}
function ChangesView() {
  const state = useData("changes");
  return !state.data ? (
    <Status {...state} />
  ) : (
    <section>
      <p className="gd-muted">
        Client types vs {state.data.baselineBuild} · +
        {state.data.typeDelta.added} / −{state.data.typeDelta.removed} /{" "}
        {state.data.typeDelta.changed} changed
      </p>
      {state.data.patches.map((p) => (
        <article className="gd-card" key={p.version}>
          <h3>
            <a href={p.url} target="_blank" rel="noreferrer">
              Patch {p.version}
            </a>{" "}
            · {p.date}
          </h3>
          <ul>
            {p.changes.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
export function GameDataPanel() {
  const [tab, setTab] = useState<Tab>("items"),
    [all, setAll] = useState(false);
  const meta = useData("meta");
  const needsCatalog =
    tab === "items" ||
    tab === "schemas" ||
    tab === "traits" ||
    tab === "properties";
  const catalog = useData(
    tab === "items" && all ? "catalog-all" : "catalog",
    !!meta.data && needsCatalog,
  );
  const chemistry = useData("chemistry", !!meta.data && needsCatalog);
  return (
    <div className="game-data-current">
      <header>
        <h2>Game Data</h2>
        {meta.data && (
          <span>
            Stillness · Cycle 7 · Build {CURRENT_DATA_BUILD} ·{" "}
            {meta.data.snapshotDate}
          </span>
        )}
      </header>
      {!meta.data ? (
        <Status {...meta} />
      ) : (
        <>
          <p className="gd-muted">
            {meta.data.counts.schemas} schemas · {meta.data.counts.traits}{" "}
            traits · {meta.data.counts.properties} properties · Patch{" "}
            {meta.data.latestPatch}
          </p>
          <nav aria-label="Game Data sections">
            {tabs.map(([id, title]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {title}
              </button>
            ))}
          </nav>
          {tab === "items" && (
            <Items
              catalog={catalog}
              all={all}
              setAll={setAll}
              chemistry={chemistry.data}
            />
          )}
          {(["schemas", "traits", "properties"] as Tab[]).includes(tab) &&
            (!catalog.data ? (
              <Status {...catalog} />
            ) : !chemistry.data ? (
              <Status {...chemistry} />
            ) : (
              <ChemistryView
                key={tab}
                data={chemistry.data}
                retry={() => {
                  chemistry.retry();
                  catalog.retry();
                }}
                catalog={catalog.data}
                tab={tab as "schemas" | "traits" | "properties"}
              />
            ))}
          {tab === "strings" && <TextView />}
          {tab === "events" && <EventsView />}
          {tab === "changes" && <ChangesView />}
          {tab === "icons" && <IconGallery />}
          {tab === "sources" && (
            <section className="gd-grid">
              <article className="gd-card">
                <h3>Client data · {CURRENT_DATA_BUILD}</h3>
                <p>Snapshot {meta.data.snapshotDate}</p>
                {[
                  "meta",
                  "catalog",
                  "catalog-all",
                  "chemistry",
                  "chemistry-rules",
                  "attributes",
                  "strings",
                  "events",
                  "changes",
                ].map((file) => (
                  <p key={file}>
                    <a
                      href={`${CURRENT_DATA_BASE}/${file}.json`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {file} JSON ↓
                    </a>
                  </p>
                ))}
              </article>
              <article className="gd-card">
                <h3>Official sources</h3>
                <p>
                  <a
                    href="https://evefrontier.com/en/news/patch-notes-founder-access-0-7-6-3-vestiges"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Patch notes · 0.7.6.3
                  </a>
                </p>
                <p>
                  <a
                    href="https://evefrontier.com/en/news/an-introduction-to-digital-chemistry"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Digital Chemistry
                  </a>
                </p>
                <p>
                  <a
                    href="https://world-api-stillness.live.pub.evefrontier.com/v2/types?limit=1000"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Official API · {meta.data.counts.apiItems} types
                  </a>
                </p>
              </article>
            </section>
          )}
        </>
      )}
    </div>
  );
}
