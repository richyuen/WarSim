/**
 * Save files (PLAN 1.27): the sim's section bytes (SPEC §2.6; state + command log), gzip-compressed
 * with the platform's CompressionStream (browsers and Node 18+). `unpackSave` also accepts
 * uncompressed bytes (no gzip magic), so raw saves stay loadable.
 */

const GZIP_MAGIC = [0x1f, 0x8b] as const;

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export function packSave(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new CompressionStream('gzip'));
}

export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1];
}

export async function unpackSave(bytes: Uint8Array): Promise<Uint8Array> {
  return isGzip(bytes) ? pipe(bytes, new DecompressionStream('gzip')) : bytes;
}
