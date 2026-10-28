import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.151: a carrier group's panel lists the wings aboard and their mission. Seed 99: Japan, at war with China
// from the start, sends its carriers' naval bombers at Chinese divisions from hour 1 (PLAN 7.145). Hour by hour to a
// Japanese fleet with a deck wing on a strike; its panel, opened by a click on its marker, has a row for each wing
// based on its carriers, the strike's among them, as the sim's `FormationDetail.deck` has them.

const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;

test("a Japanese carrier group's panel lists its air groups aboard and their missions (seed 99)", async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=99');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.151') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const jap = id('JAP');
  // A Japanese fleet whose deck has a wing on a strike, after the hour's step.
  const find = (jap: number): Promise<{ id: number; x: number; y: number; carriers: number; wings: { mission: string | null }[] } | null> =>
    (async () => {
      const { sim, view } = window.__warsim!;
      const t = (await sim.step(1)).tick;
      await new Promise<void>((done) => {
        const wait = (): void => (view!.lastTick >= t ? done() : void setTimeout(wait, 5));
        wait();
      });
      const all = (await sim.inspect(true)).formations as { id: number; x: number; y: number; nation: number }[];
      for (const f of all.filter((f) => f.nation === jap && view!.formationAfloat(f.id))) {
        const d = await sim.formation(f.id);
        if (d?.deck && d.deck.wings.some((w) => w.mission === 'strike')) return { id: f.id, x: f.x, y: f.y, carriers: d.deck.carriers, wings: d.deck.wings };
      }
      return null;
    })();
  let fleet = null;
  for (let h = 0; h < 72 && fleet === null; h++) fleet = await page.evaluate(find, jap);
  expect(fleet, 'a Japanese carrier group with a wing on a strike within 72 hours').not.toBeNull();
  await page.evaluate(({ x, y }) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 24 }), fleet!);
  await page.waitForTimeout(800);
  const centre = await page.evaluate((id) => {
    const v = window.__warsim!.view!;
    v.draw(performance.now());
    const r = v.markerRects.find((m) => m.id === id || m.members.includes(id));
    return r ? ([r.x + r.w / 2, r.y + r.h / 2] as [number, number]) : null;
  }, fleet!.id);
  expect(centre, "the fleet's marker on the screen").not.toBeNull();
  await page.mouse.click(...centre!);
  const panel = page.getByTestId('formation-panel');
  await expect(panel).toBeVisible();
  // A click on a stack opens its first member: the panel is opened on the fleet itself if it is another.
  const opened = Number(await panel.getAttribute('data-formation'));
  if (opened !== fleet!.id) await page.evaluate((id) => window.__warsim!.hud.selectFormation(id), fleet!.id);
  await expect(panel).toHaveAttribute('data-formation', String(fleet!.id));
  const head = page.getByTestId('formation-deck-head');
  await expect(head).toBeVisible();
  const rows = page.getByTestId('formation-deck').locator('tr');
  await expect(rows).toHaveCount(fleet!.wings.length);
  expect(fleet!.wings.length).toBeGreaterThan(0);
  await expect(head).toHaveText(`Air groups aboard (${fleet!.wings.length} of ${fleet!.carriers})`);
  await expect(page.getByTestId('formation-deck').locator('tr[data-mission="strike"]').first()).toContainText('striking');
  await panel.screenshot({ path: path.join(out, 'a-carrier-panel-99.png') });
  await page.screenshot({ path: path.join(out, 'b-carrier-panel-map-99.png') });
  console.log(`seed 99: Japanese fleet ${fleet!.id}, ${fleet!.carriers} carriers, missions ${fleet!.wings.map((w) => w.mission ?? 'fleet').join(', ')}`);
});
