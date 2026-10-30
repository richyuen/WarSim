// Critic run 19, session PT (new): touch on the phone (390 x 844, hasTouch) while playing Poland: a tap on a formation,
// a tap on ground (an order), a long press and drag (box select), a short drag (a pan). CDP touch events.
import { chromium } from '@playwright/test';
import { BASE, shot, save, CELLS } from './c20_lib.mjs';
const POL = CELLS.tags.POL;
const out = { steps: [] };
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y })) });
const label = () => page.evaluate(() => document.querySelector('[data-testid=player-label]')?.innerText ?? null);
const cam = () => page.evaluate(() => { const c = window.__warsim.view.controller.cam; return [+c.cx.toFixed(2), +c.cy.toFixed(2), +c.scale.toFixed(2)]; });
const sel = () => page.evaluate(() => window.__warsim.view.selectedFormations.size);
try {
  await page.goto(`${BASE}/?scenario=1938&paused=1&seed=4441`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim.hud.stats.value !== null, null, { timeout: 120_000 });
  await page.waitForFunction((p) => window.__warsim.view.formationsOf(p).length > 3, POL, { timeout: 60_000 });
  await page.evaluate((p) => window.__warsim.view.select(p), POL);
  await page.waitForTimeout(500);
  await page.getByTestId('take-control').tap();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__warsim.view.select(0));
  await page.waitForTimeout(300);
  out.steps.push({ s: 'taken', label: await label() });
  // Centre on a Polish formation at scale 12.
  const id = (await page.evaluate((p) => window.__warsim.view.formationsOf(p), POL))[2];
  const p0 = await page.evaluate((id) => window.__warsim.view.formationPos(id), id);
  await page.evaluate(([x, y]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 12 }), p0);
  await page.waitForTimeout(500);
  await shot(page, 'c20pt_00_before.png');
  // Tap on it.
  await touch('touchStart', [[195, 422]]); await page.waitForTimeout(80); await touch('touchEnd', []);
  await page.waitForTimeout(500);
  out.steps.push({ s: 'tap formation', label: await label(), sel: await sel(), cam: await cam() });
  // Short drag: pan (should end follow, keep selection).
  await touch('touchStart', [[195, 300]]); await page.waitForTimeout(50);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', [[195 + i * 12, 300 + i * 8]]); await page.waitForTimeout(16); }
  await touch('touchEnd', []);
  await page.waitForTimeout(500);
  out.steps.push({ s: 'pan', label: await label(), sel: await sel(), cam: await cam(), following: await page.evaluate(() => window.__warsim.view.controller.following) });
  // Long press and drag: box.
  await page.evaluate(([x, y]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 6 }), p0);
  await page.waitForTimeout(400);
  await touch('touchStart', [[20, 330]]); await page.waitForTimeout(700);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', [[20 + i * 43, 330 + i * 45]]); await page.waitForTimeout(30); }
  await shot(page, 'c20pt_01_box_drawn.png');
  await touch('touchEnd', []);
  await page.waitForTimeout(500);
  out.steps.push({ s: 'long press box', label: await label(), sel: await sel(), cam: await cam() });
  await shot(page, 'c20pt_02_box_done.png');
  // Tap on ground: an order for the selection.
  await touch('touchStart', [[300, 600]]); await page.waitForTimeout(60); await touch('touchEnd', []);
  await page.waitForTimeout(500);
  out.steps.push({ s: 'tap ground', label: await label(), sel: await sel(), moving: await page.evaluate(() => { const v = window.__warsim.view; return [...v.selectedFormations].map((id) => v.formationPos(id)); }) });
  await shot(page, 'c20pt_03_ordered.png');
  // Long press on a foreign nation's ground, no drag: does anything open (the war menu)?
  await page.evaluate(() => window.__warsim.view.controller.set({ cx: 1105, cy: 266, scale: 6 }));
  await page.waitForTimeout(400);
  await touch('touchStart', [[195, 422]]); await page.waitForTimeout(900); await touch('touchEnd', []);
  await page.waitForTimeout(500);
  out.steps.push({ s: 'long press Germany', menu: await page.evaluate(() => document.querySelector('[data-testid=nation-menu]')?.innerText ?? null), label: await label(), nationPanel: await page.evaluate(() => document.querySelector('[data-testid=nation-panel]')?.innerText.slice(0, 60) ?? null) });
  await shot(page, 'c20pt_04_longpress_foreign.png');
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save('c20_pt_touch.json', out);
await browser.close();
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
