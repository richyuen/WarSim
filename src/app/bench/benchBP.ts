/**
 * Render benchmark BP (PLAN 0.15), PixiJS v8: the same proxy scene as benchmark B drawn
 * with a ParticleContainer (Pixi's fastest sprite path). Pixi has no GPU interpolation, so
 * positions are interpolated on the CPU every frame. The map is pre-rendered once by our
 * MapRenderer into a texture so only unit cost is compared.
 */
import { Application, Particle, ParticleContainer, Rectangle, Sprite, Texture } from 'pixi.js';
import { GpuTimer } from '../../render/gl/gpuTimer';
import { MapRenderer } from '../../render/map/MapRenderer';
import { ATLAS_FRAME, drawUnitAtlas } from '../../render/units/atlas';
import type { ProxyBenchCase } from './benchApi';
import { runFrames } from './benchUtil';
import { ProxyScene, TACTICAL_VIEW, TICK_HZ } from './proxyScene';
import { makeSyntheticWorld } from './synthetic';

const W = 2048;
const H = 1024;
const COUNTS = [10_000, 30_000];

const canvas = document.getElementById('map') as HTMLCanvasElement;
const cssW = canvas.clientWidth;
const cssH = canvas.clientHeight;
const world = makeSyntheticWorld(W, H, 150);

// Pre-render the map at the tactical view with our renderer (offscreen GL canvas).
const mapCanvas = document.createElement('canvas');
mapCanvas.width = cssW;
mapCanvas.height = cssH;
const mgl = mapCanvas.getContext('webgl2', { preserveDrawingBuffer: true })!;
const map = new MapRenderer(mgl, W, H, { wrapX: true });
world.colors.forEach((c, i) => map.setColor(i, c));
map.setGrid(world.owner, world.controller);
map.draw({ ...TACTICAL_VIEW }, 1);

const app = new Application();
await app.init({ canvas, width: cssW, height: cssH, resolution: 1, antialias: false, preference: 'webgl', autoStart: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
const pgl = (app.renderer as unknown as { gl: WebGL2RenderingContext }).gl;
const debug = pgl.getExtension('WEBGL_debug_renderer_info');
const rendererName = String(debug ? pgl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : pgl.getParameter(pgl.RENDERER));
const timer = new GpuTimer(pgl);

app.stage.addChild(new Sprite(Texture.from(mapCanvas)));
const atlas = Texture.from(drawUnitAtlas());
const frames = [0, 1, 2, 3].map((i) => new Texture({ source: atlas.source, frame: new Rectangle(i * ATLAS_FRAME, 0, ATLAS_FRAME, ATLAS_FRAME) }));
let container: ParticleContainer | null = null;
let scene: ProxyScene | null = null;
let lastTick = 0;
const tickMs: number[] = [];

function build(n: number): void {
  if (container) {
    app.stage.removeChild(container);
    container.destroy();
  }
  scene = new ProxyScene(n, cssW, cssH, world.colors);
  container = new ParticleContainer({ dynamicProperties: { position: true, rotation: true, vertex: false, uvs: false, color: false } });
  for (let i = 0; i < n; i++) {
    const px = Math.max(scene.size[i]! * TACTICAL_VIEW.scale, 3) / ATLAS_FRAME;
    container.addParticle(new Particle({ texture: frames[scene.frame[i]!]!, anchorX: 0.5, anchorY: 0.5, scaleX: px, scaleY: px, tint: scene.color[i]! }));
  }
  app.stage.addChild(container);
}

function place(now: number): void {
  const s = scene!;
  const t = Math.min(1, (now - lastTick) * TICK_HZ / 1000);
  const ps = container!.particleChildren;
  const k = TACTICAL_VIEW.scale;
  for (let i = 0; i < s.n; i++) {
    const p = ps[i]!;
    p.x = (s.prevX[i]! + (s.x[i]! - s.prevX[i]!) * t - TACTICAL_VIEW.cx) * k + cssW / 2;
    p.y = (s.prevY[i]! + (s.y[i]! - s.prevY[i]!) * t - TACTICAL_VIEW.cy) * k + cssH / 2;
    p.rotation = s.heading[i]!;
  }
}

function frame(now: number): void {
  if (now - lastTick >= 1000 / TICK_HZ) {
    const t0 = performance.now();
    scene!.step();
    tickMs.push(performance.now() - t0);
    lastTick = now;
  }
  place(now);
  app.render();
}

async function runCase(n: number): Promise<ProxyBenchCase> {
  build(n);
  lastTick = performance.now();
  tickMs.length = 0;
  const stats = await runFrames(3, frame);
  let k = 0;
  const gpuFrameMs = await timer.measure(() => {
    place(lastTick + (k++ % 10) * 10);
    app.render();
  }, 30);
  const sorted = [...tickMs].sort((a, b) => a - b);
  return { proxies: n, ...stats, gpuFrameMs, gpuUnitsMs: NaN, tickUploadMsP50: sorted[Math.floor(sorted.length / 2)] ?? NaN };
}

async function run(): Promise<unknown> {
  const cases: ProxyBenchCase[] = [];
  for (const n of COUNTS) cases.push(await runCase(n));
  return { stack: `PixiJS ${(await import('pixi.js')).VERSION} ParticleContainer (CPU interpolation)`, renderer: rendererName, viewport: [cssW, cssH], dpr: 1, cases };
}

window.__bench = {
  ready: Promise.resolve(),
  run,
  setCamera: async () => {
    // The Pixi scene is fixed at the tactical view (the map is a pre-rendered texture).
    place(performance.now());
    app.render();
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  },
};
build(COUNTS[0]!);
lastTick = performance.now();
place(lastTick);
app.render();
