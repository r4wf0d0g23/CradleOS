export type ActivityTelemetry = {
  schema_version: 2;
  metric: "verified_wallets";
  window_days: 30;
  since: string;
  generated_at: string;
  wallet_mau: number;
  wallet_dau: number;
  onchain_mau: number | null;
  combined_mau: number | null;
  wallet_coverage_since: string;
  onchain_status: "current" | "stale" | "unavailable";
  onchain_indexed_at: string | null;
};

export function parseActivity(value: unknown, now = Date.now()): ActivityTelemetry {
  if (!value || typeof value !== "object") throw new Error("Invalid activity response");
  const v = value as ActivityTelemetry;
  const count = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  const date = (s: unknown): s is string => typeof s === "string" && Number.isFinite(Date.parse(s));
  if (v.schema_version !== 2 || v.metric !== "verified_wallets" || v.window_days !== 30 ||
      !count(v.wallet_mau) || !count(v.wallet_dau) || v.wallet_dau > v.wallet_mau ||
      !date(v.since) || !date(v.generated_at) || !date(v.wallet_coverage_since) ||
      Date.parse(v.generated_at) > now + 30_000 || now - Date.parse(v.generated_at) > 120_000 ||
      !["current", "stale", "unavailable"].includes(v.onchain_status)) throw new Error("Invalid activity response");
  if (v.onchain_status === "current") {
    if (!count(v.onchain_mau) || !count(v.combined_mau) ||
        v.combined_mau < Math.max(v.wallet_mau, v.onchain_mau) || v.combined_mau > v.wallet_mau + v.onchain_mau ||
        !date(v.onchain_indexed_at) || now - Date.parse(v.onchain_indexed_at) > 25 * 60_000 || Date.parse(v.onchain_indexed_at) > now + 30_000)
      throw new Error("Incomplete activity response");
  } else if (v.onchain_mau !== null || v.combined_mau !== null) throw new Error("Uncertain count presented as complete");
  return v;
}
