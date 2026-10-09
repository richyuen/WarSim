/**
 * The history log as the rows the UI reads (PLAN 1.34a, 3.12a): the names of a and b resolved,
 * so that no row has to show an id. An alliance has its name whether it lives or dissolved, and
 * its founder's; a Major Battle has the city it began near, at its end too.
 *
 * And what a row is of, where the log has one kind for more than one thing (PLAN 3.12b, `as`).
 * `RevoltSpawned` is emitted for a nation founded, for a dead one that returns (once for each
 * holder it takes land from, before its `NationRevived`) and for rebels that an area next to them
 * rises to: "Turkey broke away from Free Bursa" was the second. Told from the log alone: the
 * state is not asked, so a game saved before reads the same.
 *
 * `LandCeded` is two things (PLAN 3.12b2): land that rose and went back to its core nation, whose
 * holder lives, and what a nation that died in that hour left ('left'). Its death is told before
 * the land by a collapse and an annexation and after it by `eliminateNation`, so the deaths are
 * read first. The rows of one hour with the same a and b are one row, the first: they are one
 * month's revolts, an area each, and a death's land given at more than one step of it.
 */
import { EventKind } from '../shared/events';
import { HISTORY_ROLES, type HistoryAs, type HistoryRole, type HistoryRow } from '../shared/history';
import { HISTORY_STRIDE } from '../sim/history';
import type { World } from '../sim/world';

/** More than any nation id: a tick and a nation as one key. */
const NATION_KEY = 65536;

/** The kinds that tell a nation's death (a = the dead). */
const DEATHS: ReadonlySet<number> = new Set([EventKind.NationEliminated, EventKind.NationCollapsed, EventKind.NationAnnexed]);

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
  /** tick * NATION_KEY + nation of every `NationRevived`: it follows the revolts of its hour. */
  const revived = new Set<number>();
  for (let i = 0; i < rows.length; i += HISTORY_STRIDE) if (rows[i + 1] === EventKind.NationRevived) revived.add(rows[i]! * NATION_KEY + rows[i + 2]!);
  /** tick * NATION_KEY + nation of every death. */
  const died = new Set<number>();
  for (let i = 0; i < rows.length; i += HISTORY_STRIDE) if (DEATHS.has(rows[i + 1]!)) died.add(rows[i]! * NATION_KEY + rows[i + 2]!);
  /** The (a, b) of the `LandCeded` rows of the hour `cededAt`, as a * NATION_KEY + b. */
  const ceded = new Set<number>();
  let cededAt = -1;
  /** The nations a revolt founded or brought back that have not died since. */
  const risen = new Set<number>();
  const revoltAs = (tick: number, a: number): HistoryAs | undefined => {
    const as = revived.has(tick * NATION_KEY + a) ? 'revived' : risen.has(a) ? 'joined' : undefined;
    risen.add(a);
    return as;
  };
  const out: HistoryRow[] = [];
  for (let i = 0; i < rows.length; i += HISTORY_STRIDE) {
    const [tick, kind, a, b, x, y] = [rows[i]!, rows[i + 1]!, rows[i + 2]!, rows[i + 3]!, rows[i + 4]!, rows[i + 5]!];
    if (kind === EventKind.LandCeded) {
      if (tick !== cededAt) ceded.clear();
      cededAt = tick;
      if (ceded.has(a * NATION_KEY + b)) continue;
      ceded.add(a * NATION_KEY + b);
    }
    const [ra, rb] = HISTORY_ROLES[kind] ?? ['number', 'number'];
    if (kind === EventKind.MajorBattleStarted) battleCity.set(a, city(b));
    const al = alliances.get(ra === 'alliance' ? a : rb === 'alliance' ? b : 0);
    const row: HistoryRow = { tick, kind, a, b, x: Number.isNaN(x) ? null : x, y: Number.isNaN(y) ? null : y, an: name(ra, a), bn: name(rb, b), of: al ? nation(al.founder) : '' };
    if (kind === EventKind.NationEliminated) risen.delete(a);
    const as = kind === EventKind.RevoltSpawned ? revoltAs(tick, a) : kind === EventKind.LandCeded && died.has(tick * NATION_KEY + b) ? 'left' : undefined;
    if (as) row.as = as;
    out.push(row);
  }
  return out;
}
