/** Keeper was retired by the operator on 2026-10-03.
 * Mount BEFORE body parsing, rate limiting, and all legacy handlers. This keeps
 * old clients from invoking inference, OCR, submissions, or training feedback.
 * The same process still serves telemetry, shared images, and war summaries.
 */
export function isRetiredKeeperPath(path) {
  return /^\/(?:keeper|v1|queue|rag|submissions)(?:\/|$)/i.test(path);
}

export function retireKeeper(req, res, next) {
  if (!isRetiredKeeperPath(req.path)) return next();
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return res.status(410).json({ error: "Keeper has been retired.", code: "KEEPER_RETIRED" });
}
