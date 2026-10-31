// Critic run 12, session G: the editor's forces (fleets, a wing, warheads) by clicks; a scenario
// exported and chosen on the title (Cancel, then Start); then played: Germany against Poland (which
// holds 10 warheads and a bomber group) and against Britain (fleets set face to face in the North
// Sea). Do the warheads get used, do the fleets fight?
// Usage: node critic/scripts/c21_g_editor.mjs <seed>
import path from 'node:path';
import { launch, BASE, open1938, lookAt, shot, save, CELLS, run, pause } from './c21_lib.mjs';

const seed = Number(process.argv[2] ?? 5591);
const tag = `c21g_${seed}`;
const T = CELLS.tags;
const out = { seed, steps: [] };
const { browser, page, errors } = await launch();
const S = (n) => shot(page, `${tag}_${n}.png`);
const refusal = () => page.evaluate(() => document.querySelector('[data-testid=editor-refusal]')?.innerText ?? null);
const forces = (n) => page.evaluate(async (n) => { const s = await window.__warsim.sim.inspect(true); const f = s.formations.filter((x) => x.nation === n); return { all: f.length, wings: f.filter((x) => x.wing).length }; }, n);
const warheadsOf = (n) => page.evaluate((n) => window.__warsim.hud.stats.value.nations.find((x) => x.id === n)?.warheads ?? null, n);
try {
  await open1938(page, seed);
  await page.getByTestId('editor-btn').click();
  await page.waitForTimeout(500);
  await S('00_editor');
  out.editorText = (await page.getByTestId('editor-panel').innerText()).slice(0, 2500);
  const place = async (nation, tool, templateLabel, x, y, label) => {
    await page.getByTestId('editor-nation').selectOption(String(nation));
    await page.getByTestId(`editor-tool-${tool}`).click();
    if (templateLabel) await page.getByTestId('editor-template').selectOption({ label: templateLabel }).catch((e) => out.steps.push({ label, templErr: String(e).slice(0, 150) }));
    const before = await forces(nation);
    await lookAt(page, x, y, 2000, false);
    await page.mouse.click(700, 450);
    await page.waitForTimeout(800);
    const after = await forces(nation);
    const st = { label, before, after, refusal: await refusal() };
    out.steps.push(st);
    return st;
  };
  out.templates = await page.evaluate(() => [...document.querySelectorAll('[data-testid=editor-template] option')].map((o) => o.textContent)).catch(() => null);
  const [nx, ny] = CELLS.northsea;
  await place(T.GER, 'fleet', 'Battle squadron', nx + 8, ny + 2, 'GER fleet North Sea');
  await place(T.GER, 'fleet', 'Battle squadron', nx + 6, ny + 4, 'GER fleet 2');
  await place(T.ENG, 'fleet', 'Battle squadron', nx - 2, ny, 'ENG fleet North Sea');
  await place(T.ENG, 'fleet', 'Battle squadron', nx, ny - 3, 'ENG fleet 2');
  out.templatesWing = null;
  await page.getByTestId('editor-tool-wing').click();
  out.templatesWing = await page.evaluate(() => [...document.querySelectorAll('[data-testid=editor-template] option')].map((o) => o.textContent));
  await place(T.POL, 'wing', 'Strategic bomber group', CELLS.warsaw[0], CELLS.warsaw[1], 'POL bomber Warsaw');
  await S('01_after_places');
  // Poland's warheads
  await page.getByTestId('editor-nation').selectOption(String(T.POL));
  await page.getByTestId('editor-warheads').fill('10');
  await page.getByTestId('editor-warheads-add').click();
  await page.waitForTimeout(800);
  out.polWarheads = await warheadsOf(T.POL);
  out.warheadsText = await page.getByTestId('editor-warheads-of').innerText().catch(() => null);
  await S('02_warheads');
  // A fleet inland
  await place(T.GER, 'fleet', 'Battle squadron', CELLS.berlin[0], CELLS.berlin[1], 'GER fleet Berlin (should refuse)');
  await S('03_refusal');
  // Export
  await page.getByTestId('scenario-name').fill('Critic standoff 8');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('scenario-export').click()]);
  const file = path.resolve('critic/c21_critic_standoff.warsim-scenario');
  await dl.saveAs(file);
  out.placed = { GER: await forces(T.GER), ENG: await forces(T.ENG), POL: await forces(T.POL) };
  // Title: choose, cancel, choose, start
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2500);
  await page.getByTestId('title-scenario-file').setInputFiles(file);
  await page.waitForTimeout(800);
  await S('10_title_pending');
  out.pendingText = await page.getByTestId('title-file-pending').innerText().catch(() => null);
  await page.getByTestId('title-file-cancel').click();
  await page.waitForTimeout(800);
  out.afterCancelUrl = page.url();
  out.afterCancelPending = await page.getByTestId('title-file-pending').count();
  await S('11_title_cancelled');
  await page.getByTestId('title-scenario-file').setInputFiles(file);
  await page.waitForTimeout(600);
  await Promise.all([page.waitForURL(/load=scenario/, { timeout: 30_000 }), page.getByTestId('title-file-start').click()]);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim.hud.stats.value !== null && window.__warsim.sim.mapLayers !== null, null, { timeout: 120_000 });
  await page.waitForTimeout(2000);
  out.loaded = { GER: await forces(T.GER), ENG: await forces(T.ENG), POL: await forces(T.POL), polWarheads: await warheadsOf(T.POL) };
  await S('12_loaded');
  // Play
  await page.evaluate(({ T }) => {
    const c = window.__warsim.sim;
    c.command({ kind: 'declareWar', attacker: T.GER, defender: T.POL });
    c.command({ kind: 'declareWar', attacker: T.GER, defender: T.ENG });
  }, { T });
  await page.evaluate(() => window.__warsim.hud.setSpeedLevel(99));
  await run(page);
  const t0 = await page.evaluate(() => window.__warsim.hud.tick.value);
  const marks = [];
  for (const days of [1, 2, 3, 10, 30, 60, 120]) {
    await page.waitForFunction(({ t0, d }) => window.__warsim.hud.tick.value >= t0 + d * 24, { t0, d: days }, { timeout: 900_000, polling: 200 });
    await pause(page);
    const m = {
      days,
      polWarheads: await warheadsOf(T.POL),
      polForces: await forces(T.POL),
      alerts: await page.evaluate(() => document.querySelector('[data-testid=nuke-alert-text]')?.innerText ?? null),
      sea: await page.evaluate(() => window.__warsim.hud.seaBattles.value.length),
      fleetsNear: await page.evaluate(async ({ T, nx, ny }) => { const v = window.__warsim.view; const s = await window.__warsim.sim.inspect(true); const r = {}; for (const [k, n] of [['GER', T.GER], ['ENG', T.ENG]]) { const f = s.formations.filter((x) => x.nation === n && v.formationAfloat(x.id)); r[k] = { afloat: f.length, within15: f.filter((x) => Math.hypot(x.x - nx, x.y - ny) < 15).length }; } return r; }, { T, nx, ny }),
      histSea: await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /Sea battle|sunk|ships/.test(e.textContent ?? '')).map((e) => e.textContent.trim()).slice(0, 8)),
      tickerSea: await page.evaluate(() => document.body.innerText.split('\n').filter((l) => /Sea battle/.test(l)).slice(0, 5)),
    };
    marks.push(m);
    if (days === 3) {
      await lookAt(page, nx + 3, ny, 300);
      await S('20_northsea_day3_300m');
      await lookAt(page, nx + 3, ny, 30);
      await S('21_northsea_day3_30m');
    }
    if (days === 120) {
      await lookAt(page, CELLS.warsaw[0], CELLS.warsaw[1], 3000);
      await S('22_poland_day120');
    }
    out.marks = marks;
    save(`c21_g_${seed}.json`, { ...out, errors });
    await run(page);
  }
  await pause(page);
  await page.evaluate(() => window.__warsim.hud.toggleHistory());
  await page.waitForTimeout(600);
  out.history = (await page.evaluate(() => document.body.innerText)).split('\n').filter((l) => /bomb|nuclear|Sea battle|sunk|warhead|Poland/i.test(l)).slice(0, 40);
  await S('23_history');
} catch (e) {
  out.fatal = String(e?.stack ?? e);
}
out.errors = errors;
save(`c21_g_${seed}.json`, out);
await browser.close();
console.log(JSON.stringify({ fatal: out.fatal, errors: errors.length, steps: out.steps, polWarheads: out.polWarheads, pending: out.pendingText, cancel: [out.afterCancelUrl, out.afterCancelPending], loaded: out.loaded, marks: out.marks }));
