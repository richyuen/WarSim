// Critic run 15, session PL (new): playing a nation. Take control of Poland, declare war on Lithuania by the
// Actions tab, 20 days, offer peace; what the ticker and the panel say at each step; a formation clicked.
import { launch, open1938, shot, save, lookAt, CELLS, hours, screenOf } from './c15_lib.mjs';
const seed = Number(process.argv[2] ?? 6011);
const T = CELLS.tags;
const out = { seed, steps: [] };
const { browser, page, errors } = await launch();
const ticker = () => page.evaluate(() => document.body.innerText.split('\n').filter((l) => /19\d\d /.test(l)).slice(-6));
const panel = () => page.evaluate(() => document.querySelector('[data-testid=nation-panel]')?.innerText.slice(0, 900) ?? null);
try {
  await open1938(page, seed);
  await page.evaluate((p) => window.__warsim.hud.onSelectNation(p), T.POL);
  await page.waitForTimeout(800);
  await page.getByTestId('take-control').click();
  await page.waitForTimeout(800);
  out.tabs = await page.evaluate(() => [...document.querySelectorAll('[data-testid=nation-panel] button')].map((b) => b.innerText.trim()).filter(Boolean));
  const actionsBtn = page.locator('[data-testid=nation-panel] button', { hasText: /Actions/ }).first();
  if (await actionsBtn.count()) await actionsBtn.click();
  await page.waitForTimeout(500);
  out.actionsVisible = await page.getByTestId('panel-actions').isVisible().catch(() => false);
  await shot(page, `c15pl_${seed}_00_actions.png`);
  if (out.actionsVisible) {
    const opts = await page.evaluate(() => [...document.querySelectorAll('[data-testid=act-target] option')].map((o) => [o.value, o.textContent]));
    const lit = opts.find(([, l]) => l === 'Lithuania');
    out.targets = opts.length;
    await page.selectOption('[data-testid=act-target]', lit[0]);
    await page.getByTestId('act-war').click();
    await page.waitForTimeout(800);
    await hours(page, 2);
    out.steps.push({ s: 'war', ticker: await ticker() });
    await hours(page, 24 * 20);
    out.steps.push({ s: 'day20', ticker: await ticker(), panel: await panel() });
    await lookAt(page, CELLS.warsaw[0] + 4, CELLS.warsaw[1] - 6, 3000);
    await shot(page, `c15pl_${seed}_01_day20.png`);
    const peace = page.locator('[data-testid^=act-peace-]').first();
    out.peaceButtons = await page.locator('[data-testid^=act-peace-]').count();
    out.warRows = await page.evaluate(() => [...document.querySelectorAll('[data-testid=panel-actions] .god-war-name')].map((e) => e.innerText));
    if (out.peaceButtons) { await peace.click(); await page.waitForTimeout(500); await hours(page, 48); out.steps.push({ s: 'peace offered', ticker: await ticker(), warRows: await page.evaluate(() => [...document.querySelectorAll('[data-testid=panel-actions] .god-war-name')].map((e) => e.innerText)) }); }
    await shot(page, `c15pl_${seed}_02_after_peace.png`);
  }
  // click a Polish formation on the map
  const f = await page.evaluate(async (pol) => { const s = await window.__warsim.sim.inspect(true); return s.formations.find((x) => x.nation === pol); }, T.POL);
  if (f) {
    await lookAt(page, f.x, f.y, 1500);
    const [sx, sy] = await screenOf(page, f.x, f.y);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(800);
    out.formationPanel = await page.evaluate(() => document.querySelector('[data-testid=formation-panel]')?.innerText.slice(0, 600) ?? null);
    await shot(page, `c15pl_${seed}_03_formation.png`);
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c15_pl_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out, null, 1).slice(0, 5000));
