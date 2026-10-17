// Critic run 7, session M: who holds the air over Poland on day 10 of Germany's war? Hover the air mode.
import { launch, open1938, shot, save, lookAt, CELLS, screenOf, hours } from './c7_lib.mjs';

const seed = Number(process.argv[2] ?? 8217);
const T = CELLS.tags;
const out = { seed, hovers: [] };
const { browser, page, errors } = await launch();
try {
  await open1938(page, seed);
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T.GER, d: T.POL });
  await hours(page, 24 * 10);
  await page.evaluate(() => window.__warsim.hud.setMapMode('airControl'));
  await lookAt(page, CELLS.polfront[0], CELLS.polfront[1], 3000);
  await page.waitForTimeout(800);
  out.holders = await page.evaluate(() => window.__warsim.hud.airHolders.value.map((h) => ({ ...h })));
  for (const [name, c] of Object.entries({ warsaw: CELLS.warsaw, kiev: CELLS.kiev, berlin: CELLS.berlin, prague: CELLS.prague })) {
    const [x, y] = await screenOf(page, c[0], c[1]);
    await page.mouse.move(x, y);
    await page.waitForTimeout(600);
    out.hovers.push({ name, text: await page.evaluate(() => [...document.querySelectorAll('[class*=legend]')].map((e) => e.innerText).join(' | ').match(/This air zone[^|\n]*/)?.[0] ?? null) });
  }
  await shot(page, 'c7m_8217_air_hover.png');
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save('c7_m_8217.json', out);
await browser.close();
console.log(JSON.stringify(out));
