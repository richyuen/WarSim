// Critic run 17, session TG (new): tags left out (ADR-713). On a 1938 seed, Germany on Poland, at day 4, 12 and 21:
// the densest engaged spot; at 250, 120, 60, 30 m/px count formations whose blocks are in view (tag inputs), tags
// placed, tags left out; shot each.
// Usage: node critic/scripts/c20_tg_tags.mjs <seed>
import { launch, open1938, shot, save, lookAt, hours } from './c20_lib.mjs';
const seed = Number(process.argv[2] ?? 7019);
const out = { seed, samples: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  await page.evaluate(() => { try { window.__warsim.settings.nukePause.value = false; } catch {} });
  let day = 0;
  for (const d of [4, 12, 21, 35]) {
    await hours(page, (d - day) * 24); day = d;
    const spot = await page.evaluate(async () => {
      const v = window.__warsim.view;
      const st = await window.__warsim.sim.inspect(true);
      const eng = st.formations.filter((f) => !v.formationAfloat(f.id) && v.formationEngaged(f.id));
      let best = null, bn = -1;
      for (const f of eng) { const n = eng.filter((g) => Math.hypot(g.x - f.x, g.y - f.y) < 3).length; if (n > bn) { bn = n; best = f; } }
      return best ? { x: best.x, y: best.y, n: bn, engaged: eng.length } : null;
    });
    if (!spot) { out.samples.push({ d, spot: null }); continue; }
    for (const m of [250, 120, 60, 30]) {
      await lookAt(page, spot.x, spot.y, m);
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => { const v = window.__warsim.view; return { inputs: v.tagInputs?.length ?? null, placed: v.tagRects?.length ?? null, left: v.tagsLeft ?? null, leftNames: (v.tagInputs ?? []).filter((t) => !(v.tagRects ?? []).some((p) => p.id === t.id)).map((t) => [t.name, t.nation, t.engaged, t.strength]).slice(0, 12) }; });
      const p = await shot(page, `c20tg_${seed}_d${d}_${m}m.png`);
      out.samples.push({ d, m, spot, ...r, shot: p });
      save(`c20_tg_${seed}.json`, { ...out, errors });
    }
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c20_tg_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out.samples.map((s) => [s.d, s.m, s.inputs, s.placed, s.left])));
