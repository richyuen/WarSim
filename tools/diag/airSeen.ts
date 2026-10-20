/**
 * PLAN 7.36a's measure: the sorties seen up close over a front in contact, in the page.
 *
 * Germany declares war on Poland by God command; the first day with an armoured division of
 * Germany's in contact, its first infantry and armoured divisions in contact are the picks (the
 * critic's run-10 case, `c10_c_battle.mjs`: seeds 7019 and 4483 are the same world there).
 * (1) The critic's sequence: over each pick, 3,000 to 10 m/px, 2.5 s live at the first speed,
 * then one sample. (2) A live day at `m` m/px over each pick, re-centred on it each hour, a
 * sample each 100 ms. A sample: the wings tasked in view (sorties whose target is in the view,
 * any leg), those aloft, those over their target, and the sorties drawn (`view.sortieMarks`).
 *
 * Usage: `npm run build`, `npx vite preview --port 5299`, then
 * `npx tsx tools/diag/airSeen.ts <seed> <m> <out.json>`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- the page's debug handle, `window.__warsim`, is read untyped */
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

const seed = Number(process.argv[2] ?? 7019);
const M = Number(process.argv[3] ?? 25);
const outFile = process.argv[4] ?? `.cache/airSeen_${seed}_${M}.json`;
const BASE = process.env.BASE ?? 'http://localhost:5299';
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const [GER, POL] = [id('GER'), id('POL')];

interface Sample { tick: number; tasked: number; patrols: number; aloft: number; over: number; drawn: number }

const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
// tsx names the functions declared inside an evaluated one with esbuild's `__name`, which the page lacks.
await context.addInitScript({ content: 'window.__name = (f) => f;' });
const page = await context.newPage();
const ev = <T, A>(fn: (a: A) => T | Promise<T>, arg: A): Promise<T> => page.evaluate(fn as never, arg) as Promise<T>;

