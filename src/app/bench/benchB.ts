/**
 * Render benchmark B (PLAN 0.15), raw WebGL2: the T0 map renderer plus instanced unit
 * proxies with GPU interpolation, at tactical zoom with 10k and 30k proxies on screen.
 */
import type { Camera } from '../../render/camera';
import { GpuTimer } from '../../render/gl/gpuTimer';
import { MapRenderer } from '../../render/map/MapRenderer';
import { drawUnitAtlas } from '../../render/units/atlas';
import { PROXY_STRIDE, ProxyRenderer } from '../../render/units/ProxyRenderer';
import type { ProxyBenchCase } from './benchApi';
import { runFrames } from './benchUtil';
import { ProxyScene, TACTICAL_VIEW, TICK_HZ } from './proxyScene';
import { makeSyntheticWorld } from './synthetic';

const W = 2048;
const H = 1024;
const COUNTS = [10_000, 30_000];

const canvas = document.getElementById('map') as HTMLCanvasElement;
const dpr = window.devicePixelRatio || 1;
canvas.width = Math.round(canvas.clientWidth * dpr);
canvas.height = Math.round(canvas.clientHeight * dpr);
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true })!;
const debug = gl.getExtension('WEBGL_debug_renderer_info');
const rendererName = String(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));

const world = makeSyntheticWorld(W, H, 150);
const map = new MapRenderer(gl, W, H, { wrapX: true });
world.colors.forEach((c, i) => map.setColor(i, c));
map.setGrid(world.owner, world.controller);
const proxies = new ProxyRenderer(gl, drawUnitAtlas());
const timer = new GpuTimer(gl);
let cam: Camera = { ...TACTICAL_VIEW };

let scene: ProxyScene | null = null;
let lastTick = 0;

/** Fills instance data from the scene (one snapshot's worth) and uploads it. */
function uploadScene(s: ProxyScene): void {
  proxies.reserve(s.n);
  proxies.originX = Math.floor(TACTICAL_VIEW.cx);
  proxies.originY = Math.floor(TACTICAL_VIEW.cy);
  const d = proxies.data;
  const c = proxies.colors;
  for (let i = 0; i < s.n; i++) {
    const o = i * PROXY_STRIDE;
    d[o] = s.prevX[i]! - proxies.originX;
    d[o + 1] = s.prevY[i]! - proxies.originY;
    d[o + 2] = s.x[i]! - proxies.originX;
    d[o + 3] = s.y[i]! - proxies.originY;
    d[o + 4] = s.heading[i]!;
    d[o + 5] = s.size[i]!;
    d[o + 6] = s.frame[i]! + 0.5; // moving: the walk/drive animation runs (PLAN 2.3)
    d[o + 7] = 1;
    const col = s.color[i]!;
    c[i * 4] = (col >> 16) & 255;
    c[i * 4 + 1] = (col >> 8) & 255;
    c[i * 4 + 2] = col & 255;
    c[i * 4 + 3] = 255;
  }
  proxies.upload(s.n);
}

function drawFrame(now: number): void {
  const t = (now - lastTick) * TICK_HZ / 1000;
  map.draw(cam, dpr);
  proxies.draw(cam, dpr, t, 3, [0], 1, now / 1000);
}

const tickMs: number[] = [];
function frame(now: number): void {
  if (scene && now - lastTick >= 1000 / TICK_HZ) {
    const t0 = performance.now();
    scene.step();
    uploadScene(scene);
    tickMs.push(performance.now() - t0);
    lastTick = now;
  }
  drawFrame(now);
}

async function runCase(n: number): Promise<ProxyBenchCase> {
  scene = new ProxyScene(n, canvas.clientWidth, canvas.clientHeight, world.colors);
  uploadScene(scene);
  lastTick = performance.now();
  tickMs.length = 0;
  const frames = await runFrames(3, frame);
  let k = 0;
  const gpuFrameMs = await timer.measure(() => drawFrame(lastTick + (k++ % 10) * 10), 30);
  const gpuUnitsMs = await timer.measure(() => proxies.draw(cam, dpr, 0.5), 30);
  const sorted = [...tickMs].sort((a, b) => a - b);
  return {
    proxies: n,
    ...frames,
    gpuFrameMs,
    gpuUnitsMs,
    tickUploadMsP50: sorted[Math.floor(sorted.length / 2)] ?? NaN,
  };
}

async function run(): Promise<unknown> {
  const cases: ProxyBenchCase[] = [];
  for (const n of COUNTS) cases.push(await runCase(n));
  return { stack: 'raw WebGL2 + twgl (instanced, GPU interpolation)', renderer: rendererName, viewport: [canvas.width, canvas.height], dpr, cases };
}

window.__bench = {
  ready: Promise.resolve(),
  run,
  setCamera: async (cx, cy, scale) => {
    cam = { cx, cy, scale };
    drawFrame(performance.now());
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  },
};
scene = new ProxyScene(COUNTS[0]!, canvas.clientWidth, canvas.clientHeight, world.colors);
uploadScene(scene);
drawFrame(performance.now());
