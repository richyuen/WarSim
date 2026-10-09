// `npm run data [-- --check]`: data pipeline v0 (PLAN 0.18).
//
// 1. Downloads the pinned sources (tools/data/sources.json) into .cache/data/, verifying sha256.
// 2. Builds runtime assets in public/data/earth/ (gzip payloads with a neutral `.wsz` extension:
//    servers add `Content-Encoding: gzip` to `.gz` files, which makes fetch return different bytes):
//    - landmask-16384x8192.bits.wsz: 1-bit land mask (LSB-first, row-major) from NE 10m land,
//      rasterized in Miller projection (src/sim/data/projection.ts, ADR-7);
//    - elev-<w>x<h>.i16d.wsz: elevation pyramid (metres; src/shared/elevation.ts codec) from ETOPO
//      2022 60″, box-averaged into Miller cells at 4096×2048 and halved down to 512×256. The
//      4096×2048 level stays in .cache/data/derived/ (ADR-13: shipped-asset budget).
//    - terrain-<w>x<h>.u8.wsz: terrain classes at 2048×1024 and 1024×512 (PLAN 1.2,
//      tools/data/terrain.ts) from the land mask, NE1 land cover, ETOPO relief and wetlands.
//      The land mask has natural lakes (NE 10m lakes, scalerank <= 7, no reservoirs) cut out.
//    - data/scenarios/1938/cities.json: the 1938 city list (PLAN 1.5, tools/data/cities.ts).
// 3. Writes manifest.json (sizes, dims, sha256 of every asset and source). Deterministic: files
//    are rewritten only when their bytes change, so a second run changes nothing.
// 4. Scenario previews for the title screen (PLAN 1.43c, tools/data/preview.ts):
//    public/data/scenarios/<id>/preview.png, from the shipped assets and the scenario data.
//    `--previews` builds only these: no downloads, a few seconds.
// 5. The seeds of the sea zones (PLAN 4.1a, tools/data/seas.ts): data/maps/earth/seas.json, from
//    the marine polygons and the M terrain with the map's crossings. `--seas` builds only these,
//    from the cached polygons and the shipped terrain: no downloads, a few seconds.
// `--check` builds everything in memory and fails if any output would change.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fromFile } from 'geotiff';
import { LAT_BOTTOM_DEG, LAT_TOP_DEG, project, unproject } from '../../src/sim/data/projection';
import { ADMIN1_Q, encodeAdmin1, type Admin1Meta, type QPolygon, type QProvince } from '../../src/shared/admin1';
import { encodeElevation, halveElevation, OCEAN_QUANTUM_M, quantizeOcean } from '../../src/shared/elevation';
import { clearBits, rasterizePolygon, setBits } from '../../src/shared/rasterize';
import { encodePng } from './png';
import { writePreviews } from './preview';
import { buildCities, type CityRules, type NePlace } from './cities';
import { buildSeaSeeds, seasJson, type MarineFeature } from './seas';
import { applyCrossings, type StraitDef } from '../../src/sim/data/terrain';
import { earthAsset } from '../headless/assets';
import { buildTerrain, halveTerrain, landFraction, terrainPreview } from './terrain';
import { extractZipEntry } from './zip';

const root = path.resolve(import.meta.dirname, '../..');
const cacheDir = path.join(root, '.cache/data');
const outDir = path.join(root, 'public/data/earth');
const sourcesPath = path.join(root, 'tools/data/sources.json');
const CHECK = process.argv.includes('--check');
const ONLY_PREVIEWS = process.argv.includes('--previews');
const ONLY_SEAS = process.argv.includes('--seas');

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
  /** For zip sources: the entry extracted next to the archive (`<cache>/<id>/<entry>`). */
  extract?: string;
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

/** Natural lakes kept as water: NE `Lake`/`Alkaline Lake` (reservoirs are mostly post-1938). */
const LAKE_MAX_SCALERANK = 7;

