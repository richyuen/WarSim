// Critic run 21, session SXG: the one-pick rule (ADR-769) on a new seed and front. Play <A>, declare war on <B>, run
// <days>; then 12 clicks on A's formations nearest B's, and 12 on B's nearest A's, each aimed at the counter's drawn
// place at scale 12 (the front zoom of R20-B1). Records the panel and the selection.
// Usage: node c21_sxg_front.mjs <seed> <A tag> <B tag> <B label> [days]
import { launch, open1938, shot, save, hours, CELLS } from './c21_lib.mjs';
const [seed, A, B, BL, daysArg] = [Number(process.argv[2]), process.argv[3], process.argv[4], process.argv[5], process.argv[6]];
const days = Number(daysArg ?? 45);
const out = { seed, A, B, days };
const { browser, page, errors } = await launch(1600, 900);
const drawn = (id) => page.evaluate((id) => { const v = window.__warsim.view; const i = v.formIds.indexOf(id); return i < 0 ? null : v.drawnAt(i); }, id);
async function clickOn(id, label, k, mine, theirs) {
  let p = await drawn(id);
  if (!p) return null;
  await page.evaluate(() => window.__warsim.view.selectedFormations.clear());
  await page.evaluate(([x, y]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 12 }), p);
  await page.waitForTimeout(400);
  p = await drawn(id);
  await page.evaluate(([x, y]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 12 }), p);
  await page.waitForTimeout(300);
  await page.mouse.click(800, 450);
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const v = window.__warsim.view;
    const fp = document.querySelector('.formation-panel, [data-testid=formation-panel]');
    return { sel: [...v.selectedFormations], panelId: fp ? Number(fp.dataset.formation) : null, panel: fp ? fp.innerText.split('\n').slice(0, 6).join(' | ') : null };
  });
  r.clicked = id;
  r.panelMine = r.panelId !== null && mine.has(r.panelId);
  r.panelTheirs = r.panelId !== null && theirs.has(r.panelId);
  if (k < 3) await shot(page, `c21sxg_${seed}_${A}_${label}_${k}.png`);
  return r;
}
try {
  await open1938(page, seed);
  await page.evaluate((n) => window.__warsim.view.select(n), CELLS.tags[A]);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  await page.locator('.nation-panel select').first().selectOption({ label: BL });
  await page.getByRole('button', { name: 'Declare war' }).click();
  await page.getByTestId('nation-close').click().catch(() => {});
  await hours(page, 24 * days);
  out.date = await page.evaluate(() => document.querySelector('[data-testid=bottombar]')?.innerText ?? '');
  const a = await page.evaluate((p) => window.__warsim.view.formationsOf(p), CELLS.tags[A]);
  const b = await page.evaluate((p) => window.__warsim.view.formationsOf(p), CELLS.tags[B]);
  const pos = await page.evaluate(([a, b]) => {
    const v = window.__warsim.view;
    const d = (id) => { const i = v.formIds.indexOf(id); return i < 0 ? null : v.drawnAt(i); };
    return { a: a.map(d), b: b.map(d) };
  }, [a, b]);
  const near = (ids, ps, others) => ids.map((id, i) => { const p = ps[i]; if (!p) return [id, 1e9]; let d = 1e9; for (const o of others) if (o) d = Math.min(d, Math.hypot(o[0] - p[0], o[1] - p[1])); return [id, d]; }).sort((x, y) => x[1] - y[1]);
  const aFront = near(a, pos.a, pos.b).slice(0, 12);
  const bFront = near(b, pos.b, pos.a).slice(0, 12);
  out.aFront = aFront; out.bFront = bFront; out.aCount = a.length; out.bCount = b.length;
  const sa = new Set(a), sb = new Set(b);
  out.own = []; out.enemy = [];
  for (let k = 0; k < aFront.length; k++) out.own.push(await clickOn(aFront[k][0], 'own', k, sa, sb));
  for (let k = 0; k < bFront.length; k++) out.enemy.push(await clickOn(bFront[k][0], 'enemy', k, sa, sb));
  const own = out.own.filter(Boolean), en = out.enemy.filter(Boolean);
  out.summary = {
    ownClicks: own.length,
    ownSelected: own.filter((r) => r.sel.length > 0).length,
    ownPanelIsSelected: own.filter((r) => r.sel.length > 0 && r.panelId === r.sel[0]).length,
    enemyClicks: en.length,
    enemyPanelIsClicked: en.filter((r) => r.panelId === r.clicked).length,
    enemyPanelTheirs: en.filter((r) => r.panelTheirs).length,
    enemyPanelMine: en.filter((r) => r.panelMine).length,
    enemyClickSelectedMine: en.filter((r) => r.sel.length > 0).length,
  };
  // An overview of the front.
  const m = aFront[0] && (await drawn(aFront[0][0]));
  if (m) { await page.evaluate(([x, y]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 6 }), m); await page.waitForTimeout(800); await shot(page, `c21sxg_${seed}_${A}_front.png`); }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c21_sxg_${seed}_${A}.json`, out);
await browser.close();
console.log(JSON.stringify(out.summary), out.fatal ?? '', errors.slice(0, 3));
