/** Current Stillness snapshot: official item IDs; client localization IDs stay distinct. */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  GAME_DATA_BASE, validateGameDataMeta, itemLabel, validateNativeSnapshot, filterNativeRecipes,
  type GameDataMeta, type GameItem, type GameDataChanges, type NativeSnapshot,
} from "../lib/gameData";

import { ItemIcon } from "./GameIcon";
import { IconGallery } from "./IconGallery";

const ACCENT = "#FF4700";
const MUTED = "rgba(190,190,175,0.68)";
const TEXT = "#e0e0d0";
const control: CSSProperties = { background: "#14120f", border: "1px solid #5d493e", color: TEXT, padding: "7px 10px", fontFamily: "inherit", fontSize: 12, minWidth: 0 };
const card: CSSProperties = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.12)", borderLeft: `2px solid ${ACCENT}`, padding: 12, minWidth: 0, overflowWrap: "anywhere" };
const note: CSSProperties = { fontSize: 11, lineHeight: 1.6, color: MUTED };
const grid: CSSProperties = { display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))" };

type Tab = "icons" | "items" | "recipes" | "strings" | "events" | "changes" | "sources";
const TABS: Array<[Tab, string]> = [["items", "ITEMS"], ["icons", "ICONS"], ["recipes", "CLIENT RECIPES"], ["strings", "CLIENT TEXT"], ["events", "EVENT TYPES"], ["changes", "CYCLE 7 CHANGES"], ["sources", "SOURCES"]];

function useSnapshot<T>(file: string, validate?: (data: T) => T) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(null);
    fetch(`${GAME_DATA_BASE}/${file}.json`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<T>; })
      .then(value => { if (!controller.signal.aborted) setData(validate ? validate(value) : value); })
      .catch(e => { if (!controller.signal.aborted) setError(String(e.message ?? e)); });
    return () => controller.abort();
  }, [file, attempt, validate]);
  return { data, error, retry: () => setAttempt(n => n + 1) };
}

function Status({ error, retry }: { error: string | null; retry: () => void }) {
  return <div role="status" style={note}>
    {error ? <>Could not load this snapshot: {error} <button style={control} onClick={retry}>Retry</button></> : "Loading current-cycle snapshot…"}
  </div>;
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" style={{ color: "#86bfff", overflowWrap: "anywhere" }}>{children}</a>;
}

type NativeState = ReturnType<typeof useSnapshot<NativeSnapshot>>;