function buildLandMask(landJson: Uint8Array, lakesJson: Uint8Array): Uint8Array {
  const fc = JSON.parse(new TextDecoder().decode(landJson)) as { features: { geometry: Geometry }[] };
  const bits = new Uint8Array((MASK_W * MASK_H) / 8);
  let polys = 0;
  for (const f of fc.features) {
    for (const poly of polygonsOf(f.geometry)) {
      rasterizePolygon(projectPolygon(poly, MASK_W, MASK_H), MASK_W, MASK_H, (y, x0, x1) => setBits(bits, MASK_W, y, x0, x1));
      polys++;
    }
  }
  const lakes = JSON.parse(new TextDecoder().decode(lakesJson)) as { features: { geometry: Geometry; properties: { featurecla: string; scalerank: number } }[] };
  let lakeCount = 0;
  for (const f of lakes.features) {
    const p = f.properties;
    if (p.featurecla === 'Reservoir' || p.scalerank > LAKE_MAX_SCALERANK) continue;
    // Islands inside lakes (inner rings) stay land: the even-odd fill skips them.
    for (const poly of polygonsOf(f.geometry)) {
      rasterizePolygon(projectPolygon(poly, MASK_W, MASK_H), MASK_W, MASK_H, (y, x0, x1) => clearBits(bits, MASK_W, y, x0, x1));
    }
    lakeCount++;
  }
  console.log(`  land mask: ${polys} land polygons, ${lakeCount} lakes cut out, at ${MASK_W}×${MASK_H}`);
  return bits;
}

/** Wetland polygons (lon/lat rings): NE regions `Wetlands` + `Delta`, plus tools/data/wetlands.json. */
function wetlandPolygons(regionsJson: Uint8Array): number[][][][] {
  const fc = JSON.parse(new TextDecoder().decode(regionsJson)) as { features: { geometry: Geometry; properties: { FEATURECLA: string } }[] };
  const out: number[][][][] = [];
  for (const f of fc.features) {
    if (f.properties.FEATURECLA !== 'Wetlands' && f.properties.FEATURECLA !== 'Delta') continue;
    out.push(...polygonsOf(f.geometry));
  }
  const own = JSON.parse(readFileSync(path.join(root, 'tools/data/wetlands.json'), 'utf8')) as { wetlands: { ring: number[][] }[] };
  for (const wl of own.wetlands) out.push([wl.ring]);
  return out;
}

/** Extracts a zip source's entry into the cache once (re-extracted when missing or empty). */
function extracted(src: Source, zip: Uint8Array): string {
  const dir = path.join(cacheDir, src.id);
  const file = path.join(dir, src.extract!);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(file) || statSync(file).size === 0) {
    console.log(`  extracting ${src.extract}`);
    writeFileSync(file, extractZipEntry(zip, src.extract!));
  }
  return file;
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
  kind: 'landmask' | 'elevation' | 'admin1-geometry' | 'admin1-meta' | 'terrain';
  /** Raster width/height, or for admin-1 assets: province count × 1. */
  width: number;
  height: number;
  encoding: string;
  bytes: number;
  sha256: string;
}

interface Admin1Feature {
  geometry: Geometry;
  properties: Record<string, string | number | null>;
}

/**
 * Admin-1 provinces (PLAN 0.19): exact NE 10m geometry projected to Miller, quantised to 1/Q.
 * Closing and consecutive duplicate vertices are dropped; rings under 3 vertices are dropped.
 */
function buildAdmin1(geojson: Uint8Array): { geometry: Uint8Array; meta: Admin1Meta[]; vertices: number } {
  const fc = JSON.parse(new TextDecoder().decode(geojson)) as { features: Admin1Feature[] };
  const provinces: QProvince[] = [];
  const meta: Admin1Meta[] = [];
  let vertices = 0;
  fc.features.forEach((f, i) => {
    const prov: QProvince = [];
    for (const poly of polygonsOf(f.geometry)) {
      const qpoly: QPolygon = [];
      for (const ring of poly) {
        const pts: number[] = [];
        for (const p of ring) {
          const [u, v] = project(p[0]!, p[1]!);
          const qx = Math.round(u * ADMIN1_Q);
          const qy = Math.round(v * ADMIN1_Q);
          const n = pts.length;
          if (n >= 2 && pts[n - 2] === qx && pts[n - 1] === qy) continue;
          pts.push(qx, qy);
        }
        if (pts.length >= 4 && pts[0] === pts[pts.length - 2] && pts[1] === pts[pts.length - 1]) pts.length -= 2;
        if (pts.length >= 6) {
          qpoly.push(Int32Array.from(pts));
          vertices += pts.length / 2;
        }
      }
      if (qpoly.length > 0) prov.push(qpoly);
    }
    provinces.push(prov);
    const pr = f.properties;
    const [u, v] = project(Number(pr['longitude']), Number(pr['latitude']));
    meta.push({
      id: i + 1,
      adm1: String(pr['adm1_code'] ?? ''),
      name: String(pr['name_en'] ?? pr['name'] ?? ''),
      adm0: String(pr['adm0_a3'] ?? ''),
      admin: String(pr['admin'] ?? ''),
      iso2: String(pr['iso_a2'] ?? ''),
      type: String(pr['type_en'] ?? ''),
      u: Number(u.toFixed(7)),
      v: Number(v.toFixed(7)),
      areaKm2: Number(pr['area_sqkm'] ?? 0),
    });
  });
  return { geometry: encodeAdmin1(provinces), meta, vertices };
}

