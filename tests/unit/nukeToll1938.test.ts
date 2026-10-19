import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { NUKE_PART, nukeStrike, nukeToll, packNukeStrike, packNukeToll, type HistoryRow } from '../../src/shared/history';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex } from '../../src/sim/systems/elements';
import { blast } from '../../src/sim/systems/nuclear';
import { historyText } from '../../src/ui/historyText';
import { historyRows, tickerRows } from '../../src/worker/historyRows';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.32b (the critic's R9-B2: "…: 24 dead", and no string told soldiers lost): a burst's toll
// is the men, guns (artillery, anti-tank, anti-air) and tanks it destroyed beside the civilians it
// killed. The strike's row keeps its dead (men and people) as before; the forces lost are a
// companion row (`NukeToll`) the history reads into it. A row of a game saved before reads as before.

const { w: W, h: H } = SIZE_1938;
const [FRA, GER] = ['FRA', 'GER'].map(nationId) as [number, number];
const berlin = cellOf(13.4, 52.52, W, H);
const nation = (n: number): string => `nation.${NATIONS_1938[n - 1]!.tag}`;

const strikeRow = (dead: number, toll?: HistoryRow['toll']): HistoryRow => ({
  tick: 1,
  kind: EventKind.NukeCasualties,
  a: FRA,
  b: packNukeStrike(GER, 1, dead),
  x: 1,
  y: 1,
  an: nation(FRA),
  bn: nation(GER),
  of: '',
  near: '=Berlin',
  ...(toll ? { toll } : {}),
});

describe('a nuclear strike\'s toll (PLAN 7.32b)', () => {
  it('packs its parts and reads them back; guns and tanks held under NUKE_PART', () => {
    const t = { men: 1_234_567, guns: 4_321, tanks: 987 };
    expect(nukeToll(packNukeToll(t))).toEqual(t);
    expect(nukeToll(packNukeToll({ men: 0, guns: 0, tanks: 0 }))).toEqual({ men: 0, guns: 0, tanks: 0 });
    expect(nukeToll(packNukeToll({ men: 5, guns: NUKE_PART + 9, tanks: 3 * NUKE_PART }))).toEqual({ men: 5, guns: NUKE_PART - 1, tanks: NUKE_PART - 1 });
    expect(packNukeToll({ men: 2 ** 25 - 1, guns: NUKE_PART - 1, tanks: NUKE_PART - 1 })).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });

  it('a burst on an army: its guns and tanks counted from the elements they were lost from', () => {
    const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) }).world;
    const c = w.formations.cols;
    const ec = w.elements.cols;
    const units = w.rules!.units;
    const idx = elementIndex(w);
    const has = (id: number, test: (cls: string) => boolean): boolean => (idx.get(id) ?? []).some((e) => test(units[ec.unit[e]!]!.cls) && ec.strength[e]! > 0);
    const isGun = (cls: string): boolean => cls === 'art' || cls === 'at' || cls === 'aa';
    const isTank = (cls: string): boolean => cls.startsWith('armor');
    // A German division with guns and one with tanks, both a cell from the burst (none destroyed whole).
    let gunner = 0;
    let tanker = 0;
    w.formations.forEach((id) => {
      if (c.nation[id] !== GER || w.isFleet(id) || w.offLand(id)) return;
      if (!tanker && has(id, isTank)) tanker = id;
      else if (!gunner && has(id, isGun)) gunner = id;
    });
    expect(gunner).toBeGreaterThan(0);
    expect(tanker).toBeGreaterThan(0);
    for (const id of [gunner, tanker]) [c.x[id], c.y[id]] = [berlin[0] + 1, berlin[1]];
    // Every element of the world (Berlin's own garrison is in the blast too): its class and strength before.
    const before = new Map<number, { cls: string; s: number }>();
    for (const els of idx.values()) for (const e of els) before.set(e, { cls: units[ec.unit[e]!]!.cls, s: ec.strength[e]! });
    const toll = blast(w, 1, ...berlin);
    for (const id of [gunner, tanker]) expect(w.formations.has(id)).toBe(true);
    let guns = 0;
    let tanks = 0;
    for (const [e, { cls, s }] of before) {
      const lost = s - (ec.strength[e] ?? 0);
      if (isGun(cls)) guns += lost;
      if (isTank(cls)) tanks += lost;
    }
    expect(toll.guns).toBe(guns);
    expect(toll.tanks).toBe(tanks);
    expect(toll.guns).toBeGreaterThan(0);
    expect(toll.tanks).toBeGreaterThan(0);
    expect(toll.men).toBeGreaterThan(0);
    process.stderr.write(`Berlin, two divisions a cell off: ${toll.men} men, ${toll.guns} guns, ${toll.tanks} tanks, ${toll.people} people\n`);
  });

  it('the sentence: on an army the civilians and the forces lost; on a city no troops; a game saved before its dead', () => {
    expect(historyText(strikeRow(10_855 + 24, { men: 10_855, guns: 40, tanks: 12 }))).toBe('France struck Germany with an atomic bomb near Berlin: 24 civilians killed; 10,855 men, 40 guns and 12 tanks lost');
    expect(historyText(strikeRow(1_201 + 337_000, { men: 1_201, guns: 1, tanks: 0 }))).toBe('France struck Germany with an atomic bomb near Berlin: 337,000 civilians killed; 1,201 men and 1 gun lost');
    expect(historyText(strikeRow(337_000, { men: 0, guns: 0, tanks: 0 }))).toBe('France struck Germany with an atomic bomb near Berlin: 337,000 civilians killed; no troops in the blast');
    expect(historyText(strikeRow(1, { men: 1, guns: 0, tanks: 0 }))).toBe('France struck Germany with an atomic bomb near Berlin: 0 civilians killed; 1 man lost');
    // God's.
    expect(historyText({ ...strikeRow(5_000, { men: 0, guns: 0, tanks: 0 }), a: 0, an: '' })).toBe('A bomb fell from the heavens on Germany near Berlin: an atomic bomb, 5,000 civilians killed; no troops in the blast');
    // A row of a game saved before: no toll, its dead.
    expect(historyText(strikeRow(10_879))).toBe('France struck Germany with an atomic bomb near Berlin: 10,879 dead');
  });

  it('in the history, the ticker and a save: one row a strike, its toll read into it; a toll alone told alone', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    s.command({ kind: 'godNuke', x: berlin[0], y: berlin[1], thermonuclear: false });
    s.step(1);
    const logged: number[] = [];
    for (let i = 0; i < w.history.rows.length; i += 6) if (w.history.rows[i + 1] === EventKind.NukeCasualties || w.history.rows[i + 1] === EventKind.NukeToll) logged.push(w.history.rows[i + 1]!);
    expect(logged).toEqual([EventKind.NukeCasualties, EventKind.NukeToll]);
    const rows = historyRows(w, nation, () => '');
    expect(rows.filter((r) => r.kind === EventKind.NukeToll)).toEqual([]);
    const strikes = rows.filter((r) => r.kind === EventKind.NukeCasualties);
    expect(strikes.length).toBe(1);
    const toll = strikes[0]!.toll!;
    expect(toll).toBeDefined();
    expect(toll.men).toBeLessThanOrEqual(nukeStrike(strikes[0]!.b).dead);
    const ticked = tickerRows(w, nation).filter((r) => r.kind === EventKind.NukeCasualties || r.kind === EventKind.NukeToll);
    expect(ticked.map((r) => [r.kind, r.toll])).toEqual([[EventKind.NukeCasualties, toll]]);
    // Saved and loaded: the same rows.
    const c = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    c.load(s.save());
    expect(historyRows(c.world, nation, () => '').filter((r) => r.kind === EventKind.NukeCasualties).map(historyText)).toEqual(strikes.map(historyText));
    // A toll with no strike before it (not logged so; the row is told alone, not lost).
    w.history.record(w.tick + 1, EventKind.NukeToll, FRA, packNukeToll({ men: 500, guns: 0, tanks: 2 }), 1, 1);
    const alone = historyRows(w, nation, () => '').filter((r) => r.kind === EventKind.NukeToll);
    expect(alone.map(historyText)).toEqual(['A nuclear burst: 500 men and 2 tanks lost']);
  });
});
