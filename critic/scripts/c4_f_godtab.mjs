// Session F: the God tab's controls on France, and a phone-width view.
import { launch, open1938, lookAt, shot, save, settle } from './c4_lib.mjs';
const out = { shots: [] };
const { browser, page, errors } = await launch(1600, 900);
try {
  await open1938(page, 5150);
  const fra = await page.evaluate(() => window.__warsim.hud.stats.value.nations.find((x) => x.name === 'nation.FRA').id);
  await lookAt(page, 1040, 300, 3000);
  await page.evaluate((n) => window.__warsim.view.select(n), fra);
  await page.getByTestId('god-btn').click();
  await page.waitForTimeout(400);
  await page.getByTestId('tab-god').click().catch(async () => { await page.getByRole('button', { name: 'God', exact: true }).click(); });
  await page.waitForTimeout(600);
  out.godText = await page.getByTestId('panel-god').innerText().catch(() => 'no panel-god');
  out.godButtons = await page.locator('[data-testid=panel-god] button').allInnerTexts().catch(() => []);
  out.shots.push(await shot(page, 'c4f_00_god_tab.png'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await settle(page);
  out.shots.push(await shot(page, 'c4f_10_phone_390.png'));
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors.filter((e) => !e.includes('GPU stall'));
save('c4_f.json', out);
await browser.close();
console.log(JSON.stringify(out).slice(0, 3000));