/** Step 4; returns how many previews changed. */
function previews(): number {
  const changed = writePreviews(root, CHECK);
  for (const rel of changed) console.log(`  ${CHECK ? 'would change' : 'written'}: ${rel}`);
  return changed.length;
}

/** Step 5, from the M terrain without crossings (the array is not changed); returns whether the file changed. */
function seas(marine: Uint8Array, terrainM: Uint8Array): boolean {
  const mapDir = path.join(root, 'data/maps/earth');
  const terrain = new Uint8Array(terrainM);
  applyCrossings(terrain, 2048, 1024, (JSON.parse(readFileSync(path.join(mapDir, 'straits.json'), 'utf8')) as { straits: StraitDef[] }).straits);
  const seeds = buildSeaSeeds((JSON.parse(new TextDecoder().decode(marine)) as { features: MarineFeature[] }).features, terrain, 2048, 1024);
  const json = seasJson(seeds);
  const p = path.join(mapDir, 'seas.json');
  const changed = !existsSync(p) || readFileSync(p, 'utf8') !== json;
  console.log(`  seas: ${seeds.length} seeds of ${new Set(seeds.map((s) => s.name)).size} named seas`);
  if (changed) {
    if (CHECK) console.error('  would change: data/maps/earth/seas.json');
    else writeFileSync(p, json);
  }
  return changed;
}

