// Minimal zip reader for pinned data sources: finds one entry via the central directory and
// inflates it. Tools only (Node); supports stored (0) and deflate (8), no zip64.
import { inflateRawSync } from 'node:zlib';

export function extractZipEntry(zip: Uint8Array, name: string): Uint8Array {
  const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // End of central directory record: signature 0x06054b50, within the last 64 KiB + 22 bytes.
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('zip: no end-of-central-directory record');
  const entries = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let e = 0; e < entries; e++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('zip: bad central directory entry');
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const entryName = dec.decode(zip.subarray(p + 46, p + 46 + nlen));
    if (entryName === name) {
      if (dv.getUint32(local, true) !== 0x04034b50) throw new Error('zip: bad local header');
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const raw = zip.subarray(start, start + csize);
      const out = method === 0 ? raw : method === 8 ? new Uint8Array(inflateRawSync(raw)) : null;
      if (!out) throw new Error(`zip: unsupported method ${method} for ${name}`);
      if (out.length !== usize) throw new Error(`zip: ${name} inflated to ${out.length} bytes, expected ${usize}`);
      return out;
    }
    p += 46 + nlen + xlen + clen;
  }
  throw new Error(`zip: no entry ${name}`);
}
