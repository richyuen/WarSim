/**
 * Synthetic benchmark world (not game data): fBm continents and N nations from a
 * noise-warped Voronoi over jittered seeds, plus occupation strips along some borders.
 * Deterministic for a seed so benchmark screenshots are comparable between runs.
 */

export interface SyntheticWorld {
  w: number;
  h: number;
  nations: number;
  owner: Uint16Array;
  controller: Uint16Array;
  colors: number[];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed: number): (x: number, y: number) => number {
  const rnd = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;
  const grad = (h: number, x: number, y: number): number => ((h & 1) ? x : -x) + ((h & 2) ? y : -y);
  const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[xi]! + yi]!;
    const ab = perm[perm[xi]! + yi + 1]!;
    const ba = perm[perm[xi + 1]! + yi]!;
    const bb = perm[perm[xi + 1]! + yi + 1]!;
    const x1 = grad(aa, xf, yf) + u * (grad(ba, xf - 1, yf) - grad(aa, xf, yf));
    const x2 = grad(ab, xf, yf - 1) + u * (grad(bb, xf - 1, yf - 1) - grad(ab, xf, yf - 1));
    return x1 + v * (x2 - x1);
  };
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number, oct: number): number {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let o = 0; o < oct; o++) {
    s += a * noise(x * f, y * f);
    f *= 2;
    a *= 0.5;
  }
  return s;
}

export function hslToRgb(h: number, s: number, l: number): number {
  const k = (n: number): number => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

export function makeSyntheticWorld(w: number, h: number, nations: number, seed = 1938): SyntheticWorld {
  const rnd = mulberry32(seed);
  const noise = makeNoise(seed);
  const land = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const ny = y / h;
      // Seamless in x: sample the noise on a cylinder-ish mapping.
      const e = fbm(noise, nx * 6, ny * 3, 6) + 0.18 - 0.55 * Math.abs(ny - 0.5) * Math.abs(ny - 0.5) * 4 * 0.5;
      land[y * w + x] = e > 0.02 ? 1 : 0;
    }
  }

  // Jittered seeds on land, bucketed on a grid for fast nearest-seed search.
  const gx = Math.ceil(Math.sqrt((nations * w) / h));
  const gy = Math.ceil(nations / gx);
  const cw = w / gx;
  const ch = h / gy;
  const seeds: { x: number; y: number; id: number }[] = [];
  const buckets: number[][] = Array.from({ length: gx * gy }, () => []);
  let id = 1;
  let guard = 0;
  while (seeds.length < nations && guard++ < nations * 200) {
    const x = rnd() * w;
    const y = rnd() * h;
    if (!land[Math.floor(y) * w + Math.floor(x)]) continue;
    const b = Math.min(gy - 1, Math.floor(y / ch)) * gx + Math.min(gx - 1, Math.floor(x / cw));
    if (buckets[b]!.length >= 2) continue;
    seeds.push({ x, y, id });
    buckets[b]!.push(seeds.length - 1);
    id++;
  }

  const owner = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!land[i]) continue;
      // Warp the lookup point so borders are organic rather than straight Voronoi edges.
      const wx = x + 60 * fbm(noise, x / 90 + 31.7, y / 90, 4);
      const wy = y + 60 * fbm(noise, x / 90, y / 90 + 71.3, 4);
      const bx = Math.floor(wx / cw);
      const by = Math.floor(wy / ch);
      let best = 0;
      let bd = Infinity;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = by + dy;
        if (yy < 0 || yy >= gy) continue;
        for (let dx = -2; dx <= 2; dx++) {
          const xx = (((bx + dx) % gx) + gx) % gx;
          for (const si of buckets[yy * gx + xx]!) {
            const s = seeds[si]!;
            let ddx = Math.abs(s.x - wx);
            if (ddx > w / 2) ddx = w - ddx;
            const d = ddx * ddx + (s.y - wy) * (s.y - wy);
            if (d < bd) {
              bd = d;
              best = s.id;
            }
          }
        }
      }
      owner[i] = best;
    }
  }

  // Occupation: along borders of every 7th nation, its neighbour holds a 6-cell strip.
  const controller = owner.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 1; x < w - 7; x++) {
      const i = y * w + x;
      const a = owner[i - 1]!;
      const b = owner[i]!;
      if (a !== 0 && b !== 0 && a !== b && a % 7 === 0) {
        for (let k = 0; k < 6; k++) if (owner[i + k] === b) controller[i + k] = a;
      }
    }
  }

  const colors: number[] = [0x1d3557];
  for (let n = 1; n <= seeds.length; n++) {
    const hue = (n * 0.618033988749895) % 1;
    colors.push(hslToRgb(hue, 0.45 + 0.25 * ((n * 7) % 3) / 2, 0.42 + 0.18 * ((n * 5) % 4) / 3));
  }
  return { w, h, nations: seeds.length, owner, controller, colors };
}