async function main(): Promise<void> {
  if (ONLY_SEAS) {
    const changed = seas(readFileSync(path.join(cacheDir, 'ne_10m_geography_marine_polys.geojson')), new Uint8Array(earthAsset('terrain', 2048)));
    console.log(!changed ? 'data: seas unchanged' : `data: seas ${CHECK ? 'would change' : 'written'}`);
    if (CHECK && changed) process.exit(1);
    return;
  }
  if (ONLY_PREVIEWS) {
    const n = previews();
    console.log(n === 0 ? 'data: previews unchanged' : `data: ${n} preview(s) ${CHECK ? 'would change' : 'written'}`);
    if (CHECK && n > 0) process.exit(1);
    return;
  }
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
  /** Preview images (not shipped) written to .cache/data/derived/. */
  const derivedPng = new Map<string, Uint8Array>();
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
  const landBits = buildLandMask(raw.get('ne_10m_land')!, raw.get('ne_10m_lakes')!);
  add(`landmask-${MASK_W}x${MASK_H}.bits.wsz`, 'landmask', MASK_W, MASK_H, 'gzip(bitset, LSB-first, row-major)', landBits);
  const admin1 = buildAdmin1(raw.get('ne_10m_admin_1_states_provinces')!);
  console.log(`  admin-1: ${admin1.meta.length} provinces, ${admin1.vertices} vertices`);
  add('admin1-geometry.wsz', 'admin1-geometry', admin1.meta.length, 1, `gzip(WAD1 varint stream, Q = ${ADMIN1_Q})`, admin1.geometry);
  add('admin1-meta.json.wsz', 'admin1-meta', admin1.meta.length, 1, 'gzip(JSON Admin1Meta[])', new TextEncoder().encode(JSON.stringify(admin1.meta)));
  let [w, h] = ELEV_LEVELS[0]!;
  let elev = await buildElevation(path.join(cacheDir, lock.sources.find((s) => s.id === 'etopo_2022_60s_surface')!.file), w, h);
  for (let i = 0; i < ELEV_LEVELS.length; i++) {
    [w, h] = ELEV_LEVELS[i]!;
    if (i > 0) elev = halveElevation(elev, w * 2, h * 2);
    const enc = `gzip(byte-planes(row-delta(int16 metres))), ocean quantised to ${OCEAN_QUANTUM_M} m`;
    add(`elev-${w}x${h}.i16d.wsz`, 'elevation', w, h, enc, encodeElevation(elev, w, h), w <= SHIP_MAX_W);
  }

  const src = (id: string): Source => lock.sources.find((s) => s.id === id)!;
  const tb = await buildTerrain(2048, 1024, {
    ne1Path: extracted(src('ne1_hr_lc'), raw.get('ne1_hr_lc')!),
    etopoPath: path.join(cacheDir, src('etopo_2022_60s_surface').file),
    landBits,
    maskW: MASK_W,
    maskH: MASK_H,
    wetlands: wetlandPolygons(raw.get('ne_10m_geography_regions_polys')!),
  });
  for (const e of tb.exemplars) console.log(`    site ${e.name}: rgb ${e.rgb.map((v) => v.toFixed(0)).join(',')}`);
  const terrainColors = (JSON.parse(readFileSync(path.join(root, 'data/terrain.json'), 'utf8')) as { terrain: { color: string }[] }).terrain.map((t) => t.color);
  const terrainS = halveTerrain(tb.terrain, 2048, 1024, landFraction(landBits, MASK_W, MASK_H, 1024, 512));
  for (const [t, w2, h2] of [[tb.terrain, 2048, 1024], [terrainS, 1024, 512]] as const) {
    add(`terrain-${w2}x${h2}.u8.wsz`, 'terrain', w2, h2, 'gzip(u8 terrain class per cell, row-major; src/shared/terrain.ts)', t);
    derivedPng.set(`terrain-${w2}x${h2}.png`, encodePng(terrainPreview(t, terrainColors), w2, h2));
  }

  // 1938 cities (scenario data, committed under data/).
  const places = (JSON.parse(new TextDecoder().decode(raw.get('ne_10m_populated_places')!)) as { features: { properties: NePlace }[] }).features.map((f) => f.properties);
  const scen = path.join(root, 'data/scenarios/1938');
  const cityRules = JSON.parse(readFileSync(path.join(scen, 'city-rules.json'), 'utf8')) as CityRules;
  const nationDefs = (JSON.parse(readFileSync(path.join(scen, 'nations.json'), 'utf8')) as { nations: { tag: string; alive?: boolean; capital: { name: string; lonLat: [number, number] } }[] }).nations;
  const cities = buildCities(places, cityRules, nationDefs.filter((n) => n.alive !== false).map((n) => ({ tag: n.tag, ...n.capital })));
  const cityLines = cities.map((c) => JSON.stringify(c)).join(',\n    ');
  const cityJson = `{\n  "comment": "Generated by npm run data from Natural Earth populated places + city-rules.json (PLAN 1.5). Do not edit by hand.",\n  "cities": [\n    ${cityLines}\n  ]\n}\n`;
  const cityPath = path.join(scen, 'cities.json');
  const cityChanged = !existsSync(cityPath) || readFileSync(cityPath, 'utf8') !== cityJson;
  console.log(`  cities: ${cities.length} (${cities.filter((c) => c.capitalOf).length} capitals)`);

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
  for (const [name, bytes] of derivedPng) writeFileSync(path.join(derivedDir, name), bytes);

  let changed = 0;
  for (const [name, bytes] of files) {
    const p = path.join(outDir, name);
    const same = existsSync(p) && sha256(readFileSync(p)) === sha256(bytes);
    if (same) continue;
    changed++;
    if (CHECK) console.error(`  would change: ${name}`);
    else writeFileSync(p, bytes);
  }
  if (cityChanged) {
    changed++;
    if (CHECK) console.error('  would change: data/scenarios/1938/cities.json');
    else writeFileSync(cityPath, cityJson);
  }
  for (const a of assets) console.log(`  ${a.path}: ${(a.bytes / 1e6).toFixed(2)} MB`);
  if (seas(raw.get('ne_10m_geography_marine_polys')!, tb.terrain)) changed++;
  // The previews are built from the assets on disk, so after those are written.
  changed += previews();
  console.log(changed === 0 ? 'data: no changes' : `data: ${changed} file(s) ${CHECK ? 'would change' : 'written'}`);
  if (CHECK && changed > 0) process.exit(1);
}

await main();
