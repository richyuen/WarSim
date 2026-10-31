// Critic run 19, session P (run 18's phone/laptop probe + the new map-mode menu, playing a nation and its Actions
// tab, God placement's list): off-screen controls counted at 390 x 844 and 1280 x 720.
import { launch, BASE, shot, save, CELLS } from './c21_lib.mjs';
const out = { views: [] };
for (const [w, h, name] of [[390, 844, 'phone'], [1280, 720, 'laptop']]) {
  const { browser, page, errors } = await launch(w, h);
  const v = { name, w, h, steps: [] };
  const S = async (n) => shot(page, `c21p_${name}_${n}.png`);
  const offscreen = () => page.evaluate(() => [...document.querySelectorAll('button, select, input, [role=menuitem], [role=menuitemradio]')].filter((b) => b.offsetParent !== null).filter((b) => { const r = b.getBoundingClientRect(); return r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1; }).map((b) => (b.innerText || b.title || b.tagName).trim().slice(0, 30)));
  const clipped = () => page.evaluate(() => [...document.querySelectorAll('.bottombar button, .god-tools button, footer button')].filter((b) => b.offsetParent !== null && b.scrollWidth > b.clientWidth + 1).map((b) => b.innerText.trim()));
  const docScroll = () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  try {
    await page.goto(`${BASE}/?scenario=1938&paused=1&seed=3301`);
    await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim.hud.stats.value !== null, null, { timeout: 120_000 });
    await page.waitForTimeout(2500);
    v.steps.push({ s: 'world', off: await offscreen(), clipped: await clipped(), scroll: await docScroll(), bar: await page.evaluate(() => document.querySelector('[data-testid=bottombar]')?.innerText.replace(/\n/g, ' | ')) });
    await S('01_world');
    await page.getByTestId('mapmode-btn').click().catch((e) => v.steps.push({ s: 'mapmode click failed', e: String(e).slice(0, 200) }));
    await page.waitForTimeout(400);
    v.steps.push({ s: 'mapmode menu', off: await offscreen(), menu: await page.evaluate(() => { const m = document.querySelector('[data-testid=mapmode-menu]'); if (!m) return null; const r = m.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, m.querySelectorAll('[data-testid^=mapmode-opt-]').length]; }) });
    await S('02_mapmenu');
    await page.keyboard.press('Escape');
    await page.getByTestId('god-btn').click().catch(() => {});
    await page.waitForTimeout(600);
    v.steps.push({ s: 'god', off: await offscreen(), clipped: await clipped() });
    await S('03_god');
    await page.getByTestId('god-btn').click().catch(() => {});
    // Take Poland, Actions tab.
    await page.evaluate((p) => window.__warsim.view.select(p), CELLS.tags.POL);
    await page.waitForTimeout(600);
    await page.getByTestId('take-control').click();
    await page.waitForTimeout(500);
    await page.getByTestId('tab-actions').click();
    await page.waitForTimeout(500);
    v.steps.push({ s: 'actions', off: await offscreen(), label: await page.evaluate(() => document.querySelector('[data-testid=player-label]')?.innerText ?? null), panel: await page.evaluate(() => { const p = document.querySelector('[data-testid=panel-actions]'); if (!p) return null; const r = p.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }) });
    await S('04_actions');
    await page.getByTestId('god-btn').click().catch(() => {});
    await page.waitForTimeout(500);
    await page.getByTestId('tab-actions').click().catch(() => {});
    await page.waitForTimeout(500);
    v.steps.push({ s: 'actions+god', off: await offscreen(), places: await page.locator('[data-testid^=act-place-]').count() });
    await S('05_actions_god');
  } catch (e) { v.fatal = String(e?.stack ?? e); }
  v.errors = errors;
  out.views.push(v);
  save('c21_p.json', out);
  await browser.close();
}
console.log(JSON.stringify(out, null, 1).slice(0, 6000));