function NativeItemDetails({ id, state }: { id: number; state: NativeState }) {
  const [open, setOpen] = useState(false);
  const data = state.data;
  const item = data?.types[id];
  const graphic = item?.graphicID ? data?.graphics[item.graphicID] : null;
  const differences = data?.apiDifferences.filter(x => x.typeID === id) ?? [];
  return <details style={{ ...note, marginTop: 10 }} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary style={{ cursor: "pointer", color: "#ffb58b" }}>Client attributes &amp; source comparison</summary>
    {open && (!data ? <Status error={state.error} retry={state.retry} /> : <>
      {!item?.clientRecord ? <p>No matching native type record in this client snapshot. API data above remains available; no client statistics were substituted.</p> : <>
        <p><strong>Raw base attributes</strong> · client {data.build}. Not effective fitted, skill-modified, or live-server values. Zero can be a base placeholder. Percentages, multipliers, and timing values are not converted.</p>
        {item.clientName && item.clientName !== item.name && <p>Client name: {item.clientName}</p>}
        <div style={{ display: "grid", gap: 6 }}>{item.attributes.map(a => {
          const def = data.attributes[a.id];
          const unit = def.unitID !== null ? data.units[def.unitID] : null;
          return <div key={a.id} style={{ borderTop: "1px solid #ffffff18", paddingTop: 5 }}>
            <strong style={{ color: TEXT }}>{def.label || def.name}</strong> · raw value <strong style={{ color: "#ffb58b" }}>{String(a.value)}</strong>
            <div style={{ fontSize: 10 }}>{def.name} · attribute {a.id}{unit && <> · unit label: {unit.label || "not localized"} (internal: {unit.name})</>}</div>
          </div>;
        })}</div>
        {!item.attributes.length && <p>No base-attribute row was found for this item; this does not imply zero statistics.</p>}
        {item.graphicID && <p>Graphics reference #{item.graphicID}{graphic?.sofHullName && <> · hull <code>{graphic.sofHullName}</code></>}{graphic?.sofLayout?.length ? <> · layout {graphic.sofLayout.join(", ")}</> : null}. This is a data reference, not a complete model preview.</p>}
      </>}
      {differences.length > 0 && <div><strong>API / client differences</strong>{differences.map(d => <p key={d.field}>{d.field}: API <code>{JSON.stringify(d.api)}</code> · client <code>{JSON.stringify(d.client)}</code></p>)}<p>Each source is retained separately; no silent replacement.</p></div>}
    </>)}
  </details>;
}

function RecipesView({ state }: { state: NativeState }) {
  const { data, error, retry } = state;
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(30);
  const recipes = useMemo(() => data ? filterNativeRecipes(data, query) : [], [data, query]);
  if (!data) return <Status error={error} retry={retry} />;
  return <section>
    <p style={note}><strong>{data.counts.recipes} client recipe definitions</strong> · build {data.build}. Exact input/output quantities from the native client schema. Presence here does not prove a recipe is currently available at a facility. The Recipes tab uses these quantities for route choices, batch planning and material lists.</p>
    <input aria-label="Search client recipes" placeholder="Search input, output, type ID, or recipe ID…" value={query} onChange={e => { setQuery(e.target.value); setLimit(30); }} style={{ ...control, width: "100%", boxSizing: "border-box" }} />
    <p style={note}>{recipes.length} matching recipes · showing {Math.min(limit, recipes.length)}</p>
    <div style={grid}>{recipes.slice(0, limit).map(r => <article key={r.id} style={card}>
      <h3 style={{ color: TEXT, fontSize: 13, marginTop: 0 }}>{r.outputs.map(x => data.types[x.typeID].name).join(" + ")}</h3>
      <div style={{ ...note, color: "#ffb58b" }}>Recipe #{r.id}</div>
      {(["inputs", "outputs"] as const).map(side => <div key={side} style={{ marginTop: 8 }}>
        <strong style={{ fontSize: 11 }}>{side === "inputs" ? "INPUTS" : "OUTPUTS"}</strong>
        <ul style={{ ...note, paddingLeft: 18, margin: "4px 0" }}>{r[side].map(line => <li key={line.typeID}>
          <strong className="icon-label" style={{ color: TEXT }}><ItemIcon typeId={line.typeID} size={28} /><span>{line.quantity.toLocaleString()} × {data.types[line.typeID].name}</span></strong>
          <div>Type {line.typeID}{!data.types[line.typeID].apiPublished && " · client-only reference; not in API catalog"}</div>
        </li>)}</ul>
      </div>)}
      <details style={{ ...note, marginTop: 8 }}><summary style={{ cursor: "pointer" }}>Source details</summary>
        <p>Native <code>runTime</code>: {r.runTime} (raw; timing unit unverified). Primary type ID: {r.primaryTypeID}.</p>
        {data.patchChecks.filter(c => c.recipeID === r.id).map(c => <p key={c.recipeID}><SourceLink href={c.url}>Official patch cross-check</SourceLink>: {c.fields}.</p>)}
      </details>
    </article>)}</div>
    {!recipes.length && <p style={note}>No matching client recipe definitions.</p>}
    {limit < recipes.length && <button style={{ ...control, marginTop: 12 }} onClick={() => setLimit(n => n + 30)}>Show more recipes</button>}
  </section>;
}

function ItemsView({ meta, native }: { meta: GameDataMeta; native: NativeState }) {
  const { data, error, retry } = useSnapshot<GameItem[]>("items");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [limit, setLimit] = useState(48);
  const categories = useMemo(() => Array.from(new Set(data?.map(x => x.categoryName) ?? [])).sort(), [data]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(x => (category === "All" || x.categoryName === category) &&
      (!q || String(x.id) === q || `${x.name} ${x.groupName} ${x.description}`.toLowerCase().includes(q)));
  }, [data, query, category]);
  if (!data) return <Status error={error} retry={retry} />;
  return <section>
    <p style={note}>{data.length} item types from the official Stillness API, checked {meta.officialApi.fetchedAt.slice(0, 10)}. This is the API-published catalog, not every item in the client. {meta.counts.unnamedItems} record has no published name.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
      <input aria-label="Search items" placeholder="Search item name, type ID, or description…" value={query} onChange={e => { setQuery(e.target.value); setLimit(48); }} style={{ ...control, flex: "1 1 200px" }} />
      <select aria-label="Item category" value={category} onChange={e => { setCategory(e.target.value); setLimit(48); }} style={control}>
        <option value="All">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}
      </select>
    </div>
    <p style={note}>{matches.length} matching items · showing {Math.min(limit, matches.length)}</p>
    <div style={grid}>{matches.slice(0, limit).map(item => <article key={item.id} style={card}>
      <div className="icon-label" style={{ color: TEXT, fontWeight: 700, fontSize: 13 }}><ItemIcon typeId={item.id} size={48} /><span>{itemLabel(item)}</span></div>
      <div style={{ ...note, color: "#ffb58b" }}>Type ID {item.id} · {item.categoryName} / {item.groupName}</div>
      <div style={{ ...note, marginTop: 5 }}>{item.volume.toLocaleString(undefined, { maximumFractionDigits: 4 })} m³ · {item.mass.toLocaleString(undefined, { maximumFractionDigits: 4 })} kg</div>
      {item.description && <p style={{ ...note, whiteSpace: "pre-wrap", marginBottom: 0 }}>{item.description.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, "")}</p>}
      <NativeItemDetails id={item.id} state={native} />
    </article>)}</div>
    {matches.length === 0 && <p style={note}>No matching published item types.</p>}
    {limit < matches.length && <button style={{ ...control, marginTop: 12 }} onClick={() => setLimit(n => n + 48)}>Show more items</button>}
  </section>;
}

