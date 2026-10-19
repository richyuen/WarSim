// Critic run 9, session G2: the editor gives a nation a strategic bomber group at its capital and 10
// warheads; a stronger enemy attacks. Run at Max (resuming after each nuclear alert's pause) for
// up to N days: does the holder strike, when, where, for how many dead?
// Usage: node critic/scripts/c9_g2_poland.mjs <seed> <holderTag> <attackerTag> <capitalKey> <days>
import { launch, open1938, lookAt, shot, save, CELLS, run, pause } from './c9_lib.mjs';

const seed = Number(process.argv[2] ?? 5527);
const H = process.argv[3] ?? 'POL';
const A = process.argv[4] ?? 'GER';
const capKey = process.argv[5] ?? 'warsaw';
const maxDays = Number(process.argv[6] ?? 120);
const T = CELLS.tags;
const tag = `c9g2_${seed}_${H}`;
const out = { seed, H, A, alerts: [], marks: [] };
const { browser, page, errors } = await launch();
const warheadsOf = (n) => page.evaluate((n) => window.__warsim.hud.stats.value.nations.find((x) => x.id === n)?.warheads ?? null, n);
const forces = (n) => page.evaluate(async (n) => { const s = await window.__warsim.sim.inspect(true); const f = s.formations.filter((x) => x.nation === n); return { all: f.length, wings: f.filter((x) => x.wing).length }; }, n);
try {
  await open1938(page, seed);
  await page.getByTestId('editor-btn').click();
  await page.waitForTimeout(400);
  await page.getByTestId('editor-nation').selectOption(String(T[H]));
  await page.getByTestId('editor-tool-wing').click();
  await page.getByTestId('editor-template').selectOption({ label: 'Strategic bomber group' });
  const [cx, cy] = CELLS[capKey];
  await lookAt(page, cx, cy, 2000, false);
  await page.mouse.click(700, 450);
  await page.waitForTimeout(800);
  out.placeRefusal = await page.evaluate(() => document.querySelector('[data-testid=editor-refusal]')?.innerText ?? null);
  await page.getByTestId('editor-warheads').fill('10');
  await page.getByTestId('editor-warheads-add').click();
  await page.waitForTimeout(800);
  out.editorNote = await page.getByTestId('editor-panel').innerText().then((t) => t.split('\n').filter((l) => /cannot|warhead|missile|bomber/i.test(l))).catch(() => null);
  await shot(page, `${tag}_00_editor.png`);
  await page.getByTestId('editor-close').click();
  out.w0 = await warheadsOf(T[H]);
  out.f0 = await forces(T[H]);
  await page.evaluate(({ a, d }) => window.__warsim.sim.command({ kind: 'declareWar', attacker: a, defender: d }), { a: T[A], d: T[H] });
  await page.evaluate(() => window.__warsim.hud.setSpeedLevel(99));
  const t0 = await page.evaluate(() => window.__warsim.hud.tick.value);
  await run(page);
  const seen = new Set();
  let nextMark = 10;
  for (;;) {
    const r = await page.waitForFunction(({ t0, maxDays, nextMark }) => {
      const w = window.__warsim;
      if (w.hud.tick.value >= t0 + maxDays * 24) return 'end';
      if (w.hud.tick.value >= t0 + nextMark * 24) return 'mark';
      const a = document.querySelector('[data-testid=nuke-alert-text]');
      if (w.hud.paused.value) return a ? `paused:${a.innerText}` : 'paused';
      return a ? a.innerText : false;
    }, { t0, maxDays, nextMark }, { timeout: 1_200_000, polling: 100 });
    const v = await r.jsonValue();
    const day = Math.floor(((await page.evaluate(() => window.__warsim.hud.tick.value)) - t0) / 24);
    if (day >= nextMark || v === 'end') {
      out.marks.push({ day, w: await warheadsOf(T[H]), f: await forces(T[H]), land: await page.evaluate((n) => window.__warsim.hud.stats.value.nations.find((x) => x.id === n)?.land ?? null, T[H]) });
      nextMark += 10;
      save(`c9_g2_${seed}_${H}.json`, { ...out, errors });
    }
    if (v === 'end') break;
    if (v === 'mark') continue;
    const text = String(v).replace(/^paused:?/, '');
    if (text && !seen.has(text)) {
      seen.add(text);
      out.alerts.push({ day, text });
      if (out.alerts.length <= 2) await shot(page, `${tag}_1${out.alerts.length}_alert.png`);
    }
    if (String(v).startsWith('paused')) await run(page);
    else await page.waitForTimeout(300);
  }
  await pause(page);
  out.history = (await page.evaluate(() => { window.__warsim.hud.toggleHistory(); return new Promise((d) => setTimeout(() => d(document.body.innerText), 800)); })).split('\n').filter((l) => /nuclear|bomb/i.test(l)).slice(0, 20);
  await shot(page, `${tag}_9_end.png`);
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c9_g2_${seed}_${H}.json`, out);
await browser.close();
console.log(JSON.stringify(out));
