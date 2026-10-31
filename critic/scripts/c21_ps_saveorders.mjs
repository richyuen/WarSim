// Critic run 19, session PS (new, ADR-759's saved state): playing Poland with the navy box unticked, at war with
// Germany, a march ordered by a click; saved two hours in; run on 72 h (A); the save loaded and run 72 h (B):
// the same hash? The boxes and the label after the load.
import { launch, open1938, save, CELLS, hours } from './c21_lib.mjs';
const seed = Number(process.argv[2] ?? 1213);
const POL = CELLS.tags.POL, GER = CELLS.tags.GER;
const out = { seed };
const { browser, page, errors } = await launch();
const h = () => page.evaluate(async () => { const r = await window.__warsim.sim.hash(); return { tick: r.tick, hash: (r.hash >>> 0).toString(16) }; });
const boxes = () => page.evaluate(() => [...document.querySelectorAll('[data-testid^=act-assist-]')].map((e) => `${e.dataset.testid.slice(11)}=${e.checked ? 1 : 0}`).join(' '));
try {
  await open1938(page, seed);
  await page.waitForFunction((p) => window.__warsim.view.formationsOf(p).length > 3, POL, { timeout: 60_000 });
  await page.evaluate((p) => window.__warsim.view.select(p), POL);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  await page.getByTestId('act-assist-navy').uncheck();
  await page.getByTestId('act-target').selectOption(String(GER));
  await page.getByTestId('act-war').click();
  await page.waitForTimeout(300);
  out.boxes0 = await boxes();
  await page.evaluate(() => window.__warsim.view.select(0));
  const id = (await page.evaluate((p) => window.__warsim.view.formationsOf(p), POL))[3];
  const p0 = await page.evaluate((id) => window.__warsim.view.formationPos(id), id);
  await page.evaluate(([x, y]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 16 }), p0);
  await page.waitForTimeout(400);
  await page.mouse.click(800, 450);
  await page.waitForTimeout(300);
  await page.mouse.click(800 - 10 * 16, 450);
  await page.waitForTimeout(300);
  await hours(page, 2);
  out.h2 = await h();
  const bytes = await page.evaluate(async () => Array.from(await window.__warsim.sim.save()));
  out.saveBytes = bytes.length;
  await hours(page, 72);
  out.A = await h();
  out.loaded = await page.evaluate(async (b) => { const r = await window.__warsim.sim.load(new Uint8Array(b)); return { tick: r.tick, hash: (r.hash >>> 0).toString(16) }; }, bytes);
  await page.waitForTimeout(800);
  await hours(page, 72);
  out.B = await h();
  out.same = out.A.hash === out.B.hash && out.A.tick === out.B.tick;
  out.labelAfter = await page.evaluate(() => document.querySelector('[data-testid=player-label]')?.innerText ?? null);
  await page.evaluate((p) => window.__warsim.view.select(p), POL);
  await page.waitForTimeout(400);
  await page.getByTestId('tab-actions').click().catch(() => {});
  await page.waitForTimeout(300);
  out.boxesAfter = await boxes();
  out.playerAi = await page.evaluate(async () => (await window.__warsim.sim.inspect()).playerAi);
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c21_ps_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out, null, 1));
