"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var casinoStationStream_exports = {};
__export(casinoStationStream_exports, {
  StationStream: () => StationStream,
  stationary: () => stationary
});
module.exports = __toCommonJS(casinoStationStream_exports);
const stationary = () => ({ forward: 0, strafe: 0, turn: 0, look: 0 });
class StationStream {
  constructor(canvas, endpoint, status, terminal) {
    this.canvas = canvas;
    this.endpoint = endpoint;
    this.status = status;
    this.terminal = terminal;
  }
  generation = 0;
  socket = null;
  decoder = null;
  timer = null;
  fallback = null;
  input = stationary();
  joining = false;
  metrics = { frames: 0, latencyMs: [] };
  setInput(value) {
    this.input = value;
  }
  close() {
    this.generation++;
    this.joining = false;
    this.input = stationary();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.fallback) clearTimeout(this.fallback);
    this.fallback = null;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.decoder && this.decoder.state !== "closed") this.decoder.close();
    this.decoder = null;
    this.terminal(null);
  }
  async join(forceJpeg = false) {
    if (this.joining || this.socket) return;
    this.close();
    const generation = this.generation;
    this.joining = true;
    this.status("joining", "Connecting to station");
    let codec = "jpeg";
    if (!forceJpeg && typeof VideoDecoder !== "undefined") {
      for (const [id, name] of [["av1", "av01.0.08M.08"], ["h264", "avc1.42E01F"]]) {
        try {
          if ((await VideoDecoder.isConfigSupported({ codec: name, optimizeForLatency: true })).supported) {
            codec = id;
            break;
          }
        } catch {
        }
      }
    }
    if (generation !== this.generation) return;
    const ws = new WebSocket(this.endpoint.replace(/^http/, "ws") + "/join" + (codec === "jpeg" ? "" : "?codec=" + codec));
    this.socket = ws;
    ws.binaryType = "arraybuffer";
    let decoding = false, next = null, sequence = 0;
    const sent = /* @__PURE__ */ new Map();
    let needsKey = true, config = null, presented = false;
    const current = () => generation === this.generation && this.socket === ws;
    const fail = (message) => {
      if (!current()) return;
      this.close();
      this.status("offline", message);
      if (codec !== "jpeg") {
        const g = this.generation;
        this.fallback = setTimeout(() => {
          if (g === this.generation) void this.join(true);
        }, 1600);
      }
    };
    const markPresented = (inputSequence) => {
      this.metrics.frames++;
      const at = sent.get(inputSequence);
      if (at !== void 0) {
        this.metrics.latencyMs.push(performance.now() - at);
        if (this.metrics.latencyMs.length > 200) this.metrics.latencyMs.shift();
      }
      if (!presented && current()) {
        presented = true;
        this.status("walking", "Native Carbon");
      }
    };
    const paint = async (data) => {
      if (!current()) return;
      if (decoding) {
        next = data;
        return;
      }
      decoding = true;
      let image = null;
      try {
        image = await createImageBitmap(new Blob([data.slice(17)], { type: "image/jpeg" }));
        if (current()) {
          this.canvas.getContext("2d")?.drawImage(image, 0, 0);
          markPresented(Number(new DataView(data).getBigUint64(9, true)));
        }
      } catch {
        fail("Video interrupted. The games remain available.");
      } finally {
        image?.close();
        decoding = false;
        const latest = next;
        next = null;
        if (latest && current()) void paint(latest);
      }
    };
    let lastFrame = performance.now();
    const presentationInputs = /* @__PURE__ */ new Map();
    ws.onmessage = (e) => {
      if (!current()) return;
      try {
        if (typeof e.data === "string") {
          const m = JSON.parse(e.data);
          if (m.type === "joined") {
            this.joining = false;
            return;
          }
          if (m.type === "state") {
            this.terminal(Number.isInteger(m.terminal) && m.terminal >= 0 && m.terminal < 34 ? m.terminal : null);
            return;
          }
          if (m.type === "video-config") {
            if (m.codec !== "av01.0.08M.08" && !/^avc1\.[0-9a-f]{6}$/i.test(m.codec)) throw Error("Codec");
            if (this.decoder && this.decoder.state !== "closed") this.decoder.close();
            config = { codec: m.codec, optimizeForLatency: true };
            needsKey = true;
            this.decoder = new VideoDecoder({ output: (frame) => {
              try {
                if (current()) {
                  this.canvas.getContext("2d")?.drawImage(frame, 0, 0);
                  markPresented(presentationInputs.get(frame.timestamp) ?? 0);
                  presentationInputs.delete(frame.timestamp);
                }
              } finally {
                frame.close();
              }
            }, error: () => fail("Switching video format") });
            this.decoder.configure(config);
          }
        } else {
          lastFrame = performance.now();
          if (e.data.byteLength > 4 * 1024 * 1024) throw Error("Oversize video");
          if (codec === "jpeg") {
            void paint(e.data);
            return;
          }
          const decoder = this.decoder;
          if (!decoder || decoder.state !== "configured" || !config) return;
          const data = new Uint8Array(e.data);
          if (data.length <= 17) throw Error("Video packet");
          const key = data[0] === 1;
          if (decoder.decodeQueueSize > 3) {
            decoder.reset();
            decoder.configure(config);
            needsKey = true;
          }
          if (needsKey && !key) return;
          needsKey = false;
          const timestamp = Number(new DataView(e.data).getBigUint64(1, true));
          presentationInputs.set(timestamp, Number(new DataView(e.data).getBigUint64(9, true)));
          if (presentationInputs.size > 50) presentationInputs.delete(presentationInputs.keys().next().value);
          decoder.decode(new EncodedVideoChunk({ type: key ? "key" : "delta", timestamp, data: data.subarray(17) }));
        }
      } catch {
        fail("Switching video format");
      }
    };
    ws.onclose = (e) => {
      if (!current()) return;
      this.close();
      this.status("offline", e.reason || "Station busy or reconnecting. Games remain available.");
    };
    ws.onerror = () => {
    };
    this.timer = setInterval(() => {
      if (!current()) return;
      if (performance.now() - lastFrame > 15e3) {
        fail("Video unavailable. Games remain available.");
        return;
      }
      if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 2048) {
        sent.set(++sequence, performance.now());
        if (sent.size > 200) sent.delete(sent.keys().next().value);
        ws.send(JSON.stringify({ type: "input", ...this.input }));
      }
    }, 50);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  StationStream,
  stationary
});
