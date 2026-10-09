/**
 * The history log as the rows the UI reads (PLAN 1.34a, 3.12a): the names of a and b resolved,
 * so that no row has to show an id. An alliance has its name whether it lives or dissolved, and
 * its founder's; a Major Battle has the city it began near, at its end too.
 */
import { EventKind } from '../shared/events';
import { HISTORY_ROLES, type HistoryRole, type HistoryRow } from '../shared/history';
import { HISTORY_STRIDE } from '../sim/history';
import type { World } from '../sim/world';

/**
 * `nationName` gives a nation's name (an i18n key or '=' + literal), `cityName` a city row's
 * plain name ('' when it has none).
 */
export function historyRows(world: World, nationName: (id: number) => string, cityName: (row: number) => string): HistoryRow[] {
  const rows = world.history.rows;
  const alliances = new Map<number, { nameKey: string; founder: number }>();
  for (const a of world.alliances.past) alliances.set(a.id, a);
  for (const a of world.alliances.list) alliances.set(a.id, a);
  const nation = (v: number): string => (v !== 0 && world.nations.has(v) ? nationName(v) : '');
  const city = (v: number): string => {
    const n = v !== 0 && world.cities.has(v) ? cityName(v) : '';
    return n ? `=${n}` : '';
  };
  /** The city each Major Battle began near, by the battle's id. */
  const battleCity = new Map<number, string>();
  const name = (role: HistoryRole, v: number): string => {
    if (role === 'nation') return nation(v);
    if (role === 'alliance') return alliances.get(v)?.nameKey ?? '';
    if (role === 'city') return city(v);
    if (role === 'battle') return battleCity.get(v) ?? '';
    return '';
  };
  const out: HistoryRow[] = [];
  for (let i = 0; i < rows.length; i += HISTORY_STRIDE) {
    const [tick, kind, a, b, x, y] = [rows[i]!, rows[i + 1]!, rows[i + 2]!, rows[i + 3]!, rows[i + 4]!, rows[i + 5]!];
    const [ra, rb] = HISTORY_ROLES[kind] ?? ['number', 'number'];
    if (kind === EventKind.MajorBattleStarted) battleCity.set(a, city(b));
    const al = alliances.get(ra === 'alliance' ? a : rb === 'alliance' ? b : 0);
    out.push({ tick, kind, a, b, x: Number.isNaN(x) ? null : x, y: Number.isNaN(y) ? null : y, an: name(ra, a), bn: name(rb, b), of: al ? nation(al.founder) : '' });
  }
  return out;
}
