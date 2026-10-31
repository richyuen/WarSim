// Critic run 21, session EX: the cost ADR-769 names. Playing Germany at war with Poland (seed 4441, day 60), a
// click centred on a POLISH formation: which panel opens, and what does the click select? Two zooms (scale 12 as
// in SX, and scale 40 closer in). Then observing (no played nation) the same clicks, for comparison.
import { launch, open1938, shot, save, hours, CELLS } from './c21_lib.mjs';
const seed = Number(process.argv[2] ?? 4441);
const out = { seed, playing: {}, observing: {} };
const { browser, page, errors } = await launch(1600, 900);
async function clicks(label, scale, pol, ger) {
  const gset = new Set(ger);
  const res = [];
  for (let k = 0; k < pol.length; k++) {
    const id = pol[k];
    const p0 = await page.evaluate((id) => { const v = window.__warsim.view; const i = v.formIds.indexOf(id); return i < 0 ? null : v.drawnAt(i); }, id);
    if (!p0) continue;
    await page.evaluate(() => window.__warsim.view.selectedFormations.clear());
    await page.evaluate(() => document.querySelector('[data-testid=formation-close], .formation-panel button')?.click());
    await page.evaluate(([x, y, s]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: s }), [p0[0], p0[1], scale]);
    await page.waitForTimeout(400);
    const p1 = await page.evaluate((id) => { const v = window.__warsim.view; const i = v.formIds.indexOf(id); return i < 0 ? null : v.drawnAt(i); }, id);
    await page.evaluate(([x, y, s]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: s }), [p1[0], p1[1], scale]);
    await page.waitForTimeout(300);
    await page.mouse.click(800, 450);
    await page.waitForTimeout(500);
    const r = await page.evaluate(([gerArr]) => {
      const v = window.__warsim.view;
      const fp = document.querySelector('.formation-panel, [data-testid=formation-panel]');
      const g = new Set(gerArr);
      // German formations within 14 px of the click point (screen centre)
      const c = v.controller.cam;
      let near = 0;
      for (const id of gerArr) {
        const i = v.formIds.indexOf(id); const p = i < 0 ? null : v.drawnAt(i);
        if (!p) continue;
        const dx = (p[0] - c.cx) * c.scale, dy = (p[1] - c.cy) * c.scale;
        if (Math.hypot(dx, dy) <= 14) near++;
      }
      return { sel: [...v.selectedFormations], panelId: fp ? Number(fp.dataset.formation) : null, panel: fp ? fp.innerText.split('\n').slice(0, 6).join(' | ') : null, gerWithin14px: near, panelGerman: fp ? g.has(Number(fp.dataset.formation)) : null };
    }, [ger]);
    r.clicked = id;
    r.panelIsClicked = r.panelId === id;
    res.push(r);
    if (k < 4) await shot(page, `c21ex2_${label}_${scale}_${k}.png`);
  }
  return {
    n: res.length,
    panelIsClicked: res.filter((r) => r.panelIsClicked).length,
    panelGerman: res.filter((r) => r.panelGerman).length,
    selectedSomething: res.filter((r) => r.sel.length > 0).length,
    gerWithin14: res.filter((r) => r.gerWithin14px > 0).length,
    res,
  };
}
try {
  await open1938(page, seed);
  await page.evaluate((n) => window.__warsim.view.select(n), CELLS.tags.GER);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  await page.locator('.nation-panel select').first().selectOption({ label: 'Poland' });
  await page.getByRole('button', { name: 'Declare war' }).click();
  await page.getByTestId('nation-close').click().catch(() => {});
  await hours(page, 24 * 60);
  const ger = await page.evaluate((p) => window.__warsim.view.formationsOf(p), CELLS.tags.GER);
  const polAll = await page.evaluate((p) => window.__warsim.view.formationsOf(p), CELLS.tags.POL);
  // Polish formations nearest a German one (the front): by cell distance
  const pos = await page.evaluate(([a, b]) => {
    const v = window.__warsim.view;
    return { g: a.map((id) => v.formationPos(id)), p: b.map((id) => v.formationPos(id)) };
  }, [ger, polAll]);
  const scored = polAll.map((id, i) => {
    const pp = pos.p[i];
    if (!pp) return [id, 1e9];
    let d = 1e9;
    for (const g of pos.g) if (g) d = Math.min(d, Math.hypot(g[0] - pp[0], g[1] - pp[1]));
    return [id, d];
  }).sort((a, b) => a[1] - b[1]);
  const pol = scored.slice(0, 12).map((s) => s[0]);
  out.polFront = scored.slice(0, 12);
  out.polCount = polAll.length;
  out.playing.s12 = await clicks('play', 12, pol, ger);
  out.playing.s40 = await clicks('play', 40, pol, ger);
  out.playing.s120 = await clicks('play', 120, pol, ger);
  // Observing: release control from Germany's panel, the same clicks.
  await page.evaluate((n) => window.__warsim.view.select(n), CELLS.tags.GER);
  await page.getByTestId('release-control').click();
  out.observing.nation = await page.evaluate(() => window.__warsim.player.nation.value);
  out.observing.s12 = await clicks('obs', 12, pol, ger);
  out.observing.s40 = await clicks('obs', 40, pol, ger);
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c21_ex2_${seed}.json`, out);
await browser.close();
const s = (o) => o && `${o.panelIsClicked}/${o.n} panel=clicked, ${o.panelGerman} panel German, ${o.selectedSomething} selected a German, ${o.gerWithin14} with a German within 14px`;
console.log('s12', s(out.playing.s12)); console.log('s40', s(out.playing.s40)); console.log('s120', s(out.playing.s120)); console.log('obs12', s(out.observing.s12)); console.log('obs40', s(out.observing.s40)); console.log(out.fatal ?? '', out.errors.slice(0, 5));
