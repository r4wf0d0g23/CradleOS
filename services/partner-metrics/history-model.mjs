// Generated from cradleos-dapp/src/partnerMetrics/history.ts; regenerate with esbuild. Shared API-boundary allowlist.
const HISTORY_SOURCE = "https://keeper.reapers.shop/telemetry/history";
const HISTORY_MAX_AGE = 2 * 36e5;
const CYCLES = [
  {
    cycle: 5,
    name: "Shroud of Fear",
    start: "2026-03-11T00:00:00.000Z",
    end: "2026-06-25T00:00:00.000Z"
  },
  {
    cycle: 6,
    name: "Sanctuary",
    start: "2026-06-25T00:00:00.000Z",
    end: "2026-09-29T00:00:00.000Z"
  },
  { cycle: 7, name: "Vestiges", start: "2026-09-29T00:00:00.000Z", end: null }
];
const unavailable = () => {
  throw Error("History unavailable");
};
const obj = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : unavailable();
const count = (v) => v === null ? null : Number.isSafeInteger(v) && v >= 0 ? v : unavailable();
const date = (v) => typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : unavailable();
const nullableDate = (v) => v === null ? null : date(v);
function parseHistory(raw, now = Date.now()) {
  const r = obj(raw), generated = date(r.generated_at);
  if (r.schema_version !== 1 || now - Date.parse(generated) > HISTORY_MAX_AGE || Date.parse(generated) > now + 3e4 || !Array.isArray(r.cycles) || r.cycles.length !== 3)
    unavailable();
  const w = obj(r.website), start = date(w.window_start), end = date(w.window_end), collected = date(w.collected_at);
  if (w.source !== "Cloudflare Web Analytics" || w.host !== "cradleos.io" || w.sampling !== "adaptive" || !["current", "unavailable"].includes(w.status) || Date.parse(end) - Date.parse(start) !== 30 * 864e5 || end !== collected || collected !== generated || date(w.site_since) !== "2026-07-06T01:42:43.766Z")
    unavailable();
  const visits = count(w.visits), pageViews = count(w.page_views);
  if (w.status === "current" ? visits === null || pageViews === null || visits > pageViews : visits !== null || pageViews !== null)
    unavailable();
  const website = {
    source: "Cloudflare Web Analytics",
    host: "cradleos.io",
    window_start: start,
    window_end: end,
    collected_at: collected,
    site_since: "2026-07-06T01:42:43.766Z",
    sampling: "adaptive",
    status: w.status,
    visits,
    page_views: pageViews
  };
  const cycles = CYCLES.map((expected, i) => {
    const c = obj(r.cycles[i]);
    if (c.cycle !== expected.cycle || c.start !== expected.start || c.end !== expected.end || c.name !== expected.name || c.coverage !== "partial" || date(c.collected_at) !== generated)
      unavailable();
    const current = c.cycle === 7, archived = count(c.archived_wallets), signed = count(c.verified_sign_in_wallets), chain = count(c.recorded_chain_wallets), union = count(c.verified_union_wallets);
    if (current ? archived !== null || signed === null || (chain === null ? union !== null || c.status !== "chain_unavailable" : union === null || union < Math.max(signed, chain) || union > signed + chain) || !["current", "chain_unavailable"].includes(c.status) : signed !== null || chain !== null || union !== null || c.status !== "archive")
      unavailable();
    const first = nullableDate(c.first_observed), last = nullableDate(c.last_observed), since = nullableDate(c.sign_in_since), indexed = nullableDate(c.chain_indexed_at);
    const n = current ? union ?? signed : archived;
    if (first === null !== (last === null) || n !== null && n > 0 && !first || first && (Date.parse(first) < Date.parse(c.start) || Date.parse(first) > Date.parse(last) || Date.parse(last) > Date.parse(generated) || c.end && Date.parse(last) >= Date.parse(c.end)))
      unavailable();
    if (current ? !since || Date.parse(since) < Date.parse(c.start) || Date.parse(since) > Date.parse(generated) || c.status === "current" && !indexed : since !== null || indexed !== null)
      unavailable();
    if (indexed && Date.parse(indexed) > Date.parse(generated)) unavailable();
    return {
      ...expected,
      coverage: "partial",
      status: current && indexed && now - Date.parse(indexed) > 25 * 6e4 ? "chain_unavailable" : c.status,
      archived_wallets: archived,
      verified_sign_in_wallets: signed,
      recorded_chain_wallets: chain,
      verified_union_wallets: union,
      first_observed: first,
      last_observed: last,
      sign_in_since: since,
      chain_indexed_at: indexed,
      collected_at: generated,
      source: current ? "Verified proof and transaction observations" : "Archived event-sender observations",
      scope: current ? "Core, turrets, casino, legacy storage, voting" : "Legacy core packages"
    };
  });
  return {
    schema_version: 1,
    generated_at: generated,
    source_url: HISTORY_SOURCE,
    website,
    cycles
  };
}
function freshHistory(s, now = Date.now()) {
  return parseHistory(s, now);
}
function historyCsv(s, now = Date.now()) {
  const v = freshHistory(s, now), rows = [
    [
      "type",
      "cycle",
      "metric",
      "value",
      "period_start_utc",
      "period_end_utc",
      "coverage",
      "source"
    ]
  ];
  for (const key of ["page_views", "visits"])
    rows.push([
      "website",
      "",
      key,
      v.website[key] ?? "Unavailable",
      v.website.window_start,
      v.website.window_end,
      "Adaptive estimate",
      v.website.source
    ]);
  for (const c of v.cycles) {
    for (const key of [
      "archived_wallets",
      "verified_sign_in_wallets",
      "recorded_chain_wallets",
      "verified_union_wallets"
    ])
      rows.push([
        "wallets",
        c.cycle,
        key,
        c[key] ?? "Unavailable",
        c.start,
        c.end ?? c.collected_at,
        c.coverage,
        c.source
      ]);
    rows.push([
      "coverage",
      c.cycle,
      "observed_range",
      "",
      c.first_observed ?? "",
      c.last_observed ?? "",
      c.status,
      c.scope
    ]);
    if (c.sign_in_since)
      rows.push([
        "coverage",
        c.cycle,
        "sign_in_since",
        c.sign_in_since,
        "",
        "",
        "partial",
        c.source
      ]);
  }
  return rows.map(
    (r) => r.map((v2) => {
      let x = String(v2);
      if (/^[=+\-@\t\r]/.test(x)) x = "'" + x;
      return '"' + x.replace(/"/g, '""') + '"';
    }).join(",")
  ).join("\r\n") + "\r\n";
}
export {
  CYCLES,
  HISTORY_MAX_AGE,
  HISTORY_SOURCE,
  freshHistory,
  historyCsv,
  parseHistory
};
