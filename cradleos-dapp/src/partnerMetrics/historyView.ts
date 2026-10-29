import {
  HISTORY_SOURCE,
  HISTORY_MAX_AGE,
  parseHistory,
  freshHistory,
  historyCsv,
  type HistorySnapshot,
} from "./history";
const el = (id: string) => document.getElementById(id)!;
const text = (id: string, s: string) => {
  el(id).textContent = s;
};
let report: HistorySnapshot | null = null,
  working = false,
  expiry: ReturnType<typeof setTimeout>;
function unavailable() {
  report = null;
  text("history-status", "Unavailable");
  text("website-status", "Unavailable");
  text("pageviews", "—");
  text("visits", "—");
  text("website-window", "—");
  text("history-updated", "—");
  el("cycle-history").replaceChildren();
  for (const id of ["history-json", "history-csv"])
    (el(id) as HTMLButtonElement).disabled = true;
}
function render(s: HistorySnapshot) {
  text(
    "website-status",
    s.website.status === "current" ? "Cloudflare" : "Unavailable",
  );
  text("pageviews", s.website.page_views?.toLocaleString() ?? "—");
  text("visits", s.website.visits?.toLocaleString() ?? "—");
  text(
    "website-window",
    s.website.window_start.slice(0, 10) +
      " → " +
      s.website.window_end.slice(0, 10),
  );
  text(
    "history-updated",
    s.generated_at.replace("T", " ").replace(/\.\d+Z$/, " UTC"),
  );
  text("history-status", "Partial coverage");
  el("cycle-history").replaceChildren(
    ...s.cycles.map((c) => {
      const card = document.createElement("article");
      card.className = "metric cycle-metric";
      const add = (tag: string, value: string) => {
        const e = document.createElement(tag);
        e.textContent = value;
        card.append(e);
        return e;
      };
      add("h3", `Cycle ${c.cycle} · ${c.name}`);
      add(
        "span",
        `${c.start.slice(0, 10)} → ${c.end ? new Date(Date.parse(c.end) - 86400000).toISOString().slice(0, 10) : "Current"}`,
      );
      add(
        "strong",
        (
          c.archived_wallets ??
          c.verified_union_wallets ??
          c.verified_sign_in_wallets
        )?.toLocaleString() ?? "—",
      );
      add(
        "span",
        c.cycle === 7
          ? c.verified_union_wallets === null
            ? "Recorded verified sign-ins"
            : "Recorded verified wallets"
          : "Archived observed wallets",
      );
      if (c.cycle === 7) {
        add(
          "p",
          `${c.verified_sign_in_wallets} signed in · ${c.recorded_chain_wallets ?? "—"} on-chain`,
        );
        if (c.status === "chain_unavailable")
          add(
            "p",
            c.chain_indexed_at
              ? "Chain snapshot · " + c.chain_indexed_at.slice(11, 16) + " UTC"
              : "Chain update unavailable",
          );
      } else add("p", "Verified sign-ins: Not recorded");
      add(
        "p",
        c.first_observed
          ? `Observed ${c.first_observed.slice(0, 10)} → ${c.last_observed!.slice(0, 10)}`
          : "Observations unavailable",
      );
      add("span", c.scope);
      return card;
    }),
  );
  for (const id of ["history-json", "history-csv"])
    (el(id) as HTMLButtonElement).disabled = false;
}
function current() {
  if (!report) return null;
  try {
    report = freshHistory(report);
    return report;
  } catch {
    unavailable();
    return null;
  }
}
async function refresh() {
  if (working) return;
  working = true;
  (el("history-refresh") as HTMLButtonElement).disabled = true;
  try {
    const r = await fetch(HISTORY_SOURCE, {
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw Error();
    report = parseHistory(await r.json());
    render(report);
    clearTimeout(expiry);
    expiry = setTimeout(
      unavailable,
      Math.max(
        0,
        Date.parse(report.generated_at) + HISTORY_MAX_AGE - Date.now() + 1,
      ),
    );
  } catch {
    unavailable();
  } finally {
    working = false;
    (el("history-refresh") as HTMLButtonElement).disabled = false;
  }
}
for (const ext of ["json", "csv"])
  el("history-" + ext).addEventListener("click", () => {
    const s = current();
    if (!s) return;
    const content = ext === "json" ? JSON.stringify(s, null, 2) : historyCsv(s),
      url = URL.createObjectURL(
        new Blob([content], {
          type: ext === "json" ? "application/json" : "text/csv;charset=utf-8",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `cradleos-website-wallet-cycles-${s.generated_at.replace(/[:.]/g, "-")}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
el("history-refresh").addEventListener("click", () => void refresh());
window.addEventListener("beforeprint", () => {
  const s = current();
  if (s) render(s);
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    current();
    void refresh();
  }
});
window.addEventListener("pageshow", () => {
  current();
  void refresh();
});
setInterval(() => {
  if (!document.hidden) void refresh();
}, 60000);
void refresh();
