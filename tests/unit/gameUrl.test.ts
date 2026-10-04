import { describe, expect, it } from 'vitest';
import { continueUrl, newGameUrl, optionsFromUrl, stagedScenarioUrl, withLooping } from '../../src/app/gameUrl';
import { checkScenarioFile } from '../../src/app/scenarioFiles';
import { encodeScenarioFile, SCENARIO_FORMAT } from '../../src/shared/scenarioFile';
import { SCENARIO_GEOMETRY } from '../../src/shared/scenarios';

// PLAN 1.43b: the URLs that load a game from the title screen, and what the title screen can
// check of a scenario file before it leaves for the game.

const query = (url: string): Record<string, string> => Object.fromEntries(new URLSearchParams(url.slice(1)));

describe('game URLs (PLAN 1.39b1, 1.43b)', () => {
  it('a new game carries its scenario, seed and options, and starts paused', () => {
    const options = { loopingMap: false, aggression: 'random', traits: 'random', gold: 'equal', ceMode: 'static' } as const;
    const url = newGameUrl('1938', 4242, options);
    expect(query(url)).toEqual({ scenario: '1938', seed: '4242', paused: '1', looping: '0', aggr: 'random', traits: 'random', gold: 'equal', ce: 'static' });
    expect(optionsFromUrl(new URLSearchParams(url.slice(1)))).toEqual(options);
    expect(query(newGameUrl('1938', 7, {}))).toEqual({ scenario: '1938', seed: '7', paused: '1' });
  });

  it('Continue is the URL of the game that wrote the autosave, with continue=1', () => {
    expect(query(continueUrl({ scenario: '1938', seed: 77, options: { loopingMap: false, ceMode: 'locked' } }))).toEqual({
      scenario: '1938',
      seed: '77',
      paused: '1',
      looping: '0',
      ce: 'locked',
      continue: '1',
    });
    // A record from before 1.43b has neither seed nor options.
    expect(query(continueUrl({ scenario: 'toy' }))).toEqual({ scenario: 'toy', seed: '1938', paused: '1', continue: '1' });
  });

  it('a staged scenario file starts its base scenario, paused', () => {
    expect(query(stagedScenarioUrl('1938'))).toEqual({ scenario: '1938', paused: '1', load: 'scenario' });
  });

  it('withLooping sets only the looping option and leaves its input alone', () => {
    const params = new URLSearchParams('scenario=1938&seed=77&paused=1&continue=1');
    expect(query(withLooping(params, false))).toEqual({ scenario: '1938', seed: '77', paused: '1', continue: '1', looping: '0' });
    expect(params.has('looping')).toBe(false);
    const off = new URLSearchParams('scenario=1938&looping=0&load=scenario');
    expect(query(withLooping(off, true))).toEqual({ scenario: '1938', load: 'scenario' });
    expect(query(withLooping(off, false))).toEqual({ scenario: '1938', looping: '0', load: 'scenario' });
  });
});

describe('a scenario file on the title screen (PLAN 1.43b)', () => {
  const { w, h } = SCENARIO_GEOMETRY['1938'];
  const state = new Uint8Array([1, 2, 3]); // the header is checked here, the state by the game
  const file = (over: Partial<{ format: number; base: string; w: number; h: number }>): Promise<Uint8Array> =>
    encodeScenarioFile({ format: SCENARIO_FORMAT, name: 'Test', base: '1938', w, h, tick: 0, hash: 0, ...over }, state);

  it('accepts a file of a scenario this version has, at its map size', async () => {
    const ok = await checkScenarioFile(await file({}));
    expect(ok.scenario).toBe('1938');
    expect(ok.header).toMatchObject({ name: 'Test', base: '1938', w, h });
  });

  it('refuses what cannot be started, with a readable reason', async () => {
    await expect(checkScenarioFile(new TextEncoder().encode('hello'))).rejects.toThrow('not a WarSim scenario file');
    await expect(checkScenarioFile(await file({ format: 99 }))).rejects.toThrow('format 99');
    await expect(checkScenarioFile(await file({ base: 'atlantis' }))).rejects.toThrow('scenario for atlantis, which this version does not have');
    await expect(checkScenarioFile(await file({ w: 1024, h: 512 }))).rejects.toThrow(`scenario for 1938 1024×512; here 1938 is ${w}×${h}`);
    // A name on Object.prototype is not a scenario.
    await expect(checkScenarioFile(await file({ base: 'constructor' }))).rejects.toThrow('does not have');
  });
});
