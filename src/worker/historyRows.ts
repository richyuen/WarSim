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
 *
 * `AllianceJoined` is emitted for every member of an alliance that is made, its founder first
 * (PLAN 3.12Rg1): "Mexico joined the Coalition of Mexico" was the founding. The founder's row is
 * 'founded' when no row before it names the alliance: a founder that left and joins again
 * joins, and so does the founder of an alliance older than the log.
 */
import { EventKind } from '../shared/events';
import { HISTORY_ROLES, TICKER_HOURS, TICKER_KINDS, TICKER_ROWS, type HistoryAs, type HistoryRole, type HistoryRow, type TickerRow } from '../shared/history';
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
  /** The alliances a row has named. */
  const named = new Set<number>();
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
    const alId = ra === 'alliance' ? a : rb === 'alliance' ? b : 0;
    const al = alliances.get(alId);
    const founding = kind === EventKind.AllianceJoined && !named.has(alId) && a === al?.founder;
    if (alId !== 0) named.add(alId);
    const row: HistoryRow = { tick, kind, a, b, x: Number.isNaN(x) ? null : x, y: Number.isNaN(y) ? null : y, an: name(ra, a), bn: name(rb, b), of: al ? nation(al.founder) : '' };
    if (kind === EventKind.NationEliminated) risen.delete(a);
    const as = kind === EventKind.RevoltSpawned ? revoltAs(tick, a) : kind === EventKind.LandCeded && died.has(tick * NATION_KEY + b) ? 'left' : founding ? 'founded' : undefined;
    if (as) row.as = as;
    out.push(row);
  }
  return out;
}

/** The kinds whose b is the nation the event happened to (the one a war was declared on, the loser of a peace). */
const PLACE_OF_B: ReadonlySet<number> = new Set([EventKind.WarDeclared, EventKind.PeaceSigned]);

/**
 * The ticker's rows (PLAN 3.12c): the last `TICKER_ROWS` major events of the last `TICKER_HOURS`,
 * oldest first, read from the end of the log. A row whose event has no place has a capital as it
 * is now: of the nation a war was declared on, of a peace's loser, of the nation that died. A
 * death told twice in an hour (a collapse or an annexation, then `NationEliminated`) is one row,
 * the first. A peace whose winner annexed its loser in that hour is one row too, the annexation
 * (PLAN 3.12Rg2, ADR-215), on whichever side of the peace the log has it: a game saved before
 * has the peace last.
 */
export function tickerRows(world: World, nationName: (id: number) => string): TickerRow[] {
  const rows = world.history.rows;
  const nc = world.nations.cols;
  const nation = (v: number): string => (v !== 0 && world.nations.has(v) ? nationName(v) : '');
  const out: TickerRow[] = [];
  /** Whether a row of the hour of row `i` is the annexation of `dead` by `by`. */
  const annexedThen = (i: number, dead: number, by: number): boolean => {
    const is = (j: number): boolean => rows[j + 1] === EventKind.NationAnnexed && rows[j + 2] === dead && rows[j + 3] === by;
    for (let j = i - HISTORY_STRIDE; j >= 0 && rows[j] === rows[i]; j -= HISTORY_STRIDE) if (is(j)) return true;
    for (let j = i + HISTORY_STRIDE; j < rows.length && rows[j] === rows[i]; j += HISTORY_STRIDE) if (is(j)) return true;
    return false;
  };
  for (let i = rows.length - HISTORY_STRIDE; i >= 0 && out.length < TICKER_ROWS; i -= HISTORY_STRIDE) {
    const [tick, kind, a, b, x, y] = [rows[i]!, rows[i + 1]!, rows[i + 2]!, rows[i + 3]!, rows[i + 4]!, rows[i + 5]!];
    if (world.tick - tick > TICKER_HOURS) break;
    if (!TICKER_KINDS.has(kind)) continue;
    if (kind === EventKind.NationEliminated) {
      let told = false;
      for (let j = i - HISTORY_STRIDE; j >= 0 && rows[j] === tick && !told; j -= HISTORY_STRIDE) told = (rows[j + 1] === EventKind.NationCollapsed || rows[j + 1] === EventKind.NationAnnexed) && rows[j + 2] === a;
      if (told) continue;
    }
    if (kind === EventKind.PeaceSigned && annexedThen(i, b, a)) continue;
    const at = PLACE_OF_B.has(kind) ? b : a;
    const placed = !Number.isNaN(x) && !Number.isNaN(y);
    const rb = (HISTORY_ROLES[kind] ?? ['number', 'number'])[1];
    out.push({ i: i / HISTORY_STRIDE, tick, kind, a, b, x: placed ? x : (nc.capitalX[at] ?? 0), y: placed ? y : (nc.capitalY[at] ?? 0), an: nation(a), bn: rb === 'nation' ? nation(b) : '', of: '' });
  }
  return out.reverse();
}