function StringsView({ meta }: { meta: GameDataMeta }) {
  const { data, error, retry } = useSnapshot<Record<string, string>>("strings");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(50);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!data || q.length === 1) return [];
    const found: Array<[string, string]> = [];
    for (const [id, text] of Object.entries(data)) {
      if (!q || id === q || text.toLowerCase().includes(q)) found.push([id, text]);
      if (found.length >= limit) break;
    }
    return found;
  }, [data, query, limit]);
  return <section>
    <p style={note}>{meta.counts.strings.toLocaleString()} non-empty, non-numeric English strings from client build {meta.build}. These IDs are <strong>localization message IDs—not item type IDs</strong>. Text in the client does not prove a feature is live or obtainable.</p>
    {!data ? <Status error={error} retry={retry} /> : <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <input aria-label="Search client text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search text or localization message ID…" style={{ ...control, flex: "1 1 200px" }} />
        <select aria-label="Text result limit" value={limit} onChange={e => setLimit(Number(e.target.value))} style={control}>{[50,100,250].map(n => <option key={n} value={n}>{n} results</option>)}</select>
      </div>
      <p style={note}>{query.trim().length === 1 ? "Enter at least two characters." : `Showing ${matches.length} results${matches.length === limit ? " (limit reached; narrow your search)" : ""}.`}</p>
      <div style={{ display: "grid", gap: 5 }}>{matches.map(([id,text]) => <details key={id} style={card}>
        <summary style={{ cursor: "pointer", fontSize: 11, color: TEXT }}><span style={{ color: "#ffb58b" }}>Message {id}</span> · {text.slice(0,160)}{text.length > 160 ? "…" : ""}</summary>
        <div style={{ ...note, whiteSpace: "pre-wrap", marginTop: 8 }}>{text}</div>
      </details>)}</div>
    </>}
  </section>;
}

function EventsView({ meta }: { meta: GameDataMeta }) {
  const { data, error, retry } = useSnapshot<Record<string, { eventTypeName: string }>>("events");
  if (!data) return <Status error={error} retry={retry} />;
  return <section>
    <p style={note}>{Object.keys(data).length} internal client event definitions decoded from the hash-verified <code>eventtypes.static</code> in build {meta.build}. These are not Sui contract events or a guarantee that every event is used in the current world.</p>
    <div style={grid}>{Object.entries(data).map(([id, event]) => <div key={id} style={{ ...card, fontSize: 12 }}><span style={{ color: "#ffb58b" }}>Event {id}</span> · {event.eventTypeName}</div>)}</div>
  </section>;
}

function ChangesView() {
  const { data, error, retry } = useSnapshot<GameDataChanges>("changes");
  if (!data) return <Status error={error} retry={retry} />;
  return <section>
    <p style={note}>Verified official changes through {data.latestPatch}, checked {data.checkedAt}. Recipe quantities below are specific published changes, not a complete blueprint database or a refreshed Industry planner.</p>
    <div style={{ display: "grid", gap: 12 }}>{data.patches.map(p => <article key={p.version} style={card}>
      <h3 style={{ color: TEXT, fontSize: 14, margin: "0 0 5px" }}>{p.title}</h3>
      <SourceLink href={p.url}>Official patch {p.version} · {p.date}</SourceLink>
      <ul style={{ ...note, paddingLeft: 18, marginBottom: 0 }}>{p.changes.map(line => <li key={line} style={{ marginTop: 8 }}>{line}</li>)}</ul>
    </article>)}</div>
  </section>;
}

