// Minimal PNG encoder for data-pipeline previews (8-bit RGB, no interlace), and a decoder of what
// it writes. Tools and tests only.
import { crc32, deflateSync, inflateSync } from 'node:zlib';

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** Encodes `rgb` (w·h·3 bytes, row-major) as a PNG. */
export function encodePng(rgb: Uint8Array, w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const raw = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/**
 * Decodes a PNG written by `encodePng` (8-bit RGB, every row with filter 0) back to its `rgb`
 * bytes. Throws on any other PNG.
 */
export function decodePng(png: Uint8Array): { rgb: Uint8Array; w: number; h: number } {
  const b = Buffer.from(png.buffer, png.byteOffset, png.byteLength);
  let w = 0;
  let h = 0;
  const idat: Buffer[] = [];
  for (let at = 8; at < b.length; ) {
    const len = b.readUInt32BE(at);
    const type = b.toString('ascii', at + 4, at + 8);
    const data = b.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 2 || data[12] !== 0) throw new Error('decodePng: not an 8-bit RGB PNG without interlace');
    } else if (type === 'IDAT') idat.push(data);
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const row = w * 3 + 1;
  if (w === 0 || raw.length !== row * h) throw new Error('decodePng: unexpected image data');
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    if (raw[y * row] !== 0) throw new Error('decodePng: filtered rows are not supported');
    rgb.set(raw.subarray(y * row + 1, (y + 1) * row), y * w * 3);
  }
  return { rgb, w, h };
}
