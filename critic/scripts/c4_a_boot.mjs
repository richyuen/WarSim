// Session A: title, boot, the world, a zoom ladder over a home fleet, map modes.
import { launch, open1938, lookAt, shot, save, settle, BASE, inspect } from './c4_lib.mjs';
const out = { shots: [], steps: [] };
const { browser, page, errors } = await launch();
try {
  const t0 = Date.now();
  await page.goto(`${BASE}/`);
  await page.waitForSelector('[data-testid=title-screen]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  out.shots.push(await shot(page, 'c4a_00_title.png'));
  out.steps.push({ titleMs: Date.now() - t0 });
  const t1 = Date.now();
  await open1938(page, 6131);
  out.steps.push({ bootMs: Date.now() - t1 });
  await settle(page);
  out.shots.push(await shot(page, 'c4a_01_boot.png'));
  // the world, whole
  await lookAt(page, 1024, 512, 20000);
  out.shots.push(await shot(page, 'c4a_02_world_20000m.png'));
  await lookAt(page, 1060, 280, 4000);
  out.shots.push(await shot(page, 'c4a_03_europe_4000m.png'));
  // fleets at the start
  const fleets = await page.evaluate(() => {
    const v = window.__warsim.view;
    return v.formationIds().filter((f) => v.formationAfloat(f)).map((f) => ({ f, pos: v.formationPos(f), t: v.formationTitle(f) }));
  });
  out.fleetCount = fleets.length;
  out.fleetsSample = fleets.slice(0, 40);
  // nearest fleet to Portsmouth / Scapa
  const near = (x, y) => fleets.reduce((b, f) => (Math.hypot(f.pos[0] - x, f.pos[1] - y) < Math.hypot(b.pos[0] - x, b.pos[1] - y) ? f : b));
  const home = near(1006.4, 216.4);
  out.homeFleet = home;
  for (const m of [4000, 1500, 600, 200, 80, 40, 15, 5, 2]) {
    await lookAt(page, home.pos[0], home.pos[1], m);
    const info = await page.evaluate(() => {
      const v = window.__warsim.view;
      return { m: v.metresPerPx, markers: v.markerRects.length, tags: v.tagRects.length, elements: v.elementCount, individuals: v.individualCount, wakes: v.elementWakes };
    });
    out.steps.push({ ladder: m, ...info });
    out.shots.push(await shot(page, `c4a_10_ladder_home_${String(m).padStart(5, '0')}m.png`));
  }
  // map modes at Europe 4000
  await lookAt(page, 1060, 300, 5000);
  for (const mode of ['political', 'alliances', 'puppets', 'terrain', 'wars', 'diplomacy', 'income', 'revolts', 'seaControl']) {
    await page.evaluate((m) => window.__warsim.hud.setMapMode(m), mode);
    await page.waitForTimeout(400);
    await settle(page);
    out.shots.push(await shot(page, `c4a_20_mode_${mode}.png`));
  }
  await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
  // keyboard: F-keys, Escape, hover tooltip
  await page.keyboard.press('F2');
  await page.waitForTimeout(300);
  out.afterF2 = await page.evaluate(() => window.__warsim.view.mapMode);
  await page.keyboard.press('m');
  await page.waitForTimeout(300);
  out.afterM = await page.evaluate(() => window.__warsim.view.mapMode);
  // click a nation, then Escape
  await lookAt(page, 1100, 267, 3000);
  await page.mouse.click(800, 450);
  await page.waitForTimeout(600);
  out.panelOpen = await page.locator('[data-testid=nation-panel]').isVisible().catch(() => false);
  out.shots.push(await shot(page, 'c4a_30_nation_panel.png'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  out.panelAfterEsc = await page.locator('[data-testid=nation-panel]').isVisible().catch(() => false);
  // hover a ranking row / button for a tooltip
  await page.locator('[data-testid=speed-up]').hover();
  await page.waitForTimeout(900);
  out.titleAttrs = await page.evaluate(() => [...document.querySelectorAll('[title]')].slice(0, 30).map((e) => e.getAttribute('title')));
  out.shots.push(await shot(page, 'c4a_31_hover_speed.png'));
  const ins = await inspect(page);
  out.settings = ins.settings;
  out.living = ins.nations.filter((n) => n.living).length;
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save('c4_a.json', out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, fleets: out.fleetCount, steps: out.steps }, null, 0));
