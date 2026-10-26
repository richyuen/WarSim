// Critic run 12, session U: the late war from a headless save: engaged formations found, each of
// up to 4 fronts looked at at 3,000, 250 and 25 m/px for 3 s live: sorties drawn, elements, figures.
// Usage: node critic/scripts/c15_u_lateair.mjs <seed> <save.bin>
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launch, open1938, shot, save, lookAt, hours } from './c15_lib.mjs';

const seed = Number(process.argv[2]);
const bin = process.argv[3];
const tag = `c15u_${seed}`;
const out = { seed, bin, fronts: [] };
const { browser, page, errors } = await launch();
const live = async (ms) => {
  await page.evaluate(() => { window.__warsim.hud.setSpeedLevel(0); if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
  await page.waitForTimeout(ms);
  await page.evaluate(() => { if (!window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
};
const probe = () => page.evaluate(() => {
  const v = window.__warsim.view;
  return { el: v.elementCount ?? null, ind: v.individualCount ?? null, sorties: v.sortieMarks?.length ?? null, contact: v.contactLinesShown?.length ?? null, mpp: Math.round(v.metresPerPx) };
});
try {
  const bytes = readFileSync(path.resolve(bin));
  await page.route('**/__critic_ck.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
  await open1938(page, seed);
  await page.evaluate(async () => window.__warsim.sim.load(new Uint8Array(await (await fetch('/__critic_ck.bin')).arrayBuffer())));
  await page.evaluate(() => { try { window.__warsim.settings.nukePause.value = false; } catch {} });
  await hours(page, 24);
  const eng = await page.evaluate(async () => {
    const v = window.__warsim.view;
    const s = await window.__warsim.sim.inspect(true);
    return s.formations.filter((f) => v.formationEngaged(f.id) && !v.formationAfloat(f.id)).map((f) => ({ id: f.id, n: f.nation, x: f.x, y: f.y }));
  });
  out.engaged = eng.length;
  out.aloftWorld = await page.evaluate(() => window.__warsim.view.sortieMarks?.length ?? null);
  const picks = [];
  for (const f of eng) { if (picks.every((p) => Math.hypot(p.x - f.x, p.y - f.y) > 40)) picks.push(f); if (picks.length >= 4) break; }
  for (const [i, p] of picks.entries()) {
    const fr = { ...p, views: [] };
    for (const m of [3000, 250, 25]) {
      const pos = await page.evaluate((id) => window.__warsim.view.formationPos(id), p.id);
      const [cx, cy] = pos ?? [p.x, p.y];
      await lookAt(page, cx, cy, m);
      await live(3000);
      fr.views.push(await probe());
      await shot(page, `${tag}_f${i}_${String(m).padStart(4, '0')}m.png`);
    }
    out.fronts.push(fr);
    save(`c15_u_${seed}.json`, { ...out, errors });
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c15_u_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out).slice(0, 2500));
