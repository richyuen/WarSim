// `npm run data [-- --check]`: data pipeline v0 (PLAN 0.18).
//
// 1. Downloads the pinned sources (tools/data/sources.json) into .cache/data/, verifying sha256.
// 2. Builds runtime assets in public/data/earth/:
//    - landmask-16384x8192.bits.gz: 1-bit land mask (LSB-first, row-major) from NE 10m land,
//      rasterized in Miller projection (src/sim/data/projection.ts, ADR-7);
//    - elev-<w>x<h>.i16d.gz: elevation pyramid (metres; src/shared/elevation.ts codec) from ETOPO
//      2022 60″, box-averaged into Miller cells at 4096×2048 and halved down to 512×256. The
//      4096×2048 level stays in .cache/data/derived/ (ADR-13: shipped-asset budget).
// 3. Writes manifest.json (sizes, dims, sha256 of every asset and source). Deterministic: files
//    are rewritten only when their bytes change, so a second run changes nothing.
// `--check` builds everything in memory and fails if any output would change.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fromFile } from 'geotiff';
import { LAT_BOTTOM_DEG, LAT_TOP_DEG, project, unproject } from '../../src/sim/data/projection';
import { encodeElevation, halveElevation, OCEAN_QUANTUM_M, quantizeOcean } from '../../src/shared/elevation';
import { rasterizePolygon, setBits } from '../../src/sim/data/rasterize';

const root = path.resolve(import.meta.dirname, '../..');
const cacheDir = path.join(root, '.cache/data');
const outDir = path.join(root, 'public/data/earth');
const sourcesPath = path.join(root, 'tools/data/sources.json');
const CHECK = process.argv.includes('--check');

const MASK_W = 16384;
const MASK_H = 8192;
const ELEV_LEVELS: [number, number][] = [
  [4096, 2048],
  [2048, 1024],
  [1024, 512],
  [512, 256],
];
/** Levels wider than this are derived products only (not shipped). */
const SHIP_MAX_W = 2048;

interface Source {
  id: string;
  url: string;
  file: string;
  license: string;
  sha256: string;
}

const sha256 = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');

/** gzip with a fixed header (mtime 0, OS byte 255) so bytes are identical on every platform. */
function gzip(b: Uint8Array): Uint8Array {
  const z = gzipSync(b, { level: 9 });
  z[9] = 0xff;
  return z;
}

