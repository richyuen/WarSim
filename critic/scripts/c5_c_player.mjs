// Session C (run 5): the player as the United Kingdom, by the mouse.
// 1. R4-B2 again: a division at Southampton clicked, then a German port city clicked (Bremen); 20 days watched.
// 2. Air: the Actions tab's wings; a patrol and a strike ordered by the mouse; an order beyond range; a paradrop.
import { readFileSync } from 'node:fs';
import { launch, open1938, lookAt, shot, save, hours } from './c5_lib.mjs';
const seed = Number(process.argv[2] ?? 2207);
const tag = `c5c_${seed}`;
const out = { seed, shots: [], log: [] };
const tags = JSON.parse(readFileSync(new URL('../c5_tags.json', import.meta.url), 'utf8'));
const { browser, page, errors } = await launch(1600, 900);
const T0 = Date.now();
const screenOf = (x, y) =>
  page.evaluate(({ x, y }) => {
    const v = window.__warsim.view;
    const c = document.getElementById('map');
    const cam = v.controller.cam;
    const r = c.getBoundingClientRect();
    return [r.left + (x - cam.cx) * cam.scale + r.width / 2, r.top + (y - cam.cy) * cam.scale + r.height / 2];
  }, { x, y });
const news = () => page.locator('[data-testid=order-news]').allInnerTexts().catch(() => []);
try {
  await open1938(page, seed);
  const cities = await page.evaluate(() => window.__warsim.sim.mapLayers.cities.map((c) => ({ name: c.name, x: c.x, y: c.y })));
  const city = (n) => cities.find((c) => c.name === n);
  out.cities = ['Southampton', 'Portsmouth', 'Bremen', 'Hamburg', 'Berlin', 'Wilhelmshaven', 'Kiel', 'London', 'Essen', 'Cologne', 'Köln', 'Düsseldorf'].map((n) => city(n) ?? n);
  await page.evaluate((n) => window.__warsim.view.select(n), tags.ENG);
  await page.waitForTimeout(400);
  await page.getByTestId('take-control').click();
  await page.waitForTimeout(500);
  out.player = await page.evaluate(() => window.__warsim.player.nation.value);
  await page.getByTestId('tab-actions').click();
  await page.waitForTimeout(300);
  // declare war on Germany by the Actions tab
  await page.getByTestId('act-target').selectOption(String(tags.GER));
  await page.getByTestId('act-war').click();
  await hours(page, 1);
  out.shots.push(await shot(page, `${tag}_00_actions_tab_war.png`));
  out.actionsText = (await page.getByTestId('panel-actions').innerText()).slice(0, 4000);
  // --- 1. invasion by the mouse
  const so = city('Southampton') ?? city('Portsmouth');
  const forms = await page.evaluate((n) => {
    const v = window.__warsim.view;
    return v.formationsOf(n).map((f) => ({ f, pos: v.formationPos(f), afloat: v.formationAfloat(f), t: v.formationTitle(f) }));
  }, tags.ENG);
  const d = (p, x, y) => Math.hypot(p[0] - x, p[1] - y);
  const land = forms.filter((f) => !f.afloat && f.pos).sort((a, b) => d(a.pos, so.x, so.y) - d(b.pos, so.x, so.y));
  const div = land[0];
  out.division = div;
  const tgt = city('Bremen') ?? city('Hamburg');
  out.target = tgt;
  await lookAt(page, (so.x + tgt.x) / 2, (so.y + tgt.y) / 2, 1800);
  let [sx, sy] = await screenOf(div.pos[0], div.pos[1]);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(400);
  out.selected = await page.evaluate(() => [...window.__warsim.view.selectedFormations]);
  [sx, sy] = await screenOf(tgt.x, tgt.y);
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(600);
  out.shots.push(await shot(page, `${tag}_10_order_to_bremen.png`));
  await hours(page, 2);
  out.newsAfterOrder = await news();
  out.formationPanel = await page.locator('[data-testid=formation-panel]').innerText().catch(() => null);
  out.shots.push(await shot(page, `${tag}_11_after_2h.png`));
  const track = [];
  for (let k = 0; k < 20; k++) {
    await hours(page, 24);
    const s = await page.evaluate((f) => {
      const v = window.__warsim.view;
      const p = v.formationPos(f);
      return { pos: p && p.map((x) => +x.toFixed(1)), afloat: v.formationAfloat(f), engaged: v.formationEngaged(f), exists: v.formationIds().includes(f) };
    }, div.f);
    track.push({ day: k + 1, ...s, news: (await news()).slice(0, 4) });
    if (k === 2 || k === 6) out.shots.push(await shot(page, `${tag}_12_day${k + 1}.png`));
  }
  out.track = track;
  await lookAt(page, (so.x + tgt.x) / 2, (so.y + tgt.y) / 2, 1800);
  out.shots.push(await shot(page, `${tag}_13_after_20_days.png`));
  // --- 2. wings
  await page.getByTestId('tab-actions').click().catch(() => {});
  await page.waitForTimeout(300);
  const wings = await page.evaluate(() => window.__warsim.hud.stats.value?.wings ?? null);
  out.wings = wings;
  out.wingRows = await page.locator('[data-testid^=act-wing-]').evaluateAll((els) => els.filter((e) => /^act-wing-\d+$/.test(e.dataset.testid)).map((e) => e.innerText));
  out.shots.push(await shot(page, `${tag}_20_actions_wings.png`));
  if (wings && wings.length) {
    const fighter = wings.find((w) => !w.transport);
    const lon = city('London');
    // patrol over the German coast (in range of a fighter in England?)
    await lookAt(page, (lon.x + tgt.x) / 2, (lon.y + tgt.y) / 2, 2500);
    await page.getByTestId(`act-wing-${fighter.id}-patrol`).click();
    await page.waitForTimeout(300);
    out.armedText = await page.getByTestId('act-wing-armed').innerText().catch(() => null);
    [sx, sy] = await screenOf(tgt.x, tgt.y);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(500);
    await hours(page, 1);
    out.newsAfterPatrol = await news();
    out.shots.push(await shot(page, `${tag}_21_patrol_ordered.png`));
    // far beyond range: Berlin then Vienna
    const far = city('Vienna') ?? city('Berlin');
    await lookAt(page, (lon.x + far.x) / 2, (lon.y + far.y) / 2, 3500);
    await page.getByTestId(`act-wing-${fighter.id}-strike`).click().catch((e) => out.log.push(String(e)));
    await page.waitForTimeout(300);
    [sx, sy] = await screenOf(far.x, far.y);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(500);
    await hours(page, 1);
    out.newsAfterFar = await news();
    out.shots.push(await shot(page, `${tag}_22_far_strike.png`));
    // watch the patrol a day at T1 over Bremen
    await lookAt(page, tgt.x, tgt.y, 1000);
    const air = [];
    for (let h = 0; h < 24; h++) {
      await hours(page, 1);
      air.push(await page.evaluate(() => {
        const v = window.__warsim.view;
        v.draw();
        return { tick: v.lastTick, sorties: v.sortieMarks.length, shown: v.airFx.shown.slice() };
      }));
    }
    out.patrolDay = air;
    out.wingsAfter = await page.evaluate(() => window.__warsim.hud.stats.value?.wings ?? null);
    out.shots.push(await shot(page, `${tag}_23_patrol_day.png`));
    // paradrop if a transport exists
    if (wings.some((w) => w.transport)) {
      out.paradropTried = true;
      await lookAt(page, so.x, so.y, 1500);
      [sx, sy] = await screenOf(div.pos[0], div.pos[1]);
      await page.mouse.click(sx, sy);
      await page.getByTestId('act-drop').click().catch((e) => out.log.push(String(e)));
      [sx, sy] = await screenOf(tgt.x, tgt.y);
      await page.mouse.click(sx, sy);
      await hours(page, 2);
      out.newsAfterDrop = await news();
    }
  }
  const hist = await page.evaluate(() => window.__warsim.sim.history());
  out.historyTail = hist.slice(-40);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.wallS = (Date.now() - T0) / 1000;
out.errors = errors;
save(`c5_c_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, division: out.division?.t, target: out.target, newsAfterOrder: out.newsAfterOrder, track: out.track?.map((t) => [t.day, t.pos, t.afloat, t.engaged]), wings: out.wings?.length, newsAfterPatrol: out.newsAfterPatrol, newsAfterFar: out.newsAfterFar, wallS: out.wallS }));
