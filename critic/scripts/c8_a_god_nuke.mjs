// Critic run 8, session A: title, boot, God Mode's toolbar by clicks, a hydrogen bomb on Paris and
// an atomic one on London by map clicks, the ruins after 10 days at three tiers, the struck nations'
// panels and the nuclear charts, then the phone.
// Usage: node critic/scripts/c8_a_god_nuke.mjs <seed>
import { launch, BASE, shot, save, lookAt, CELLS, settle, buttons, hours } from './c8_lib.mjs';

const seed = Number(process.argv[2] ?? 4711);
const out = { seed, shots: [], notes: {} };
const { browser, page, errors } = await launch();
const S = async (n) => out.shots.push(await shot(page, `c8a_${seed}_${n}.png`));
const text = () => page.evaluate(() => document.body.innerText);

await page.goto(`${BASE}/`);
await page.waitForTimeout(4000);
await S('00_title');
out.notes.titleButtons = await buttons(page);
out.notes.langOptions = await page.evaluate(() => [...document.querySelectorAll('select option')].map((o) => o.textContent));

const t0 = Date.now();
await page.goto(`${BASE}/?scenario=1938&paused=1&seed=${seed}`);
await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 180_000 });
await page.waitForFunction(() => window.__warsim.hud.stats.value !== null && window.__warsim.sim.mapLayers !== null, null, { timeout: 180_000 });
out.notes.bootMs = Date.now() - t0;
await page.waitForTimeout(1500);
await S('01_boot');
out.notes.hudButtons = await buttons(page);

// God Mode by its button
await page.getByRole('button', { name: 'God Mode' }).click();
await page.waitForTimeout(700);
await S('02_godmode_on');
out.notes.godToolbar = await page.evaluate(() => document.querySelector('[data-testid=god-tools]')?.innerText ?? null);
out.notes.godToolbarRect = await page.evaluate(() => {
  const r = document.querySelector('[data-testid=god-tools]')?.getBoundingClientRect();
  return r ? [r.x, r.y, r.width, r.height] : null;
});

const [px, py] = CELLS.paris;
const [lx, ly] = CELLS.london;
const casualtyText = async () => (await text()).split('\n').filter((l) => /dead|killed|nuclear|warhead|strike|bomb/i.test(l)).slice(0, 30);

// Hydrogen bomb on Paris
await lookAt(page, px, py, 150);
await S('10_paris_150_before');
await lookAt(page, px, py, 2500);
await S('11_paris_2500_before');
await page.locator('[data-testid=god-tool-nuke]').click();
await page.waitForTimeout(400);
out.notes.nukeSizes = await page.evaluate(() => [...document.querySelectorAll('[data-testid=god-nuke-size] option')].map((o) => o.textContent));
await page.locator('[data-testid=god-nuke-size]').selectOption('thermonuclear');
out.notes.nukeHint = await page.evaluate(() => document.querySelector('[data-testid=god-tool-hint]')?.innerText ?? null);
await S('12_nuke_tool_h');
await page.mouse.click(800, 450);
await page.waitForTimeout(1500);
await S('13_paris_h_strike');
out.notes.afterParis = await casualtyText();
await hours(page, 2);
await S('14_paris_h_2h');

// Atomic bomb on London
await lookAt(page, lx, ly, 2500);
await page.locator('[data-testid=god-tool-nuke]').click();
await page.waitForTimeout(300);
await page.locator('[data-testid=god-nuke-size]').selectOption('fission');
await page.mouse.click(800, 450);
await page.waitForTimeout(1500);
await S('15_london_a_strike');
out.notes.afterLondon = await casualtyText();

// 10 days on
await hours(page, 240);
for (const [name, x, y] of [['paris', px, py], ['london', lx, ly]]) {
  for (const m of [3000, 600, 150, 30]) {
    await lookAt(page, x, y, m);
    await S(`20_${name}_${m}m_day10`);
  }
}
out.notes.history = await page.evaluate(() => {
  window.__warsim.hud.toggleHistory();
  return null;
});
await page.waitForTimeout(800);
await S('30_history');
out.notes.historyText = (await text()).slice(0, 4000);
await page.evaluate(() => window.__warsim.hud.toggleHistory());

// France's panel
await lookAt(page, px + 10, py + 10, 2500);
await page.getByRole('button', { name: 'God Mode' }).click(); // off, so a click selects
await page.waitForTimeout(400);
await page.mouse.click(800, 450);
await page.waitForTimeout(1200);
await S('31_france_panel');
out.notes.francePanel = (await text()).slice(0, 5000);

// Charts: the nuclear metrics
await page.evaluate(() => window.__warsim.hud.toggleCharts?.());
await page.waitForTimeout(800);
out.notes.chartOptions = await page.evaluate(() => [...document.querySelectorAll('select option')].map((o) => o.textContent));
await S('32_charts');
for (const opt of out.notes.chartOptions.filter((o) => /nuclear|warhead|fallout/i.test(o ?? ''))) {
  try {
    const sel = page.locator('select').filter({ hasText: opt }).first();
    await sel.selectOption({ label: opt });
    await page.waitForTimeout(600);
    await S(`33_chart_${opt.replace(/[^a-z]/gi, '_').slice(0, 20)}`);
  } catch (e) {
    out.notes[`chartErr_${opt}`] = String(e).slice(0, 200);
  }
}
out.errors = errors;
save(`c8_a_${seed}.json`, out);

// Phone
const ph = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
ph.on('pageerror', (e) => errors.push(`phone pageerror: ${e.message}`));
await ph.goto(`${BASE}/?scenario=1938&paused=1&seed=${seed}`);
await ph.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 180_000 });
await ph.waitForTimeout(2000);
await ph.screenshot({ path: 'critic/shots/c8a_phone_00_boot.png' });
await ph.getByRole('button', { name: 'God Mode' }).click().catch((e) => (out.notes.phoneGodErr = String(e).slice(0, 200)));
await ph.waitForTimeout(700);
await ph.screenshot({ path: 'critic/shots/c8a_phone_01_god.png' });
out.notes.phone = await ph.evaluate(() => ({
  sw: document.documentElement.scrollWidth,
  bar: (() => {
    const r = document.querySelector('[data-testid=bottombar]')?.getBoundingClientRect();
    return r ? [r.x, r.y, r.width, r.height] : null;
  })(),
  tools: (() => {
    const r = document.querySelector('[data-testid=god-tools]')?.getBoundingClientRect();
    const el = document.querySelector('[data-testid=god-tools]');
    return r ? [r.x, r.y, r.width, r.height, el.scrollWidth] : null;
  })(),
  toolsVisible: [...document.querySelectorAll('[data-testid^=god-tool-]')].map((b) => {
    const r = b.getBoundingClientRect();
    return [b.innerText, Math.round(r.x), Math.round(r.right), r.right <= 390 && r.x >= 0];
  }),
}));
out.errors = errors;
save(`c8_a_${seed}.json`, out);
await browser.close();
