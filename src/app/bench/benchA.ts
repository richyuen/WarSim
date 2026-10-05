/**
 * Render benchmark A (PLAN 0.14): raw WebGL2 + twgl id-map renderer on a 2048×1024
 * synthetic world with 150 nations. Driven by tools/bench via `window.__bench`.
 */
import type { Camera } from '../../render/camera';
import { GpuTimer } from '../../render/gl/gpuTimer';
import { GROUND_CAP, GroundInstances } from '../../render/map/GroundInstances';
import { MapRenderer } from '../../render/map/MapRenderer';
import { cityIndex, scatter, type ScatterWorld } from '../../render/map/scatter';
import type { LandMask } from '../../shared/landMask';
import { Terrain } from '../../shared/terrain';
import type { BenchAResult } from './benchApi';
import { runFrames } from './benchUtil';
import { makeSyntheticWorld } from './synthetic';

const W = 2048;
const H = 1024;
const NATIONS = 150;

const canvas = document.getElementById('map') as HTMLCanvasElement;
const dpr = window.devicePixelRatio || 1;
canvas.width = Math.round(canvas.clientWidth * dpr);
canvas.height = Math.round(canvas.clientHeight * dpr);
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true })!;
const debug = gl.getExtension('WEBGL_debug_renderer_info');
const rendererName = String(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));

const t0 = performance.now();
const world = makeSyntheticWorld(W, H, NATIONS);
const genMs = performance.now() - t0;
const map = new MapRenderer(gl, W, H, { wrapX: true });
world.colors.forEach((c, i) => map.setColor(i, c));
const t1 = performance.now();
map.setGrid(world.owner, world.controller);
gl.finish();
const uploadMs = performance.now() - t1;
// A relief to shade (PLAN 2.8a): ranges some hundred km apart, up to 3 km high, the same on every run.
const height = new Int16Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) height[y * W + x] = Math.round(1500 * (1 + Math.sin(x * 0.21) * Math.cos(y * 0.17)) * (0.5 + 0.5 * Math.sin(x * 0.013 + y * 0.029)));
map.setElevation(W, H, height);

const fitScale = Math.min(canvas.clientWidth / W, canvas.clientHeight / H);
let cam: Camera = { cx: W / 2, cy: H / 2, scale: fitScale };
/** How much of the ground of T2 and T3 the pass draws (0: the map of T0 and T1). */
let detail = 0;
// What stands on the ground (PLAN 2.8c2): a world that is forest all over, as many instances as a view can have.
const things = new GroundInstances(gl);
const forest: ScatterWorld = { w: W, h: H, wrapX: true, kmPerCell: 19.57, terrain: new Uint8Array(W * H).fill(Terrain.Forest), mask: null, cities: cityIndex([], W, H, 19.57) };
/** Whether the instances are scattered and drawn in a frame, and how many the last frame had. */
let withThings = false;
let thingCount = 0;

/** The map a frame draws: the bench's, or the one with a coast. */
let drawn = map;

/**
 * A map with a coast (PLAN 2.9b2): land in blobs some cells across round the close views, as a
 * coverage of 2 texels a cell (the coast of T0 and T1) and as a mask of 8 px a cell (the coast
 * of T2 and T3). Elsewhere it is sea: the views measured do not look there.
 */
function coastMap(): { map: MapRenderer; mask: LandMask } {
  const m = new MapRenderer(gl, W, H, { wrapX: true });
  world.colors.forEach((c, i) => m.setColor(i, c));
  m.setGrid(world.owner, world.controller);
  m.setElevation(W, H, height);
  const land = (x: number, y: number): boolean => Math.sin(x * 0.9) * Math.cos(y * 0.7) + 0.3 * Math.sin(x * 0.05 + y * 0.08) > 0;
  const [x0, x1, y0, y1] = [1060, 1140, 300, 360];
  const cover = new Uint8Array(2 * W * 2 * H);
  for (let ty = y0 * 2; ty < y1 * 2; ty++) for (let tx = x0 * 2; tx < x1 * 2; tx++) cover[ty * 2 * W + tx] = land((tx + 0.5) / 2, (ty + 0.5) / 2) ? 255 : 0;
  m.setLand(2 * W, 2 * H, cover);
  const mask: LandMask = { w: 8 * W, h: 8 * H, bits: new Uint8Array(W * 8 * H) };
  for (let py = y0 * 8; py < y1 * 8; py++) {
    for (let px = x0 * 8; px < x1 * 8; px++) {
      const i = py * mask.w + px;
      if (land((px + 0.5) / 8, (py + 0.5) / 8)) mask.bits[i >> 3]! |= 1 << (i & 7);
    }
  }
  return { map: m, mask };
}

