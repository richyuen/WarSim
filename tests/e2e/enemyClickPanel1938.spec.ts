import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 7.163 AT (critic run 21, non-blocking 1 and 2; ADR-773): while playing, a click on an
// enemy's counter at the front opens the panel of what is drawn there, never one's own. The replay
// of the critic's `c21_ex2_enemypanel.mjs` (seed 4441, Germany at war with Poland, day 60) and
// `c21_sxg_front.mjs` (seed 6827, Japan at war with China, day 45): the twelve enemy formations
// nearest one's own, the camera on each where it is drawn at scale 12, a click at the centre.
// On ce3f95e6 (ADR-769, own first): 4441 a German panel 3 of 12 and the clicked Polish one 5;
// 6827 a Japanese panel 7 of 12, one with nothing selected, the clicked Chinese one 0.

const tag = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;

interface Click {
  clicked: number;
  /** What is drawn under the click before it (the map's pick), and its nation. */
  drawn: number;
  drawnNation: number;
  panel: number | null;
  panelNation: number;
  sel: number[];
}

async function front(page: Page, seed: number, a: number, label: string, b: number, days: number): Promise<Click[]> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(`/?scenario=1938&paused=1&seed=${seed}`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 120_000 });
  await page.evaluate((n) => window.__warsim!.view!.select(n), a);
  await page.getByTestId('take-control').click();
  await page.getByTestId('tab-actions').click();
  await page.locator('.nation-panel select').first().selectOption({ label });
  await page.getByRole('button', { name: 'Declare war' }).click();
  await page.getByTestId('nation-close').click().catch(() => {});
  await page.evaluate(async (n) => {
    const w = window.__warsim!;
    const target = w.view!.lastTick + n;
    await w.sim.step(n);
    await new Promise<void>((done) => {
      const wait = (): void => void (w.view!.lastTick >= target ? done() : setTimeout(wait, 10));
      wait();
    });
  }, 24 * days);
  // The enemy's twelve formations nearest one's own, by where they are drawn (as the critic's).
  const enemies = await page.evaluate(
    ([na, nb]) => {
      const v = window.__warsim!.view! as unknown as { formIds: number[]; drawnAt(i: number): [number, number]; formationsOf(n: number): number[] };
      const at = (id: number): [number, number] | null => {
        const i = v.formIds.indexOf(id);
        return i < 0 ? null : v.drawnAt(i);
      };
      const mine = v.formationsOf(na).map(at);
      return v
        .formationsOf(nb)
        .map((id) => {
          const p = at(id);
          let d = 1e9;
          if (p) for (const o of mine) if (o) d = Math.min(d, Math.hypot(o[0] - p[0], o[1] - p[1]));
          return [id, d] as const;
        })
        .sort((x, y) => x[1] - y[1])
        .slice(0, 12)
        .map((x) => x[0]);
    },
    [a, b] as const,
  );
  const drawnAt = (id: number): Promise<[number, number]> =>
    page.evaluate((f) => {
      const v = window.__warsim!.view! as unknown as { formIds: number[]; drawnAt(i: number): [number, number] };
      return v.drawnAt(v.formIds.indexOf(f));
    }, id);
  const out: Click[] = [];
  for (const id of enemies) {
    await page.evaluate(() => {
      window.__warsim!.view!.selectedFormations.clear();
      document.querySelector<HTMLElement>('[data-testid=formation-close]')?.click();
    });
    // Twice, as the critic: the camera's move changes where a marker is drawn.
    for (let k = 0; k < 2; k++) {
      await page.evaluate(([x, y]) => window.__warsim!.view!.controller.set({ cx: x, cy: y, scale: 12 }), await drawnAt(id));
      await page.waitForTimeout(k === 0 ? 400 : 300);
    }
    const drawn = await page.evaluate(() => {
      const v = window.__warsim!.view!;
      const c = document.getElementById('map') as HTMLCanvasElement;
      const f = v.formationPick(c.clientWidth / 2, c.clientHeight / 2);
      return { drawn: f, drawnNation: v.formationNation(f) };
    });
    await page.mouse.click(800, 450);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const v = window.__warsim!.view!;
      const fp = document.querySelector<HTMLElement>('[data-testid=formation-panel]');
      const panel = fp ? Number(fp.dataset['formation']) : null;
      return { panel, panelNation: panel === null ? 0 : v.formationNation(panel), sel: [...v.selectedFormations] };
    });
    out.push({ clicked: id, ...drawn, ...r });
  }
  return out;
}

const cases = [
  { seed: 4441, a: 'GER', label: 'Poland', b: 'POL', days: 60, clickedAtLeast: 9 },
  { seed: 6827, a: 'JAP', label: 'China', b: 'CHI', days: 45, clickedAtLeast: 1 },
];

for (const c of cases) {
  test(`playing ${c.a} at war with ${c.b} (seed ${c.seed}): a click on an enemy's counter opens what is drawn there, never one's own unselected`, async ({ page }, info) => {
    test.setTimeout(600_000);
    const [a, b] = [tag(c.a), tag(c.b)];
    const clicks = await front(page, c.seed, a, c.label, b, c.days);
    const out = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/7.163') : info.outputPath();
    mkdirSync(out, { recursive: true });
    await page.screenshot({ path: path.join(out, `enemy-click-${c.seed}.png`) });
    const s = JSON.stringify(clicks);
    const sum = {
      clicks: clicks.length,
      panelIsDrawn: clicks.filter((k) => k.panel === k.drawn).length,
      panelEnemy: clicks.filter((k) => k.panelNation === b).length,
      panelOwn: clicks.filter((k) => k.panelNation === a).length,
      panelClicked: clicks.filter((k) => k.panel === k.clicked).length,
      ownUnselected: clicks.filter((k) => k.panelNation === a && !(k.sel.length === 1 && k.sel[0] === k.panel)).length,
      drawnEnemy: clicks.filter((k) => k.drawnNation === b).length,
    };
    process.stderr.write(`${c.seed}: ${JSON.stringify(sum)}\n`);
    expect(clicks, s).toHaveLength(12);
    // The panel is of what is drawn under the click, on every click.
    expect(sum.panelIsDrawn, s).toBe(12);
    // Where an enemy's counter is drawn under the click, its panel opens and nothing of one's own is selected.
    for (const k of clicks.filter((x) => x.drawnNation === b)) {
      expect(k.panelNation, s).toBe(b);
      expect(k.sel, s).toEqual([]);
    }
    // A panel of one's own is the formation the click selected (ADR-769), never another.
    expect(sum.ownUnselected, s).toBe(0);
    expect(sum.panelClicked, s).toBeGreaterThanOrEqual(c.clickedAtLeast);
  });
}
