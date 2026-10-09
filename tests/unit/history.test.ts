import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { filterHistory, HISTORY_ROLES as HISTORY_ROLES_ALL, kindName, NO_FILTER, TICKER_HOURS, TICKER_KINDS, TICKER_ROWS, toCsv, toExport, type HistoryRow } from '../../src/shared/history';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { HISTORY_STRIDE } from '../../src/sim/history';
import { leaveAlliance } from '../../src/sim/systems/alliances';
import { historyText } from '../../src/ui/historyText';
import { historyRows, tickerRows } from '../../src/worker/historyRows';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 1.34a: the history log (state), its filters and its CSV/JSON export.

const W = SIZE_1938.w;
const [GER, POL, LIT] = ['GER', 'POL', 'LIT'].map(nationId) as number[];

describe('history log (PLAN 1.34a)', () => {
  it('records historic events as state: save/load keeps it and replays identically', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'declareWar', attacker: GER!, defender: POL! });
    s.step(24);
    const rows = s.world.history.rows;
    const kinds: number[] = [];
    for (let i = 0; i < rows.length; i += HISTORY_STRIDE) kinds.push(rows[i + 1]!);
    expect(kinds).toContain(EventKind.WarDeclared);
    expect(kinds).not.toContain(EventKind.CommandApplied); // not historic
    const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    t.load(s.save());
    expect(t.world.history.rows).toEqual(rows);
    s.step(24 * 10);
    t.step(24 * 10);
    expect(t.hash()).toBe(s.hash());
    expect(t.world.history.rows).toEqual(s.world.history.rows);
  }, 120_000);

  const startDay = new Sim({ scenario: 'toy', seed: 1 }).world.startDay;
  const yearTick = 24 * 366;
  const rows: HistoryRow[] = [
    { tick: 10, kind: EventKind.WarDeclared, a: GER!, b: POL!, x: null, y: null, an: 'nation.GER', bn: 'nation.POL', of: '' },
    { tick: 20, kind: EventKind.AllianceJoined, a: LIT!, b: 3, x: null, y: null, an: 'nation.LIT', bn: 'alliance.baltic_entente', of: 'nation.LIT' },
    { tick: yearTick + 5, kind: EventKind.PeaceSigned, a: GER!, b: POL!, x: null, y: null, an: 'nation.GER', bn: '=Poland, "the brave"', of: '' },
  ];

  it('filters by kind, nation (in nation roles only) and year range', () => {
    expect(filterHistory(rows, NO_FILTER, startDay)).toHaveLength(3);
    expect(filterHistory(rows, { ...NO_FILTER, kind: EventKind.WarDeclared }, startDay).map((r) => r.tick)).toEqual([10]);
    expect(filterHistory(rows, { ...NO_FILTER, nation: POL! }, startDay)).toHaveLength(2);
    // An alliance id equal to a nation id does not match the nation filter.
    expect(filterHistory(rows, { ...NO_FILTER, nation: 3 }, startDay)).toHaveLength(0);
    const y0 = new Date(Date.UTC(1970, 0, 1 + startDay)).getUTCFullYear();
    expect(filterHistory(rows, { ...NO_FILTER, fromYear: y0 + 1 }, startDay).map((r) => r.tick)).toEqual([yearTick + 5]);
    expect(filterHistory(rows, { ...NO_FILTER, toYear: y0 }, startDay)).toHaveLength(2);
  });

  it('exports CSV with a header and RFC 4180 quoting, and JSON records', () => {
    const recs = toExport(rows, startDay, (k) => (k.startsWith('=') ? k.slice(1) : k), (r) => `${kindName(r.kind)} text`);
    const csv = toCsv(recs);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe('date,tick,type,a,aName,b,bName,text');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2},10,WarDeclared,/);
    expect(lines[3]).toContain('"Poland, ""the brave"""');
    const json = JSON.parse(JSON.stringify(recs)) as typeof recs;
    expect(json[2]).toMatchObject({ tick: yearTick + 5, type: 'PeaceSigned', bName: 'Poland, "the brave"' });
  });
});

// Review after PLAN 1.36: NationAnnexed joined the log without its sentence. Every historic kind
// needs roles, a type name and a sentence.
describe('history kinds are complete', () => {
  it('every HISTORY_KINDS kind has roles and both i18n keys', async () => {
    const { HISTORY_KINDS } = await import('../../src/sim/history');
    const { HISTORY_ROLES } = await import('../../src/shared/history');
    const en = (await import('../../src/ui/i18n/en.json', { with: { type: 'json' } })).default as Record<string, string>;
    for (const k of HISTORY_KINDS) {
      const name = kindName(k);
      expect(HISTORY_ROLES[k], name).toBeDefined();
      expect(en[`history.${name}`], name).toBeDefined();
      expect(en[`history.type.${name}`], name).toBeDefined();
    }
  });
});

