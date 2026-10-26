// Critic run 15, session K3: God Mode's Breakthrough at war (run 14 and K2 tried it only at peace). Seed 7019, day 4:
// Japan at war with China near (1695, 410). Japan selected; Breakthrough from a Japanese formation toward a Chinese
// one 4+ cells off; what the page says, the corridor's land after 1, 3, 7 days against the same world without it.
import { launch, open1938, shot, save, lookAt, screenOf, hours } from './c15_lib.mjs';
const seed = 7019, JAP = 75, CHI = 69;
const out = { seed, runs: [] };
for (const useTool of [true, false]) {
  const { browser, page, errors } = await launch();
  const r = { useTool, steps: [] };
  try {
    await open1938(page, seed);
    await hours(page, 72);
    const pick = await page.evaluate(async ({ JAP, CHI }) => {
      const v = window.__warsim.view; const st = await window.__warsim.sim.inspect(true);
      const land = st.formations.filter((f) => !v.formationAfloat(f.id));
      const j = land.filter((f) => f.nation === JAP && Math.hypot(f.x - 1695, f.y - 410) < 15);
      const c = land.filter((f) => f.nation === CHI);
      let best = null;
      for (const a of j) for (const b of c) { const d = Math.hypot(a.x - b.x, a.y - b.y); if (d > 4 && d < 10 && (!best || d < best.d)) best = { a: [a.x, a.y], b: [b.x, b.y], d }; }
      return best;
    }, { JAP, CHI });
    r.pick = pick;
    const ctrlAlong = () => page.evaluate(async ({ a, b, JAP }) => {
      const st = await window.__warsim.sim.inspect(true);
      return { tick: window.__warsim.view.lastTick, mb: (st.majorBattles ?? []).length ?? null };
    }, { ...pick, JAP });
    await page.evaluate((n) => window.__warsim.hud.onSelectNation(n), JAP);
    await page.getByRole('button', { name: 'God Mode', exact: true }).click();
    await lookAt(page, (pick.a[0] + pick.b[0]) / 2, (pick.a[1] + pick.b[1]) / 2, 1200);
    if (useTool) {
      await page.getByRole('button', { name: 'Breakthrough', exact: true }).click();
      await page.waitForTimeout(300);
      const [ax, ay] = await screenOf(page, pick.a[0], pick.a[1]);
      const [bx, by] = await screenOf(page, pick.b[0], pick.b[1]);
      await page.mouse.click(ax, ay); await page.waitForTimeout(300);
      await page.mouse.click(bx, by); await page.waitForTimeout(1200);
    }
    r.after0c = await page.evaluate(async () => { const s = await window.__warsim.sim.inspect(true); return { majors: s.majors?.length ?? null, corridors: JSON.stringify(s.corridors).slice(0, 300), majorsJ: JSON.stringify(s.majors).slice(0, 300) }; });
    r.after0 = await page.evaluate(() => document.body.innerText.split('\n').filter((l) => /1938|battle|Breakthrough|breakthrough/i.test(l)).slice(0, 12));
    await shot(page, `c15k3_${useTool ? 'tool' : 'none'}_00.png`);
    // the land Japan holds within 12 cells of the pick, after 1, 3, 7 days
    for (const d of [1, 3, 7]) {
      await hours(page, d === 1 ? 24 : d === 3 ? 48 : 96);
      const held = await page.evaluate(async ({ a, JAP }) => {
        const w = window.__warsim; const s = await w.sim.inspect(true);
        return { majors: s.majors?.length ?? null, corridors: JSON.stringify(s.corridors).slice(0, 300), majorsJ: JSON.stringify(s.majors).slice(0, 300) };
      }, { ...pick, JAP });
      await lookAt(page, (pick.a[0] + pick.b[0]) / 2, (pick.a[1] + pick.b[1]) / 2, 1200);
      r.steps.push({ d, held, ticker: await page.evaluate(() => document.body.innerText.split('\n').filter((l) => /\d{4}/.test(l) && /battle|captured|Breakthrough/i.test(l)).slice(0, 10)) });
      await shot(page, `c15k3_${useTool ? 'tool' : 'none'}_d${d}.png`);
    }
  } catch (e) { r.fatal = String(e?.stack ?? e); }
  r.errors = errors;
  out.runs.push(r);
  save('c15_k3_7019.json', out);
  await browser.close();
}
console.log(JSON.stringify(out).slice(0, 3000));