function SourcesView({ meta }: { meta: GameDataMeta }) {
  const { data: changes, error, retry } = useSnapshot<GameDataChanges>("changes");
  return <section style={{ display: "grid", gap: 12 }}>
    <article style={card}><h3 style={{ color: TEXT, marginTop: 0 }}>Snapshot coverage</h3><ul style={{ ...note, paddingLeft: 18 }}>{meta.coverage.map(x => <li key={x} style={{ marginBottom: 6 }}>{x}</li>)}</ul>
      <p style={note}>Physical item values are reported as published by the API. Missing names and placeholder descriptions are retained honestly. No old-cycle game state or balances are included.</p>
    </article>
    <article style={card}><h3 style={{ color: TEXT, marginTop: 0 }}>Source records</h3>
      <p style={note}><SourceLink href={meta.officialApi.url}>Official Stillness item API</SourceLink> · fetched {meta.officialApi.fetchedAt}</p>
      <p style={note}>Client: Stillness / Cycle 7 / build {meta.build} · extracted {meta.extractedAt}. Resource sizes and MD5 hashes matched the launcher's manifest before decoding. Independent SHA-256 digests are recorded in the snapshot metadata.</p>
      <p style={note}>{meta.native?.recipes ?? "Current"} native client recipe definitions and raw base attributes are now available. Facility availability, timing units, effective fitted statistics, and complete current 3D models remain unverified. Older localization IDs and illustrative model stand-ins are not presented as current items.</p>
      {meta.native && <p style={note}><SourceLink href={`${GAME_DATA_BASE}/${meta.native.file}`}>Download native recipe / attribute data</SourceLink> · extracted {meta.native.extractedAt}<br />SHA-256 {meta.native.sha256}</p>}
      <SourceLink href={`${GAME_DATA_BASE}/meta.json`}>Download provenance JSON</SourceLink>
      <details style={{ ...note, marginTop: 10 }}><summary style={{ cursor: "pointer" }}>Verified client files</summary>{meta.clientFiles.map(file => <div key={file.resource} style={{ marginTop: 8 }}><code>{file.resource}</code><br />{file.bytes.toLocaleString()} bytes · {file.decodeStatus ?? "Decoded for this snapshot"}<br /><span style={{ fontSize: 9 }}>SHA-256 {file.sha256}</span></div>)}</details>
    </article>
    <article style={card}><h3 style={{ color: TEXT, marginTop: 0 }}>Official GitHub cross-check</h3>
      {!changes ? <Status error={error} retry={retry} /> : <><p style={note}>Upstream heads checked {changes.checkedAt}. These support the current world/API configuration; they do not replace the client as a source of game statistics.</p>{changes.github.map(repo => <p key={repo.repo} style={note}><SourceLink href={repo.url}>{repo.repo} · {repo.sha.slice(0,8)}</SourceLink><br />{repo.note}</p>)}</>}
    </article>
  </section>;
}

export function GameDataPanel() {
  const [tab, setTab] = useState<Tab>("items");
  const { data: meta, error, retry } = useSnapshot<GameDataMeta>("meta", validateGameDataMeta);
  const native = useSnapshot<NativeSnapshot>("native-v1", validateNativeSnapshot);
  return <div style={{ padding: "16px", maxWidth: 1100, margin: "0 auto", color: TEXT }}>
    <header style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
      <h2 style={{ color: ACCENT, fontSize: 17, margin: "0 0 6px", letterSpacing: "0.08em" }}>◇ GAME DATA</h2>
      {meta && <span style={{ ...note, color: "#ffb58b" }}>CYCLE {meta.cycle} · {meta.name.toUpperCase()} · CLIENT {meta.build}</span>}
    </header>
    {!meta ? <Status error={error} retry={retry} /> : <>
      <p style={note}>Stillness reference data · {meta.counts.items} official item types · {meta.counts.eventTypes} client event definitions · snapshot {meta.extractedAt.slice(0,10)}</p>
      <nav aria-label="Game Data sections" style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>{TABS.map(([id,label]) => <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} style={{ ...control, cursor: "pointer", borderBottom: `2px solid ${tab === id ? ACCENT : "transparent"}`, color: tab === id ? "#ffb58b" : TEXT }}>{label}</button>)}</nav>
      {tab === "icons" && <IconGallery />}
      {tab === "items" && <ItemsView meta={meta} native={native} />}
      {tab === "recipes" && <RecipesView state={native} />}
      {tab === "strings" && <StringsView meta={meta} />}
      {tab === "events" && <EventsView meta={meta} />}
      {tab === "changes" && <ChangesView />}
      {tab === "sources" && <SourcesView meta={meta} />}
    </>}
  </div>;
}
