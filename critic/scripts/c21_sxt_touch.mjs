// Critic run 21, session SXT: R20-B1's case on touch. Phone portrait 390x844, Germany at war with Poland for 60 days
// (seed 4441), 12 taps centred on German formations (their drawn place): is the panel the selected formation's?
import { chromium } from '@playwright/test';
import { BASE, shot, save, CELLS, hours } from './c21_lib.mjs';
const out = { taps: [] };
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
try {
  await page.goto(`${BASE}/?scenario=1938&paused=1&seed=4441`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim.hud.stats.value !== null, null, { timeout: 120_000 });
  await page.waitForTimeout(1500);
  await page.evaluate((n) => window.__warsim.view.select(n), CELLS.tags.GER);
  await page.waitForTimeout(600);
  await page.getByTestId('take-control').tap();
  await page.getByTestId('tab-actions').tap();
  await page.waitForTimeout(800);
  await page.locator('.nation-panel select').first().selectOption({ label: 'Poland' });
  await page.getByRole('button', { name: 'Declare war' }).tap();
  await page.getByTestId('nation-close').tap().catch(() => {});
  await hours(page, 24 * 60);
  const ger = await page.evaluate((p) => window.__warsim.view.formationsOf(p), CELLS.tags.GER);
  const cx = 195, cy = 422;
  for (let k = 0; k < 12; k++) {
    const id = ger[k * 3];
    const at = async () => page.evaluate((id) => { const v = window.__warsim.view; const i = v.formIds.indexOf(id); return i < 0 ? null : v.drawnAt(i); }, id);
    let p = await at();
    if (!p) continue;
    await page.evaluate(() => window.__warsim.view.selectedFormations.clear());
    await page.evaluate(([x, y]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 12 }), p);
    await page.waitForTimeout(400);
    p = await at();
    await page.evaluate(([x, y]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 12 }), p);
    await page.waitForTimeout(300);
    await page.touchscreen.tap(cx, cy);
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const v = window.__warsim.view;
      const fp = document.querySelector('.formation-panel, [data-testid=formation-panel]');
      return { sel: [...v.selectedFormations], panelId: fp ? Number(fp.dataset.formation) : null, panel: fp ? fp.innerText.split('\n').slice(0, 6).join(' | ') : null };
    });
    r.id = id;
    out.taps.push(r);
    if (k < 3) await shot(page, `c21sxt_${k}.png`);
  }
  out.selected = out.taps.filter((t) => t.sel.length > 0).length;
  out.panelIsSelected = out.taps.filter((t) => t.sel.length > 0 && t.panelId === t.sel[0]).length;
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save('c21_sxt_4441.json', out);
await browser.close();
console.log(out.selected, out.panelIsSelected, out.fatal ?? '', errors.slice(0, 3));