async function download(src: Source): Promise<Uint8Array> {
  const file = path.join(cacheDir, src.file);
  if (existsSync(file)) {
    const b = readFileSync(file);
    if (!src.sha256 || sha256(b) === src.sha256) return b;
    console.warn(`  cached ${src.file} has a different sha256, re-downloading`);
  }
  console.log(`  downloading ${src.url}`);
  const res = await fetch(src.url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${src.url}`);
  const b = new Uint8Array(await res.arrayBuffer());
  const h = sha256(b);
  if (src.sha256 && h !== src.sha256) throw new Error(`sha256 mismatch for ${src.id}: got ${h}, pinned ${src.sha256}`);
  writeFileSync(file, b);
  return b;
}

type Position = number[];
interface Geometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: Position[][] | Position[][][];
}

/** Projects a GeoJSON polygon's rings into grid cell units. */
function projectPolygon(rings: Position[][], w: number, h: number): Float64Array[] {
  return rings.map((ring) => {
    const out = new Float64Array(ring.length * 2);
    ring.forEach((p, i) => {
      const [u, v] = project(p[0]!, p[1]!);
      out[2 * i] = u * w;
      out[2 * i + 1] = v * h;
    });
    return out;
  });
}

function polygonsOf(g: Geometry): Position[][][] {
  return g.type === 'Polygon' ? [g.coordinates as Position[][]] : (g.coordinates as Position[][][]);
}

function buildLandMask(geojson: Uint8Array): Uint8Array {
  const fc = JSON.parse(new TextDecoder().decode(geojson)) as { features: { geometry: Geometry }[] };
  const bits = new Uint8Array((MASK_W * MASK_H) / 8);
  let polys = 0;
  for (const f of fc.features) {
    for (const poly of polygonsOf(f.geometry)) {
      rasterizePolygon(projectPolygon(poly, MASK_W, MASK_H), MASK_W, MASK_H, (y, x0, x1) => setBits(bits, MASK_W, y, x0, x1));
      polys++;
    }
  }
  console.log(`  land mask: ${polys} polygons rasterized at ${MASK_W}×${MASK_H}`);
  return bits;
}

/** Box-averages ETOPO (21600×10800, 1′ cells from 90°N, 180°W) into Miller cells. */
async function buildElevation(tifPath: string, w: number, h: number): Promise<Int16Array> {
  const tiff = await fromFile(tifPath);
  const img = await tiff.getImage();
  const sw = img.getWidth();
  const sh = img.getHeight();
  const perDeg = sw / 360;
  if (sh !== 180 * perDeg) throw new Error(`unexpected ETOPO size ${sw}×${sh}`);
  const out = new Int16Array(w * h);
  // Source column ranges per target column (centres within the target cell).
  const colLo = new Int32Array(w);
  const colHi = new Int32Array(w);
  for (let c = 0; c < w; c++) {
    colLo[c] = Math.ceil((c * sw) / w - 0.5);
    colHi[c] = Math.max(colLo[c]! + 1, Math.ceil(((c + 1) * sw) / w - 0.5));
  }
  const BLOCK = 64;
  for (let r0 = 0; r0 < h; r0 += BLOCK) {
    const r1 = Math.min(h, r0 + BLOCK);
    const rowRange = (r: number): [number, number] => {
      const latTop = unproject(0, r / h)[1];
      const latBot = unproject(0, (r + 1) / h)[1];
      const lo = Math.ceil((90 - latTop) * perDeg - 0.5);
      return [lo, Math.max(lo + 1, Math.ceil((90 - latBot) * perDeg - 0.5))];
    };
    const srcTop = rowRange(r0)[0];
    const srcBot = rowRange(r1 - 1)[1];
    const win = (await img.readRasters({ window: [0, srcTop, sw, srcBot], samples: [0], interleave: true })) as unknown as Float32Array;
    for (let r = r0; r < r1; r++) {
      const [lo, hi] = rowRange(r);
      for (let c = 0; c < w; c++) {
        let sum = 0;
        let n = 0;
        for (let sy = lo; sy < hi; sy++) {
          const base = (sy - srcTop) * sw;
          for (let sx = colLo[c]!; sx < colHi[c]!; sx++) {
            sum += win[base + (sx >= sw ? sx - sw : sx)]!;
            n++;
          }
        }
        out[r * w + c] = quantizeOcean(Math.max(-11000, Math.min(9000, Math.round(sum / n))));
      }
    }
    process.stdout.write(`\r  elevation ${w}×${h}: ${Math.round((r1 / h) * 100)}%`);
  }
  process.stdout.write('\n');
  return out;
}

interface Asset {
  path: string;
  kind: 'landmask' | 'elevation';
  width: number;
  height: number;
  encoding: string;
  bytes: number;
  sha256: string;
}

async function main(): Promise<void> {
  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  const lock = JSON.parse(readFileSync(sourcesPath, 'utf8')) as { comment: string; sources: Source[] };
  console.log('sources:');
  const raw = new Map<string, Uint8Array>();
  let lockChanged = false;
  for (const s of lock.sources) {
    const b = await download(s);
    raw.set(s.id, b);
    if (!s.sha256) {
      s.sha256 = sha256(b);
      lockChanged = true;
    }
  }
  if (lockChanged) {
    if (CHECK) throw new Error('sources.json has unpinned sha256 values');
    writeFileSync(sourcesPath, `${JSON.stringify(lock, null, 2)}\n`);
    console.log('  pinned new sha256 values in tools/data/sources.json');
  }

  const files = new Map<string, Uint8Array>();
  const assets: Asset[] = [];
  const derived = new Map<string, Uint8Array>();
  const add = (name: string, kind: Asset['kind'], width: number, height: number, encoding: string, data: Uint8Array, ship = true): void => {
    const gz = gzip(data);
    if (!ship) {
      derived.set(name, gz);
      return;
    }
    files.set(name, gz);
    assets.push({ path: name, kind, width, height, encoding, bytes: gz.byteLength, sha256: sha256(gz) });
  };

  console.log('products:');
  add(`landmask-${MASK_W}x${MASK_H}.bits.gz`, 'landmask', MASK_W, MASK_H, 'gzip(bitset, LSB-first, row-major)', buildLandMask(raw.get('ne_10m_land')!));
  let [w, h] = ELEV_LEVELS[0]!;
  let elev = await buildElevation(path.join(cacheDir, lock.sources.find((s) => s.id === 'etopo_2022_60s_surface')!.file), w, h);
  for (let i = 0; i < ELEV_LEVELS.length; i++) {
    [w, h] = ELEV_LEVELS[i]!;
    if (i > 0) elev = halveElevation(elev, w * 2, h * 2);
    const enc = `gzip(byte-planes(row-delta(int16 metres))), ocean quantised to ${OCEAN_QUANTUM_M} m`;
    add(`elev-${w}x${h}.i16d.gz`, 'elevation', w, h, enc, encodeElevation(elev, w, h), w <= SHIP_MAX_W);
  }

  const manifest = {
    version: 1,
    projection: { type: 'miller', latTopDeg: LAT_TOP_DEG, latBottomDeg: Number(LAT_BOTTOM_DEG.toFixed(6)), lonWestDeg: -180, aspect: 2 },
    assets,
    sources: lock.sources.map((s) => ({ id: s.id, url: s.url, license: s.license, sha256: s.sha256 })),
  };
  files.set('manifest.json', new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`));

  const derivedDir = path.join(cacheDir, 'derived');
  mkdirSync(derivedDir, { recursive: true });
  for (const [name, bytes] of derived) writeFileSync(path.join(derivedDir, name), bytes);

  let changed = 0;
  for (const [name, bytes] of files) {
    const p = path.join(outDir, name);
    const same = existsSync(p) && sha256(readFileSync(p)) === sha256(bytes);
    if (same) continue;
    changed++;
    if (CHECK) console.error(`  would change: ${name}`);
    else writeFileSync(p, bytes);
  }
  for (const a of assets) console.log(`  ${a.path}: ${(a.bytes / 1e6).toFixed(2)} MB`);
  console.log(changed === 0 ? 'data: no changes' : `data: ${changed} file(s) ${CHECK ? 'would change' : 'written'}`);
  if (CHECK && changed > 0) process.exit(1);
}

await main();
