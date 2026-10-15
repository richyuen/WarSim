// Bench G (PLAN 7.1j): the frame budgets on the game itself. The production build of the 1938
// world at 1920 × 1080, the sim running at its default speed, measured by the view's own loop:
//  - T0: the whole world in view (103 nations at the start), the camera panning east, so that
//    every frame is drawn; budget ≥ 60 fps (SPEC §8);
//  - T2: God Mode stands divisions of one nation in western China until 10,000 element sprites or
//    more are in the view, at 200 m/px; budget ≥ 30 fps.
// A frame counts when the view drew it (`view.frames`); the CPU of a frame is `view.draw`'s
// (the GL calls and the overlay's Canvas2D), the GPU's a timer query around the frame's WebGL
// passes drawn back to back (ADR-407). The verdict is the dedicated GPU's; a weak setting is
// run beside it and reported, not judged.
import type { Browser, Page } from '@playwright/test';
import type {} from '../../src/app/testApi';
import type { Command } from '../../src/shared/commands';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';

export const T0_FPS = 60;
export const T2_FPS = 30;
export const T2_PROXIES = 10_000;
/** SPEC §8, the bench machine's GPU budgets (ADR-4) and the main thread's. */
export const T0_GPU_MS = 1.0;
export const T2_GPU_MS = 2.0;
export const FRAME_CPU_MS = 6;
const spec = (budget: number, value: number): SpecBudget => ({ budget, value, within: value <= budget });
const GRID: [number, number] = [24, 16];
const SECONDS = 8;
const T2_M_PER_PX = 200;
/** Western China: no formation stands near it at the start (`tiers1938.spec.ts`). */
const SITE = [1578.5, 338.5] as const;
const nation = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

export interface Setting {
  name: string;
  args: string[];
  /** Only this setting's cases are judged against the budgets. */
  judged: boolean;
}

interface Measured {
  frames: number;
  seconds: number;
  fps: number;
  rafFps: number;
  frameMsP50: number;
  frameMsP95: number;
  frameMsMax: number;
  cpuMsP50: number;
  cpuMsP95: number;
  gpuFrameMs: number;
  /** 7.1j's figure: 30 whole draws in one query, their CPU in it (an upper bound). */
  gpuDrawsMs: number;
  /** The passes in each query of `gpuFrameMs`. */
  gpuPasses: number;
}

/** A SPEC §8 budget of the bench machine (ADR-4), reported beside the verdict and not part of it (PLAN 7.1l). */
interface SpecBudget {
  budget: number;
  value: number;
  within: boolean;
}

export interface GameCase extends Measured {
  tier: 'T0' | 'T2';
  metresPerPx: number;
  nations: number;
  proxiesOnScreen: number;
  elements: number;
  budgetFps: number;
  /** SPEC §8: the GPU's frame (T0 ≤ 1.0 ms, T2 ≤ 2.0) and the main thread's draw (≤ 6 ms, the median). */
  specGpuMs: SpecBudget;
  specCpuMs: SpecBudget;
  /** What God Mode stood in the view (T2). */
  stage?: { nation: string; template: string; divisions: number; grid: [number, number]; site: readonly [number, number] };
  pass: boolean | null;
}

