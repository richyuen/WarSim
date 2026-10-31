// Critic run 19, session PB (new, ADR-758): (1) God placement as Poland at peace: armoured divisions dropped in Berlin
// and in Paris, what becomes of them and of Berlin in 10 days; 30 placed in one spot (tick and fights);
// (2) the right-click menu: no player, on sea, on an ally of the target, at the window's edge, war on Germany (allies
// told?); (3) the map-mode menu at 1600 and on the phone.
import { launch, open1938, shot, save, lookAt, CELLS, hours, screenOf } from './c21_lib.mjs';
const seed = Number(process.argv[2] ?? 6673);
const T = CELLS.tags;
const POL = T.POL, GER = T.GER;
const out = { seed };
const { browser, page, errors } = await launch();
const tickerAll = () => page.evaluate(() => document.body.innerText.split('\n').filter((l) => /19\d\d|not done|Carrier|war/.test(l)).slice(-14));
const ins = () => page.evaluate(() => window.__warsim.sim.inspect(true));
const ctrlAt = (x, y) => page.evaluate(async ([x, y]) => { const v = window.__warsim.view; return v.nationAt(...(await (async () => { const c = v.controller.cam; return [(x - c.cx) * c.scale + innerWidth / 2, (y - c.cy) * c.scale + innerHeight / 2]; })())); }, [x, y]);
try {
  await open1938(page, seed);
  // (2a) right-click with no player.
  await lookAt(page, CELLS.warsaw[0], CELLS.warsaw[1], 3000, false);
  await page.mouse.click(800, 450, { button: 'right' });
  await page.waitForTimeout(400);
  out.menuNoPlayer = await page.evaluate(() => document.querySelector('[data-testid=nation-menu]')?.innerText ?? null);
  // Take Poland.
  await page.evaluate((p) => window.__warsim.view.select(p), POL);
  await page.getByTestId('take-control').click();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__warsim.view.select(0));
  // (2b) on sea (the Baltic north of Danzig).
  await lookAt(page, CELLS.warsaw[0] - 6, CELLS.warsaw[1] - 14, 3000, false);
  const sea = await page.evaluate(() => { const v = window.__warsim.view; for (let y = 100; y < 500; y += 10) for (let x = 400; x < 1200; x += 10) if (v.nationAt(x, y) === 0 && v.cellAt(x, y)) return [x, y]; return null; });
  out.seaSpot = sea;
  if (sea) { await page.mouse.click(sea[0], sea[1], { button: 'right' }); await page.waitForTimeout(400); out.menuOnSea = await page.evaluate(() => document.querySelector('[data-testid=nation-menu]')?.innerText ?? null); await page.keyboard.press('Escape'); }
  // (2c) at the window's right edge: Soviet ground near x=1590.
  await lookAt(page, CELLS.warsaw[0] + 20, CELLS.warsaw[1], 3000, false);
  const edge = await page.evaluate(() => { const v = window.__warsim.view; for (let y = 450; y < 840; y += 10) { const n = v.nationAt(1590, y); if (n > 0) return [1590, y, n]; } return null; });
  if (edge) {
    await page.mouse.click(edge[0], edge[1], { button: 'right' });
    await page.waitForTimeout(400);
    out.menuEdge = await page.evaluate(() => { const m = document.querySelector('[data-testid=nation-menu]'); if (!m) return null; const r = m.getBoundingClientRect(); return { text: m.innerText, r: [r.left, r.top, r.right, r.bottom] }; });
    await shot(page, `c21pb_${seed}_00_menu_edge.png`);
    await page.keyboard.press('Escape');
  }
  // (2d) war on Germany from the menu: who else joins, and is it told?
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 3000, false);
  const before = await ins();
  out.warsBefore = before.wars.length;
  const gerSpot = await page.evaluate((g) => { const v = window.__warsim.view; for (let y = 300; y < 600; y += 10) for (let x = 600; x < 1000; x += 10) if (v.nationAt(x, y) === g) return [x, y]; return null; }, GER);
  await page.mouse.click(gerSpot[0], gerSpot[1], { button: 'right' });
  await page.waitForTimeout(400);
  out.menuGer = await page.evaluate(() => document.querySelector('[data-testid=nation-menu]')?.innerText ?? null);
  await shot(page, `c21pb_${seed}_01_menu_ger.png`);
  // Do not declare yet: first God placement at peace.
  await page.keyboard.press('Escape');
  // (1) God Mode placement at peace.
  await page.getByTestId('god-btn').click();
  await page.waitForTimeout(400);
  await page.evaluate((p) => window.__warsim.view.select(p), POL);
  await page.waitForTimeout(400);
  await page.getByTestId('tab-actions').click();
  await page.waitForTimeout(300);
  const names = await page.evaluate(() => window.__warsim.hud.templates.value.map((t) => t.nameKey));
  out.templates = names.length;
  const panzer = names.indexOf('template.panzer_div');
  out.placeButtons = await page.locator('[data-testid^=act-place-]').count();
  await shot(page, `c21pb_${seed}_02_place_tab.png`);
  await page.getByTestId(`act-place-${panzer}`).click();
  await page.waitForTimeout(200);
  out.armedText = await page.evaluate(() => document.querySelector('[data-testid=act-place-armed]')?.innerText ?? null);
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 1000, false);
  const polBefore = (await ins()).formations.filter((f) => f.nation === POL).length;
  for (let i = 0; i < 30; i++) { await page.mouse.click(800 + (i % 6) * 6 - 15, 450 + Math.floor(i / 6) * 6 - 12); await page.waitForTimeout(60); }
  await page.waitForTimeout(600);
  out.refusal = await page.evaluate(() => document.querySelector('[data-testid=act-place-refusal]')?.innerText ?? null);
  const after = await ins();
  const placed = after.formations.filter((f) => f.nation === POL).slice(polBefore);
  out.placedInBerlin = placed.length;
  out.placedSample = placed.slice(0, 3);
  await page.keyboard.press('Escape');
  await shot(page, `c21pb_${seed}_03_placed_berlin_1000m.png`);
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 120);
  await shot(page, `c21pb_${seed}_04_placed_berlin_120m.png`);
  // 10 days at peace.
  const t0 = Date.now();
  const berlinOwner0 = await ctrlAt(CELLS.berlin[0], CELLS.berlin[1]);
  const track = [];
  for (let d = 0; d < 10; d += 2) {
    await hours(page, 48);
    const s = await ins();
    const ids = new Set(placed.map((p) => p.id));
    const mine = s.formations.filter((f) => ids.has(f.id) && f.nation === POL);
    const cx = mine.reduce((a, f) => a + f.x, 0) / Math.max(1, mine.length), cy = mine.reduce((a, f) => a + f.y, 0) / Math.max(1, mine.length);
    track.push({ day: d + 2, left: mine.length, centre: [cx, cy], fromBerlin: Math.hypot(cx - CELLS.berlin[0], cy - CELLS.berlin[1]), polWars: s.wars.filter((w) => w.attackers.includes(POL) || w.defenders.includes(POL)).map((w) => [w.attackers, w.defenders]), berlin: await ctrlAt(CELLS.berlin[0], CELLS.berlin[1]) });
  }
  out.peaceTrack = { berlinOwner0, track, wallS: (Date.now() - t0) / 1000, ticker: await tickerAll() };
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 1000);
  await shot(page, `c21pb_${seed}_05_day10.png`);
  // (2d') now declare war on Germany from its menu and see what comes with it.
  await page.getByTestId('god-btn').click().catch(() => {});
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 3000, false);
  const gs = await page.evaluate((g) => { const v = window.__warsim.view; for (let y = 300; y < 600; y += 10) for (let x = 600; x < 1000; x += 10) if (v.nationAt(x, y) === g) return [x, y]; return null; }, GER);
  await page.mouse.click(gs[0], gs[1], { button: 'right' });
  await page.waitForTimeout(300);
  await page.getByTestId('nation-menu-war').click().catch((e) => { out.warClickErr = String(e); });
  await page.waitForTimeout(300);
  await hours(page, 3);
  const w = await ins();
  out.warsAfter = w.wars.filter((x) => x.attackers.includes(POL) || x.defenders.includes(POL));
  out.warTicker = await tickerAll();
  await hours(page, 24 * 5);
  const s5 = await ins();
  const ids = new Set(placed.map((p) => p.id));
  out.after5daysWar = { left: s5.formations.filter((f) => ids.has(f.id) && f.nation === POL).length, berlin: await ctrlAt(CELLS.berlin[0], CELLS.berlin[1]), ticker: await tickerAll() };
  await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 3000);
  await shot(page, `c21pb_${seed}_06_war_day5.png`);
  // (3) map-mode menu.
  await page.getByTestId('mapmode-btn').click();
  await page.waitForTimeout(300);
  out.modes = await page.evaluate(() => { const m = document.querySelector('[data-testid=mapmode-menu]'); if (!m) return null; const r = m.getBoundingClientRect(); return { items: [...m.querySelectorAll('[data-testid^=mapmode-opt-]')].map((e) => e.innerText.trim()), r: [r.left, r.top, r.right, r.bottom] }; });
  await shot(page, `c21pb_${seed}_07_mapmode_menu.png`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  out.menuAfterEsc = await page.locator('[data-testid=mapmode-menu]').count();
  // A key still changes the mode?
  const m0 = await page.evaluate(() => document.querySelector('[data-testid=mapmode-btn]')?.dataset.mode);
  await page.mouse.click(800, 300);
  await page.keyboard.press('m');
  await page.waitForTimeout(300);
  out.modeKey = [m0, await page.evaluate(() => document.querySelector('[data-testid=mapmode-btn]')?.dataset.mode)];
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c21_pb_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out, null, 1).slice(0, 9000));
