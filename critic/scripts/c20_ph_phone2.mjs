// Critic run 20, session PH: a phone in portrait (390x844) and on its side (844x390), touch: the compact news
// (ADR-760), the war banners' +N, the folded legend and ranking, the Cancel button ending a selection by a tap,
// the Actions tab's icons, after 60 days of a war started by the player (seed 4441, Germany on Poland).
import { chromium } from '@playwright/test';
import { BASE, shot, save, CELLS, hours } from './c20_lib.mjs';
const out = { views: [] };
for (const [w, h, name] of [[390, 844, 'portrait'], [844, 390, 'landscape']]) {
  const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  const v = { name, w, h, steps: [] };
  const S = (n) => shot(page, `c20ph_${name}_${n}.png`);
  const layout = () => page.evaluate(() => {
    const box = (sel) => { const e = document.querySelector(sel); if (!e || e.offsetParent === null) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
    const bar = document.querySelector('[data-testid=bottombar]');
    const area = (b) => (b ? Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]) : 0);
    const parts = { ticker: box('[data-testid=ticker]'), banners: box('[data-testid=war-banners]'), legend: box('.map-legend, [data-testid=map-legend]'), ranking: box('.stats-ranking, [data-testid=stats-ranking]'), panel: box('.nation-panel'), bar: box('[data-testid=bottombar]'), top: box('[data-testid=topbar]') };
    const covered = Object.values(parts).reduce((s, b) => s + area(b), 0) / (innerWidth * innerHeight);
    const offBtns = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null).filter((b) => { const r = b.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1; }).map((b) => b.innerText.trim().slice(0, 20));
    return { parts, coveredShare: +covered.toFixed(2), tickerRows: document.querySelectorAll('[data-testid=ticker] li').length, banners: document.querySelectorAll('[data-testid=war-banner]').length, more: document.querySelector('[data-testid=war-more]')?.innerText ?? null, bar: bar ? [bar.scrollWidth, bar.clientWidth, bar.scrollHeight, bar.clientHeight] : null, offBtns, cancel: !!document.querySelector('[data-testid=cancel-btn]') };
  });
  try {
    await page.goto(`${BASE}/?scenario=1938&paused=1&seed=4441`);
    await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim.hud.stats.value !== null, null, { timeout: 120_000 });
    await page.waitForTimeout(1500);
    v.steps.push({ s: 'start', ...(await layout()) });
    await S('01_start');
    // Germany taken, war on Poland, 60 days.
    await page.evaluate((n) => window.__warsim.view.select(n), CELLS.tags.GER);
    await page.waitForTimeout(600);
    await page.getByTestId('take-control').tap();
    await page.getByTestId('tab-actions').tap();
    await page.waitForTimeout(800);
    await page.locator('.nation-panel select').first().selectOption({ label: 'Poland' });
    await page.getByRole('button', { name: 'Declare war' }).tap();
    await page.waitForTimeout(500);
    v.steps.push({ s: 'actions tab', ...(await layout()) });
    await S('02_actions');
    await page.getByTestId('nation-close').tap().catch(() => {});
    await hours(page, 24 * 60);
    await page.waitForTimeout(1200);
    v.steps.push({ s: 'day 60', ...(await layout()), tickerText: await page.evaluate(() => document.querySelector('[data-testid=ticker]')?.innerText ?? null) });
    await S('03_day60');
    const more = page.locator('button[data-testid=war-more]');
    if (await more.count()) {
      await more.tap();
      await page.waitForTimeout(400);
      v.steps.push({ s: '+N opened', ...(await layout()) });
      await S('04_banners_open');
      await more.tap();
    }
    // Legend and ranking folded: tap to open.
    for (const sel of ['.map-legend', '.stats-ranking']) {
      const t = page.locator(`${sel} button, ${sel} .legend-title, ${sel} summary`).first();
      if (await t.count()) { await t.tap().catch(() => {}); await page.waitForTimeout(400); v.steps.push({ s: `${sel} tapped`, ...(await layout()) }); await S(`05_${sel.slice(1)}`); await t.tap().catch(() => {}); }
    }
    // Select a formation by a tap, then the Cancel button.
    const id = (await page.evaluate((p) => window.__warsim.view.formationsOf(p), CELLS.tags.GER))[3];
    const p0 = await page.evaluate((id) => window.__warsim.view.formationPos(id), id);
    await page.evaluate(([x, y]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 12 }), p0);
    await page.waitForTimeout(500);
    await page.touchscreen.tap(Math.round(w / 2), Math.round(h / 2));
    await page.waitForTimeout(500);
    v.steps.push({ s: 'formation tapped', sel: await page.evaluate(() => window.__warsim.view.selectedFormations.size), ...(await layout()) });
    await S('06_selected');
    const cb = page.getByTestId('cancel-btn');
    const box = await cb.boundingBox().catch(() => null);
    v.steps.push({ s: 'cancel box', box });
    if (box) { await cb.tap(); await page.waitForTimeout(400); }
    v.steps.push({ s: 'after cancel', sel: await page.evaluate(() => window.__warsim.view.selectedFormations.size), cancel: await cb.count() });
    await S('07_after_cancel');
  } catch (e) { v.fatal = String(e?.stack ?? e).slice(0, 800); }
  v.errors = errors;
  out.views.push(v);
  save('c20_ph.json', out);
  await browser.close();
}
console.log(JSON.stringify(out, null, 1).slice(0, 8000));
