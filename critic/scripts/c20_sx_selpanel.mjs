// Critic run 20, session SX: playing Germany, a click on a German formation in a mixed stack at the front: is the
// formation panel the selected formation's? (Seen on the phone: a German selected, the panel a Polish division's.)
import { launch, open1938, shot, save, hours, CELLS } from './c20_lib.mjs';
const seed = Number(process.argv[2] ?? 4441);
const out = { seed, clicks: [] };
const { browser, page, errors } = await launch(1600, 900);
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
  const gset = new Set(ger);
  for (let k = 0; k < 12; k++) {
    const id = ger[k * 3];
    const p0 = await page.evaluate((id) => window.__warsim.view.formationPos(id), id);
    await page.evaluate(() => window.__warsim.view.selectedFormations.clear());
    await page.evaluate(([x, y]) => window.__warsim.view.controller.set({ cx: x, cy: y, scale: 12 }), p0);
    await page.waitForTimeout(400);
    await page.mouse.click(800, 450);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const v = window.__warsim.view;
      const fp = document.querySelector('.formation-panel, [data-testid=formation-panel]');
      return { sel: [...v.selectedFormations], panelId: fp ? Number(fp.dataset.formation) : null, panel: fp ? fp.innerText.split('\n').slice(0, 6).join(' | ') : null };
    });
    r.id = id;
    r.selGerman = r.sel.map((s) => gset.has(s));
    r.panelPolish = !!r.panel && /Poland/.test(r.panel);
    out.clicks.push(r);
    if (r.panelPolish && r.sel.length) await shot(page, `c20sx_${seed}_${k}.png`);
  }
  out.mismatch = out.clicks.filter((c) => c.sel.length > 0 && c.panelPolish).length;
  out.idMismatch = out.clicks.filter((c) => c.sel.length > 0 && c.panelId !== c.sel[0]).length;
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c20_sx_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
