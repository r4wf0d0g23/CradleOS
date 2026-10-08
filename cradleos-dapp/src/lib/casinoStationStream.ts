/** Native video/input only. Deliberately cannot read a wallet or casino ledger. */
export type StationInput = {
  forward: number;
  strafe: number;
  turn: number;
  look: number;
};
export const stationary = (): StationInput => ({
  forward: 0,
  strafe: 0,
  turn: 0,
  look: 0,
});
export type StationStatus = "joining" | "walking" | "offline";
export class StationStream {
  private generation = 0;
  private socket: WebSocket | null = null;
  private decoder: VideoDecoder | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private fallback: ReturnType<typeof setTimeout> | null = null;
  private input = stationary();
  private joining = false;
  readonly metrics = { frames: 0, latencyMs: [] as number[] };
  constructor(
    private canvas: HTMLCanvasElement,
    private endpoint: string,
    private status: (state: StationStatus, message: string) => void,
    private terminal: (index: number | null) => void,
  ) {}
  setInput(value: StationInput) {
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
      for (const [id, name] of [
        ["av1", "av01.0.08M.08"],
        ["h264", "avc1.42E01F"],
      ]) {
        try {
          if (
            (
              await VideoDecoder.isConfigSupported({
                codec: name,
                optimizeForLatency: true,
              })
            ).supported
          ) {
            codec = id;
            break;
          }
        } catch {
          /* fallback stays available */
        }
      }
    }
    if (generation !== this.generation) return;
    const ws = new WebSocket(
      this.endpoint.replace(/^http/, "ws") +
        "/join" +
        (codec === "jpeg" ? "" : "?codec=" + codec),
    );
    this.socket = ws;
    ws.binaryType = "arraybuffer";
    let decoding = false,
      next: ArrayBuffer | null = null,
      sequence = 0;
    const sent = new Map<number, number>();
    let needsKey = true,
      config: VideoDecoderConfig | null = null,
      presented = false;
    const current = () => generation === this.generation && this.socket === ws;
    const fail = (message: string) => {
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
    const markPresented = (inputSequence: number) => {
      this.metrics.frames++;
      const at = sent.get(inputSequence);
      if (at !== undefined) {
        this.metrics.latencyMs.push(performance.now() - at);
        if (this.metrics.latencyMs.length > 200) this.metrics.latencyMs.shift();
      }
      if (!presented && current()) {
        presented = true;
        this.status("walking", "Native Carbon");
      }
    };
    const paint = async (data: ArrayBuffer) => {
      if (!current()) return;
      if (decoding) {
        next = data;
        return;
      }
      decoding = true;
      let image: ImageBitmap | null = null;
      try {
        image = await createImageBitmap(
          new Blob([data.slice(17)], { type: "image/jpeg" }),
        );
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
    const presentationInputs = new Map<number, number>();
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
            this.terminal(
              Number.isInteger(m.terminal) && m.terminal >= 0 && m.terminal < 34
                ? m.terminal
                : null,
            );
            return;
          }
          if (m.type === "video-config") {
            if (
              m.codec !== "av01.0.08M.08" &&
              !/^avc1\.[0-9a-f]{6}$/i.test(m.codec)
            )
              throw Error("Codec");
            if (this.decoder && this.decoder.state !== "closed")
              this.decoder.close();
            config = { codec: m.codec, optimizeForLatency: true };
            needsKey = true;
            this.decoder = new VideoDecoder({
              output: (frame) => {
                try {
                  if (current()) {
                    this.canvas.getContext("2d")?.drawImage(frame, 0, 0);
                    markPresented(presentationInputs.get(frame.timestamp) ?? 0);
                    presentationInputs.delete(frame.timestamp);
                  }
                } finally {
                  frame.close();
                }
              },
              error: () => fail("Switching video format"),
            });
            this.decoder.configure(config);
          }
        } else {
          lastFrame = performance.now();
          if (e.data.byteLength > 4 * 1024 * 1024)
            throw Error("Oversize video");
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
          presentationInputs.set(
            timestamp,
            Number(new DataView(e.data).getBigUint64(9, true)),
          );
          if (presentationInputs.size > 50)
            presentationInputs.delete(presentationInputs.keys().next().value!);
          decoder.decode(
            new EncodedVideoChunk({
              type: key ? "key" : "delta",
              timestamp,
              data: data.subarray(17),
            }),
          );
        }
      } catch {
        fail("Switching video format");
      }
    };
    ws.onclose = (e) => {
      if (!current()) return;
      this.close();
      this.status(
        "offline",
        e.reason || "Station busy or reconnecting. Games remain available.",
      );
    };
    ws.onerror = () => {
      /* onclose owns state and release */
    };
    this.timer = setInterval(() => {
      if (!current()) return;
      if (performance.now() - lastFrame > 15000) {
        fail("Video unavailable. Games remain available.");
        return;
      }
      if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 2048) {
        sent.set(++sequence, performance.now());
        if (sent.size > 200) sent.delete(sent.keys().next().value!);
        ws.send(JSON.stringify({ type: "input", ...this.input }));
      }
    }, 50);
  }
}
