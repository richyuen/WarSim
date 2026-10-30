// Critic run 20, session W: a wing followed by its name (ADR-766/767) while it flies. Germany at war with Poland,
// a fighter group given a strike near Warsaw, then followed; per frame: the mark's screen place against the nearest
// drawn German sortie, at ×1 and ×5, at 3,000 and 250 m/px. Also the wing's mark after a pan and on another panel.
import { launch, open1938, shot, save, hours, CELLS, lookAt, cellOf } from './c20_lib.mjs';
const seed = Number(process.argv[2] ?? 5557);
const out = { seed, steps: [] };
const { browser, page, errors } = await launch(1600, 900);
const step = (s, o = {}) => { out.steps.push({ s, ...o }); console.log(s, JSON.stringify(o).slice(0, 300)); };
const wings = () => page.evaluate(() => window.__warsim.hud.stats.value?.wings ?? []);
const sample = (id) => page.evaluate((id) => {
  const v = window.__warsim.view;
  const w = window.__warsim.hud.stats.value?.wings.find((x) => x.id === id);
  const m = v.selectionMarks.find((k) => k.kind === 'wing');
  const mx = m ? (m.x0 + m.x1) / 2 : null, my = m ? (m.y0 + m.y1) / 2 : null;
  const ger = v.sortieMarks.filter((s) => s.nation === 1);
  let best = null;
  if (m) for (const s of ger) { const d = Math.hypot(s.x - mx, s.y - my); if (best === null || d < best) best = d; }
  return { tick: v.lastTick, flying: w?.flying ?? null, mission: w?.mission ?? null, wx: w?.x ?? null, wy: w?.y ?? null, mark: m ? [Math.round(mx), Math.round(my)] : null, nearestSortiePx: best === null ? null : Math.round(best), sorties: ger.length, mpp: Math.round(v.metresPerPx), following: v.controller.following };
}, id);
try {
  await open1938(page, seed);
  await page.evaluate((n) => window.__warsim.view.select(n), CELLS.tags.GER);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  await page.waitForFunction(() => (window.__warsim.hud.stats.value?.wings?.length ?? 0) > 10, null, { timeout: 60_000 });
  // War on Poland from the Actions tab.
  const sel = page.locator('.nation-panel select').first();
  await sel.selectOption({ label: 'Poland' });
  await page.getByRole('button', { name: 'Declare war' }).click();
  await page.waitForTimeout(800);
  step('war', { ticker: await page.evaluate(() => document.body.innerText.split('\n').filter((l) => /declared war/.test(l)).slice(-3)) });
  const names = await page.evaluate(() => window.__warsim.hud.templates.value.map((t) => t.nameKey));
  const list = await wings();
  const fighters = list.filter((w) => w.template === names.indexOf('template.fighter_group') && !w.carrier);
  // the fighter nearest Poland
  const war = CELLS.warsaw;
  fighters.sort((a, b) => Math.hypot(a.x - war[0], a.y - war[1]) - Math.hypot(b.x - war[0], b.y - war[1]));
  // pick one ~ mid-range so the flight is long
  const f = fighters[fighters.length - 1];
  step('fighter', { id: f.id, x: f.x, y: f.y, warsaw: war, km: Math.round(Math.hypot(f.x - war[0], f.y - war[1]) * 19.5) });
  await page.getByTestId(`act-wing-${f.id}-strike`).click();
  await lookAt(page, war[0], war[1], 3000);
  await page.mouse.click(800, 450);
  await page.waitForTimeout(600);
  step('strike ordered', { w: (await wings()).find((x) => x.id === f.id), ticker: await page.evaluate(() => document.body.innerText.split('\n').filter((l) => /not done|strike/i.test(l)).slice(-3)) });
  // Follow it.
  await page.getByTestId(`act-wing-${f.id}-name`).click();
  await page.waitForTimeout(800);
  step('followed', { cls: await page.getByTestId(`act-wing-${f.id}`).getAttribute('class') });
  // Run at x1 until it flies (or up to 12 game hours by stepping).
  for (let i = 0; i < 24; i++) {
    const w = (await wings()).find((x) => x.id === f.id);
    if (w?.flying) break;
    await hours(page, 1);
  }
  await page.evaluate(() => window.__warsim.hud.setSpeedLevel(0));
  for (const [mpp, lvl, tagn] of [[3000, 0, 'x1_3000'], [250, 0, 'x1_250'], [3000, 4, 'x5_3000']]) {
    await page.evaluate((l) => window.__warsim.hud.setSpeedLevel(l), lvl);
    const c = await page.evaluate(() => window.__warsim.view.controller.cam);
    // zoom by the wheel at the middle (a set() would end the follow)
    await page.mouse.move(800, 450);
    for (let k = 0; k < 40; k++) {
      const cur = await page.evaluate(() => window.__warsim.view.metresPerPx);
      if (cur > mpp * 0.8 && cur < mpp * 1.25) break;
      await page.mouse.wheel(0, cur > mpp ? -200 : 200);
      await page.waitForTimeout(250);
    }
    await page.evaluate(() => (window.__warsim.hud.paused.value ? window.__warsim.hud.togglePause() : undefined));
    const ss = [];
    const t0 = Date.now();
    let shotN = 0;
    while (Date.now() - t0 < 8000) {
      ss.push(await sample(f.id));
      if (shotN < 3 && Date.now() - t0 > 1500 * (shotN + 1)) { await shot(page, `c20w_${seed}_${tagn}_${shotN}.png`); shotN++; }
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => (window.__warsim.hud.paused.value ? undefined : window.__warsim.hud.togglePause()));
    const fl = ss.filter((s) => s.flying && s.nearestSortiePx !== null);
    const ds = fl.map((s) => s.nearestSortiePx).sort((a, b) => a - b);
    step(`samples ${tagn}`, { n: ss.length, flyingWithMark: fl.length, noMark: ss.filter((s) => !s.mark).length, medianPx: ds[Math.floor(ds.length / 2)] ?? null, p90Px: ds[Math.floor(ds.length * 0.9)] ?? null, max: ds[ds.length - 1] ?? null, first: ss[0], last: ss[ss.length - 1] });
    out[`raw_${tagn}`] = ss;
  }
  // Another nation's panel while following: does the mark stay?
  await page.evaluate((n) => window.__warsim.view.select(n), CELLS.tags.ITA);
  await page.waitForTimeout(1200);
  await hours(page, 1);
  await page.waitForTimeout(500);
  step('other panel open', await sample(f.id));
  await shot(page, `c20w_${seed}_otherpanel.png`);
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c20_w_${seed}.json`, out);
await browser.close();
