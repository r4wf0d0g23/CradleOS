import { parseActivity } from "../lib/activityTelemetry";
import {
  RELEASES,
  REPORT_URL,
  SOURCE_URL,
  SOURCE_BRANCH,
  TRACKED_CONTRACTS,
} from "./data";
export const DAY = 86_400_000;
export const MAX_AGE = 120_000;
export type PartnerSnapshot = {
  schema_version: 1;
  project: "CradleOS";
  environment: "Sui testnet · Stillness";
  cycle: 7;
  report_url: string;
  repository: string;
  source_url: string;
  generated_at: string;
  window_start: string;
  window_end: string;
  window_days: 30;
  sign_in_coverage_since: string;
  chain_indexed_at: string | null;
  chain_status: "current" | "stale" | "unavailable";
  counts: {
    verified_wallets_30d: number | null;
    signed_in_wallets_30d: number;
    onchain_wallets_30d: number | null;
    signed_in_wallets_today_utc: number;
  };
  tracked_contracts: { package_id: string; name: string }[];
  definitions: {
    unit: string;
    combined: string;
    sign_ins: string;
    onchain: string;
    operator_wallets: string;
    coverage: string;
  };
  milestone_cycles: [5, 6, 7];
  selected_releases: typeof RELEASES;
};
export function parsePartnerSnapshot(
  raw: unknown,
  now = Date.now(),
): PartnerSnapshot {
  const v = parseActivity(raw, now);
  const meta = raw as Record<string, unknown>;
  const generated = Date.parse(v.generated_at),
    since = Date.parse(v.since),
    coverage = Date.parse(v.wallet_coverage_since);
  const expected = Object.keys(TRACKED_CONTRACTS).sort();
  if (
    meta.cycle !== 7 ||
    meta.chain_id !== "4c78adac" ||
    !Array.isArray(meta.packages) ||
    meta.packages.length !== expected.length ||
    [...meta.packages].sort().some((p, i) => p !== expected[i]) ||
    Math.abs(generated - since - 30 * DAY) > 1000 ||
    coverage > generated ||
    (v.onchain_indexed_at !== null &&
      (typeof v.onchain_indexed_at !== "string" ||
        !Number.isFinite(Date.parse(v.onchain_indexed_at)) ||
        Date.parse(v.onchain_indexed_at) > generated))
  )
    throw Error("Metrics unavailable");
  // Deliberate allowlist. Never export the upstream response or arbitrary extra keys.
  const snapshot: PartnerSnapshot = {
    schema_version: 1,
    project: "CradleOS",
    environment: "Sui testnet · Stillness",
    cycle: 7,
    report_url: REPORT_URL,
    repository: SOURCE_BRANCH,
    source_url: SOURCE_URL,
    generated_at: new Date(generated).toISOString(),
    window_start: new Date(since).toISOString(),
    window_end: new Date(generated).toISOString(),
    window_days: 30,
    sign_in_coverage_since: new Date(coverage).toISOString(),
    chain_indexed_at:
      v.onchain_indexed_at === null
        ? null
        : new Date(v.onchain_indexed_at).toISOString(),
    chain_status: v.onchain_status,
    counts: {
      verified_wallets_30d: v.combined_mau,
      signed_in_wallets_30d: v.wallet_mau,
      onchain_wallets_30d: v.onchain_mau,
      signed_in_wallets_today_utc: v.wallet_dau,
    },
    tracked_contracts: expected.map((package_id) => ({
      package_id,
      name: TRACKED_CONTRACTS[package_id as keyof typeof TRACKED_CONTRACTS],
    })),
    definitions: {
      unit: "Unique wallet addresses, not people or visits.",
      combined:
        "Union of verified sign-in and tracked on-chain wallet addresses; repeat addresses count once.",
      sign_ins: "Cryptographically verified identity proofs; UTC for today.",
      onchain:
        "Successful calls to the five listed current-cycle contract packages.",
      operator_wallets: "Operator wallets are included.",
      coverage:
        "Rolling 30 days, not a full-Cycle audience total. Sign-in history starts at sign_in_coverage_since. New reward, sports and storage-access packages are not in this chain scope.",
    },
    milestone_cycles: [5, 6, 7],
    selected_releases: RELEASES.map((r) => ({ ...r })),
  };
  assertFresh(snapshot, now);
  return snapshot;
}
export function snapshotDeadline(snapshot: PartnerSnapshot): number {
  const generated = Date.parse(snapshot.generated_at);
  return Math.min(
    generated + MAX_AGE + 1,
    Math.floor(generated / DAY) * DAY + DAY,
    snapshot.chain_status === "current"
      ? Date.parse(snapshot.chain_indexed_at!) + 25 * 60_000 + 1
      : Infinity,
  );
}
export function assertFresh(snapshot: PartnerSnapshot, now = Date.now()) {
  if (
    now >= snapshotDeadline(snapshot) ||
    Date.parse(snapshot.generated_at) > now + 30_000 ||
    new Date(now).toISOString().slice(0, 10) !==
      snapshot.generated_at.slice(0, 10)
  )
    throw Error("Metrics expired");
}
export function snapshotCsv(s: PartnerSnapshot, now = Date.now()): string {
  assertFresh(s, now);
  const rows: unknown[][] = [
    ["type", "label", "value", "period_start_utc", "period_end_utc", "source"],
  ];
  for (const [key, value] of Object.entries(s.counts))
    rows.push([
      "metric",
      key,
      value ?? "Unavailable",
      key.includes("today")
        ? s.window_end.slice(0, 10) + "T00:00:00.000Z"
        : s.window_start,
      s.window_end,
      s.source_url,
    ]);
  rows.push(
    [
      "coverage",
      "sign_in_coverage_since",
      s.sign_in_coverage_since,
      "",
      "",
      s.source_url,
    ],
    ["status", "chain_status", s.chain_status, "", "", s.source_url],
    [
      "coverage",
      "chain_indexed_at",
      s.chain_indexed_at ?? "Unavailable",
      "",
      "",
      s.source_url,
    ],
  );
  for (const [key, value] of Object.entries(s.definitions))
    rows.push(["definition", key, value, "", "", s.report_url]);
  for (const c of s.tracked_contracts)
    rows.push(["contract", c.name, c.package_id, "", "", s.source_url]);
  for (const r of s.selected_releases)
    rows.push(["release", r.title, r.summary, r.date, r.date, r.source]);
  return (
    rows
      .map((row) =>
        row
          .map((value) => {
            let cell = String(value);
            if (/^[=+\-@\t\r]/.test(cell)) cell = "'" + cell;
            return '"' + cell.replace(/"/g, '""') + '"';
          })
          .join(","),
      )
      .join("\r\n") + "\r\n"
  );
}
