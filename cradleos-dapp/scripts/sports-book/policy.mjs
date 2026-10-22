import { sha, SOURCE } from "./polymarket.mjs";
export function readTerms(f) {
  const t = JSON.parse(f.terms_json);
  if (
    sha(t) !== Buffer.from(f.terms_hash, "base64").toString("hex") ||
    t.adapter !== 1 ||
    t.chain !== 137 ||
    t.ctf !== SOURCE.ctf ||
    t.oracle !== SOURCE.oracle ||
    t.version !== "v1" ||
    t.collateral !== SOURCE.collateral ||
    !["nba", "nfl"].includes(t.league) ||
    t.league !== (Number(f.league) === 1 ? "nba" : "nfl") ||
    t.labels?.[0] !== f.label_a ||
    t.labels?.[1] !== f.label_b ||
    t.marketId !== f.source_market ||
    t.condition !== "0x" + Buffer.from(f.condition, "base64").toString("hex") ||
    t.start !== Number(f.starts) ||
    t.cutoff !== t.start - 300 ||
    t.cutoff !== Number(f.cutoff) ||
    t.deadline !== t.start + 172800 ||
    t.deadline !== Number(f.proof_deadline) ||
    t.hold !== 7200
  )
    throw Error("FROZEN_TERMS");
  return t;
}
export function actionFor(f, ss, now) {
  if (Number(f.result) !== 0 || now >= Number(f.proof_deadline)) return null;
  if (ss.invalid) return "invalidate";
  if (now < (ss.next || 0)) return null;
  const start = Number(f.starts),
    cutoff = Number(f.cutoff),
    cand = Number(f.candidate);
  if (now < start - 900) return null;
  if (now <= cutoff + 60) return "preflight";
  if (cand) return now >= Number(f.candidate_at) + 7260 ? "confirm" : null;
  return now >= start + 10800 ? "result" : null;
}

export function retryAt(now, cutoff, failures) {
  return (
    now + (now < cutoff ? 60 : Math.min(3600, 600 * Math.max(1, failures)))
  );
}
