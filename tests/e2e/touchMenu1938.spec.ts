import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';

// PLAN 7.171 AT (critic runs 20–21, `c20_pt_touch.json`: on a touch screen a long press only drew a
// selection box, and there was no way to the nation menu, so no war could be declared by touch): at
// 390 × 844 with touch, playing Germany, a long press held still on Poland's land opens Poland's
// menu, and "Declare war" there starts the war; a long press on Germany's own land, then its drag,
// still selects the formations in the box, and opens no menu.

const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;

/** A finger: down at (x, y), held `ms`, moved to (x2, y2) in steps, lifted. Pointer events as a touch screen sends them. */
async function press(page: Page, id: number, x: number, y: number, ms: number, x2 = x, y2 = y): Promise<void> {
  const send = (type: string, px: number, py: number): Promise<void> =>
    page.evaluate(
      ([type, id, px, py]) => {
        const c = document.querySelector('canvas')!;
        c.dispatchEvent(new PointerEvent(type as string, { pointerId: id as number, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: px as number, clientY: py as number, bubbles: true }));
      },
      [type, id, px, py] as const,
    );
  await send('pointerdown', x, y);
  await page.waitForTimeout(ms);
  for (let k = 1; k <= 6; k++) await send('pointermove', x + ((x2 - x) * k) / 6, y + ((y2 - y) * k) / 6);
  await send('pointerup', x2, y2);
}

test.use({ hasTouch: true });

test("a long press on Poland opens its menu and declares war; on Germany's own land it still draws a box", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
  await page.evaluate((n) => window.__warsim!.view!.select(n), GER);
  await page.getByTestId('take-control').tap();
  await page.getByTestId('nation-close').tap();
  await expect(page.getByTestId('nation-panel')).toHaveCount(0);
  const [x, y] = cellOf(17, 52.3, SIZE_1938.w, SIZE_1938.h);
  await page.evaluate(([cx, cy]) => window.__warsim!.view!.controller.set({ cx, cy, scale: 10 }), [x, y] as [number, number]);
  await page.waitForTimeout(300);
  const spot = (nation: number): Promise<readonly [number, number] | null> =>
    page.evaluate((n) => {
      const v = window.__warsim!.view!;
      for (let y = 200; y <= 560; y += 12) for (let x = 40; x <= 350; x += 12) if (v.nationAt(x, y) === n && v.nationAt(x + 12, y) === n && v.nationAt(x, y + 12) === n && v.nationAt(x - 12, y) === n) return [x, y] as const;
      return null;
    }, nation);
  const pol = (await spot(POL))!;
  const own = (await spot(GER))!;
  expect(pol, "Poland's land on the screen").not.toBeNull();
  expect(own, "Germany's land on the screen").not.toBeNull();
  const menu = page.getByTestId('nation-menu');
  const atWar = (): Promise<boolean> => page.evaluate(async ([a, b]) => (await window.__warsim!.sim.inspect()).wars.some((w) => (w.attackers.includes(a) && w.defenders.includes(b)) || (w.attackers.includes(b) && w.defenders.includes(a))), [GER, POL] as [number, number]);
  expect(await atWar()).toBe(false);

  // A long press on Germany's own land, then its drag: the box selects, and no menu.
  // From Germany's land to the lower left, over Berlin's formations.
  const inBox = await page.evaluate(([ax, ay, n]) => window.__warsim!.view!.formationsInBox(ax, ay, 8, 600, n), [own[0], own[1], GER] as [number, number, number]);
  await press(page, 11, own[0], own[1], 700, 8, 600);
  await expect(menu).toHaveCount(0);
  const boxed = await page.evaluate(() => [...window.__warsim!.view!.selectedFormations]);
  expect(boxed.sort((a, b) => a - b), 'the box selects what is in it').toEqual(inBox.sort((a, b) => a - b));
  // A long press held still on Germany's land: no menu either.
  await press(page, 12, own[0], own[1], 700);
  await expect(menu).toHaveCount(0);

  // A long press held still on Poland's land: Poland's menu.
  await press(page, 13, pol[0], pol[1], 700);
  await expect(menu).toBeVisible();
  await expect(page.getByTestId('nation-menu-name')).toHaveText('Poland');
  const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.171') : info.outputPath();
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'touch-menu-poland.png') });
  // "Declare war" there: the war is on, and the menu closed.
  await page.getByTestId('nation-menu-war').tap();
  await expect(menu).toHaveCount(0);
  await expect.poll(atWar, { timeout: 15_000 }).toBe(true);
  // A short press there is a tap, as before: no menu.
  await press(page, 14, pol[0], pol[1], 50);
  await expect(menu).toHaveCount(0);
  expect(boxed.length, 'the box on own land selected formations').toBeGreaterThan(0);
});
