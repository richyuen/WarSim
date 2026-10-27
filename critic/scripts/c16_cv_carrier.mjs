// Critic run 16, session CV (new): carriers (ADR-725/726).
// A: the 1938 start's carrier groups: panel text. The editor's carrier group placed: wings of its nation before/after,
//    its panel (ADR-725 leaves the editor's decks empty). Then play 20 days and watch for its sorties.
// B (with a save): the late world's carrier groups: panel, view at T2/T3, sorties over 10 days.
// Usage: node critic/scripts/c16_cv_carrier.mjs <seed> [save.bin]
import { readFileSync } from 'node:fs';
import { launch, open1938, lookAt, shot, save, CELLS, hours } from './c16_lib.mjs';
const seed = Number(process.argv[2] ?? 4877);
const bin = process.argv[3];
const T = CELLS.tags;
const tag = `c16cv_${seed}${bin ? '_save' : ''}`;
const out = { seed, bin, steps: [] };
const { browser, page, errors } = await launch();
const S = (n) => shot(page, `${tag}_${n}.png`);
const carriersOf = () => page.evaluate(async () => {
  const v = window.__warsim.view; const st = await window.__warsim.sim.inspect(true);
  return st.formations.filter((x) => v.formationAfloat(x.id) && /carrier/i.test(JSON.stringify(v.formationTitle(x.id)))).map((x) => ({ id: x.id, nation: x.nation, x: x.x, y: x.y, t: v.formationTitle(x.id), elements: x.elements }));
});
const wingsOf = (n) => page.evaluate(async (n) => { const st = await window.__warsim.sim.inspect(true); return st.formations.filter((x) => x.nation === n && x.wing).length; }, n);
const panel = async (id) => {
  await page.evaluate((id) => window.__warsim.hud.selectFormation(id), id);
  await page.waitForTimeout(700);
  return page.evaluate(() => document.querySelector('[data-testid=formation-panel]')?.innerText ?? null);
};
const sortiesNear = (x, y, r) => page.evaluate(async ({ x, y, r }) => {
  const v = window.__warsim.view;
  const s = v.sortiesDrawn?.() ?? null;
  return s;
}, { x, y, r });
try {
  await open1938(page, seed);
  if (bin) {
    const bytes = readFileSync(bin);
    await page.route('**/__critic_ck.bin', (r) => r.fulfill({ status: 200, body: bytes, contentType: 'application/octet-stream' }));
    await page.evaluate(async () => window.__warsim.sim.load(new Uint8Array(await (await fetch('/__critic_ck.bin')).arrayBuffer())));
    await hours(page, 1);
  }
  const cvs = await carriersOf();
  out.carriers = cvs;
  for (const c of cvs.slice(0, 4)) {
    c.panel = await panel(c.id);
    await lookAt(page, c.x, c.y, 60);
    c.shot60 = await S(`fleet${c.id}_60m`);
    await lookAt(page, c.x, c.y, 15);
    c.shot15 = await S(`fleet${c.id}_15m`);
  }
  if (!bin) {
    // The editor's carrier group for the United States, mid-Atlantic, and one for Japan off its coast.
    await page.getByTestId('editor-btn').click();
    await page.waitForTimeout(500);
    await page.getByTestId('editor-tool-fleet').click();
    out.fleetTemplates = await page.evaluate(() => [...document.querySelectorAll('[data-testid=editor-template] option')].map((o) => o.textContent));
    const label = out.fleetTemplates.find((t) => /carrier/i.test(t));
    out.label = label;
    const before = await wingsOf(T.USA);
    const beforeCv = (await carriersOf()).map((c) => c.id);
    await page.getByTestId('editor-nation').selectOption(String(T.USA));
    await page.getByTestId('editor-tool-fleet').click();
    await page.getByTestId('editor-template').selectOption({ label });
    const [nx, ny] = CELLS.northsea;
    await lookAt(page, nx - 6, ny + 1, 2000, false);
    await page.mouse.click(700, 450);
    await page.waitForTimeout(900);
    out.refusal = await page.evaluate(() => document.querySelector('[data-testid=editor-refusal]')?.innerText ?? null);
    const after = await wingsOf(T.USA);
    out.usaWings = { before, after };
    const placed = (await carriersOf()).filter((c) => !beforeCv.includes(c.id));
    out.placed = placed;
    await S('editor_placed');
    await page.getByTestId('editor-btn').click().catch(() => {});
    await page.waitForTimeout(400);
    if (placed[0]) {
      placed[0].panel = await panel(placed[0].id);
      await lookAt(page, placed[0].x, placed[0].y, 60);
      placed[0].shot = await S('editor_placed_panel');
    }
    // A start carrier's panel beside it for comparison
    const start = cvs.find((c) => c.nation === T.USA);
    if (start) out.startUsaPanel = await panel(start.id);
  }
} catch (e) { out.fatal = String(e?.stack ?? e); }
out.errors = errors;
save(`${tag}.json`, out);
await browser.close();
console.log(JSON.stringify({ carriers: (out.carriers ?? []).length, placed: out.placed?.length, usaWings: out.usaWings, label: out.label, refusal: out.refusal, fatal: out.fatal }));
