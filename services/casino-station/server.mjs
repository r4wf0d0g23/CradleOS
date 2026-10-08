/** Native video gateway. Wallets, outcomes and casino ledgers never enter this service. */
import http from "node:http";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { spawn as processSpawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import {
  spawn,
  idle,
  parseInput,
  move,
  camera,
  nearestTerminal,
} from "./motion.mjs";
import { JpegFrames, H264Frames, Av1Frames } from "./frames.mjs";
const ROOT = dirname(fileURLToPath(import.meta.url)),
  IPC = resolve(process.argv[2] || "run/ipc");
const PORT = Number(process.env.STATION_PORT || 5318),
  FPS = 20,
  CAP = 2,
  LOCAL = process.env.STATION_LOCAL === "1";
const ORIGINS = new Set([
  "https://cradleos.io",
  ...(LOCAL
    ? [
        `http://127.0.0.1:${PORT}`,
        `http://localhost:${PORT}`,
        "http://127.0.0.1:5320",
      ]
    : []),
]);
await mkdir(IPC, { recursive: true, mode: 0o700 });
const sessions = new Map();
let revision = 0,
  flushing = false,
  closing = false,
  nativeAt = 0,
  lastJoin = 0;

const health = () => ({
  ready: !closing && Date.now() - nativeAt < 3000,
  capacity: CAP,
  active: sessions.size,
});
const server = http.createServer((req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (ORIGINS.has(req.headers.origin)) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "GET" && req.url === "/health") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(health()));
  } else {
    res.writeHead(404);
    res.end();
  }
});
server.headersTimeout = 5000;
server.requestTimeout = 5000;
server.keepAliveTimeout = 2000;
server.maxConnections = 32;
server.maxRequestsPerSocket = 5;
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 512,
  perMessageDeflate: false,
});
server.on("upgrade", (req, socket, head) => {
  const now = Date.now();
  if (
    !["/join", "/join?codec=h264", "/join?codec=av1"].includes(req.url) ||
    !ORIGINS.has(req.headers.origin) ||
    sessions.size >= CAP ||
    !health().ready ||
    now - lastJoin < 200
  ) {
    socket.end("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
    return;
  }
  lastJoin = now;
  wss.handleUpgrade(req, socket, head, (ws) =>
    wss.emit(
      "connection",
      ws,
      req.url.includes("h264")
        ? "h264"
        : req.url.includes("av1")
          ? "av1"
          : "jpeg",
    ),
  );
});
function dispose(s, reason = "Session closed") {
  if (s.closed) return;
  s.closed = true;
  s.ws.close(1000, reason);
  setTimeout(() => s.ws.terminate(), 300).unref();
  s.encoder.stdin.destroy();
  s.encoder.kill("SIGTERM");
  s.killTimer = setTimeout(() => {
    if (s.encoder.exitCode === null) s.encoder.kill("SIGKILL");
  }, 1500);
  s.killTimer.unref();
  // Keep the slot reserved until the OS confirms the encoder exited.
}
wss.on("connection", (ws, codec) => {
  const slots = new Set([...sessions.values()].map((s) => s.slot)),
    slot = [0, 1].find((n) => !slots.has(n));
  if (slot === undefined) {
    ws.close(1013);
    return;
  }
  const id = randomUUID(),
    now = Date.now();
  const encode =
    codec === "av1"
      ? [
          "-c:v",
          "av1_nvenc",
          "-preset",
          "p1",
          "-tune",
          "ull",
          "-level",
          "4.0",
          "-pix_fmt",
          "yuv420p",
          "-g",
          "1",
          "-bf",
          "0",
          "-rc",
          "cbr",
          "-b:v",
          "2400k",
          "-maxrate",
          "2400k",
          "-bufsize",
          "2400k",
          "-f",
          "ivf",
        ]
      : codec === "h264"
        ? [
            "-c:v",
            "h264_nvenc",
            "-preset",
            "p1",
            "-tune",
            "ull",
            "-profile:v",
            "baseline",
            "-pix_fmt",
            "yuv420p",
            "-g",
            "20",
            "-bf",
            "0",
            "-rc",
            "cbr",
            "-b:v",
            "1600k",
            "-maxrate",
            "1600k",
            "-bufsize",
            "1600k",
            "-aud",
            "1",
            "-f",
            "h264",
          ]
        : ["-c:v", "mjpeg", "-threads", "2", "-q:v", "12", "-f", "image2pipe"];
  const encoder = processSpawn(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "rawvideo",
      "-pixel_format",
      "bgra",
      "-video_size",
      "960x540",
      "-framerate",
      String(codec === "jpeg" ? 10 : FPS),
      "-i",
      "pipe:0",
      "-an",
      ...encode,
      "pipe:1",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  const s = {
    id,
    slot,
    ws,
    encoder,
    pos: spawn(),
    input: idle(),
    lastInput: now,
    lastActivity: now,
    lastOutput: now,
    lastWrite: 0,
    created: now,
    messages: 0,
    bucket: now,
    lastFrame: 0n,
    sequence: 0,
    frames: 0,
    bytes: 0,
    closed: false,
    alive: true,
    readBusy: false,
    codec,
    encodedInputs: [],
  };
  sessions.set(id, s);
  ws.send(
    JSON.stringify({
      type: "joined",
      id,
      slot,
      codec,
      width: 960,
      height: 540,
    }),
  );
  const framing =
    codec === "h264"
      ? new H264Frames()
      : codec === "av1"
        ? new Av1Frames()
        : new JpegFrames();
  let needsKey = true,
    videoCodec = null,
    pts = 0;
  encoder.stdout.on("data", (data) => {
    if (s.closed) return;
    try {
      for (const frame of framing.push(data)) {
        const appliedInput = s.encodedInputs.shift() ?? 0n;
        s.lastOutput = Date.now();
        if ((codec === "jpeg" ? frame.length : frame.data.length) > 262144) {
          dispose(s, "Video packet too large");
          return;
        }
        if (ws.bufferedAmount > 150000) {
          s.congestedAt ??= Date.now();
          if (Date.now() - s.congestedAt > 1500) {
            dispose(s, "Connection too slow for native video");
            return;
          }
        } else s.congestedAt = null;
        if (ws.readyState !== WebSocket.OPEN) continue;
        if (codec !== "jpeg") {
          pts += 50000;
          if (frame.codec) videoCodec = frame.codec;
          if (ws.bufferedAmount > 150000) {
            needsKey = true;
            continue;
          }
          if (needsKey) {
            if (!frame.key || !videoCodec) continue;
            ws.send(
              JSON.stringify({ type: "video-config", codec: videoCodec }),
            );
            needsKey = false;
          }
          const packet = Buffer.alloc(17 + frame.data.length);
          packet[0] = frame.key ? 1 : 0;
          packet.writeBigUInt64LE(BigInt(pts), 1);
          packet.writeBigUInt64LE(appliedInput, 9);
          frame.data.copy(packet, 17);
          ws.send(packet, { binary: true });
          s.frames++;
          s.bytes += packet.length;
        } else {
          if (ws.bufferedAmount > 150000) continue;
          const packet = Buffer.alloc(17 + frame.length);
          packet[0] = 1;
          packet.writeBigUInt64LE(appliedInput, 9);
          frame.copy(packet, 17);
          ws.send(packet, { binary: true });
          s.frames++;
          s.bytes += packet.length;
        }
      }
    } catch {
      dispose(s, "Video unavailable");
    }
  });
  encoder.stderr.on("data", () => {});
  encoder.on("error", () => dispose(s, "Encoder unavailable"));
  encoder.on("close", () => {
    dispose(s, "Video ended");
    clearTimeout(s.killTimer);
    sessions.delete(id);
  });
  encoder.stdin.on("error", () => dispose(s, "Encoder unavailable"));
  ws.on("pong", () => {
    s.alive = true;
  });
  ws.on("message", (data, binary) => {
    if (s.closed || binary) {
      dispose(s, "Invalid input");
      return;
    }
    const now = Date.now();
    if (now - s.bucket > 1000) {
      s.messages = 0;
      s.bucket = now;
    }
    if (++s.messages > 45) {
      dispose(s, "Input rate exceeded");
      return;
    }
    let input;
    try {
      input = parseInput(JSON.parse(data.toString()));
    } catch {}
    if (!input) {
      dispose(s, "Invalid input");
      return;
    }
    s.input = input;
    s.lastInput = now;
    s.sequence++;
    if (Object.values(input).some(Boolean)) s.lastActivity = now;
  });
  ws.on("error", () => dispose(s));
  ws.on("close", () => dispose(s));
});
async function flush() {
  if (flushing || closing) return;
  flushing = true;
  try {
    const slots = [...sessions.values()]
      .filter((s) => !s.closed)
      .map((s) => ({
        slot: s.slot,
        id: s.id,
        sequence: s.sequence,
        ...camera(s.pos),
      }));
    const next = resolve(IPC, "cameras.next");
    await writeFile(next, JSON.stringify({ revision: ++revision, slots }));
    await rename(next, resolve(IPC, "cameras.json"));
  } finally {
    flushing = false;
  }
}
let healthBusy = false;
const nativeHealth = setInterval(async () => {
  if (healthBusy) return;
  healthBusy = true;
  try {
    const h = JSON.parse(
      await readFile(resolve(IPC, "heartbeat.json"), "utf8"),
    );
    nativeAt =
      Number.isSafeInteger(h.at) && h.at <= Date.now() + 500 ? h.at : 0;
  } catch {
    nativeAt = 0;
  } finally {
    healthBusy = false;
  }
}, 500);
const tick = setInterval(() => {
  const now = Date.now();
  for (const s of sessions.values()) {
    if (s.closed) continue;
    if (!health().ready) {
      dispose(s, "Station renderer reconnecting");
      continue;
    }
    if (now - s.lastActivity > 180000 || now - s.created > 1200000) {
      dispose(s, "Session expired; rejoin to continue");
      continue;
    }
    if (now - s.lastOutput > 12000) {
      dispose(s, "Video unavailable");
      continue;
    }
    s.pos = move(s.pos, now - s.lastInput > 250 ? idle() : s.input, 1 / FPS);
    if (!s.readBusy) {
      s.readBusy = true;
      void readFile(resolve(IPC, `frame-${s.slot}.raw`))
        .then((data) => {
          if (
            s.closed ||
            data.length !== 960 * 540 * 4 + 40 ||
            Date.now() - Number(data.readBigUInt64LE(8)) > 1500
          )
            return;
          if (
            data.subarray(24, 40).toString("hex") !== s.id.replaceAll("-", "")
          )
            return;
          const seq = data.readBigUInt64LE();
          if (seq <= s.lastFrame) return;
          s.lastFrame = seq;
          if (
            s.encodedInputs.length < 4 &&
            s.encoder.stdin.writableLength < 960 * 540 * 4 &&
            (s.codec !== "jpeg" || Date.now() - s.lastWrite >= 95)
          ) {
            s.lastWrite = Date.now();
            s.encodedInputs.push(data.readBigUInt64LE(16));
            s.encoder.stdin.write(data.subarray(40));
          }
        })
        .catch(() => {})
        .finally(() => {
          s.readBusy = false;
        });
    }
  }
  void flush().catch(() => {});
}, 1000 / FPS);
const status = setInterval(() => {
  for (const s of sessions.values())
    if (
      !s.closed &&
      s.ws.readyState === WebSocket.OPEN &&
      s.ws.bufferedAmount < 150000
    )
      s.ws.send(
        JSON.stringify({
          type: "state",
          pos: s.pos,
          terminal: nearestTerminal(s.pos),
          frames: s.frames,
          bytes: s.bytes,
          nativeFrame: Number(s.lastFrame),
          inputSequence: s.sequence,
        }),
      );
}, 250);
const heartbeat = setInterval(() => {
  for (const s of sessions.values()) {
    if (s.closed) continue;
    if (!s.alive) {
      dispose(s, "Connection lost");
      continue;
    }
    s.alive = false;
    s.ws.ping();
  }
}, 10000);
server.listen(PORT, "127.0.0.1", () =>
  console.log(
    `Native station gateway listening on loopback:${PORT}; ${CAP} slots`,
  ),
);
async function stop() {
  if (closing) return;
  closing = true;
  clearInterval(tick);
  clearInterval(status);
  clearInterval(heartbeat);
  clearInterval(nativeHealth);
  for (const s of [...sessions.values()]) dispose(s, "Station restarting");
  while (flushing) await new Promise((resolve) => setTimeout(resolve, 10));
  await writeFile(
    resolve(IPC, "cameras.next"),
    JSON.stringify({ revision: ++revision, slots: [] }),
  );
  await rename(resolve(IPC, "cameras.next"), resolve(IPC, "cameras.json"));
  wss.close();
  server.close();
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
