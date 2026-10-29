import "./style.css";
import { RELEASES, SOURCE_URL } from "./data";
import {
  assertFresh,
  snapshotDeadline,
  parsePartnerSnapshot,
  snapshotCsv,
  type PartnerSnapshot,
} from "./model";
const el = (id: string) => document.getElementById(id)!;
const text = (id: string, value: string) => {
  el(id).textContent = value;
};
const utc = (date: string) =>
  new Date(date)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "");
for (const r of RELEASES) {
  const li = document.createElement("li"),
    date = document.createElement("time"),
    body = document.createElement("div"),
    title = document.createElement("h3"),
    summary = document.createElement("p"),
    links = document.createElement("div");
  date.dateTime = r.date;
  date.textContent = r.date;
  title.textContent = r.title;
  summary.textContent = r.summary;
  links.className = "release-links";
  for (const [label, href] of [
    ["Source ↗", r.source],
    ["Release record ↗", r.evidence],
  ]) {
    const a = document.createElement("a");
    a.textContent = label;
    a.href = href;
    a.rel = "noreferrer";
    links.append(a);
  }
  body.append(title, summary, links);
  li.append(date, body);
  el("releases").append(li);
}
let snapshot: PartnerSnapshot | null = null,
  controller: AbortController | null = null,
  timer: ReturnType<typeof setTimeout> | undefined,
  expiry: ReturnType<typeof setTimeout> | undefined;
function clear(status: string) {
  snapshot = null;
  for (const id of [
    "combined",
    "signins",
    "onchain",
    "today",
    "window",
    "coverage",
    "indexed",
    "updated",
  ])
    text(id, "—");
  text("metrics-status", status);
  for (const id of ["json", "csv"])
    (el(id) as HTMLButtonElement).disabled = true;
}
function render(s: PartnerSnapshot) {
  const count = (value: number | null) =>
    value === null ? "—" : value.toLocaleString();
  text("combined", count(s.counts.verified_wallets_30d));
  text("signins", count(s.counts.signed_in_wallets_30d));
  text("onchain", count(s.counts.onchain_wallets_30d));
  text("today", count(s.counts.signed_in_wallets_today_utc));
  text(
    "window",
    `${s.window_start.slice(0, 10)} → ${s.window_end.slice(0, 10)}`,
  );
  text("coverage", utc(s.sign_in_coverage_since));
  text("indexed", s.chain_indexed_at ? utc(s.chain_indexed_at) : "Unavailable");
  text("updated", utc(s.generated_at));
  text(
    "metrics-status",
    s.chain_status === "current"
      ? "Current"
      : s.chain_status === "stale"
        ? "Chain stale"
        : "Chain unavailable",
  );
  for (const id of ["json", "csv"])
    (el(id) as HTMLButtonElement).disabled = false;
}
async function refresh() {
  if (controller) return;
  clearTimeout(timer);
  controller = new AbortController();
  const own = controller;
  const timeout = setTimeout(() => own.abort(), 12_000);
  (el("refresh") as HTMLButtonElement).disabled = true;
  if (!snapshot) text("metrics-status", "Loading");
  try {
    const response = await fetch(SOURCE_URL, {
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: own.signal,
    });
    if (!response.ok) throw Error("Unavailable");
    const s = parsePartnerSnapshot(await response.json());
    snapshot = s;
    render(s);
    clearTimeout(expiry);
    expiry = setTimeout(
      () => clear("Expired"),
      Math.max(0, snapshotDeadline(s) - Date.now()),
    );
  } catch {
    clearTimeout(expiry);
    clear("Unavailable");
  } finally {
    clearTimeout(timeout);
    controller = null;
    (el("refresh") as HTMLButtonElement).disabled = false;
    timer = setTimeout(() => {
      if (!document.hidden) void refresh();
    }, 60_000);
  }
}
function fresh() {
  if (!snapshot) return null;
  try {
    assertFresh(snapshot);
    return snapshot;
  } catch {
    clear("Expired");
    return null;
  }
}
function download(format: "json" | "csv") {
  const s = fresh();
  if (!s) return;
  const content =
    format === "json" ? JSON.stringify(s, null, 2) + "\n" : snapshotCsv(s);
  const url = URL.createObjectURL(
      new Blob([content], {
        type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
      }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = `cradleos-partner-metrics-${s.generated_at.replace(/[:.]/g, "-")}.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
el("refresh").addEventListener("click", () => void refresh());
el("json").addEventListener("click", () => download("json"));
el("csv").addEventListener("click", () => download("csv"));
el("print").addEventListener("click", () => {
  fresh();
  window.print();
});
window.addEventListener("beforeprint", () => {
  fresh();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    fresh();
    void refresh();
  }
});
window.addEventListener("pageshow", () => {
  fresh();
  void refresh();
});
void refresh();