// PLAN 3.12a (the critic's R3-B6): rows showed an id or left out who: "#43 dissolved", "Denmark
// left #43", "Major battle #12 was won by Germany". A row is read by a person: it names its
// alliance, dissolved or not, and its battle by the city it began near.
describe('history rows name what they are of (PLAN 3.12a)', () => {
  const row = (kind: number, an: string, bn: string, of = ''): HistoryRow => ({ tick: 1, kind, a: 43, b: 43, x: null, y: null, an, bn, of });

  it('an alliance that many have a copy of is told by its founder; one with a name of its own is not', () => {
    expect(historyText(row(EventKind.AllianceLeft, 'nation.LIT', 'alliance.defensive', 'nation.POL'))).toBe('Lithuania left the Defensive Pact of Poland');
    expect(historyText(row(EventKind.AllianceJoined, 'nation.LIT', 'alliance.coalition', '=Free Bursa'))).toBe('Lithuania joined the Coalition of Free Bursa');
    expect(historyText(row(EventKind.AllianceJoined, 'nation.LIT', 'alliance.baltic_entente', 'nation.LIT'))).toBe('Lithuania joined the Baltic Entente');
    expect(historyText(row(EventKind.AllianceDissolved, 'alliance.defensive', 'nation.POL', 'nation.GER'))).toBe('The Defensive Pact of Germany was dissolved');
    expect(historyText(row(EventKind.UnionFormed, 'alliance.comintern', 'nation.POL', 'nation.POL'))).toBe('The Comintern became a union under Poland');
  });

  it('an alliance or a battle that is not known is said so, with no id', () => {
    expect(historyText(row(EventKind.AllianceLeft, 'nation.LIT', ''))).toBe('Lithuania left an alliance');
    expect(historyText(row(EventKind.AllianceDissolved, '', 'nation.POL'))).toBe('An alliance was dissolved');
    expect(historyText(row(EventKind.MajorBattleEnded, '', 'nation.POL'))).toBe('A major battle was won by Poland');
  });

  it('a Major Battle is that of its city, at its start and its end, with a winner or none', () => {
    expect(historyText(row(EventKind.MajorBattleStarted, '=Lyon', '=Lyon'))).toBe('A major battle began near Lyon');
    expect(historyText(row(EventKind.MajorBattleStarted, '', ''))).toBe('A major battle began');
    expect(historyText(row(EventKind.MajorBattleEnded, '=Lyon', 'nation.GER'))).toBe('The major battle near Lyon was won by Germany');
    expect(historyText(row(EventKind.MajorBattleEnded, '=Lyon', ''))).toBe('The major battle near Lyon ended with no winner');
  });

  it('no sentence of a kind shows an id, whatever its names', () => {
    for (const k of Object.keys(HISTORY_ROLES_ALL)) {
      const kind = Number(k);
      for (const [an, bn] of [['', ''], ['nation.GER', 'nation.POL']] as const) expect(historyText(row(kind, an, bn)), kindName(kind)).not.toMatch(/#\d|\{|\}/);
    }
  });

  it('the rows of a game: an alliance that dissolved keeps its name and its founder, a battle its city', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    const al = w.alliances.allianceOf(GER!) ?? w.alliances.list[0]!;
    const { id, nameKey, founder } = al;
    w.tick = 5;
    for (const m of [...al.members]) leaveAlliance(w, m);
    expect(w.alliances.list.some((a) => a.id === id)).toBe(false);
    expect(w.alliances.past).toContainEqual({ id, nameKey, founder });
    const cityRow = w.cities.cols.capitalOf.findIndex((n, i) => i > 0 && n === POL);
    w.history.record(6, EventKind.MajorBattleStarted, 7, cityRow, 1, 1);
    w.history.record(7, EventKind.MajorBattleEnded, 7, GER!, 1, 1);
    w.history.record(8, EventKind.MajorBattleEnded, 8, 0, 1, 1);
    const rows = historyRows(w, (n) => `=Nation ${n}`, (c) => (c === cityRow ? 'Warsaw' : ''));
    const left = rows.filter((r) => r.kind === EventKind.AllianceLeft);
    expect(left.length).toBeGreaterThanOrEqual(1);
    for (const r of left) expect(r).toMatchObject({ bn: nameKey, of: `=Nation ${founder}` });
    const gone = rows.find((r) => r.kind === EventKind.AllianceDissolved)!;
    expect(gone).toMatchObject({ a: id, an: nameKey, of: `=Nation ${founder}` });
    const ends = rows.filter((r) => r.kind === EventKind.MajorBattleEnded);
    expect(ends.map((r) => [r.an, r.bn])).toEqual([['=Warsaw', `=Nation ${GER}`], ['', '']]);
    expect(historyText(ends[0]!)).toBe(`The major battle near Warsaw was won by Nation ${GER}`);
    for (const r of rows) expect(historyText(r)).not.toMatch(/#\d/);
    // Saved and loaded, the names are still there.
    const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    t.load(s.save());
    expect(t.world.alliances.past).toEqual(w.alliances.past);
    expect(t.world.alliances.list).toEqual(w.alliances.list);
  }, 120_000);

  // PLAN 3.12b: "Turkey broke away from Free Bursa" was Turkey, dead, returning on its land.
  it('a revolt is a nation founded, a dead one that takes its land back, or land that rises to rebels', () => {
    const revolt = (as?: HistoryRow['as']): HistoryRow => ({ ...row(EventKind.RevoltSpawned, '=Free Bursa', 'nation.TUR'), ...(as ? { as } : {}) });
    expect(historyText(revolt())).toBe('Free Bursa broke away from Turkey');
    expect(historyText(revolt('joined'))).toBe('More of Turkey rose and joined Free Bursa');
    expect(historyText({ ...row(EventKind.RevoltSpawned, 'nation.TUR', '=Free Bursa'), as: 'revived' })).toBe('Turkey took back land held by Free Bursa');
    // A kind with one sentence has it whatever the row is said to be of.
    expect(historyText({ ...row(EventKind.WarDeclared, 'nation.GER', 'nation.POL'), as: 'joined' })).toBe('Germany declared war on Poland');
  });

  it('the rows of a log: which of the three each revolt is, told from the log alone', () => {
    const s = new Sim({ scenario: 'toy', seed: 1 });
    const h = s.world.history;
    const [FREE, OLD, A, B] = [1, 2, s.world.nations.create(), s.world.nations.create()]; // the toy world has two
    h.record(10, EventKind.RevoltSpawned, FREE, A, 1, 1); // founded
    h.record(10, EventKind.RevoltSpawned, FREE, A, 1, 1); // more of A rises to it in the same hour
    h.record(20, EventKind.RevoltSpawned, FREE, B, 1, 1); // and of B later
    h.record(30, EventKind.RevoltSpawned, OLD, A, 1, 1); // a dead nation returns on the land of two
    h.record(30, EventKind.RevoltSpawned, OLD, FREE, 1, 1);
    h.record(30, EventKind.NationRevived, OLD, 2, 1, 1);
    h.record(40, EventKind.NationEliminated, FREE, 0, NaN, NaN);
    h.record(50, EventKind.RevoltSpawned, FREE, B, 1, 1); // the id of the dead, founded anew
    h.record(60, EventKind.NationRevived, OLD, 1, 1, 1); // a return by itself makes no later revolt one
    h.record(70, EventKind.RevoltSpawned, OLD, B, 1, 1);
    const rows = historyRows(s.world, (n) => `=N${n}`, () => '');
    expect(rows.filter((r) => r.kind === EventKind.RevoltSpawned).map((r) => [r.tick, r.as])).toEqual([[10, undefined], [10, 'joined'], [20, 'joined'], [30, 'revived'], [30, 'revived'], [50, undefined], [70, 'joined']]);
    expect(rows.filter((r) => r.kind !== EventKind.RevoltSpawned).every((r) => r.as === undefined)).toBe(true);
    expect(rows.map(historyText).slice(3, 6)).toEqual(['N2 took back land held by N3', 'N2 took back land held by N1', 'N2 returned']);
  });

  // PLAN 3.12Rg1: "Mexico joined the Coalition of Mexico" was Mexico founding it.
  it('the founder founds its alliance and the others join it', () => {
    const joined = (bn: string, as?: HistoryRow['as']): HistoryRow => ({ ...row(EventKind.AllianceJoined, 'nation.LIT', bn, 'nation.LIT'), ...(as ? { as } : {}) });
    expect(historyText(joined('alliance.coalition', 'founded'))).toBe('Lithuania founded a Coalition');
    expect(historyText(joined('alliance.defensive', 'founded'))).toBe('Lithuania founded a Defensive Pact');
    expect(historyText(joined('alliance.baltic_entente', 'founded'))).toBe('Lithuania founded the Baltic Entente');
    expect(historyText(joined('alliance.coalition'))).toBe('Lithuania joined the Coalition of Lithuania');
  });

  it('the rows of a log: the founding is the first row of an alliance and of its founder, told from the log alone', () => {
    const s = new Sim({ scenario: 'toy', seed: 1 });
    const { history: h, alliances: al, nations } = s.world;
    const [A, B, C, D, E] = [1, 2, nations.create(), nations.create(), nations.create()]; // the toy world has two
    for (const a of [...al.list]) for (const m of [...a.members]) al.leave(m);
    const made = al.create(A, [B, C], 'alliance.defensive', 50)!;
    const old = al.create(D, [E], 'alliance.coalition', 50)!; // older than the log: no row of its founding
    for (const m of made.members) h.record(10, EventKind.AllianceJoined, m, made.id, NaN, NaN);
    h.record(20, EventKind.AllianceLeft, A, made.id, NaN, NaN);
    h.record(30, EventKind.AllianceJoined, A, made.id, NaN, NaN); // the founder again: it joins
    h.record(40, EventKind.AllianceLeft, D, old.id, NaN, NaN);
    h.record(50, EventKind.AllianceJoined, D, old.id, NaN, NaN);
    const rows = historyRows(s.world, (n) => `=N${n}`, () => '');
    expect(rows.map((r) => [r.tick, r.a, r.as])).toEqual([[10, A, 'founded'], [10, B, undefined], [10, C, undefined], [20, A, undefined], [30, A, undefined], [40, D, undefined], [50, D, undefined]]);
    expect(rows.slice(0, 3).map(historyText)).toEqual(['N1 founded a Defensive Pact', 'N2 joined the Defensive Pact of N1', 'N3 joined the Defensive Pact of N1']);
    expect(historyText(rows[4]!)).toBe('N1 joined the Defensive Pact of N1');
  });

  // PLAN 3.12b2: 450 of the critic's 2,395 rows read "Land of X went over to Y".
  it('land that goes over went back to its core nation, or was left by a nation that died', () => {
    const ceded = (as?: HistoryRow['as']): HistoryRow => ({ ...row(EventKind.LandCeded, 'nation.POL', 'nation.GER'), ...(as ? { as } : {}) });
    expect(historyText(ceded())).toBe('Land held by Germany rose and went back to Poland');
    expect(historyText(ceded('left'))).toBe('Land left by Germany went to Poland');
  });

  it('the rows of a log: land left by the dead, whichever side of it the death is told, and one row an hour for two nations', () => {
    const s = new Sim({ scenario: 'toy', seed: 1 });
    const h = s.world.history;
    const [A, B, C, D] = [1, 2, s.world.nations.create(), s.world.nations.create()]; // the toy world has two
    h.record(10, EventKind.LandCeded, A, B, 1, 1); // three areas rise in one month: two go back to A,
    h.record(10, EventKind.LandCeded, C, B, 2, 2); // one to C,
    h.record(10, EventKind.LandCeded, A, B, 3, 3);
    h.record(10, EventKind.LandCeded, B, A, 4, 4); // and one of A's to B: not the same two
    h.record(20, EventKind.LandCeded, A, B, 5, 5); // a later hour: a row again
    h.record(30, EventKind.NationCollapsed, B, 0, NaN, NaN); // a collapse: told before the land,
    h.record(30, EventKind.LandCeded, A, B, 6, 6);
    h.record(30, EventKind.LandCeded, A, B, 7, 7); // twice (the stray cells, then what A occupied)
    h.record(30, EventKind.NationEliminated, B, 0, NaN, NaN);
    h.record(40, EventKind.LandCeded, A, C, 8, 8); // a death by itself: told after the land
    h.record(40, EventKind.NationEliminated, C, 0, NaN, NaN);
    h.record(50, EventKind.NationAnnexed, D, A, NaN, NaN); // an annexation
    h.record(50, EventKind.LandCeded, B, D, 9, 9);
    h.record(50, EventKind.NationEliminated, D, 0, NaN, NaN);
    h.record(60, EventKind.LandCeded, A, B, 10, 10); // the dead of an earlier hour: B lives again
    const rows = historyRows(s.world, (n) => `=N${n}`, () => '');
    const ceded = rows.filter((r) => r.kind === EventKind.LandCeded);
    expect(ceded.map((r) => [r.tick, r.a, r.b, r.x, r.as])).toEqual([
      [10, A, B, 1, undefined], [10, C, B, 2, undefined], [10, B, A, 4, undefined], [20, A, B, 5, undefined],
      [30, A, B, 6, 'left'], [40, A, C, 8, 'left'], [50, B, D, 9, 'left'], [60, A, B, 10, undefined],
    ]);
    // No other row is folded or is `as` anything: the two of B's death are both there.
    expect(rows.length).toBe(h.rows.length / HISTORY_STRIDE - 2);
    expect(rows.filter((r) => r.kind !== EventKind.LandCeded).every((r) => r.as === undefined)).toBe(true);
    expect(rows.filter((r) => r.tick === 30).map(historyText)).toEqual(['N2 collapsed', 'Land left by N2 went to N1', 'N2 was destroyed']);
  });

  it('a save from before it loads: the leader stands for the founder, and nothing is past', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const al = s.world.alliances;
    const old = { list: al.list.map(({ founder: _f, ...a }) => a), guarantees: al.guarantees, nextId: al.nextId };
    al.deserialize([{ name: 'alliances.json', dtype: 'u8', data: new TextEncoder().encode(JSON.stringify(old)) }]);
    expect(al.past).toEqual([]);
    for (const a of al.list) expect(a.founder).toBe(a.leader);
  }, 120_000);
  // PLAN 3.12c: the ticker's rows, read from the end of the log.
  it('the ticker: the last major events, each with a place, a death told once, none older than a month', () => {
    const s = new Sim({ scenario: 'toy', seed: 1 });
    const w = s.world;
    const h = w.history;
    const nc = w.nations.cols;
    const [A, B] = [1, 2];
    [nc.capitalX[A], nc.capitalY[A], nc.capitalX[B], nc.capitalY[B]] = [11.5, 12.5, 21.5, 22.5];
    const name = (n: number): string => `=N${n}`;
    w.tick = 100;
    expect(tickerRows(w, name)).toEqual([]);
    h.record(90, EventKind.WarDeclared, A, B, NaN, NaN); // the place: the capital of the nation it was declared on
    h.record(91, EventKind.RevoltSpawned, A, B, 1, 1); // not major
    h.record(92, EventKind.LandCeded, A, B, 1, 1);
    h.record(93, EventKind.CapitalCaptured, B, A, 3, 4); // its own place
    h.record(94, EventKind.NationCollapsed, B, 0, NaN, NaN); // a death told twice in an hour: once,
    h.record(94, EventKind.LandCeded, A, B, 1, 1);
    h.record(94, EventKind.NationEliminated, B, 0, NaN, NaN);
    h.record(95, EventKind.NationEliminated, A, 0, NaN, NaN); // and one told once: at its capital
    const rows = tickerRows(w, name);
    expect(rows.map((r) => [r.i, r.tick, r.kind, r.x, r.y])).toEqual([
      [0, 90, EventKind.WarDeclared, 21.5, 22.5],
      [3, 93, EventKind.CapitalCaptured, 3, 4],
      [4, 94, EventKind.NationCollapsed, 21.5, 22.5],
      [7, 95, EventKind.NationEliminated, 11.5, 12.5],
    ]);
    expect(rows.map(historyText)).toEqual(['N1 declared war on N2', "N1 captured N2's capital", 'N2 collapsed', 'N1 was destroyed']);
    for (const r of rows) expect(TICKER_KINDS.has(r.kind)).toBe(true);
    // A peace is at its loser's capital, an annexation at the capital of the annexed, a return where the log has it.
    h.record(96, EventKind.PeaceSigned, A, B, NaN, NaN);
    h.record(97, EventKind.NationAnnexed, A, B, NaN, NaN);
    h.record(97, EventKind.NationEliminated, A, 0, NaN, NaN);
    h.record(98, EventKind.NationRevived, A, 2, 5, 6);
    const later = tickerRows(w, name);
    // No more than TICKER_ROWS, the newest last.
    expect(later.length).toBe(TICKER_ROWS);
    expect(later.slice(-3).map((r) => [r.kind, r.x, r.y])).toEqual([[EventKind.PeaceSigned, 21.5, 22.5], [EventKind.NationAnnexed, 11.5, 12.5], [EventKind.NationRevived, 5, 6]]);
    expect(later.slice(-3).map(historyText)).toEqual(['N1 made peace with N2', 'N1 was annexed by N2', 'N1 returned']);
    // A row leaves when it is more than TICKER_HOURS old.
    w.tick = 96 + TICKER_HOURS;
    expect(tickerRows(w, name).map((r) => r.tick)).toEqual([96, 97, 98]);
    w.tick = 99 + TICKER_HOURS;
    expect(tickerRows(w, name)).toEqual([]);
  });
});
