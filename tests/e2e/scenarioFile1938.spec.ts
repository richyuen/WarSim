import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { decodeScenarioFile } from '../../src/shared/scenarioFile';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 1.38 AT: a scenario file round trip yields an identical scenario hash. Edit the world,
// export through the editor (a real download), open a fresh page, load the file through the
// file input: the state hash equals the file's, and the edits are there. A damaged file is
// refused with a message.

const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const POL = NATIONS_1938.findIndex((n) => n.tag === 'POL') + 1;

async function open(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?scenario=1938&paused=1&seed=1938');
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null && window.__warsim!.sim.mapLayers !== null, null, { timeout: 60_000 });
}

test('scenario file: export, load in a fresh game, identical hash', async ({ page }, info) => {
  test.setTimeout(180_000);
  await open(page);
  // Edits: rename, a war, a painted area, then a month of play (history and stats that the
  // scenario must leave out).
  await page.evaluate(
    ({ g, p }) => {
      const sim = window.__warsim!.sim;
      sim.command({ kind: 'renameNation', nation: p, name: 'Rzeczpospolita' }, true);
      sim.command({ kind: 'declareWar', attacker: g, defender: p }, true);
      sim.command({ kind: 'editPaint', layer: 'nation', tool: 'brush', x: 1150, y: 230, x2: 0, y2: 0, r: 6, value: g, mask: null }, true);
    },
    { g: GER, p: POL },
  );
  await page.evaluate(() => window.__warsim!.sim.step(24 * 30));

  await page.getByTestId('editor-btn').click();
  await page.getByTestId('scenario-name').fill('Poland 1938 (test)');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('scenario-export').click()]);
  expect(dl.suggestedFilename()).toBe('poland-1938-test.warsim-scenario');
  const file = path.join(info.outputPath(), dl.suggestedFilename());
  await dl.saveAs(file);
  await expect(page.getByTestId('scenario-status')).toContainText('Poland 1938 (test)');
  const { header } = await decodeScenarioFile(new Uint8Array(readFileSync(file)));
  expect(header).toMatchObject({ name: 'Poland 1938 (test)', base: '1938', w: 2048, h: 1024 });
  const exportedRasters = (await page.evaluate(() => window.__warsim!.sim.inspect())).rasters;

  // A fresh game (no autosave resume), then load the file.
  await open(page);
  expect((await page.evaluate(() => window.__warsim!.sim.hash())).hash).not.toBe(header.hash);
  await page.getByTestId('editor-btn').click();
  await page.getByTestId('scenario-import').setInputFiles(file);
  await expect(page.getByTestId('scenario-status')).toContainText('Loaded', { timeout: 30_000 });
  const status = await page.evaluate(() => window.__warsim!.sim.hash());
  expect(status.hash).toBe(header.hash);
  expect(status.tick).toBe(header.tick);
  const s = await page.evaluate(() => window.__warsim!.sim.inspect());
  expect(s.rasters).toEqual(exportedRasters);
  expect(s.nations.find((n) => n.id === POL)!.name).toBe('=Rzeczpospolita');
  expect(s.wars.some((w) => w.attackers.includes(GER) && w.defenders.includes(POL))).toBe(true);
  expect((await page.evaluate(() => window.__warsim!.sim.history())).length).toBe(0); // no run history

  // A damaged file is refused; the game stays as it was.
  const bad = readFileSync(file);
  bad[bad.length - 40] = bad[bad.length - 40]! ^ 0xff;
  await page.getByTestId('scenario-import').setInputFiles({ name: 'bad.warsim-scenario', mimeType: 'application/octet-stream', buffer: bad });
  await expect(page.getByTestId('scenario-status')).toContainText('Could not load', { timeout: 30_000 });
  await page.getByTestId('scenario-import').setInputFiles({ name: 'not.warsim-scenario', mimeType: 'application/octet-stream', buffer: Buffer.from('hello') });
  await expect(page.getByTestId('scenario-status')).toContainText('not a WarSim scenario file');
});
