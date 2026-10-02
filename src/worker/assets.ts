/**
 * Map asset loading for the worker (and Node tools/tests): fetches files listed in
 * public/data/earth/manifest.json, verifies their sha256 and gunzips them with
 * DecompressionStream (available in browsers and Node ≥ 18).
 */

export interface ManifestAsset {
  path: string;
  kind: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
}

export interface Manifest {
  version: number;
  assets: ManifestAsset[];
}

export type Fetcher = (url: string) => Promise<Response>;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>));
  let s = '';
  for (const b of d) s += b.toString(16).padStart(2, '0');
  return s;
}

export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export class AssetStore {
  private manifest: Manifest | null = null;

  /** `base` is the URL of the asset directory (ending in '/'). */
  constructor(
    private readonly base: string,
    private readonly fetcher: Fetcher = (u) => fetch(u),
  ) {}

  async getManifest(): Promise<Manifest> {
    if (!this.manifest) {
      const r = await this.fetcher(new URL('manifest.json', this.base).href);
      if (!r.ok) throw new Error(`manifest: HTTP ${r.status}`);
      this.manifest = (await r.json()) as Manifest;
    }
    return this.manifest;
  }

  /** Fetches, verifies and gunzips the asset of `kind` (and width, when given). */
  async load(kind: string, width?: number): Promise<{ asset: ManifestAsset; bytes: Uint8Array; fetchMs: number; decodeMs: number }> {
    const m = await this.getManifest();
    const asset = m.assets.find((a) => a.kind === kind && (width === undefined || a.width === width));
    if (!asset) throw new Error(`no asset ${kind}${width === undefined ? '' : ` @${width}`}`);
    const t0 = performance.now();
    const r = await this.fetcher(new URL(asset.path, this.base).href);
    if (!r.ok) throw new Error(`${asset.path}: HTTP ${r.status}`);
    const raw = new Uint8Array(await r.arrayBuffer());
    const t1 = performance.now();
    if (raw.byteLength !== asset.bytes || (await sha256Hex(raw)) !== asset.sha256) {
      throw new Error(`${asset.path}: size or sha256 mismatch (corrupt or stale asset)`);
    }
    const bytes = await gunzip(raw);
    return { asset, bytes, fetchMs: t1 - t0, decodeMs: performance.now() - t1 };
  }
}
