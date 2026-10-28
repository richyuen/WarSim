// Critic run 17, session WW (new): a new seed's first two years watched at world/Europe zoom every 60 days:
// shot, ticker, war chips, engaged land formations. Usage: node critic/scripts/c17_ww_watch.mjs <seed>
import { launch, open1938, shot, save, lookAt, hours, CELLS } from './c17_lib.mjs';
const seed = Number(process.argv[2] ?? 2711);
const out = { seed, samples: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  await page.evaluate(() => { try { window.__warsim.settings.nukePause.value = false; } catch {} });
  for (let d = 0; d <= 720; d += 60) {
    if (d) await hours(page, 60 * 24);
    const s = await page.evaluate(async () => {
      const v = window.__warsim.view; const st = await window.__warsim.sim.inspect(true);
      const land = st.formations.filter((f) => !v.formationAfloat(f.id));
      return { engaged: land.filter((f) => v.formationEngaged(f.id)).length, land: land.length,
        ticker: [...document.querySelectorAll('[data-testid=ticker] > *')].map((e) => e.innerText.replace(/\n/g, ' ')).slice(-6),
        chips: [...document.querySelectorAll('.war-chip, [data-testid^=war-chip]')].map((c) => c.innerText.replace(/\n/g, ' ')) };
    });
    await lookAt(page, CELLS.berlin[0], CELLS.berlin[1], 3500);
    s.shot = await shot(page, `c17ww_${seed}_d${String(d).padStart(3, '0')}_europe.png`);
    out.samples.push({ d, ...s });
    save(`c17_ww_${seed}.json`, { ...out, errors });
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`c17_ww_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify(out.samples.map((s) => [s.d, s.engaged, s.land, s.chips.length])));
