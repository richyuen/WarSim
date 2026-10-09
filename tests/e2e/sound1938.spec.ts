import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type {} from '../../src/app/testApi';
import { NATIONS_1938 } from '../../src/sim/scenario1938';

// PLAN 3.12d AT (critic R3-B6): a cue is asked for on a declaration of war; the settings have a
// volume and a mute, and both are kept. A test cannot hear: it reads the cues the game asked
// for (`__warsim.sound.asked`) and how many of them reached the audio context (`sounded`).

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

async function open(page: Page, query = ''): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto(`/?scenario=1938&paused=1&seed=1938${query}`);
  await page.waitForFunction(() => (window.__warsim?.view?.frames ?? 0) > 0 && window.__warsim!.hud.stats.value !== null, null, { timeout: 60_000 });
}

const sound = (page: Page): Promise<{ asked: string[]; sounded: number; volume: number; muted: boolean }> =>
  page.evaluate(() => {
    const s = window.__warsim!.sound;
    return { asked: [...s.asked], sounded: s.sounded, volume: s.volume, muted: s.muted };
  });

test('sound: a war declared is a cue, the volume and the mute are kept, a loaded game is silent about its past', async ({ page }, info) => {
  test.setTimeout(240_000);
  await open(page);
  await page.evaluate(() => {
    window.__warsim!.settings.setMuted(false);
    window.__warsim!.settings.setVolume(0.5);
    window.__warsim!.sound.asked.length = 0;
  });
  const [GER, POL] = [id('GER'), id('POL')];

  // The settings: a volume and a mute. A volume chosen is heard at once, as the peace cue.
  await page.getByTestId('settings-btn').click();
  const volume = page.getByTestId('settings-volume');
  const mute = page.getByTestId('settings-mute');
  await expect(volume).toHaveValue('0.5');
  await expect(mute).not.toBeChecked();
  await volume.selectOption('1');
  expect(await sound(page)).toMatchObject({ asked: ['peace'], volume: 1, muted: false });
  const ev = process.env['EVIDENCE'] ? path.resolve(import.meta.dirname, '../../docs/evidence/3.12') : info.outputPath();
  mkdirSync(ev, { recursive: true });
  await page.getByTestId('settings-panel').screenshot({ path: path.join(ev, 'd-settings-sound.png') });
  await page.getByTestId('settings-close').click();

  // War on Poland from the God tab, the game paused: the war cue, once, and it reaches the
  // audio context (the presses before it allowed the page to sound).
  await page.getByTestId('god-btn').click();
  await page.evaluate((n) => window.__warsim!.hud.onSelectNation(n), GER);
  await page.getByTestId('tab-god').click();
  await page.getByTestId('god-target').selectOption(String(POL));
  const before = (await sound(page)).sounded;
  await page.getByTestId('god-war').click();
  await expect(page.getByTestId('ticker-row')).toHaveCount(1);
  expect((await sound(page)).asked).toEqual(['peace', 'war']);
  expect((await sound(page)).sounded).toBe(before + 1);

  // Muted: the peace is told in the ticker and asks for no cue. The volume cannot be chosen.
  await page.getByTestId('settings-btn').click();
  await mute.check();
  await expect(volume).toBeDisabled();
  expect((await sound(page)).muted).toBe(true);
  await page.getByTestId('settings-close').click();
  const war = (await page.evaluate(() => window.__warsim!.sim.inspect())).wars.find((w) => w.attackers.includes(GER) && w.defenders.includes(POL))!;
  await page.getByTestId(`god-peace-${war.id}`).click();
  await expect(page.getByTestId('ticker-row')).toHaveCount(2);
  expect(await sound(page)).toMatchObject({ asked: ['peace', 'war'], sounded: before + 1 });

  // Both are kept: the game loaded again, with its two rows, is muted at full volume. And it
  // is silent about them once the mute is off: they are its past.
  await page.evaluate(() => window.__warsim!.autosave.saveNow());
  await open(page, '&continue=1');
  await expect(page.getByTestId('ticker-row')).toHaveCount(2);
  expect(await sound(page)).toMatchObject({ asked: [], volume: 1, muted: true });
  await page.getByTestId('settings-btn').click();
  await expect(volume).toHaveValue('1');
  await expect(mute).toBeChecked();
  await mute.uncheck();
  await expect(volume).toBeEnabled();
  await page.getByTestId('settings-close').click();
  expect(await sound(page)).toMatchObject({ asked: [], muted: false });

  // News of the loaded game sounds (a war on France: Germany and Poland have a truce); the game
  // loaded over it, with that news gone, does not.
  await page.getByTestId('god-btn').click();
  await page.evaluate((n) => window.__warsim!.hud.onSelectNation(n), GER);
  await page.getByTestId('tab-god').click();
  await page.getByTestId('god-target').selectOption(String(id('FRA')));
  await page.getByTestId('god-war').click();
  // Under the panel the ticker shows two rows before and after: the message is known by its third.
  await expect.poll(() => page.evaluate(() => window.__warsim!.hud.stats.value!.ticker.length)).toBe(3);
  expect((await sound(page)).asked).toEqual(['war']);
  const world = await page.evaluate(() => window.__warsim!.hud.stats.value!.world);
  await page.evaluate(() => window.__warsim!.autosave.restore());
  await expect.poll(() => page.evaluate(() => window.__warsim!.hud.stats.value!.world)).toBe(world + 1);
  expect(await page.evaluate(() => window.__warsim!.hud.stats.value!.ticker.length)).toBe(2);
  expect((await sound(page)).asked).toEqual(['war']);

  // Back to the defaults for the other tests (settings persist per origin).
  await page.evaluate(() => {
    window.__warsim!.settings.setMuted(false);
    window.__warsim!.settings.setVolume(0.5);
  });
});
