import { test } from "node:test";
import assert from "node:assert/strict";
import {
  spawn,
  idle,
  parseInput,
  move,
  camera,
  TERMINALS,
  BOUNDS,
} from "./motion.mjs";
import { JpegFrames } from "./frames.mjs";
test("strict finite movement packets only", () => {
  assert.deepEqual(parseInput({ type: "input", ...idle() }), idle());
  for (const raw of [
    { type: "input", ...idle(), forward: NaN },
    { type: "input", ...idle(), turn: 2 },
    { type: "input", ...idle(), path: "/tmp/a" },
    { type: "open", game: "roulette" },
    null,
    [],
  ])
    assert.equal(parseInput(raw), null);
});
test("per-client camera objects are independent and bounded, collisions cannot tunnel", () => {
  const a = spawn(),
    b = spawn();
  let p = a;
  for (let i = 0; i < 2000; i++)
    p = move(p, { ...idle(), forward: 1, strafe: 1 }, 0.05);
  assert.deepEqual(b, spawn());
  assert.ok(Math.abs(p.x) <= BOUNDS.x && Math.abs(p.z) <= BOUNDS.z);
  for (const t of TERMINALS) {
    let p = { x: t.x, z: t.z + 2, yaw: 0, pitch: 0 };
    for (let i = 0; i < 100; i++) p = move(p, { ...idle(), forward: 1 }, 3);
    assert.ok(p.z >= t.z + 1.3);
  }
  assert.ok(camera(p).eye.every(Number.isFinite));
});
test("fragmented JPEG frame boundaries and memory ceiling", () => {
  const bytes = Buffer.from([255, 216, 1, 2, 255, 217, 255, 216, 3, 255, 217]);
  for (let split = 1; split < bytes.length; split++) {
    const p = new JpegFrames(),
      out = [];
    for (let i = 0; i < bytes.length; i += split)
      out.push(...p.push(bytes.subarray(i, i + split)));
    assert.equal(out.length, 2);
    assert.deepEqual(out[1], bytes.subarray(6));
  }
  assert.throws(() => new JpegFrames().push(Buffer.alloc(4194305)));
});
import { H264Frames } from "./frames.mjs";
test("Annex B framing preserves parameter sets and whole access units across arbitrary chunks", () => {
  const au1 = Buffer.from([
    0, 0, 0, 1, 9, 240, 0, 0, 0, 1, 103, 66, 192, 31, 0, 0, 1, 104, 1, 0, 0, 1,
    101, 2, 3,
  ]);
  const au2 = Buffer.from([0, 0, 0, 1, 9, 240, 0, 0, 1, 65, 9, 8]);
  const bytes = Buffer.concat([au1, au2, au2]);
  for (let split = 1; split < bytes.length; split++) {
    const p = new H264Frames(),
      out = [];
    for (let i = 0; i < bytes.length; i += split)
      out.push(...p.push(bytes.subarray(i, i + split)));
    assert.equal(out.length, 2);
    assert.deepEqual(out[0].data, au1);
    assert.equal(out[0].codec, "avc1.42c01f");
    assert.equal(out[0].key, true);
    assert.equal(out[1].key, false);
  }
  assert.throws(() => new H264Frames().push(Buffer.alloc(4194305)));
});

test("AV1 IVF frame boundaries preserve independently decodable packets", async () => {
  const { Av1Frames } = await import("./frames.mjs");
  const header = Buffer.alloc(32);
  header.write("DKIF");
  header.writeUInt16LE(32, 6);
  header.write("AV01", 8);
  const frame = Buffer.alloc(16);
  frame.writeUInt32LE(4);
  Buffer.from([1, 2, 3, 4]).copy(frame, 12);
  const bytes = Buffer.concat([header, frame, frame]);
  for (let n = 1; n < bytes.length; n++) {
    const p = new Av1Frames(),
      out = [...p.push(bytes.subarray(0, n)), ...p.push(bytes.subarray(n))];
    assert.equal(out.length, 2);
    assert.equal(out[0].key, true);
    assert.deepEqual(out[0].data, Buffer.from([1, 2, 3, 4]));
  }
  assert.throws(() => new Av1Frames().push(Buffer.alloc(32)), /Invalid IVF/);
});

test("three byte Annex B access delimiters are supported", async () => {
  const { H264Frames } = await import("./frames.mjs");
  const a = Buffer.from([
    0, 0, 1, 9, 16, 0, 0, 1, 103, 66, 224, 31, 0, 0, 1, 101, 12,
  ]);
  const out = new H264Frames().push(Buffer.concat([a, a]));
  assert.equal(out.length, 1);
  assert.equal(out[0].key, true);
  assert.equal(out[0].codec, "avc1.42e01f");
});
