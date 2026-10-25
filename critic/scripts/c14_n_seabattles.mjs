// Critic run 12, session N: sea battles in other wars than the builder's test (seed 5591 GER-ENG).
// Steps 6 h at a time (as a player at x1 would see it), for each new battle of the pair with a row:
// clicks its row, runs 4 s at Speed x1, counts the ships of both sides on screen and the shots drawn.
// Usage: node critic/scripts/c14_n_seabattles.mjs <seed> <attackerTag> <defenderTag> [days]
import { launch, open1938, shot, save, CELLS } from './c14_lib.mjs';

const seed = Number(process.argv[2] ?? 2251);
const A = process.argv[3] ?? 'ITA';
const D = process.argv[4] ?? 'ENG';
const days = Number(process.argv[5] ?? 12);
const tag = `c14n_${seed}_${A}_${D}`;
const T = CELLS.tags;
const out = { seed, A, D, samples: [], battlesSeen: 0, rowless: 0, rowsClicked: [] };
const { browser, page, errors } = await launch();
const probe = (b) => page.evaluate(async (b) => {
  const v = window.__warsim.view;
  v.draw(performance.now());
  const cam = v.controller.cam;
  const side = { a: 0, b: 0, aEls: 0, bEls: 0, lens: [] };
  for (const f of (await window.__warsim.sim.inspect(true)).formations) {
    if (!v.formationAfloat(f.id)) continue;
    const s = f.nation === b.a ? 'a' : f.nation === b.b ? 'b' : null;
    if (!s) continue;
    let on = 0;
    for (let i = 0; i < v.elementCount; i++) {
      if (v.elementFormation[i] !== f.id) continue;
      const x = (v.elementX[i] - cam.cx) * cam.scale + window.innerWidth / 2;
      const y = (v.elementY[i] - cam.cy) * cam.scale + window.innerHeight / 2;
      if (x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight) on++;
    }
    if (on > 0) { side[s]++; side[s + 'Els'] += on; }
  }
  return { ...side, m: v.metresPerPx, shots: v.fire?.shots?.length ?? null };
}, b);
try {
  await open1938(page, seed);
  const a = T[A], d = T[D];
  out.ids = [a, d];
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a, d });
  const clickedKeys = new Set();
  for (let h = 6; h <= days * 24 && out.rowsClicked.length < 4; h += 6) {
    await page.evaluate(async () => {
      const { sim, view } = window.__warsim;
      const t = (await sim.step(6)).tick;
      await new Promise((done) => { const w = () => (view.lastTick >= t ? done() : setTimeout(w, 5)); w(); });
    });
    const bs = await page.evaluate(() => JSON.parse(JSON.stringify(window.__warsim.view.seaBattles())));
    const mine = bs.filter((b) => [b.a, b.b].includes(a) || [b.a, b.b].includes(d));
    out.battlesSeen += mine.length;
    out.rowless += mine.filter((b) => b.pair === null).length;
    const domRows = await page.evaluate(() => document.querySelectorAll('[data-testid=sea-battle-row]').length);
    out.samples.push({ h, domRows, all: bs.length, mine: mine.length, withPair: bs.filter((b) => b.pair).length, spans: mine.map((b) => [b.a, b.b, +b.span[0].toFixed(1), +b.span[1].toFixed(1), b.pair ? +Math.hypot(b.pair.w, b.pair.h).toFixed(2) : null]) });
    const rows = bs.filter((b) => b.pair !== null);
    const k = rows.findIndex((b) => ([b.a, b.b].includes(a) || [b.a, b.b].includes(d)) && !clickedKeys.has(`${Math.round(b.x / 8)},${Math.round(b.y / 8)}`));
    if (k < 0) continue;
    const b = rows[k];
    clickedKeys.add(`${Math.round(b.x / 8)},${Math.round(b.y / 8)}`);
    const rowLoc = page.getByTestId('sea-battle-row').nth(k);
    const rowText = await rowLoc.innerText().catch(() => null);
    await rowLoc.click();
    await page.waitForTimeout(300);
    await page.waitForFunction(() => !window.__warsim.view.controller.animating, null, { timeout: 60_000 });
    await page.waitForTimeout(500);
    const atClick = await probe(b);
    const n = out.rowsClicked.length;
    await shot(page, `${tag}_${n}_row.png`);
    await page.evaluate(() => { window.__warsim.hud.setSpeedLevel(0); if (window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
    let maxShots = 0;
    const seq = [];
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(500);
      const r = await probe(b);
      seq.push(r.shots);
      maxShots = Math.max(maxShots, r.shots ?? 0);
      if (i === 3) await shot(page, `${tag}_${n}_live.png`);
    }
    await page.evaluate(() => { if (!window.__warsim.hud.paused.value) window.__warsim.hud.togglePause(); });
    // a close look: 15 m/px at the view's centre
    const c = await page.evaluate(() => { const cc = window.__warsim.view.controller.cam; return [cc.cx, cc.cy]; });
    await page.evaluate(({ c }) => { const v = window.__warsim.view; v.controller.set({ cx: c[0], cy: c[1], scale: (v.metresPerPx * v.controller.cam.scale) / 20 }); }, { c });
    await page.waitForTimeout(1500);
    const close = await probe(b);
    await shot(page, `${tag}_${n}_20m.png`);
    out.rowsClicked.push({ h, rowText, battle: { a: b.a, b: b.b, span: b.span, pair: b.pair }, atClick, maxShots, seq, close });
    console.log(JSON.stringify(out.rowsClicked.at(-1)));
  }
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c14_n_${seed}_${A}_${D}.json`, out);
await browser.close();
console.log('done', out.battlesSeen, out.rowless, out.rowsClicked.length, out.fatal ?? '');
