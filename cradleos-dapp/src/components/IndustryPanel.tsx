import { useEffect, useMemo, useRef, useState } from "react";
import { GAME_DATA_BASE, validateNativeSnapshot, type NativeSnapshot, type NativeRecipe } from "../lib/gameData";
import { materialListText, planRecipe, producersFor, type MaterialLine, type RouteChoices } from "../lib/recipePlanner";
import "./RecipePlanner.css";
import { ItemIcon, ClientUIIcon } from "./GameIcon";

const number = (n: number) => n.toLocaleString();
function batchLabel(data: NativeSnapshot, recipe: NativeRecipe): string {
  return `#${recipe.id} · ${recipe.inputs.map(x => `${x.quantity} ${data.types[x.typeID].name}`).join(" + ")}`;
}
function Lines({ data, lines }: { data: NativeSnapshot; lines: MaterialLine[] }) {
  return <ul className="recipe-lines">{lines.map(x => <li key={x.typeID}>
    <strong className="icon-label"><ItemIcon typeId={x.typeID} size={28} /><span>{number(x.quantity)} × {data.types[x.typeID].name}</span></strong>
    <small>Type {x.typeID}{!data.types[x.typeID].apiPublished && " · client-only definition"}</small>
  </li>)}</ul>;
}

function Planner({ data }: { data: NativeSnapshot }) {
  const producers = useMemo(() => producersFor(data), [data]);
  const products = useMemo(() => [...producers.keys()].map(id => data.types[id])
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id), [data, producers]);
  const categories = useMemo(() => [...new Set(products.map(x => x.category || "Client-only"))].sort(), [products]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [shown, setShown] = useState(40);
  const [target, setTarget] = useState<number | null>(null);
  const [rootID, setRootID] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [mode, setMode] = useState<"direct" | "chain">("direct");
  const [choices, setChoices] = useState<RouteChoices>({});
  const [copied, setCopied] = useState("");
  const currentCopy = useRef("");
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(x => (category === "All" || (x.category || "Client-only") === category) &&
      (!q || String(x.id) === q || `${x.name} ${x.group ?? ""}`.toLowerCase().includes(q)));
  }, [products, search, category]);
  const options = target === null ? [] : producers.get(target) ?? [];
  const recipe = options.find(r => r.id === rootID);
  const calculation = useMemo(() => {
    if (target === null || rootID === null) return { plan: null, error: "" };
    try {
      if (!/^\d+$/.test(quantity) || Number(quantity) <= 0 || !Number.isSafeInteger(Number(quantity))) {
        throw new Error("Enter a positive whole number.");
      }
      return { plan: planRecipe(data, target, Number(quantity), rootID, mode, choices), error: "" };
    } catch (e) { return { plan: null, error: e instanceof Error ? e.message : String(e) }; }
  }, [data, target, rootID, quantity, mode, choices]);
  const plan = calculation.plan;
  const copyText = plan?.status === "ready" ? materialListText(data, plan) : "";
  currentCopy.current = copyText;
  useEffect(() => { setCopied(""); }, [copyText]);
  const rootJob = plan?.jobs.find(j => j.recipeID === rootID);
  const rootOutput = rootJob?.outputs.find(x => x.typeID === target);
  const surplus = plan?.jobs.flatMap(job => job.outputs.filter(x => x.surplus > 0).map(x => ({ ...x, recipeID: job.recipeID }))) ?? [];
  function select(id: number) {
    setTarget(id); setRootID(producers.get(id)?.length === 1 ? producers.get(id)![0].id : null);
    setChoices({}); setCopied("");
  }
  async function copy() {
    if (!copyText) return;
    const requestedText = copyText;
    try {
      await navigator.clipboard.writeText(requestedText);
      if (currentCopy.current === requestedText) setCopied("Material list copied.");
    } catch { if (currentCopy.current === requestedText) setCopied("Clipboard unavailable · Use text version"); }
  }
  return <div className="recipe-planner">
    <header className="recipe-header">
      <div><div className="recipe-eyebrow">CYCLE 7 · VESTIGES · CLIENT {data.build}</div><h2><ClientUIIcon name="gameplay/manufacturing_32px" size={24} /> Recipes &amp; Materials</h2>
        </div>
      <div className="recipe-count"><strong>{data.counts.recipes}</strong> recipes <span>·</span> <strong>{products.length}</strong> products</div>
    </header>
    <p className="recipe-muted">Base quantities · Whole batches · Zero starting inventory</p>
    <div className="recipe-layout">
      <aside className="recipe-catalog" aria-label="Recipe product catalog">
        <label htmlFor="recipe-search">Find a product</label>
        <input id="recipe-search" aria-label="Search recipe products" placeholder="Name, type ID, or group…" value={search} onChange={e => { setSearch(e.target.value); setShown(40); }} />
        <label htmlFor="recipe-category">Category</label>
        <select id="recipe-category" value={category} onChange={e => { setCategory(e.target.value); setShown(40); }}>
          <option>All</option>{categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <p className="recipe-muted">{matches.length} matching products</p>
        <div className="recipe-product-list">{matches.slice(0, shown).map(item => <button key={item.id} className={`recipe-product${target === item.id ? " selected" : ""}`} aria-pressed={target === item.id} onClick={() => select(item.id)}>
          <strong className="icon-label"><ItemIcon typeId={item.id} /><span>{item.name}</span></strong><small>Type {item.id} · {producers.get(item.id)!.length} recipe{producers.get(item.id)!.length === 1 ? "" : "s"}</small>
          {!item.apiPublished && <small>Client-only reference</small>}
        </button>)}</div>
        {!matches.length && <p>No matching products.</p>}
        {shown < matches.length && <button onClick={() => setShown(n => n + 40)}>Show more products</button>}
      </aside>
      <section className="recipe-workspace" aria-label="Recipe plan">
        {target === null ? <div className="recipe-empty"><h3>Select a product</h3><button className="recipe-primary" onClick={() => { setSearch("88335"); setCategory("All"); select(88335); }}>Try D1 Fuel</button></div> : <>
          <section className="recipe-card">
            <h3><span className="icon-label"><ItemIcon typeId={target} size={48} /><span>{data.types[target].name}</span></span> <small>Type {target}</small></h3>
            <div className="recipe-controls">
              <div><label htmlFor="root-recipe">Recipe route</label>
                <select id="root-recipe" value={rootID ?? ""} onChange={e => { setRootID(e.target.value ? Number(e.target.value) : null); setChoices({}); }}>
                  <option value="">Choose one of {options.length} recipes</option>{options.map(r => <option key={r.id} value={r.id}>{batchLabel(data, r)}</option>)}
                </select>
              </div>
              <div><label htmlFor="recipe-quantity">Units wanted</label><input id="recipe-quantity" inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
            </div>
            {!recipe && <p className="recipe-muted">Select a recipe route.</p>}
            {recipe && <>
              <div className="recipe-two-column recipe-one-batch"><div><h4>Inputs per batch</h4><Lines data={data} lines={recipe.inputs} /></div><div><h4>Outputs per batch</h4><Lines data={data} lines={recipe.outputs} /></div></div>
              <details className="recipe-source"><summary>Recipe #{recipe.id} · source details</summary><p>Raw runtime: {recipe.runTime} · Unit unverified · Type {recipe.primaryTypeID}</p>
                {data.patchChecks.filter(x => x.recipeID === recipe.id).map(x => <p key={x.recipeID}><a href={x.url} target="_blank" rel="noreferrer">Official patch check</a>: {x.fields}.</p>)}
              </details>
            </>}
          </section>
          <div className="recipe-mode" role="group" aria-label="Planning mode">
            <button aria-pressed={mode === "direct"} onClick={() => setMode("direct")}>Direct ingredients</button>
            <button aria-pressed={mode === "chain"} onClick={() => setMode("chain")}>Supply chain</button>
          </div>

          {calculation.error && <p className="recipe-alert" role="alert">{calculation.error}</p>}
          {mode === "chain" && plan && plan.routes.some(r => r.typeID !== target) && <section className="recipe-card">
            <h3>Ingredient routes</h3>
            {plan.routes.filter(r => r.typeID !== target).map(route => {
              const candidates = producers.get(route.typeID) ?? [];
              return <div className="recipe-route" key={route.typeID}>
                <label htmlFor={`route-${route.typeID}`}>{data.types[route.typeID].name}<small>Type {route.typeID}</small></label>
                {candidates.length ? <select id={`route-${route.typeID}`} value={choices[route.typeID] ?? ""} onChange={e => setChoices(old => {
                  const next = { ...old }; if (!e.target.value) delete next[route.typeID]; else next[route.typeID] = e.target.value === "acquire" ? "acquire" : Number(e.target.value); return next;
                })}>
                  <option value="">{candidates.length === 1 ? `Automatic · recipe #${candidates[0].id}` : "Choose a recipe or acquire"}</option>
                  <option value="acquire">Acquire externally</option>
                  {candidates.map(r => <option key={r.id} value={r.id}>{batchLabel(data, r)}</option>)}
                </select> : <span className="recipe-muted">Acquire · no producer in this snapshot</span>}
              </div>;
            })}
          </section>}
          {plan?.status === "cycle" && <p role="alert" className="recipe-alert">Production loop · Change route or acquire externally · Recipes: {plan.cycleRecipes.join(", ")}.</p>}
          {plan?.status === "needs-routes" && <p role="alert" className="recipe-alert">Plan incomplete · {plan.required.filter(x => x.reason === "choice").length} ingredient route(s) required</p>}
          {rootJob && rootOutput && <div className="recipe-metrics" aria-label="Batch totals">
            <div><small>Requested</small><strong>{number(plan!.requested.quantity)}</strong></div>
            <div><small>Final recipe batches</small><strong>{number(rootJob.runs)}</strong></div>
            <div><small>Produced</small><strong>{number(rootOutput.quantity)}</strong></div>
            <div><small>Extra target units</small><strong>{number(rootOutput.surplus)}</strong></div>
          </div>}
          {plan && plan.status !== "cycle" && <>
            <section className="recipe-card" aria-label="Materials to acquire">
              <div className="recipe-section-heading"><h3>{plan.status === "ready" ? "Materials to acquire" : "Provisional material requirements"}</h3><button onClick={copy} disabled={!copyText}>Copy material list</button></div>
              <p className="recipe-muted">Gross requirements · Inventory not deducted</p>
              <ul className="recipe-lines">{plan.required.map(line => <li key={line.typeID}><strong className="icon-label"><ItemIcon typeId={line.typeID} size={28} /><span>{number(line.quantity)} × {data.types[line.typeID].name}</span></strong><small>Type {line.typeID} · {line.reason === "choice" ? "route choice required" : line.reason === "external" ? "no producer in snapshot" : "acquire externally"}</small></li>)}</ul>
              {copied && <p role="status">{copied}</p>}
              {copyText && <details><summary>Text version</summary><textarea aria-label="Material list text" readOnly value={copyText} rows={Math.min(16, plan.required.length + 6)} /></details>}
            </section>
            <section className="recipe-card"><h3>Batch plan <small>{plan.jobs.length} recipe job{plan.jobs.length === 1 ? "" : "s"}</small></h3>

              {plan.jobs.map(job => <details key={job.recipeID} className="recipe-job"><summary><strong>Recipe #{job.recipeID}</strong> · {number(job.runs)} batch{job.runs === 1 ? "" : "es"} · {job.outputs.map(x => data.types[x.typeID].name).join(" + ")}</summary>
                <div className="recipe-two-column"><div><h4>Total inputs</h4><Lines data={data} lines={job.inputs} /></div><div><h4>Total outputs</h4><Lines data={data} lines={job.outputs} /></div></div>
              </details>)}
            </section>
            <section className="recipe-card"><h3>Surplus &amp; by-products</h3>
              {!surplus.length ? <p className="recipe-muted">No surplus.</p> : <><p className="recipe-muted">Unallocated output</p><ul className="recipe-lines">{surplus.map(x => <li key={`${x.recipeID}-${x.typeID}`}><strong className="icon-label"><ItemIcon typeId={x.typeID} size={28} /><span>{number(x.surplus)} × {data.types[x.typeID].name}</span></strong><small>From recipe #{x.recipeID} · type {x.typeID}</small></li>)}</ul></>}
            </section>
          </>}
        </>}
      </section>
    </div>
    <footer className="recipe-footer">Build {data.build} · snapshot {data.extractedAt.slice(0, 10)} · <a href={`${GAME_DATA_BASE}/native-v1.json`} target="_blank" rel="noreferrer">Recipe data &amp; provenance</a> </footer>
  </div>;
}

export function IndustryPanel() {
  const [data, setData] = useState<NativeSnapshot | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    fetch(`${GAME_DATA_BASE}/native-v1.json`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(validateNativeSnapshot)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(e => { if (!controller.signal.aborted) setError(String(e.message ?? e)); });
    return () => controller.abort();
  }, [attempt]);
  if (!data) return <section className="recipe-planner"><h2><ClientUIIcon name="gameplay/manufacturing_32px" size={24} /> Recipes &amp; Materials</h2><p role="status">{error ? `Could not load current recipe data: ${error}` : "Loading verified Cycle 7 recipes…"}</p>{error && <button onClick={() => setAttempt(n => n + 1)}>Retry recipe data</button>}</section>;
  return <Planner data={data} />;
}