/** Runs the view's loop for `seconds`, every frame drawn; `panPerS` moves the camera east (cells a second). */
async function measure(page: Page, seconds: number, panPerS: number): Promise<Measured> {
  return page.evaluate(
    async ({ seconds, panPerS, w }) => {
      const v = window.__warsim!.view!;
      const own = v.draw.bind(v);
      const cpu: number[] = [];
      v.draw = (now?: number): void => {
        const t0 = performance.now();
        own(now);
        cpu.push(performance.now() - t0);
      };
      const pct = (xs: number[], p: number): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? 0;
      const gaps: number[] = [];
      const frames0 = v.frames;
      const start = performance.now();
      let last = -1;
      await new Promise<void>((done) => {
        const loop = (now: number): void => {
          if (last >= 0) {
            gaps.push(now - last);
            const c = v.camera;
            if (panPerS !== 0) v.controller.set({ cx: (c.cx + (panPerS * (now - last)) / 1000) % w, cy: c.cy, scale: c.scale });
          }
          last = now;
          v.requestDraw();
          if (now - start < seconds * 1000) requestAnimationFrame(loop);
          else done();
        };
        requestAnimationFrame(loop);
      });
      const wall = (performance.now() - start) / 1000;
      const frames = v.frames - frames0;
      delete (v as { draw?: unknown }).draw;
      // The GPU's time of a frame (ADR-407): the frame's WebGL passes (`drawWebGl`) drawn n times
      // back to back in one timer query (EXT_disjoint_timer_query_webgl2), after as many again
      // to bring the GPU's clock up; the median of 5. Their CPU is a few hundredths of a ms, so
      // the query holds the GPU's work alone. A query about a whole `draw` held the overlay's
      // Canvas2D on the CPU too, which the GPU waits through (7.1j's 1.58 ms at T0); one about a
      // single draw a frame read 1 to 5.5 ms for the same frame, the GPU's clock down between
      // frames. `gpuDrawsMs` is 7.1j's figure, 30 whole draws in one query, kept beside it.
      const gl = v.gl;
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
      const gpu = async (n: number, draw: (t: number) => void, warm: boolean): Promise<number> => {
        if (!ext) return NaN;
        const t = performance.now();
        if (warm) for (let i = 0; i < n; i++) draw(t);
        const q = gl.createQuery()!;
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        for (let i = 0; i < n; i++) draw(t + i * 16);
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        gl.flush();
        let ms = NaN;
        for (let tries = 0; tries < 600; tries++) {
          await new Promise((r) => requestAnimationFrame(r));
          if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) as boolean) {
            if (!(gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean)) ms = (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6 / n;
            break;
          }
        }
        gl.deleteQuery(q);
        return ms;
      };
      v.draw(performance.now());
      // As many as make some 100 ms of work, 60 at most: the software rasteriser draws the ground
      // of T2 in 0.6 s, and 600 of them held the page for minutes. One pass's wall time to a
      // pixel read back (which waits for the GPU), less a read back alone, is an upper bound of
      // its work; the least of three.
      const toPixel = (pass: boolean): number => {
        let best = Infinity;
        for (let k = 0; k < 3; k++) {
          const t = performance.now();
          if (pass) v.drawWebGl(t);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
          best = Math.min(best, performance.now() - t);
        }
        return best;
      };
      const n = Math.max(2, Math.min(60, Math.round(100 / Math.max(0.01, toPixel(true) - toPixel(false)))));
      const passes: number[] = [];
      for (let k = 0; k < 5; k++) passes.push(await gpu(n, (t) => v.drawWebGl(t), true));
      const gpuFrameMs = pct(passes, 0.5);
      const gpuDrawsMs = await gpu(30, (t) => v.draw(t), false);
      return {
        frames,
        seconds: wall,
        fps: frames / wall,
        rafFps: gaps.length / wall,
        frameMsP50: pct(gaps, 0.5),
        frameMsP95: pct(gaps, 0.95),
        frameMsMax: Math.max(0, ...gaps),
        cpuMsP50: pct(cpu, 0.5),
        cpuMsP95: pct(cpu, 0.95),
        gpuFrameMs,
        gpuDrawsMs,
        gpuPasses: n,
      };
    },
    { seconds, panPerS, w: SIZE_1938.w },
  );
}

/** The element sprites whose place is in the view, the living nations, the view's metres a pixel. */
async function scene(page: Page): Promise<{ proxiesOnScreen: number; elements: number; nations: number; metresPerPx: number }> {
  return page.evaluate(SCENE);
}

const SCENE = (): { proxiesOnScreen: number; elements: number; nations: number; metresPerPx: number } => {
    const api = window.__warsim!;
    const v = api.view!;
    const c = v.camera;
    const hw = v.gl.canvas.width / (window.devicePixelRatio || 1) / 2 / c.scale;
    const hh = v.gl.canvas.height / (window.devicePixelRatio || 1) / 2 / c.scale;
    let on = 0;
    for (let i = 0; i < v.elementCount; i++) if (Math.abs(v.elementX[i]! - c.cx) <= hw && Math.abs(v.elementY[i]! - c.cy) <= hh) on++;
    return { proxiesOnScreen: on, elements: v.elementCount, nations: api.hud.stats.value?.nations.length ?? 0, metresPerPx: v.metresPerPx };
};

function judge(m: Measured, budgetFps: number, judged: boolean, ok = true): boolean | null {
  return judged ? ok && m.fps >= budgetFps : null;
}

async function openGame(page: Page): Promise<void> {
  // Paused at first: the T2 stage is laid out before a tick runs.
  await page.goto('/?scenario=1938&seed=1938&paused=1');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 120_000 });
}

