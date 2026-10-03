/** Current Stillness snapshot: official item IDs; client localization IDs stay distinct. */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  GAME_DATA_BASE, validateGameDataMeta, itemLabel,
  type GameDataMeta, type GameItem, type GameDataChanges,
} from "../lib/gameData";

const ACCENT = "#FF4700";
const MUTED = "rgba(190,190,175,0.68)";
const TEXT = "#e0e0d0";
const control: CSSProperties = { background: "#14120f", border: "1px solid #5d493e", color: TEXT, padding: "7px 10px", fontFamily: "inherit", fontSize: 12, minWidth: 0 };
const card: CSSProperties = { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.12)", borderLeft: `2px solid ${ACCENT}`, padding: 12, minWidth: 0, overflowWrap: "anywhere" };
const note: CSSProperties = { fontSize: 11, lineHeight: 1.6, color: MUTED };
const grid: CSSProperties = { display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))" };

type Tab = "items" | "strings" | "events" | "changes" | "sources";
const TABS: Array<[Tab, string]> = [["items", "ITEMS"], ["strings", "CLIENT TEXT"], ["events", "EVENT TYPES"], ["changes", "CYCLE 7 CHANGES"], ["sources", "SOURCES"]];

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

function ItemsView({ meta }: { meta: GameDataMeta }) {
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
      <div style={{ color: TEXT, fontWeight: 700, fontSize: 13 }}>{itemLabel(item)}</div>
      <div style={{ ...note, color: "#ffb58b" }}>Type ID {item.id} · {item.categoryName} / {item.groupName}</div>
      <div style={{ ...note, marginTop: 5 }}>{item.volume.toLocaleString(undefined, { maximumFractionDigits: 4 })} m³ · {item.mass.toLocaleString(undefined, { maximumFractionDigits: 4 })} kg</div>
      {item.description && <p style={{ ...note, whiteSpace: "pre-wrap", marginBottom: 0 }}>{item.description.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, "")}</p>}
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
      <p style={note}>No complete recipe, combat-stat, or current 3D model dataset is claimed. The previous catalogue's localization IDs and illustrative model stand-ins are no longer presented as current item data.</p>
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
  return <div style={{ padding: "16px", maxWidth: 1100, margin: "0 auto", color: TEXT }}>
    <header style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
      <h2 style={{ color: ACCENT, fontSize: 17, margin: "0 0 6px", letterSpacing: "0.08em" }}>◇ GAME DATA</h2>
      {meta && <span style={{ ...note, color: "#ffb58b" }}>CYCLE {meta.cycle} · {meta.name.toUpperCase()} · CLIENT {meta.build}</span>}
    </header>
    {!meta ? <Status error={error} retry={retry} /> : <>
      <p style={note}>Stillness reference data · {meta.counts.items} official item types · {meta.counts.eventTypes} client event definitions · snapshot {meta.extractedAt.slice(0,10)}</p>
      <nav aria-label="Game Data sections" style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>{TABS.map(([id,label]) => <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} style={{ ...control, cursor: "pointer", borderBottom: `2px solid ${tab === id ? ACCENT : "transparent"}`, color: tab === id ? "#ffb58b" : TEXT }}>{label}</button>)}</nav>
      {tab === "items" && <ItemsView meta={meta} />}
      {tab === "strings" && <StringsView meta={meta} />}
      {tab === "events" && <EventsView meta={meta} />}
      {tab === "changes" && <ChangesView />}
      {tab === "sources" && <SourcesView meta={meta} />}
    </>}
  </div>;
}
