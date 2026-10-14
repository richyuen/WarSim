// Session I (run 5): armour in a fight at T2/T3, and what the air adds there. Germany on Poland.
import { readFileSync } from 'node:fs';
import { launch, open1938, lookAt, shot, save, hours } from './c5_lib.mjs';
const seed = Number(process.argv[2] ?? 3307);
const tag = `c5i_${seed}`;
const tags = JSON.parse(readFileSync(new URL('../c5_tags.json', import.meta.url), 'utf8'));
const out = { seed, shots: [], views: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: tags.GER, d: tags.POL });
  let picks = [];
  for (let d = 0; d < 8 && picks.length < 2; d++) {
    await hours(page, 24);
    picks = await page.evaluate((n) => {
      const v = window.__warsim.view;
      return v.formationsOf(n).map((f) => ({ f, t: v.formationTitle(f), pos: v.formationPos(f), e: v.formationEngaged(f) })).filter((x) => x.e && /Armoured|Tank|Panzer|mechanised|Motorised/i.test(x.t?.kind ?? ''));
    }, tags.GER);
    out.day = d + 1;
  }
  out.picks = picks.slice(0, 4);
  for (const p of picks.slice(0, 2)) {
    for (const m of [150, 40, 12, 4]) {
      await lookAt(page, p.pos[0], p.pos[1], m);
      await page.evaluate(() => {
        window.__warsim.hud.setSpeedLevel(0);
        window.__warsim.sim.setPaused(false);
        window.__warsim.hud.paused.value = false;
      });
      await page.waitForTimeout(2500);
      const s = await page.evaluate(() => {
        const v = window.__warsim.view;
        return { m: Math.round(v.metresPerPx), el: v.elementCount, ind: v.individualCount, sorties: v.sortieMarks.length, air: v.airFx.shown.slice(), wrecks: v.wrecks?.count ?? null };
      });
      out.views.push({ f: p.f, ...s });
      out.shots.push(await shot(page, `${tag}_${p.f}_${String(m).padStart(3, '0')}m.png`));
      await page.evaluate(() => {
        window.__warsim.sim.setPaused(true);
        window.__warsim.hud.paused.value = true;
      });
    }
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c5_i_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, day: out.day, picks: out.picks.map((p) => p.t?.name), views: out.views }));
