// Critic run 17 helpers (Playwright driving the production build on port 5299).
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const SHOTS = path.join(ROOT, 'critic/shots');
export const BASE = 'http://127.0.0.1:5336';
mkdirSync(SHOTS, { recursive: true });

export async function launch(w = 1600, h = 900) {
  const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`.slice(0, 400));
  });
  return { browser, page, errors };
}

export async function open1938(page, seed, extra = '') {
  await page.goto(`${BASE}/?scenario=1938&paused=1&seed=${seed}${extra}`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 120_000 });
  await page.waitForFunction(() => window.__warsim.hud.stats.value !== null && window.__warsim.sim.mapLayers !== null && window.__warsim.sim.elevation !== null, null, { timeout: 120_000 });
}

export async function settle(page, timeoutMs = 30_000) {
  await page.evaluate(async (timeoutMs) => {
    const v = window.__warsim.view;
    const deadline = performance.now() + timeoutMs;
    for (;;) {
      const now = performance.now();
      v.draw(now);
      if (!v.unitsAnimating(now)) return;
      if (performance.now() > deadline) return;
      await new Promise((d) => setTimeout(d, 25));
    }
  }, timeoutMs);
}

export async function lookAt(page, cx, cy, m, doSettle = true) {
  await page.evaluate(({ cx, cy, m }) => {
    const v = window.__warsim.view;
    v.controller.set({ cx, cy, scale: (v.metresPerPx * v.controller.cam.scale) / m });
  }, { cx, cy, m });
  if (doSettle) await settle(page);
  else await page.waitForTimeout(400);
}

export async function shot(page, name) {
  const p = path.join(SHOTS, name);
  await page.screenshot({ path: p });
  return `critic/shots/${name}`;
}

/** Steps n hours and waits for the snapshot of the last one. */
export async function hours(page, n) {
  await page.evaluate(async (n) => {
    const w = window.__warsim;
    const target = w.view.lastTick + n;
    await w.sim.step(n);
    const t0 = performance.now();
    await new Promise((done) => {
      const wait = () => void (w.view.lastTick >= target || performance.now() - t0 > 600000 ? done() : setTimeout(wait, 10));
      wait();
    });
  }, n);
}

export const inspect = (page) => page.evaluate(() => window.__warsim.sim.inspect());

export function save(name, obj) {
  writeFileSync(path.join(ROOT, 'critic', name), JSON.stringify(obj, null, 1));
}

/** Lon/lat to cell, by the 1938 projection (equirectangular over the map). */
export async function cellOf(page, lon, lat) {
  return page.evaluate(({ lon, lat }) => {
    const l = window.__warsim.sim.mapLayers;
    const w = l.w ?? l.width;
    const h = l.h ?? l.height;
    return [((lon + 180) / 360) * w, ((90 - lat) / 180) * h];
  }, { lon, lat });
}

import { readFileSync } from 'node:fs';
export const CELLS = JSON.parse(readFileSync(path.join(ROOT, 'critic/c6_cells.json'), 'utf8'));
/** Screen position of a world cell point in the current camera. */
export async function screenOf(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const v = window.__warsim.view;
    const c = v.controller.cam;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return [(x - c.cx) * c.scale + vw / 2, (y - c.cy) * c.scale + vh / 2, v.metresPerPx];
  }, { x, y });
}
export const run = (page) => page.evaluate(() => (window.__warsim.hud.paused.value ? window.__warsim.hud.togglePause() : undefined));
export const pause = (page) => page.evaluate(() => (window.__warsim.hud.paused.value ? undefined : window.__warsim.hud.togglePause()));

export const maxSpeed = (page) => page.evaluate(() => window.__warsim.hud.setSpeedLevel(99));
export const buttons = (page) => page.evaluate(() => [...document.querySelectorAll('button, select, input, a')].filter((b) => b.offsetParent !== null).map((b) => (b.innerText || b.value || b.title || b.getAttribute('aria-label') || b.tagName).trim().slice(0, 40)));
export const dateText = (page) => page.evaluate(() => String(window.__warsim.hud.date?.() ?? ''));
