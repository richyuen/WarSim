// Critic run 21, session U: the new gunmetal UI (ADR-762..768) at 1600x900: panels, allies chips, Actions icons,
// God placing icon arm/disarm and the Cancel button, menus, selects, a contrast census of visible text.
import { launch, open1938, shot, save, hours, CELLS, run, pause } from './c21_lib.mjs';
const seed = Number(process.argv[2] ?? 5557);
const [W, H] = [Number(process.argv[3] ?? 1600), Number(process.argv[4] ?? 900)];
const tag = `c21u_${W}`;
const out = { seed, W, H, steps: [] };
const { browser, page, errors } = await launch(W, H);
const S = (n) => shot(page, `${tag}_${n}.png`);
const step = (s, o = {}) => out.steps.push({ s, ...o });
const contrast = () => page.evaluate(() => {
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const bgOf = (e) => { for (let x = e; x; x = x.parentElement) { const s = getComputedStyle(x); const bc = s.backgroundColor; const a = bc.match(/[\d.]+/g); if (a && (a.length < 4 || Number(a[3]) > 0.5)) return bc; } return 'rgb(0,0,0)'; };
  const res = [];
  const walker = document.createTreeWalker(document.getElementById('ui'), NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const e = n.parentElement; if (!e || seen.has(e) || !n.textContent.trim()) continue; seen.add(e);
    if (e.offsetParent === null) continue;
    const r = e.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) continue;
    const s = getComputedStyle(e); const fg = s.color; const bg = bgOf(e);
    const L1 = lum(fg), L2 = lum(bg); const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    res.push({ t: n.textContent.trim().slice(0, 30), cls: String(e.className).slice(0, 30), fg, bg, cr: +cr.toFixed(2), px: s.fontSize });
  }
  res.sort((a, b) => a.cr - b.cr);
  return { n: res.length, under45: res.filter((x) => x.cr < 4.5).length, under3: res.filter((x) => x.cr < 3).length, worst: res.slice(0, 12) };
});
try {
  await open1938(page, seed);
  await page.waitForTimeout(1500);
  step('world', { bar: await page.evaluate(() => document.querySelector('[data-testid=bottombar]').innerText.replace(/\n/g, ' | ')), title: await page.evaluate(() => [document.title, document.querySelector('[data-testid=app-title]')?.innerText]) });
  await S('01_world');
  step('contrast world', await contrast());
  // Germany's overview: allies.
  await page.evaluate((n) => window.__warsim.view.select(n), CELLS.tags.GER);
  await page.waitForTimeout(1200);
  step('germany overview', { allies: await page.evaluate(() => document.querySelector('[data-testid=panel-allies]')?.innerText ?? null), alliance: await page.evaluate(() => document.querySelector('[data-testid=panel-alliance]')?.innerText ?? null) });
  await S('02_germany_overview');
  step('contrast panel', await contrast());
  const chip = page.locator('[data-testid=panel-allies] [data-testid=nation-chip]').first();
  if (await chip.count()) {
    await chip.click();
    await page.waitForTimeout(800);
    step('ally chip clicked', { panel: await page.evaluate(() => document.querySelector('[data-testid=nation-name]')?.innerText), allies: await page.evaluate(() => document.querySelector('[data-testid=panel-allies]')?.innerText ?? null) });
    await S('03_ally_panel');
  }
  // Other tabs.
  await page.evaluate((n) => window.__warsim.view.select(n), CELLS.tags.GER);
  await page.waitForTimeout(800);
  for (const t of ['economy', 'military', 'history']) {
    const tb = page.getByTestId(`tab-${t}`);
    if (await tb.count()) { await tb.click(); await page.waitForTimeout(500); await S(`04_tab_${t}`); }
  }
  await page.getByTestId('take-control').click();
  await page.waitForTimeout(600);
  await page.getByTestId('tab-actions').click();
  await page.waitForTimeout(1500);
  step('actions', { icons: await page.locator('[data-testid=panel-actions] .unit-icon, .nation-panel .unit-icon').count(), iconButtons: await page.locator('.nation-panel button.unit-icon, .nation-panel .unit-icon[role=button]').count() });
  await S('05_actions');
  await page.locator('.nation-panel').screenshot({ path: `critic/shots/${tag}_05b_actions_panel.png` });
  // Scroll the panel to the air list.
  await page.evaluate(() => { const p = document.querySelector('.nation-panel'); const w = p.querySelector('[data-testid^=act-wing-]'); w?.scrollIntoView(); });
  await page.waitForTimeout(400);
  await page.locator('.nation-panel').screenshot({ path: `critic/shots/${tag}_05c_actions_air.png` });
  // God Mode: placing list icons arm / disarm; the Cancel button.
  await page.getByTestId('god-btn').click();
  await page.waitForTimeout(600);
  await page.getByTestId('tab-actions').click().catch(() => {});
  await page.waitForTimeout(600);
  const ic = page.locator('[data-testid$=-icon][data-testid^=act-place-]').first();
  step('place icons', { n: await page.locator('[data-testid$=-icon][data-testid^=act-place-]').count() });
  await ic.scrollIntoViewIfNeeded();
  await ic.click();
  await page.waitForTimeout(400);
  step('icon armed', { cancel: await page.getByTestId('cancel-btn').count(), bar: await page.evaluate(() => document.querySelector('[data-testid=bottombar]').innerText.replace(/\n/g, ' | ')), hint: await page.evaluate(() => [...document.querySelectorAll('.place-hint, [data-testid=place-hint], .hint')].map((e) => e.innerText).join(' / ')), armed: await page.evaluate(() => window.__warsim.player?.placing?.value ?? null) });
  await S('06_place_armed');
  await page.getByTestId('cancel-btn').click().catch((e) => step('cancel click failed', { e: String(e).slice(0, 200) }));
  await page.waitForTimeout(400);
  step('after cancel', { cancel: await page.getByTestId('cancel-btn').count() });
  await page.getByTestId('god-btn').click();
  await page.waitForTimeout(400);
  // Menus and dialogs.
  await page.getByTestId('mapmode-btn').click();
  await page.waitForTimeout(400);
  await S('07_mapmode_menu');
  await page.keyboard.press('Escape');
  for (const [b, n] of [['stats-btn', '08_stats'], ['history-btn', '09_history'], ['editor-btn', '10_editor'], ['settings-btn', '11_settings']]) {
    await page.getByTestId(b).click();
    await page.waitForTimeout(900);
    await S(n);
    if (n === '11_settings' || n === '10_editor') {
      step(`selects ${n}`, await page.evaluate(() => [...document.querySelectorAll('select')].filter((s) => s.offsetParent).map((s) => { const cs = getComputedStyle(s); const o = s.options[0]; const os = o ? getComputedStyle(o) : null; return { val: s.value, fg: cs.color, bg: cs.backgroundColor, optFg: os?.color, optBg: os?.backgroundColor }; })));
      step(`contrast ${n}`, await contrast());
    }
    await page.getByTestId(b).click();
    await page.waitForTimeout(300);
  }
  // Run 40 days and shoot the ticker and banners.
  await page.evaluate((n) => window.__warsim.view.select(0), 0);
  await hours(page, 24 * 40);
  await page.waitForTimeout(800);
  await S('12_day40');
  step('contrast day40', await contrast());
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c21_u_${W}_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out, null, 1).slice(0, 5000));
