// Critic run 7, session C2: God Mode tools used by clicks; war, battle at tiers, spawn, nuke, kill.
import { launch, BASE, shot, save, lookAt, CELLS, run, pause, buttons, hours, screenOf, settle } from './c7_lib.mjs';

const seed = Number(process.argv[2] ?? 4419);
const out = { seed, steps: [] };
const { browser, page, errors } = await launch();
const S = async (n) => shot(page, `c7c2_${seed}_${n}.png`);
const txt = () => page.evaluate(() => document.body.innerText);
const step = async (name, fn) => {
  try {
    const r = await fn();
    out.steps.push({ name, ok: true, r });
  } catch (e) {
    out.steps.push({ name, ok: false, err: String(e).slice(0, 400) });
  }
  save(`c7_c2_${seed}.json`, { ...out, errors });
};
await page.goto(`${BASE}/?scenario=1938&paused=1&seed=${seed}`);
await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0, null, { timeout: 180_000 });
await page.waitForTimeout(2500);
const [bx, by] = CELLS.berlin;
await lookAt(page, bx, by, 2500);
await page.getByRole('button', { name: 'God Mode' }).click();
const [gx, gy] = await screenOf(page, bx - 8, by + 6);
await page.mouse.click(gx, gy);
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'God', exact: true }).click();
await page.waitForTimeout(600);

await step('panelScroll', async () => {
  const r = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Kill');
    if (!b) return 'no Kill button';
    let p = b.parentElement;
    while (p && !(p.scrollHeight > p.clientHeight + 4 && getComputedStyle(p).overflowY !== 'visible')) p = p.parentElement;
    const rect = b.getBoundingClientRect();
    return { scrollable: !!p, cls: p?.className ?? null, killTop: rect.top, innerH: innerHeight, sh: p?.scrollHeight, ch: p?.clientHeight };
  });
  await page.getByRole('button', { name: 'Kill' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await S('00_panel_scrolled');
  return r;
});

await step('declareWarPoland', async () => {
  const sel = page.locator('select').filter({ hasText: 'Afghanistan' });
  await sel.selectOption({ label: 'Poland' });
  await page.getByRole('button', { name: 'Declare war' }).click();
  await page.waitForTimeout(800);
  await S('01_war_declared');
  return (await txt()).slice(0, 600);
});
await step('fightToDeathVisible', async () => (await buttons(page)).filter((b) => /death|Peace|Fight/i.test(b)));
await step('grantBuff', async () => {
  await page.getByRole('button', { name: /Grant/ }).click();
  await page.waitForTimeout(300);
  return 'clicked';
});
await page.evaluate(() => window.__warsim.hud.setSpeedLevel(3));
await hours(page, 24 * 15);
await S('02_day15_europe');
await step('tiers', async () => {
  const res = [];
  const [px, py] = CELLS.polfront;
  for (const m of [2500, 800, 250, 60, 20]) {
    await lookAt(page, px, py, m);
    await page.waitForTimeout(300);
    res.push(await S(`03_polfront_${m}m`));
  }
  return res;
});
await step('warBannerClick', async () => {
  const b = page.getByRole('button', { name: /Germany[\s\S]*Poland|Poland[\s\S]*Germany/ }).first();
  await b.click({ timeout: 4000 });
  await page.waitForTimeout(2500);
  await settle(page);
  await S('04_banner_battle');
  return { mpp: await page.evaluate(() => window.__warsim.view.metresPerPx) };
});
await step('battleLive20m', async () => {
  const cur = await page.evaluate(() => { const c = window.__warsim.view.controller.cam; return [c.cx, c.cy]; });
  await lookAt(page, cur[0], cur[1], 20);
  await page.evaluate(() => window.__warsim.hud.setSpeedLevel(1));
  await run(page);
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(1500);
    await S(`05_battle_20m_live_${i}`);
  }
  await pause(page);
  return 'ok';
});
await step('annex', async () => {
  await lookAt(page, bx, by, 2500);
  await page.mouse.click(gx, gy);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'God', exact: true }).click();
  const sel = page.locator('select').filter({ hasText: 'Afghanistan' });
  await sel.selectOption({ label: 'Czechoslovakia' });
  await page.getByRole('button', { name: 'Annex' }).click();
  await page.waitForTimeout(500);
  await hours(page, 2);
  await S('06_annexed_czs');
  return 'ok';
});
await step('donate', async () => {
  const sel = page.locator('select').filter({ hasText: 'Afghanistan' });
  await sel.selectOption({ label: 'Italy' });
  await page.getByPlaceholder('Gold').fill('5000');
  await page.getByRole('button', { name: 'Donate gold' }).click();
  await hours(page, 1);
  return (await txt()).match(/Treasury[^\n]*/)?.[0] ?? null;
});
await step('recolor', async () => {
  const inp = page.locator('input[type=color]');
  await inp.evaluate((el) => { el.value = '#ff00ff'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.getByRole('button', { name: 'Recolor' }).click();
  await hours(page, 1);
  await page.waitForTimeout(800);
  await S('07_recolor');
  return 'ok';
});
await step('spawnNation', async () => {
  await page.getByRole('button', { name: 'Spawn nation' }).click();
  await page.waitForTimeout(300);
  await S('08a_spawn_tool');
  const [fx, fy] = await screenOf(page, CELLS.paris[0], CELLS.paris[1]);
  await page.mouse.click(fx, fy);
  await hours(page, 2);
  await page.waitForTimeout(800);
  await S('08_spawn_nation');
  return (await txt()).slice(0, 500);
});
await step('nuke', async () => {
  await page.keyboard.press('Escape');
  await page.mouse.click(gx, gy);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'God', exact: true }).click().catch(() => {});
  await page.getByRole('button', { name: 'Nuke' }).click();
  await page.waitForTimeout(300);
  const opts = await buttons(page);
  await S('09_nuke_tool');
  const [wx, wy] = await screenOf(page, CELLS.warsaw[0], CELLS.warsaw[1]);
  await page.mouse.click(wx, wy);
  await hours(page, 3);
  await page.waitForTimeout(1500);
  await S('10_nuke_warsaw');
  return { opts: opts.slice(-30), text: (await txt()).slice(0, 800) };
});
await step('breakthrough', async () => {
  await page.getByRole('button', { name: 'Breakthrough' }).click();
  await page.waitForTimeout(300);
  await S('11_breakthrough_tool');
  return (await txt()).slice(0, 300);
});
out.errors = errors;
save(`c7_c2_${seed}.json`, { ...out, errors });
await browser.close();
