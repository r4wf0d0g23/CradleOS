import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StationStream } from "./casinoStationStream";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

class FakeSocket {
  static OPEN = 1;
  static sockets: FakeSocket[] = [];
  readyState = 1;
  bufferedAmount = 0;
  binaryType = "";
  sent: string[] = [];
  closed = false;
  onmessage: ((event: { data: string | ArrayBuffer }) => void) | null = null;
  onclose: ((event: { reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.sockets.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.({ reason: "closed" });
  }
  message(data: string | ArrayBuffer) {
    this.onmessage?.({ data });
  }
}

class FakeDecoder {
  static instances: FakeDecoder[] = [];
  static isConfigSupported = vi.fn(async () => ({ supported: true }));
  state: "unconfigured" | "configured" | "closed" = "unconfigured";
  decodeQueueSize = 0;
  decode = vi.fn();
  configure = vi.fn(() => {
    this.state = "configured";
  });
  constructor(
    readonly callbacks: {
      output: (frame: VideoFrame) => void;
      error: (error: DOMException) => void;
    },
  ) {
    FakeDecoder.instances.push(this);
  }
  close() {
    this.state = "closed";
  }
  reset() {
    this.state = "unconfigured";
  }
}

const streams: StationStream[] = [];
const bitmapJobs: ReturnType<typeof deferred<ImageBitmap>>[] = [];
function setup() {
  const drawImage = vi.fn(),
    status = vi.fn(),
    terminal = vi.fn();
  const canvas = {
    getContext: () => ({ drawImage }),
  } as unknown as HTMLCanvasElement;
  const stream = new StationStream(
    canvas,
    "https://media.invalid",
    status,
    terminal,
  );
  streams.push(stream);
  return { stream, drawImage, status, terminal };
}
function packet(input = 1n, timestamp = 50_000n, key = true) {
  const bytes = new ArrayBuffer(18),
    view = new DataView(bytes);
  view.setUint8(0, key ? 1 : 0);
  view.setBigUint64(1, timestamp, true);
  view.setBigUint64(9, input, true);
  return bytes;
}
function configure(socket: FakeSocket) {
  socket.message(
    JSON.stringify({ type: "video-config", codec: "av01.0.08M.08" }),
  );
  return FakeDecoder.instances[FakeDecoder.instances.length - 1];
}
async function microtasks() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.sockets = [];
  FakeDecoder.instances = [];
  bitmapJobs.length = 0;
  FakeDecoder.isConfigSupported = vi.fn(async () => ({ supported: true }));
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal("VideoDecoder", FakeDecoder);
  vi.stubGlobal(
    "EncodedVideoChunk",
    class {
      constructor(init: EncodedVideoChunkInit) {
        Object.assign(this, init);
      }
    },
  );
  vi.stubGlobal("createImageBitmap", () => {
    const job = deferred<ImageBitmap>();
    bitmapJobs.push(job);
    return job.promise;
  });
});
afterEach(() => {
  for (const stream of streams.splice(0)) stream.close();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("native station stream lifecycle", () => {
  it("claims admission synchronously and cancels a join still probing capabilities", async () => {
    const capability = deferred<{ supported: boolean }>();
    FakeDecoder.isConfigSupported.mockImplementation(() => capability.promise);
    const a = setup(),
      first = a.stream.join();
    await a.stream.join();
    expect(FakeDecoder.isConfigSupported).toHaveBeenCalledTimes(1);
    capability.resolve({ supported: true });
    await first;
    expect(FakeSocket.sockets).toHaveLength(1);
    a.stream.close();
    const secondCapability = deferred<{ supported: boolean }>();
    FakeDecoder.isConfigSupported.mockImplementation(
      () => secondCapability.promise,
    );
    const b = setup(),
      pending = b.stream.join();
    b.stream.close();
    secondCapability.resolve({ supported: true });
    await pending;
    expect(FakeSocket.sockets).toHaveLength(1);
  });

  it("closes a late JPEG bitmap without painting it over a replacement session", async () => {
    const { stream, drawImage } = setup();
    await stream.join(true);
    FakeSocket.sockets[0].message(packet());
    stream.close();
    await stream.join(true);
    const close = vi.fn();
    bitmapJobs[0].resolve({ close } as unknown as ImageBitmap);
    await microtasks();
    expect(close).toHaveBeenCalledOnce();
    expect(drawImage).not.toHaveBeenCalled();
    expect(stream.metrics.frames).toBe(0);
    FakeSocket.sockets[1].message(packet());
    bitmapJobs[1].resolve({ close } as unknown as ImageBitmap);
    await microtasks();
    expect(drawImage).toHaveBeenCalledOnce();
    expect(stream.metrics.frames).toBe(1);
  });

  it("releases a failed decoder, closes stale VideoFrames and falls back to JPEG only once", async () => {
    const { stream, drawImage } = setup();
    await stream.join();
    const socket = FakeSocket.sockets[0],
      decoder = configure(socket);
    decoder.callbacks.error(new DOMException("Decode failed"));
    expect(socket.closed).toBe(true);
    const close = vi.fn();
    decoder.callbacks.output({
      timestamp: 50_000,
      close,
    } as unknown as VideoFrame);
    expect(close).toHaveBeenCalledOnce();
    expect(drawImage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1600);
    expect(FakeSocket.sockets).toHaveLength(2);
    expect(FakeSocket.sockets[1].url).toBe("wss://media.invalid/join");
    FakeSocket.sockets[1].message(packet());
    bitmapJobs[0].reject(new Error("Bad JPEG"));
    await microtasks();
    expect(FakeSocket.sockets[1].closed).toBe(true);
    await vi.advanceTimersByTimeAsync(4000);
    expect(FakeSocket.sockets).toHaveLength(2);
  });

  it("explicit close cancels scheduled recovery and never resubmits held input", async () => {
    const { stream } = setup();
    await stream.join();
    const socket = FakeSocket.sockets[0];
    stream.setInput({ forward: 1, strafe: 0, turn: 0, look: 0 });
    await vi.advanceTimersByTimeAsync(50);
    expect(JSON.parse(socket.sent[0]).forward).toBe(1);
    configure(socket).callbacks.error(new DOMException("Decode failed"));
    stream.close();
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeSocket.sockets).toHaveLength(1);
    await stream.join(true);
    await vi.advanceTimersByTimeAsync(50);
    expect(JSON.parse(FakeSocket.sockets[1].sent[0])).toEqual({
      type: "input",
      forward: 0,
      strafe: 0,
      turn: 0,
      look: 0,
    });
  });

  it("drops dependent frames after decoder backpressure until a new keyframe", async () => {
    const { stream } = setup();
    await stream.join();
    const socket = FakeSocket.sockets[0],
      decoder = configure(socket);
    decoder.decodeQueueSize = 4;
    socket.message(packet(1n, 50_000n, false));
    expect(decoder.decode).not.toHaveBeenCalled();
    decoder.decodeQueueSize = 0;
    socket.message(packet(2n, 100_000n, false));
    expect(decoder.decode).not.toHaveBeenCalled();
    socket.message(packet(3n, 150_000n, true));
    expect(decoder.decode).toHaveBeenCalledOnce();
  });

  it("correlates latency only when the tagged frame is actually presented", async () => {
    const { stream, status } = setup();
    await stream.join();
    const socket = FakeSocket.sockets[0],
      decoder = configure(socket);
    await vi.advanceTimersByTimeAsync(50);
    socket.message(packet(1n, 50_000n));
    expect(stream.metrics.latencyMs).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(125);
    const close = vi.fn();
    decoder.callbacks.output({
      timestamp: 50_000,
      close,
    } as unknown as VideoFrame);
    expect(close).toHaveBeenCalledOnce();
    expect(stream.metrics.latencyMs[0]).toBeCloseTo(125);
    expect(status).toHaveBeenLastCalledWith("walking", "Native Carbon");
  });
});