const hours = (n: number): Promise<void> => ev(async (n: number) => {
  const w = (window as never as { __warsim: any }).__warsim;
  const target = w.view.lastTick + n;
  await w.sim.step(n);
  await new Promise<void>((done) => { const wait = (): void => void (w.view.lastTick >= target ? done() : setTimeout(wait, 10)); wait(); });
}, n);
const lookAt = async (cx: number, cy: number, m: number): Promise<void> => {
  await ev(({ cx, cy, m }: { cx: number; cy: number; m: number }) => {
    const v = (window as never as { __warsim: any }).__warsim.view;
    v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { cx, cy, m });
  await ev(async () => {
    const v = (window as never as { __warsim: any }).__warsim.view;
    const end = performance.now() + 30_000;
    for (;;) {
      v.draw(performance.now());
      if (!v.unitsAnimating(performance.now()) || performance.now() > end) return;
      await new Promise((d) => setTimeout(d, 25));
    }
  }, 0);
};
const setLive = (on: boolean): Promise<void> => ev((on: boolean) => {
  const h = (window as never as { __warsim: any }).__warsim.hud;
  if (on) h.setSpeedLevel(0);
  if (h.paused.value === on) h.togglePause();
}, on);
const sample = (): Promise<Sample> => ev(() => {
  const v = (window as never as { __warsim: any }).__warsim.view;
  const cam = v.controller.cam;
  const hw = v.canvas.clientWidth / 2 / cam.scale;
  const hh = v.canvas.clientHeight / 2 / cam.scale;
  const t = v.tickProgress(performance.now()) - 1;
  const r: Float32Array = v.sorties;
  const tasked = new Set<string>(), patrols = new Set<string>(), aloft = new Set<string>(), over = new Set<string>();
  for (let i = 0; i + 11 <= r.length; i += 11) {
    const [bx, by, tx, ty, launch, kmh, km, o, nation] = Array.from(r.slice(i, i + 9)) as number[];
    if (Math.abs(tx! - cam.cx) > hw || Math.abs(ty! - cam.cy) > hh) continue;
    const k = `${nation}@${bx!.toFixed(1)},${by!.toFixed(1)},${launch}`;
    tasked.add(k);
    if (o! > 0) patrols.add(k);
    const h = kmh! > 0 ? km! / kmh! : 0;
    const e = t - launch!;
    if (e >= 0 && e < 2 * h + o!) aloft.add(k);
    if (e >= h && e < h + o!) over.add(k);
  }
  return { tick: v.lastTick, tasked: tasked.size, patrols: patrols.size, aloft: aloft.size, over: over.size, drawn: v.sortieMarks.length };
}, 0);
const posOf = (f: number): Promise<[number, number] | null> => ev((f: number) => (window as never as { __warsim: any }).__warsim.view.formationPos(f), f);

await page.goto(`${BASE}/?scenario=1938&paused=1&seed=${seed}`);
await page.waitForFunction(() => ((window as never as { __warsim: any }).__warsim?.view?.frames ?? 0) > 0, null, { timeout: 120_000 });
await page.waitForFunction(() => { const w = (window as never as { __warsim: any }).__warsim; return w.hud.stats.value !== null && w.sim.mapLayers !== null && w.sim.elevation !== null; }, null, { timeout: 120_000 });
await ev(({ a, d }: { a: number; d: number }) => (window as never as { __warsim: any }).__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: GER, d: POL });
let inf: number | undefined;
let arm: number | undefined;
let day = 0;
for (; day < 12 && arm === undefined; day++) {
  await hours(24);
  const all = await ev((n: number) => {
    const v = (window as never as { __warsim: any }).__warsim.view;
    return (v.formationsOf(n) as number[]).filter((f) => v.formationEngaged(f)).map((f) => ({ f, t: JSON.stringify(v.formationTitle(f)) }));
  }, GER);
  inf = all.find((x) => /Infantry/i.test(x.t))?.f;
  arm = all.find((x) => /Armoured/i.test(x.t))?.f;
}
const picks: [string, number | undefined][] = [['inf', inf], ['arm', arm]];
const critic: (Sample & { label: string; f: number; m: number })[] = [];
for (const [label, f] of picks) {
  if (f === undefined) continue;
  for (const m of [3000, 900, 250, 80, 25, 10]) {
    const p = await posOf(f);
    if (!p) break;
    await lookAt(p[0], p[1], m);
    await setLive(true);
    await page.waitForTimeout(2500);
    critic.push({ label, f, m, ...(await sample()) });
    await setLive(false);
  }
}
const days = [];
for (const [label, f] of picks) {
  if (f === undefined) continue;
  const p = await posOf(f);
  if (!p) continue;
  await lookAt(p[0], p[1], M);
  const t0 = (await sample()).tick;
  let last = t0;
  const samples: Sample[] = [];
  await setLive(true);
  while (last - t0 < 24) {
    await page.waitForTimeout(100);
    const s = await sample();
    samples.push(s);
    if (s.tick !== last) {
      last = s.tick;
      const q = await posOf(f);
      if (q) await ev(({ cx, cy }: { cx: number; cy: number }) => { const v = (window as never as { __warsim: any }).__warsim.view; v.controller.set({ cx, cy, scale: v.controller.cam.scale }); }, { cx: q[0], cy: q[1] });
    }
  }
  await setLive(false);
  const tasked = samples.filter((s) => s.tasked > 0);
  const byHour = new Map<number, Sample[]>();
  for (const s of samples) byHour.set(s.tick, [...(byHour.get(s.tick) ?? []), s]);
  const hrs = [...byHour.values()].filter((l) => l.some((s) => s.tasked > 0));
  days.push({
    label, f, samples: samples.length, samplesTasked: tasked.length,
    shareDrawnWhenTasked: +(tasked.filter((s) => s.drawn > 0).length / Math.max(1, tasked.length)).toFixed(3),
    hoursTasked: hrs.length, hoursDrawn: hrs.filter((l) => l.some((s) => s.drawn > 0)).length,
  });
}
writeFileSync(outFile, JSON.stringify({ seed, m: M, day, picks: { inf, arm }, critic, days }, null, 1));
await browser.close();
console.log(JSON.stringify({ critic: critic.filter((c) => c.m <= 25), days }));
