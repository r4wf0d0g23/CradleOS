/** Bounded Annex-B/MJPEG framing: transport never invents video/game outcomes. */
export class JpegFrames {
  buffer = Buffer.alloc(0);
  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > 4 * 1024 * 1024)
      throw Error("Frame exceeds limit");
    const frames = [];
    while (true) {
      const start = this.buffer.indexOf(Buffer.from([255, 216]));
      if (start < 0) {
        this.buffer = this.buffer.subarray(-1);
        break;
      }
      const end = this.buffer.indexOf(Buffer.from([255, 217]), start + 2);
      if (end < 0) {
        this.buffer = this.buffer.subarray(start);
        break;
      }
      frames.push(this.buffer.subarray(start, end + 2));
      this.buffer = this.buffer.subarray(end + 2);
    }
    return frames;
  }
}
function audAt(buffer, from = 0) {
  for (let i = from; i < buffer.length - 3; i++) {
    if (buffer[i] || buffer[i + 1]) continue;
    if (buffer[i + 2] === 1 && (buffer[i + 3] & 31) === 9) return i;
    if (
      buffer[i + 2] === 0 &&
      buffer[i + 3] === 1 &&
      i + 4 < buffer.length &&
      (buffer[i + 4] & 31) === 9
    )
      return i;
  }
  return -1;
}
export function nalUnits(buffer) {
  const starts = [];
  for (let i = 0; i < buffer.length - 3; i++) {
    if (buffer[i] === 0 && buffer[i + 1] === 0) {
      if (buffer[i + 2] === 1) {
        starts.push({ start: i, data: i + 3 });
        i += 2;
      } else if (buffer[i + 2] === 0 && buffer[i + 3] === 1) {
        starts.push({ start: i, data: i + 4 });
        i += 3;
      }
    }
  }
  return starts.map((s, i) =>
    buffer.subarray(s.data, starts[i + 1]?.start ?? buffer.length),
  );
}
export class H264Frames {
  buffer = Buffer.alloc(0);
  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > 4 * 1024 * 1024)
      throw Error("Access unit exceeds limit");
    const out = [];
    while (true) {
      const first = audAt(this.buffer),
        next =
          first < 0
            ? -1
            : audAt(
                this.buffer,
                first + (this.buffer[first + 2] === 1 ? 4 : 5),
              );
      if (next < 0) break;
      const data = this.buffer.subarray(0, next),
        nals = nalUnits(data),
        sps = nals.find((n) => (n[0] & 31) === 7);
      out.push({
        data,
        key: nals.some((n) => (n[0] & 31) === 5),
        codec:
          sps?.length >= 4
            ? "avc1." + sps.subarray(1, 4).toString("hex")
            : null,
      });
      this.buffer = this.buffer.subarray(next);
    }
    return out;
  }
}

/** IVF from our fixed all-intra AV1 encoder. Each packet is independently decodable. */
export class Av1Frames {
  buffer = Buffer.alloc(0);
  header = false;
  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > 4 * 1024 * 1024)
      throw Error("IVF frame exceeds limit");
    if (!this.header) {
      if (this.buffer.length < 32) return [];
      if (
        this.buffer.toString("ascii", 0, 4) !== "DKIF" ||
        this.buffer.readUInt16LE(6) !== 32 ||
        this.buffer.toString("ascii", 8, 12) !== "AV01"
      )
        throw Error("Invalid IVF");
      this.header = true;
      this.buffer = this.buffer.subarray(32);
    }
    const out = [];
    while (this.buffer.length >= 12) {
      const n = this.buffer.readUInt32LE(0);
      if (n > 4 * 1024 * 1024) throw Error("IVF frame exceeds limit");
      if (this.buffer.length < n + 12) break;
      out.push({
        data: this.buffer.subarray(12, 12 + n),
        key: true,
        codec: "av01.0.08M.08",
      });
      this.buffer = this.buffer.subarray(12 + n);
    }
    return out;
  }
}
