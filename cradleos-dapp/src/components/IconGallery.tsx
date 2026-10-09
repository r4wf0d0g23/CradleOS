import { useMemo, useState } from "react";
import { GAME_ICON_BASE, iconAssetUrl, useGameIcons } from "../lib/gameIcons";
import { GameIcon } from "./GameIcon";

export function IconGallery() {
  const { data, error, retry } = useGameIcons();
  const [group, setGroup] = useState("items");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(48);
  const matches = useMemo(() => {
    if (!data) return [];
    const rows = group === "items" ? Object.entries(data.types).map(([key, x]) => ({ key, name: x.name, asset: x.asset, source: x.source,
      detail: `Type ${key} · ${x.apiPublished ? "API-published" : "Recipe-linked client definition"}${x.asset ? "" : " · " + x.reason}` })) :
      Object.entries(group === "ui" ? data.ui : data.library).map(([key, x]) => ({ key, name: key, asset: x.asset, source: x.source, detail: "Source artwork" }));
    const q = query.trim().toLowerCase();
    return rows.filter(x => !q || `${x.key} ${x.name} ${x.source ?? ""}`.toLowerCase().includes(q));
  }, [data, group, query]);
  if (!data) return <section className="icon-gallery"><p role="status">{error ? `Icon pack unavailable: ${error}` : "Loading current-client icons…"}</p>{error && <button onClick={retry}>Retry icon pack</button>}</section>;
  return <section className="icon-gallery" aria-label="Current-client icon pack">
    <h3>Current-client icon pack</h3>
    <p>{data.counts.resolved} of {data.counts.types} item references · {data.counts.ui} UI symbols · {data.counts.library} Frontier source-art entries · {data.counts.assets} unique PNGs.</p>
    <p>Stillness · Build {data.build}</p>
    <p><a href={`${GAME_ICON_BASE}/cradleos-icons-cycle7-3573151.zip`} download>Download icon pack</a> · <a href={`${GAME_ICON_BASE}/manifest.json`} target="_blank" rel="noreferrer">ID index</a> · <a href={`${GAME_ICON_BASE}/provenance.json`} target="_blank" rel="noreferrer">Source hashes</a> · <a href={`${GAME_ICON_BASE}/NOTICE.txt`} target="_blank" rel="noreferrer">Artwork attribution</a></p>
    <p> <a href="https://cradleos.io/api/icons?name=D1%20Fuel" target="_blank" rel="noreferrer">Name-search API</a> · <a href="https://cradleos.io/data/icon-api.md" target="_blank" rel="noreferrer">API documentation</a> · <a href="https://cradleos.io/data/icon-api-v1.json" target="_blank" rel="noreferrer">OpenAPI schema</a></p>
    <div className="icon-gallery-controls">
      <input aria-label="Search icons" placeholder="Item name, type ID, or resource name…" value={query} onChange={e => { setQuery(e.target.value); setLimit(48); }} />
      <select aria-label="Icon collection" value={group} onChange={e => { setGroup(e.target.value); setLimit(48); }}><option value="items">Items &amp; ships</option><option value="ui">UI symbols</option><option value="library">Frontier source art</option></select>
    </div>
    <p>{matches.length} matching entries · showing {Math.min(limit, matches.length)}</p>
    <div className="icon-gallery-grid">{matches.slice(0, limit).map(row => <article className="icon-gallery-card" key={group + row.key}>
      <GameIcon asset={row.asset} size={64} /><strong>{row.name}</strong><small>{row.detail}</small>
      {row.asset && <a href={iconAssetUrl(row.asset)!} target="_blank" rel="noreferrer">Open original PNG</a>}
      {row.source && <details><summary>Source resource</summary><small>{row.source}</small></details>}
    </article>)}</div>
    {!matches.length && <p>No matching icons.</p>}
    {limit < matches.length && <div className="icon-gallery-controls"><button onClick={() => setLimit(n => n + 48)}>Show more icons</button></div>}
  </section>;
}
