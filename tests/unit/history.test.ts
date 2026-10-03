import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { filterHistory, kindName, NO_FILTER, toCsv, toExport, type HistoryRow } from '../../src/shared/history';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { HISTORY_STRIDE } from '../../src/sim/history';
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
    { tick: 10, kind: EventKind.WarDeclared, a: GER!, b: POL!, x: null, y: null, an: 'nation.GER', bn: 'nation.POL' },
    { tick: 20, kind: EventKind.AllianceJoined, a: LIT!, b: 3, x: null, y: null, an: 'nation.LIT', bn: 'alliance.baltic_entente' },
    { tick: yearTick + 5, kind: EventKind.PeaceSigned, a: GER!, b: POL!, x: null, y: null, an: 'nation.GER', bn: '=Poland, "the brave"' },
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