/** The game run or paused by the HUD's own button, so the bottom bar says which. */
async function run(page: Page, on: boolean): Promise<void> {
  await page.evaluate((on) => {
    const hud = window.__warsim!.hud;
    if (hud.paused.value === on) hud.togglePause();
  }, on);
}

async function setCamera(page: Page, cx: number, cy: number, scale: number): Promise<void> {
  await page.evaluate(
    ({ cx, cy, scale }) => {
      window.__warsim!.view!.controller.set({ cx, cy, scale });
      window.__warsim!.view!.requestDraw();
    },
    { cx, cy, scale },
  );
}

/** The divisions for T2: one nation's, on its own ground, its AI off, in rows across the view. */
function t2Stage(cols: number, rows: number, spanX: number, spanY: number): Command[] {
  const JAP = nation('JAP');
  const INF = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
  const out: Command[] = [
    { kind: 'paintControl', nation: JAP, x: SITE[0], y: SITE[1], r: 20 },
    { kind: 'setAi', nation: JAP, enabled: false },
  ];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) out.push({ kind: 'spawnFormation', nation: JAP, x: SITE[0] - spanX / 2 + ((i + 0.5) * spanX) / cols, y: SITE[1] - spanY / 2 + ((j + 0.5) * spanY) / rows, strength: 0, template: INF });
  return out;
}

export async function gameBench(browser: Browser, baseURL: string, setting: Setting, shot: (page: Page, name: string) => Promise<void>): Promise<{ setting: string; renderer: string; cases: GameCase[] }> {
  const context = await browser.newContext({ baseURL, viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  // tsx names the functions declared inside an evaluated one with esbuild's `__name`, which the page lacks.
  await context.addInitScript({ content: 'window.__name = (f) => f;' });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('[page]', e.message));
  try {
    await openGame(page);
    const renderer = await page.evaluate(() => {
      const gl = window.__warsim!.view!.gl;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    });
    const kmPerCell = await page.evaluate(() => window.__warsim!.view!.geo.kmPerCell);
    const cases: GameCase[] = [];

    // T0: the whole world across the view's width, the game running.
    await setCamera(page, SIZE_1938.w / 2, SIZE_1938.h / 2, 1920 / SIZE_1938.w);
    await run(page, true);
    await page.waitForTimeout(2000);
    const t0 = await measure(page, SECONDS, 40);
    const s0 = await scene(page);
    console.log(`${setting.name} T0: ${t0.fps.toFixed(1)} fps, ${s0.nations} nations`);
    await shot(page, 't0-world');
    cases.push({ tier: 'T0', ...s0, ...t0, budgetFps: T0_FPS, specGpuMs: spec(T0_GPU_MS, t0.gpuFrameMs), specCpuMs: spec(FRAME_CPU_MS, t0.cpuMsP50), pass: judge(t0, T0_FPS, setting.judged) });

    // T2: the divisions stood across the view, then the game running at the default speed.
    await run(page, false);
    const scale = (kmPerCell * 1000) / T2_M_PER_PX;
    const spanX = 1920 / scale;
    const spanY = 1080 / scale;
    for (const c of t2Stage(GRID[0], GRID[1], spanX * 0.9, spanY * 0.85)) await page.evaluate((cmd) => window.__warsim!.sim.command(cmd), c);
    await setCamera(page, SITE[0], SITE[1], scale);
    await run(page, true);
    for (let deadline = Date.now() + 180_000; (await scene(page)).proxiesOnScreen < T2_PROXIES; ) {
      if (Date.now() > deadline) throw new Error(`fewer than ${T2_PROXIES} sprites in the view at T2 after 180 s`);
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2000);
    const t2 = await measure(page, SECONDS, 0);
    const s2 = await scene(page);
    console.log(`${setting.name} T2: ${t2.fps.toFixed(1)} fps, ${s2.proxiesOnScreen} of ${s2.elements} sprites on screen`);
    await shot(page, 't2-proxies');
    cases.push({ tier: 'T2', ...s2, ...t2, budgetFps: T2_FPS, specGpuMs: spec(T2_GPU_MS, t2.gpuFrameMs), specCpuMs: spec(FRAME_CPU_MS, t2.cpuMsP50), stage: { nation: 'JAP', template: 'infantry_div', divisions: GRID[0] * GRID[1], grid: GRID, site: SITE }, pass: judge(t2, T2_FPS, setting.judged, s2.proxiesOnScreen >= T2_PROXIES) });
    return { setting: setting.name, renderer, cases };
  } finally {
    await context.close();
  }
}