function frame(): void {
  drawn.draw(cam, dpr, detail);
  if (!withThings) return;
  const [vw, vh] = [canvas.clientWidth, canvas.clientHeight];
  thingCount = scatter(forest, { cx: cam.cx, cy: cam.cy, halfW: vw / 2 / cam.scale, halfH: vh / 2 / cam.scale, pxPerCell: cam.scale }, GROUND_CAP, things.data).count;
  things.upload(thingCount);
  things.draw(vw, vh, dpr, detail);
}

const timer = new GpuTimer(gl);

/** GPU ms per full-screen map draw (timer query; the camera jitters so no draw is redundant). */
async function measureDraw(n: number): Promise<number> {
  const base = cam;
  let i = 0;
  const ms = await timer.measure(() => {
    cam = { ...base, cx: base.cx + (i++ % 2) * 1e-3 };
    frame();
  }, n);
  cam = base;
  return ms;
}

async function run(): Promise<BenchAResult> {
  const drawMs: Record<string, number> = {};
  const views: [string, Camera][] = [
    ['T0-world', { cx: W / 2, cy: H / 2, scale: fitScale }],
    ['europe-4px', { cx: 1100, cy: 330, scale: 4 }],
    ['close-48px', { cx: 1100.3, cy: 330.7, scale: 48 }],
  ];
  for (const [name, c] of views) {
    cam = c;
    drawMs[name] = await measureDraw(60);
  }
  // The ground of T2 and T3 (PLAN 2.8): the same close view and a closer one, with the detail in full.
  detail = 1;
  for (const [name, c] of [['close-48px-ground', views[2]![1]], ['close-400px-ground', { cx: 1100.3, cy: 330.7, scale: 400 }]] as [string, Camera][]) {
    cam = c;
    drawMs[name] = await measureDraw(60);
  }
  // The coast of T2 and T3 (PLAN 2.9b2): the same two views on a map with a coast in them, the
  // coast drawn from the coverage and then from the fine mask. The difference is the mask's cost.
  const coast = coastMap();
  drawn = coast.map;
  const coastViews: [string, Camera][] = [['close-48px-ground-coast', views[2]![1]], ['close-400px-ground-coast', { cx: 1100.3, cy: 330.7, scale: 400 }]];
  for (const [name, c] of coastViews) {
    cam = c;
    drawMs[`${name}-coverage`] = await measureDraw(60);
  }
  if (!coast.map.setLandMask(coast.mask)) throw new Error('bench A: the mask does not fit a texture');
  for (const [name, c] of coastViews) {
    cam = c;
    drawMs[`${name}-mask`] = await measureDraw(60);
  }
  drawn = map;
  // And with what stands on it, scattered and uploaded again in every frame (the camera moves in each).
  // 55 px a cell: the end of an octave of zoom, where a view has the most instances.
  withThings = true;
  cam = { cx: 1100.3, cy: 330.7, scale: 55 };
  drawMs['close-55px-ground-things'] = await measureDraw(60);
  const cpu: number[] = [];
  for (let k = 0; k < 60; k++) {
    cam = { ...cam, cx: cam.cx + 1e-3 };
    const t = performance.now();
    frame();
    cpu.push(performance.now() - t);
  }
  drawMs['close-55px-ground-things-cpu'] = cpu.sort((a, b) => a - b)[30]!;
  drawMs['close-55px-ground-things-count'] = thingCount;
  withThings = false;
  detail = 0;
  cam = views[0]![1];
  const t0Stats = await runFrames(3, frame);

  // Dirty-tile churn: 32 tiles per frame re-uploaded from the source grids.
  const tile = 64;
  const tilesX = W / tile;
  const tilesY = H / tile;
  const tOwner = new Uint16Array(tile * tile);
  const tCtrl = new Uint16Array(tile * tile);
  let k = 0;
  const churn = (): void => {
    for (let n = 0; n < 32; n++) {
      const t = (k++ * 7919) % (tilesX * tilesY);
      const tx = t % tilesX;
      const ty = Math.floor(t / tilesX);
      for (let r = 0; r < tile; r++) {
        const src = (ty * tile + r) * W + tx * tile;
        tOwner.set(world.owner.subarray(src, src + tile), r * tile);
        tCtrl.set(world.controller.subarray(src, src + tile), r * tile);
      }
      map.updateTile(tx, ty, tile, tOwner, tCtrl, 0);
    }
  };
  const churnStats = await runFrames(3, () => {
    churn();
    frame();
  });

  return {
    renderer: rendererName,
    viewport: [canvas.width, canvas.height],
    dpr,
    map: [W, H],
    nations: world.nations,
    genMs,
    uploadMs,
    drawMs,
    t0: t0Stats,
    t0TileChurn: { ...churnStats, tilesPerFrame: 32 },
  };
}

window.__bench = {
  ready: Promise.resolve(),
  run,
  setCamera: async (cx, cy, scale) => {
    cam = { cx, cy, scale };
    frame();
    gl.finish();
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  },
};
frame();
