import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';

// PLAN 7.172 AT (critic runs 18–21, `c20_ft_5381_d21.json`, `c21_ft_5381_d21.json`: after a land
// formation's "To its fight", the formation itself off screen on 6 of 8 and no enemy on screen on 2
// of 8): seed 5381, day 21, the critic's 8 formations at 1600 × 900; after the press and the
// camera's flight, the formation's drawn counter or elements are inside the view, and so are the
// enemy's it faces (the one its panel frames), 8 of 8.
//
// The critic placed each formation at its sim position (`inspect().formations[].x/y`), which is the
// formation's anchor, about half a cell from where its block is drawn (`blockPose`): at 20 m/px half
// a cell is some 490 px, off the view, while the block it frames is in the middle (its shots show
// it). This counts what is drawn (`formationsInBox`, the box select's own test).

const IDS = [376, 389, 408, 427, 442, 475, 487, 746];

test("a land formation's \"To its fight\": it and the enemy it faces drawn in the view, the critic's 8 of 8", async ({ page }, info) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/?scenario=1938&paused=1&seed=5381');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 120_000 });
  await page.evaluate(() => {
    window.__warsim!.settings.nukePause.value = false;
  });
  await page.evaluate(async (n) => {
    const w = window.__warsim!;
    const target = w.view!.lastTick + n;
    await w.sim.step(n);
    await new Promise<void>((done) => {
      const wait = (): void => void (w.view!.lastTick >= target ? done() : setTimeout(wait, 10));
      wait();
    });
  }, 21 * 24);
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.172') : info.outputPath();
  mkdirSync(out, { recursive: true });
  const seen: { id: number; self: boolean; enemy: boolean }[] = [];
  for (const id of IDS) {
    await page.evaluate((id) => window.__warsim!.hud.selectFormation(id), id);
    await expect.poll(() => page.evaluate(() => window.__warsim!.hud.formationInfo.value?.id ?? 0)).toBe(id);
    const fight = page.getByTestId('formation-fight');
    await expect(fight, `${id} in contact`).toBeVisible();
    const enemy = await page.evaluate(() => window.__warsim!.hud.formationInfo.value!.fight!.enemy);
    await fight.click();
    // The camera's flight over: the same place twice, 300 ms apart.
    const cam = (): Promise<string> => page.evaluate(() => JSON.stringify(window.__warsim!.view!.controller.cam));
    await expect
      .poll(async () => {
        const a = await cam();
        await page.waitForTimeout(300);
        return a === (await cam());
      }, { timeout: 15_000 })
      .toBe(true);
    seen.push(
      await page.evaluate(
        ([id, enemy]) => {
          const v = window.__warsim!.view!;
          const drawn = (f: number): boolean => v.formationsInBox(0, 0, innerWidth, innerHeight, v.formationNation(f)).includes(f);
          return { id, self: drawn(id), enemy: drawn(enemy) };
        },
        [id, enemy] as [number, number],
      ),
    );
    await page.screenshot({ path: path.join(out, `fight-${id}.png`) });
  }
  expect(seen).toEqual(IDS.map((id) => ({ id, self: true, enemy: true })));
});
