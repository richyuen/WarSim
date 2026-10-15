import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { EventKind } from '../../src/shared/events';
import { nukeStrike } from '../../src/shared/history';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';

// PLAN 6.7 AT: the AI's nuclear strike, decided by its utility, not God Mode's. The scene (seed 1,
// 1 January 1938), set by commands: nukes allowed, France given one warhead and ballistic missiles
// (in 1938 its one strategic bomber would not get past Germany's air, and its utility, which weighs
// the chance a warhead gets there, says so); Germany declares war on France, France's side fights
// to the death, and six German divisions stand at Reims, 130 km from Paris. France's desperation is
// extreme (fighting to the death, its capital threatened), and at the next day's first hour its
// decision (`nukeDecisions`) strikes Berlin by missile. The decision record is the history's `NukeDecided` (France, its utility above 0); the
// strike's is France's, Germany struck; no command of the test launched it (every command sent is
// recorded: none is `launchNuke` or `godNuke`).

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const [FRA, GER] = [id('FRA'), id('GER')];
const reims = cellOf(4.03, 49.26, W, H);
const berlin = cellOf(13.4, 52.52, W, H);
const infantry = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

test('the AI decides on a nuclear strike: France, fighting to the death with the Germans before Paris, strikes Berlin', async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__warsim!.view!.hasFineCoast, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/6.7') : info.outputPath();
  mkdirSync(out, { recursive: true });

  // Every command the page sends from here, recorded.
  await page.evaluate(() => {
    const sim = window.__warsim!.sim as unknown as { command: (c: { kind: string }, now?: boolean) => void; sent?: string[] };
    const send = sim.command.bind(sim);
    sim.sent = [];
    sim.command = (c, now) => {
      sim.sent!.push(c.kind);
      send(c, now);
    };
  });
  // The scene.
  await page.evaluate(
    async ({ FRA, GER, reims, infantry }) => {
      const s = window.__warsim!.sim;
      s.command({ kind: 'setSetting', key: 'nukesEnabled', value: true });
      s.command({ kind: 'grantWarheads', nation: FRA, count: 1 });
      s.command({ kind: 'grantTech', nation: FRA, tech: 'ballistic_missiles' });
      s.command({ kind: 'declareWar', attacker: GER, defender: FRA });
      for (let k = 0; k < 6; k++) s.command({ kind: 'spawnFormation', nation: GER, x: reims[0] + (k % 3) * 0.4, y: reims[1] + Math.floor(k / 3) * 0.4, strength: 0, template: infantry });
      await s.step(1);
      const war = (await s.inspect()).wars.find((w) => w.attackers.includes(GER) && w.defenders.includes(FRA))!;
      s.command({ kind: 'setWarFightToDeath', war: war.id, side: 1, value: true });
      await s.step(1);
    },
    { FRA, GER, reims, infantry },
  );
  // Two days on.
  await page.evaluate(() => window.__warsim!.sim.step(48));
  const rows = await page.evaluate(() => window.__warsim!.sim.history());
  const decided = rows.filter((r) => r.kind === EventKind.NukeDecided);
  const struck = rows.filter((r) => r.kind === EventKind.NukeCasualties);
  // The decision record: France's, of its utility.
  expect(decided.length).toBe(1);
  expect(decided[0]!.a).toBe(FRA);
  expect(decided[0]!.b).toBeGreaterThan(0);
  // The strike: France's on Germany, after the decision; no command launched it.
  expect(struck.length).toBe(1);
  expect(struck[0]!.a).toBe(FRA);
  expect(nukeStrike(struck[0]!.b).nation).toBe(GER);
  expect(struck[0]!.tick).toBeGreaterThanOrEqual(decided[0]!.tick);
  const sent = await page.evaluate(() => (window.__warsim!.sim as unknown as { sent: string[] }).sent);
  expect(sent).not.toContain('launchNuke');
  expect(sent).not.toContain('godNuke');
  process.stderr.write(`decided ${JSON.stringify(decided[0])}; struck ${JSON.stringify(struck[0])}; commands ${sent.join(', ')}\n`);
  // The alert tells it; the burst over Berlin at T1 (held at 1.6 s into it).
  await expect(page.getByTestId('nuke-alert-text')).toHaveText(/^France struck Germany with an atomic bomb near Berlin: [\d,]+ dead$/, { timeout: 15_000 });
  await page.evaluate(({ x, y }) => {
    const v = window.__warsim!.view!;
    v.controller.set({ cx: x, cy: y, scale: 14 });
    if (v.nukeFx.bursts.length === 0) v.nukeFx.bursts.push({ x, y, yieldN: 1, born: performance.now() });
    v.nukeFx.hold = 1600;
    v.draw();
  }, { x: berlin[0], y: berlin[1] });
  await page.screenshot({ path: path.join(out, 'ai-strike.png') });
});
