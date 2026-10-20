// Critic run 10, session S: what stays on screen after a thing is gone.
// (1) A God revolt near Berlin, run until the rebel is annexed, then 3 and 10 days more: is the
//     rebel's map name and its war chip still shown? (2) Raze Prague with the mouse over it, then
//     move the mouse 2 px, then away and back: what does the tooltip say each time?
// Usage: node critic/scripts/c10_s_stale.mjs <seed>
import { launch, open1938, lookAt, shot, save, CELLS, screenOf, hours } from './c10_lib.mjs';

const seed = Number(process.argv[2] ?? 6421);
const out = { seed, revolt: {}, raze: {} };
const { browser, page, errors } = await launch();
const tip = () => page.evaluate(() => document.querySelector('[class*=tooltip]')?.innerText ?? null);
const chips = () => page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.innerText.replace(/\n/g, ' ')).filter((t) => /⚔/.test(t)));
const labels = () => page.evaluate(() => (window.__warsim.view.nationLabels ?? []).map((l) => ({ id: l.id, text: l.text ?? l.name ?? null })));
const living = () => page.evaluate(() => window.__warsim.hud.stats.value.nations.map((n) => [n.id, n.name]));
try {
  await open1938(page, seed);
  await page.getByRole('button', { name: 'God Mode' }).click();
  await page.waitForTimeout(400);
  const [bx, by] = CELLS.berlin;
  await lookAt(page, bx - 6, by + 10, 2500);
  const before = new Set((await living()).map((n) => n[0]));
  await page.locator('[data-testid=god-tool-revolt]').click();
  const [sx, sy] = await screenOf(page, bx - 6, by + 10);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(1200);
  const rebel = (await living()).find((n) => !before.has(n[0]));
  out.revolt.rebel = rebel ?? null;
  await page.getByRole('button', { name: 'God Mode' }).click(); // off
  await page.mouse.move(5, 300);
  let goneDay = null;
  for (let d = 1; d <= 40 && rebel; d++) {
    await hours(page, 24);
    const alive = (await living()).some((n) => n[0] === rebel[0]);
    if (!alive) { goneDay = d; break; }
  }
  out.revolt.goneDay = goneDay;
  if (goneDay) {
    for (const extra of [0, 3, 10]) {
      if (extra) await hours(page, 24 * (extra === 3 ? 3 : 7));
      await lookAt(page, bx - 4, by + 6, 2500);
      out.revolt[`plus${extra}`] = { chips: await chips(), labels: (await labels()).filter((l) => l.id === rebel[0]), text: (await page.evaluate(() => document.body.innerText)).includes(rebel[1]) };
      await shot(page, `c10s_${seed}_rebel_gone_plus${extra}.png`);
    }
  }
  // (2) raze with the mouse over the city
  await page.getByRole('button', { name: 'God Mode' }).click();
  await page.waitForTimeout(300);
  const [px, py] = CELLS.prague;
  await lookAt(page, px, py, 600);
  const [qx, qy] = await screenOf(page, px, py);
  await page.mouse.move(qx, qy);
  await page.waitForTimeout(700);
  out.raze.tipBefore = await tip();
  await page.locator('[data-testid=god-tool-raze]').click();
  await page.mouse.move(qx, qy);
  await page.mouse.click(qx, qy);
  await page.waitForTimeout(1000);
  await hours(page, 24);
  out.raze.tipStill = await tip();
  await page.mouse.move(qx + 2, qy + 1);
  await page.waitForTimeout(700);
  out.raze.tipMoved2px = await tip();
  await shot(page, `c10s_${seed}_raze_moved2px.png`);
  await page.mouse.move(qx + 300, qy + 200);
  await page.waitForTimeout(500);
  await page.mouse.move(qx, qy);
  await page.waitForTimeout(700);
  out.raze.tipAwayBack = await tip();
  await shot(page, `c10s_${seed}_raze_away_back.png`);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c10_s_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out, null, 1).slice(0, 3000));
