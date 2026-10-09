import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { filterHistory, HISTORY_ROLES as HISTORY_ROLES_ALL, kindName, NO_FILTER, toCsv, toExport, type HistoryRow } from '../../src/shared/history';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { HISTORY_STRIDE } from '../../src/sim/history';
import { leaveAlliance } from '../../src/sim/systems/alliances';
import { historyText } from '../../src/ui/historyText';
import { historyRows } from '../../src/worker/historyRows';
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

  it('a save from before it loads: the leader stands for the founder, and nothing is past', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const al = s.world.alliances;
    const old = { list: al.list.map(({ founder: _f, ...a }) => a), guarantees: al.guarantees, nextId: al.nextId };
    al.deserialize([{ name: 'alliances.json', dtype: 'u8', data: new TextEncoder().encode(JSON.stringify(old)) }]);
    expect(al.past).toEqual([]);
    for (const a of al.list) expect(a.founder).toBe(a.leader);
  }, 120_000);
});
