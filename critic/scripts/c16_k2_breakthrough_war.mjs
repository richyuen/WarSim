// Critic run 16, session K2 (Breakthrough on day 3, at war): God Mode's Breakthrough and Territory tools and Kill, by clicks, on a fresh 1938 world.
// Germany selected; Breakthrough from Berlin toward Warsaw; what appears, whether a battle follows.
import { launch, open1938, shot, save, lookAt, CELLS, screenOf, hours } from './c16_lib.mjs';

const seed = Number(process.argv[2] ?? 2203);
const tag = `c16k2_${seed}`;
const T = CELLS.tags;
const out = { seed, steps: [] };
const { browser, page, errors } = await launch();
const count = () => page.evaluate(async () => { const v = window.__warsim.view; const s = await window.__warsim.sim.inspect(true); const land = s.formations.filter((f) => !v.formationAfloat(f.id)); return { all: s.formations.length, land: land.length, engaged: land.filter((f) => v.formationEngaged(f.id)).length, nations: s.nations?.length ?? null }; });
const ticker = () => page.evaluate(() => document.body.innerText.split('\n').filter((l) => /19\d\d/.test(l)).slice(0, 8));
try {
  await open1938(page, seed);
  await hours(page, 72);
  await page.evaluate((g) => window.__warsim.hud.onSelectNation(g), T.GER);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'God Mode', exact: true }).click();
  await page.waitForTimeout(600);
  await lookAt(page, (CELLS.berlin[0] + CELLS.warsaw[0]) / 2, CELLS.berlin[1], 1500);
  const c0 = await count();
  await page.getByRole('button', { name: 'Breakthrough', exact: true }).click();
  await page.waitForTimeout(400);
  out.hintBattle = await page.evaluate(() => document.body.innerText.match(/Click the start[^\n]*|Select a nation[^\n]*/)?.[0] ?? null);
  const [ax, ay] = await screenOf(page, CELLS.berlin[0] + 3, CELLS.berlin[1]);
  const [bx, by] = await screenOf(page, CELLS.warsaw[0], CELLS.warsaw[1]);
  await page.mouse.click(ax, ay);
  await page.waitForTimeout(300);
  await page.mouse.click(bx, by);
  await page.waitForTimeout(1200);
  const c1 = await count();
  out.steps.push({ s: 'breakthrough', before: c0, after: c1, ticker: await ticker() });
  await shot(page, `${tag}_00_breakthrough_clicked.png`);
  for (const d of [1, 3, 7]) {
    await hours(page, d === 1 ? 24 : d === 3 ? 48 : 96);
    out.steps.push({ s: `day${d}`, c: await count(), ticker: await ticker() });
    await lookAt(page, (CELLS.berlin[0] + CELLS.warsaw[0]) / 2, CELLS.berlin[1], 1500);
    await shot(page, `${tag}_01_day${d}_1500m.png`);
  }
  // find an engaged formation and look at it at 80 m/px
  const eng = await page.evaluate(async () => { const v = window.__warsim.view; const s = await window.__warsim.sim.inspect(true); return s.formations.filter((f) => v.formationEngaged(f.id) && !v.formationAfloat(f.id)).map((f) => ({ id: f.id, x: f.x, y: f.y })); });
  if (eng.length) {
    await lookAt(page, eng[0].x, eng[0].y, 80);
    await page.evaluate(() => { window.__warsim.hud.setSpeedLevel(0); if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
    await page.waitForTimeout(2500);
    await page.evaluate(() => { if (!window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
    await shot(page, `${tag}_02_engaged_80m.png`);
  }
  // Kill: Czechoslovakia, by the nation panel's Kill button (two clicks)
  await page.evaluate((c) => window.__warsim.hud.onSelectNation(c), T.CZS);
  await page.waitForTimeout(800);
  const kill = page.getByRole('button', { name: 'Kill', exact: true }).first();
  out.killVisible = await kill.isVisible().catch(() => false);
  if (out.killVisible) {
    await kill.click();
    await page.waitForTimeout(300);
    out.killConfirmText = await page.evaluate(() => document.body.innerText.includes('Click again to kill'));
    await page.getByRole('button', { name: /Click again to kill|Kill/ }).first().click();
    await page.waitForTimeout(1500);
    await hours(page, 24);
    out.afterKill = { c: await count(), ticker: await ticker() };
    await lookAt(page, CELLS.prague[0], CELLS.prague[1], 3000);
    await shot(page, `${tag}_03_after_kill.png`);
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c16_k2_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out).slice(0, 3000));
