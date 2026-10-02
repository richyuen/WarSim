/**
 * Render benchmark A (PLAN 0.14): raw WebGL2 + twgl id-map renderer on a 2048×1024
 * synthetic world with 150 nations. Driven by tools/bench via `window.__bench`.
 */
import type { Camera } from '../../render/camera';
import { GpuTimer } from '../../render/gl/gpuTimer';
import { MapRenderer } from '../../render/map/MapRenderer';
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

const fitScale = Math.min(canvas.clientWidth / W, canvas.clientHeight / H);
let cam: Camera = { cx: W / 2, cy: H / 2, scale: fitScale };

function frame(): void {
  map.draw(cam, dpr);
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
