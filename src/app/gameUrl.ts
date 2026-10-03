/**
 * New-game options in the URL (PLAN 1.39b1): ?looping=0, ?aggr=random, ?traits=random,
 * ?gold=random|equal, ?ce=<mode>. Absent = the scenario's own setting.
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
