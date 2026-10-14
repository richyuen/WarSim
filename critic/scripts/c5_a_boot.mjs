// Session A (run 5): title, boot, GPU, ranking rows, fleets and wings at the start, map modes incl. airControl.
import { launch, open1938, lookAt, shot, save, settle, BASE, inspect } from './c5_lib.mjs';
const out = { shots: [], steps: [] };
const { browser, page, errors } = await launch();
try {
  const t0 = Date.now();
  await page.goto(`${BASE}/`);
  await page.waitForSelector('[data-testid=title-screen]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  out.shots.push(await shot(page, 'c5a_00_title.png'));
  out.titleText = (await page.locator('[data-testid=title-screen]').innerText()).slice(0, 2000);
  out.steps.push({ titleMs: Date.now() - t0 });
  const t1 = Date.now();
  await open1938(page, 6131);
  out.steps.push({ bootMs: Date.now() - t1 });
  out.renderer = await page.evaluate(() => {
    const gl = window.__warsim.view.gl;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  await settle(page);
  out.shots.push(await shot(page, 'c5a_01_boot.png'));
  // ranking rows: name and value boxes, overlaps
  out.ranking = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid=stats-ranking] li, .rank-row, [class*=rank] li')];
    return rows.slice(0, 20).map((r) => {
      const b = r.getBoundingClientRect();
      return { text: r.textContent, top: Math.round(b.top), h: Math.round(b.height) };
    });
  });
  await lookAt(page, 1024, 512, 20000);
  out.shots.push(await shot(page, 'c5a_02_world_20000m.png'));
  await lookAt(page, 1060, 280, 4000);
  out.shots.push(await shot(page, 'c5a_03_europe_4000m.png'));
  await lookAt(page, 1006, 214, 4000);
  out.shots.push(await shot(page, 'c5a_04_britain_4000m.png'));
  const ins = await inspect(page);
  out.inspectKeys = Object.keys(ins);
  // formations: fleets and wings
  const all = await page.evaluate(() => {
    const v = window.__warsim.view;
    return v.formationIds().map((f) => ({ f, afloat: v.formationAfloat(f), pos: v.formationPos(f), t: v.formationTitle(f) }));
  });
  out.formationCount = all.length;
  out.fleetCount = all.filter((a) => a.afloat).length;
  out.kinds = {};
  for (const a of all) out.kinds[a.t?.kind ?? '?'] = (out.kinds[a.t?.kind ?? '?'] ?? 0) + 1;
  // map modes at Europe
  await lookAt(page, 1060, 300, 5000);
  for (const mode of ['political', 'alliances', 'wars', 'seaControl', 'airControl']) {
    await page.evaluate((m) => window.__warsim.hud.setMapMode(m), mode);
    await page.waitForTimeout(500);
    await settle(page);
    out.shots.push(await shot(page, `c5a_20_mode_${mode}.png`));
  }
  out.legendAir = await page.evaluate(() => document.querySelector('[data-testid=map-legend]')?.textContent ?? document.body.innerText.slice(0, 0));
  await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
  // keys
  await page.keyboard.press('F2');
  await page.waitForTimeout(300);
  out.afterF2 = await page.evaluate(() => window.__warsim.view.mapMode ?? window.__warsim.hud.mapMode.value);
  await page.keyboard.press('m');
  await page.waitForTimeout(300);
  out.afterM = await page.evaluate(() => window.__warsim.hud.mapMode.value);
  await page.evaluate(() => window.__warsim.hud.setMapMode('political'));
  await lookAt(page, 1100, 267, 3000);
  await page.mouse.click(800, 450);
  await page.waitForTimeout(700);
  out.panelOpen = await page.locator('[data-testid=nation-panel]').isVisible().catch(() => false);
  out.shots.push(await shot(page, 'c5a_30_nation_panel.png'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  out.panelAfterEsc = await page.locator('[data-testid=nation-panel]').isVisible().catch(() => false);
  // phone width
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  out.shots.push(await shot(page, 'c5a_40_phone_390.png'));
  out.living = ins.nations?.filter((n) => n.living).length;
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save('c5_a.json', out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, renderer: out.renderer, errors: errors.length, fleets: out.fleetCount, kinds: out.kinds, steps: out.steps, f2: out.afterF2, m: out.afterM, esc: out.panelAfterEsc }, null, 0));
