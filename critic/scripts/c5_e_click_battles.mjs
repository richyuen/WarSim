// Session E (run 5): the player's way to battles. The ticker's sea-battle row clicked; a war banner's
// battle clicked; then a continuous zoom by the mouse wheel from the world to the men, frame by frame.
import { readFileSync } from 'node:fs';
import { launch, open1938, shot, save, hours } from './c5_lib.mjs';
const seed = Number(process.argv[2] ?? 6131);
const tag = `c5e_${seed}`;
const tags = JSON.parse(readFileSync(new URL('../c5_tags.json', import.meta.url), 'utf8'));
const out = { seed, shots: [], sea: [], land: [], wheel: [] };
const { browser, page, errors } = await launch();
const state = () => page.evaluate(() => {
  const v = window.__warsim.view;
  v.draw();
  return { m: Math.round(v.metresPerPx * 10) / 10, el: v.elementCount, ind: v.individualCount, sorties: v.sortieMarks.length, air: v.airFx.shown.slice(), shares: { ...v.shares }, markers: v.markerRects?.length, tags: v.tagRects?.length };
});
try {
  await open1938(page, seed);
  await page.evaluate(({ g, e, p }) => {
    window.__warsim.sim.command({ kind: 'declareWar', attacker: g, defender: e });
    window.__warsim.sim.command({ kind: 'declareWar', attacker: g, defender: p });
  }, { g: tags.GER, e: tags.ENG, p: tags.POL });
  await hours(page, 41);
  const rows = page.locator('[data-testid=sea-battle-row]');
  out.seaRowCount = await rows.count();
  if (out.seaRowCount > 0) {
    out.seaRowText = await rows.first().innerText();
    await rows.first().click();
    await page.waitForTimeout(2500);
    out.sea.push(await state());
    out.shots.push(await shot(page, `${tag}_10_sea_row_clicked.png`));
    await page.evaluate(() => {
      window.__warsim.hud.setSpeedLevel(0);
      window.__warsim.sim.setPaused(false);
      window.__warsim.hud.paused.value = false;
    });
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(1000);
      out.sea.push(await state());
      if (i === 3 || i === 7) out.shots.push(await shot(page, `${tag}_11_sea_live_${i}.png`));
    }
    await page.evaluate(() => {
      window.__warsim.sim.setPaused(true);
      window.__warsim.hud.paused.value = true;
    });
  }
  // a war banner: Germany vs Poland's battle
  await hours(page, 24 * 5);
  const banners = page.locator('[data-testid^=war-banner]');
  out.bannerCount = await banners.count();
  out.bannerTexts = await banners.allInnerTexts();
  const gp = banners.filter({ hasText: 'Poland' }).first();
  if (await gp.count()) {
    await gp.click();
    await page.waitForTimeout(3000);
    out.land.push(await state());
    out.shots.push(await shot(page, `${tag}_20_banner_clicked.png`));
    // "to the fight" button if any
    const toFight = page.locator('[data-testid=to-fight], [data-testid=formation-to-fight]').first();
    if (await toFight.count()) {
      await toFight.click();
      await page.waitForTimeout(3000);
      out.land.push(await state());
      out.shots.push(await shot(page, `${tag}_21_to_fight.png`));
    }
    await page.evaluate(() => {
      window.__warsim.hud.setSpeedLevel(0);
      window.__warsim.sim.setPaused(false);
      window.__warsim.hud.paused.value = false;
    });
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(1000);
      out.land.push(await state());
      if (i === 2 || i === 5) out.shots.push(await shot(page, `${tag}_22_land_live_${i}.png`));
    }
    await page.evaluate(() => {
      window.__warsim.sim.setPaused(true);
      window.__warsim.hud.paused.value = true;
    });
    // wheel out to the world and back in, a shot every few notches
    const c = await page.locator('#map').boundingBox();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, 240);
      await page.waitForTimeout(120);
      const s = await state();
      out.wheel.push({ dir: 'out', i, ...s });
      if (i % 5 === 4) out.shots.push(await shot(page, `${tag}_30_wheel_out_${String(i).padStart(2, '0')}.png`));
      if (s.m > 15000) break;
    }
    for (let i = 0; i < 60; i++) {
      await page.mouse.wheel(0, -240);
      await page.waitForTimeout(120);
      const s = await state();
      out.wheel.push({ dir: 'in', i, ...s });
      if (i % 5 === 4) out.shots.push(await shot(page, `${tag}_31_wheel_in_${String(i).padStart(2, '0')}.png`));
      if (s.m < 2) break;
    }
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c5_e_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, seaRow: out.seaRowText, sea: out.sea, banners: out.bannerTexts?.slice(0, 6), land: out.land, wheel: out.wheel.map((w) => [w.dir, w.m, w.el, w.ind, w.sorties]) }));
