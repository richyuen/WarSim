/**
 * New-game options in the URL (PLAN 1.39b1): ?looping=0, ?aggr=random, ?traits=random,
 * ?gold=random|equal, ?ce=<mode>. Absent = the scenario's own setting. And the URLs that load a
 * game (PLAN 1.43b): ?continue=1 (the autosave), ?load=scenario (the staged scenario file).
 */
import type { GameOptions } from '../shared/gameOptions';

const CE = ['dynamic', 'progressive', 'static', 'locked', 'random'] as const;

export function optionsFromUrl(params: URLSearchParams): GameOptions {
  const o: GameOptions = {};
  if (params.get('looping') === '0') o.loopingMap = false;
  if (params.get('aggr') === 'random') o.aggression = 'random';
  if (params.get('traits') === 'random') o.traits = 'random';
  const gold = params.get('gold');
  if (gold === 'random' || gold === 'equal') o.gold = gold;
  const ce = params.get('ce') as (typeof CE)[number] | null;
  if (ce && CE.includes(ce)) o.ceMode = ce;
  return o;
}

export function newGameUrl(base: string, seed: number, o: GameOptions): string {
  // A new game starts paused, so the new world can be looked at first.
  const q = new URLSearchParams({ scenario: base, seed: String(seed), paused: '1' });
  if (o.loopingMap === false) q.set('looping', '0');
  if (o.aggression === 'random') q.set('aggr', 'random');
  if (o.traits === 'random') q.set('traits', 'random');
  if (o.gold && o.gold !== 'scenario') q.set('gold', o.gold);
  if (o.ceMode) q.set('ce', o.ceMode);
  return `?${q.toString()}`;
}

/**
 * The URL that resumes an autosave (PLAN 1.43b): the URL of the game that wrote it, with
 * `continue=1`. A record from before 1.43b has no seed or options: the game then corrects its URL
 * from the loaded world (`withLooping`).
 */
export function continueUrl(rec: { scenario: string; seed?: number; options?: GameOptions }): string {
  return `${newGameUrl(rec.scenario, rec.seed ?? 1938, rec.options ?? {})}&continue=1`;
}

/** The URL of a game that starts from the scenario file staged for `base` (PLAN 1.43b). */
export function stagedScenarioUrl(base: string): string {
  return `?${new URLSearchParams({ scenario: base, paused: '1', load: 'scenario' }).toString()}`;
}

/** The title screen, saying that the staged scenario file could not be loaded. */
export function loadFailedUrl(): string {
  return '?failed=scenario';
}

/**
 * The URL `params` with the looping option made `looping`. A loaded world brings its own setting,
 * and the map view is built from the URL before the world is there.
 */
export function withLooping(params: URLSearchParams, looping: boolean): string {
  const q = new URLSearchParams(params);
  if (looping) q.delete('looping');
  else q.set('looping', '0');
  return `?${q.toString()}`;
}
