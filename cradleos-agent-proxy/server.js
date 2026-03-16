/**
 * CradleOS Agent Proxy
 * 
 * OpenAI-compatible proxy in front of local Nemotron3-Super vLLM instance.
 * - Rate limiting per IP
 * - System prompt injection (EVE Frontier + Sui context)
 * - Training data logging (query + context + response pairs)
 * - Read-only enforcement (no transaction signing, no private keys)
 * - Optional API key auth for custom endpoint users
 */

import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 4403;
const UPSTREAM = process.env.UPSTREAM || "http://localhost:8001";
const API_KEY = process.env.CRADLEOS_AGENT_KEY || null; // optional auth
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, "training_logs");
const MAX_RPM = parseInt(process.env.MAX_RPM || "20"); // requests per minute per IP

// ── Training log directory ────────────────────────────────────────────────────
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function logTrainingSample(ip, messages, response, contextSnapshot) {
  const sample = {
    ts: new Date().toISOString(),
    ip: ip.replace(/[.:]/g, "_"),
    messages,
    response,
    context: contextSnapshot,
    quality: null, // filled later via feedback endpoint
  };
  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(LOG_DIR, `${date}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(sample) + "\n");
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Reality Anchor, the CradleOS tactical intelligence agent for EVE Frontier.

CAPABILITIES:
- Read and analyze on-chain state: tribe vaults, defense policies, structure status, gate access, cargo contracts, bounties, ship fitting
- Understand EVE Frontier game mechanics: structures, fuel, jump mechanics, turrets, gates, tribe relations
- Understand Sui Move smart contracts and the CradleOS contract suite deployed on Sui testnet
- Provide tactical analysis, fleet composition advice, infrastructure recommendations, and economic insights

CONSTRAINTS (READ-ONLY):
- You cannot sign transactions, move funds, or change on-chain state
- You cannot access private keys, mnemonics, or any sensitive wallet data
- You do not have access to information not provided in the context
- If asked to perform an action, explain what transaction a human would need to sign instead

KNOWLEDGE BASE:
- CradleOS contracts: TribeVault, TribeDefensePolicy, TurretDelegation, GatePolicy, TribeRoles, CargoContract, SRPPolicy, BountyBoard, AnnouncementBoard
- EVE Frontier world: Stillness server, tribe IDs, structure types (Network Node, Smart Gate, SSU, Turret, Assembly)
- Sui testnet: CRADLEOS_PKG at 0x036c2c..., WORLD_PKG_STILLNESS at 0x28b497..., WORLD_PKG_UTOPIA at 0xd12a70...

When context data is provided in the message, use it. When it is not, say so clearly and advise the user to open CradleOS to provide it.`;

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "2mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60_000,
  max: MAX_RPM,
  message: { error: "Rate limit exceeded. Max " + MAX_RPM + " requests/min." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Optional API key auth
app.use((req, res, next) => {
  if (!API_KEY) return next();
  const key = req.headers["authorization"]?.replace("Bearer ", "");
  if (key !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
});

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Health
app.get("/health", (req, res) => res.json({ status: "ok", model: "nemotron3-super", upstream: UPSTREAM }));

// Model list passthrough
app.get("/v1/models", async (req, res) => {
  try {
    const r = await fetch(`${UPSTREAM}/v1/models`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(503).json({ error: "Upstream unavailable" });
  }
});

// Chat completions — inject system prompt + log
app.post("/v1/chat/completions", async (req, res) => {
  const body = req.body;
  const ip = req.ip || req.connection?.remoteAddress || "unknown";

  // Inject system prompt if not already present
  if (!body.messages?.find(m => m.role === "system")) {
    body.messages = [{ role: "system", content: SYSTEM_PROMPT }, ...(body.messages || [])];
  }

  // Extract context snapshot from user messages for logging
  const contextSnapshot = body.messages
    .filter(m => m.role === "user")
    .map(m => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
    .join("\n")
    .slice(0, 2000);

  // Forward to upstream
  try {
    const upstreamRes = await fetch(`${UPSTREAM}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await upstreamRes.json();

    // Log training sample
    try {
      const responseText = data.choices?.[0]?.message?.content || "";
      logTrainingSample(ip, body.messages.slice(1), responseText, contextSnapshot);
    } catch { /* don't fail on logging error */ }

    res.status(upstreamRes.status).json(data);
  } catch (e) {
    res.status(503).json({ error: "Upstream unavailable", detail: e.message });
  }
});

// Feedback endpoint — quality labels for training
app.post("/v1/feedback", (req, res) => {
  const { date, index, quality } = req.body;
  if (!date || typeof index !== "number" || typeof quality !== "number") {
    return res.status(400).json({ error: "Need date, index, quality" });
  }
  // TODO: update the JSONL file at the given index
  // For now just append a feedback record
  const file = path.join(LOG_DIR, `${date}.jsonl`);
  fs.appendFileSync(file, JSON.stringify({ feedback: true, index, quality, ts: new Date().toISOString() }) + "\n");
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`CradleOS Agent Proxy running on :${PORT}`);
  console.log(`Upstream: ${UPSTREAM}`);
  console.log(`Rate limit: ${MAX_RPM} req/min per IP`);
  console.log(`Training logs: ${LOG_DIR}`);
  console.log(`Auth: ${API_KEY ? "enabled" : "disabled (open)"}`);
});
