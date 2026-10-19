import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { convoyTake, filterHistory, NO_FILTER } from '../../src/shared/history';
import { ECONOMY_TABLES_1938, NATIONS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { RAID_PER_BOAT, convoyLosses } from '../../src/sim/systems/convoys';
import { CONVOY_ROWS, economyBreakdown, monthlyAccounts, runEconomyMonth, tellConvoyQuarter } from '../../src/sim/systems/economy';
import { equipFormation } from '../../src/sim/systems/elements';
import { SCREEN } from '../../src/sim/systems/navalCombat';
import { seaHolder } from '../../src/sim/systems/seaControl';
import { convoyWays } from '../../src/sim/systems/seaSupply';
import { blocOf } from '../../src/sim/systems/supply';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, seaOf, type World } from '../../src/sim/world';
import { historyRows } from '../../src/worker/historyRows';
import { historyText } from '../../src/ui/historyText';
import { assets1938 } from '../helpers/earth';

// PLAN 4.4d: convoys and submarine raiding. AT: a submarine flotilla in a zone of a convoy's
// way cuts the income it carries by the expected share; destroyers there screen it; the raid
// is in the log.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const template = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);
const GER = id('GER');
const ENG = id('ENG');
const sim = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 4404, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  return s;
};
function fleet(w: World, nation: number, tpl: string, zone: number): number {
  const cell = seaOf(w).seedCell[zone]!;
  const f = w.formations;
  const fid = f.create();
  f.cols.nation[fid] = nation;
  [f.cols.x[fid], f.cols.y[fid]] = w.seaPoint(cell) ?? [(cell % W) + 0.5, Math.floor(cell / W) + 0.5];
  f.cols.template[fid] = template(tpl);
  f.cols.supply[fid] = 1;
  f.cols.org[fid] = 1;
  equipFormation(w, fid, template(tpl));
  return fid;
}
const gross = (w: World, n: number): number => monthlyAccounts(w, ECONOMY_TABLES_1938).gross[n]!;

/** Each British land's share of the United Kingdom's land income. */
function landShares(w: World): Map<number, number> {
  const comp = navOf(w).grid.component;
  const { econ, owner, controller } = w.cells;
  let all = 0;
  const byLand = new Map<number, number>();
  for (let c = 0; c < econ.length; c++) {
    if (controller[c] !== ENG) continue;
    const v = owner[c] === ENG ? econ[c]! : econ[c]! * 0.5;
    all += v;
    byLand.set(comp[c]!, (byLand.get(comp[c]!) ?? 0) + v);
  }
  for (const [k, v] of byLand) byLand.set(k, v / all);
  return byLand;
}
/** The United Kingdom's month as the raids leave it: every land whose convoys pass the raiders. */
const raided = (w: World, free: number): number => {
  const shares = landShares(w);
  let lost = 0;
  for (const [land, kept] of convoyLosses(w)?.kept.get(ENG) ?? []) lost += (shares.get(land) ?? 0) * (1 - kept);
  return free * (1 - lost);
};

/** The zones a fleet of `nation` stands in. */
const fleetZones = (w: World, nation: number): Set<number> => {
  const out = new Set<number>();
  w.formations.forEach((f) => {
    if (w.afloat(f) && w.formations.cols.nation[f] === nation) out.add(seaOf(w).zoneOf[Math.floor(w.formations.cols.y[f]!) * W + Math.floor(w.formations.cols.x[f]!)]!);
  });
  return out;
};

/** A British land joined to home by sea, with a way of two zones or more, the share of the United Kingdom's land income it makes, and a zone of its way with no British fleet in it. */
function britishLand(w: World): { land: number; way: number[]; share: number; zone: number } {
  const ways = convoyWays(w).get(ENG)!;
  const comp = navOf(w).grid.component;
  const { econ, owner, controller } = w.cells;
  let all = 0;
  const byLand = new Map<number, number>();
  for (let c = 0; c < econ.length; c++) {
    if (controller[c] !== ENG) continue;
    const v = owner[c] === ENG ? econ[c]! : econ[c]! * 0.5;
    all += v;
    byLand.set(comp[c]!, (byLand.get(comp[c]!) ?? 0) + v);
  }
  const british = fleetZones(w, ENG);
  for (const [land, way] of [...ways].sort((a, b) => a[0] - b[0])) {
    const zone = way.find((z) => !british.has(z));
    if (way.length >= 2 && zone !== undefined && (byLand.get(land) ?? 0) > 0) return { land, way, share: byLand.get(land)! / all, zone };
  }
  throw new Error('no such land');
}

describe('convoys and submarine raiding (PLAN 4.4d)', () => {
  it('the AT: a German submarine flotilla on a British convoy\'s way takes 8 × RAID_PER_BOAT of the income it carries; a destroyer flotilla there screens it', () => {
    const s = sim();
    const w = s.world;
    expect(declareWar(w, GER, ENG, true)).not.toBeNull();
    s.step(1);
    const { land, way, share, zone } = britishLand(w);
    const free = gross(w, ENG);
    fleet(w, GER, 'submarine_flotilla', zone);
    const losses = convoyLosses(w)!;
    const take = Math.min(1, 8 * RAID_PER_BOAT);
    expect(losses.kept.get(ENG)!.get(land)).toBeCloseTo(1 - take, 12);
    // Every land whose way passes the zone is raided as this one: the month is their sum.
    expect(gross(w, ENG)).toBeCloseTo(raided(w, free), 6);
    expect(gross(w, ENG)).toBeLessThanOrEqual(free * (1 - take * share) + 1e-6);
    // A British destroyer flotilla in the zone: 8 destroyers to 8 boats, a full screen.
    fleet(w, ENG, 'destroyer_flotilla', zone);
    expect(convoyLosses(w)!.kept.get(ENG)!.get(land)).toBeCloseTo(1 - take * (1 - SCREEN), 12);
    expect(gross(w, ENG)).toBeCloseTo(raided(w, free), 6);
    process.stderr.write(`convoys: land ${land} (${(100 * share).toFixed(2)} % of the United Kingdom's land income), a way of ${way.length} zones, ${convoyLosses(w)!.kept.get(ENG)!.size} British lands' convoys through the zone; ${free.toFixed(1)} a month free, ${gross(w, ENG).toFixed(1)} raided and screened\n`);
  });

  it("a quarter's raids of a nation on a bloc are one row in the log, with the gold they took, and read as a sentence; the tally is saved; a submarine holds no sea (PLAN 7.33a)", () => {
    const s = sim();
    const w = s.world;
    expect(declareWar(w, GER, ENG, true)).not.toBeNull();
    s.step(1);
    const { zone, way } = britishLand(w);
    fleet(w, GER, 'submarine_flotilla', zone);
    fleet(w, GER, 'submarine_flotilla', zone);
    // A second zone of the way raided: still one row of Germany on the British bloc.
    const other = way.find((z) => z !== zone && !fleetZones(w, ENG).has(z));
    if (other !== undefined) fleet(w, GER, 'submarine_flotilla', other);
    // What the economy counts as lost to the raids in a month, of every nation of the bloc.
    let lost = 0;
    w.nations.forEach((n) => void (w.nations.cols.living[n] === 1 && blocOf(w, n) === ENG && (lost += economyBreakdown(w, ECONOMY_TABLES_1938, n).convoys)));
    expect(lost).toBeGreaterThan(0.5);
    const raidRows = (): number[][] => {
      const out: number[][] = [];
      for (let i = 0; i < w.out.events.length; i += 6) if (w.out.events[i + 1] === EventKind.ConvoyRaided) out.push(w.out.events.slice(i, i + 6));
      return out;
    };
    // A month of January, a quarter's first: added to the quarter, nothing told yet.
    w.out.events.length = 0;
    runEconomyMonth(w, ECONOMY_TABLES_1938);
    expect(raidRows()).toHaveLength(0);
    expect(w.convoyQuarter.length).toBeGreaterThan(0);
    // The tally is state: saved and loaded with the game.
    const s2 = sim();
    s2.load(s.save());
    expect(s2.world.convoyQuarter.map((t) => [t.raider, t.bloc, [...t.zones]])).toEqual(w.convoyQuarter.map((t) => [t.raider, t.bloc, [...t.zones]]));
    // At the next quarter's start the quarter is told: one row of Germany on the British bloc.
    tellConvoyQuarter(w);
    expect(w.convoyQuarter).toHaveLength(0);
    const raids = raidRows();
    const ours = raids.filter((r) => r[2] === GER && convoyTake(r[3]!).nation === ENG);
    expect(ours).toHaveLength(1);
    expect(raids.length).toBeLessThanOrEqual(CONVOY_ROWS);
    // The gold in the row is what the bloc's accounts lost to them, in tenths.
    expect(convoyTake(ours[0]![3]!).gold).toBeCloseTo(lost, 1);
    const row = historyRows(w, (n) => `nation.${NATIONS_1938[n - 1]!.tag}`, () => '').find((r) => r.kind === EventKind.ConvoyRaided)!;
    expect(row.bn).toBe('nation.ENG');
    const g = convoyTake(ours[0]![3]!).gold;
    const told = g < 10 ? g.toLocaleString('en-US', { maximumFractionDigits: 1 }) : Math.round(g).toLocaleString('en-US');
    expect(historyText(row)).toBe(`Germany's submarines raided the convoys of United Kingdom over three months: ${told} gold of cargo taken`);
    // A row of a game saved before (the bloc alone in b) reads as it did.
    expect(historyText({ ...row, b: ENG })).toBe("Germany's submarines raided the convoys of United Kingdom");
    // The filter finds the row by the bloc raided, and by the raider.
    expect(filterHistory([row], { ...NO_FILTER, nation: ENG }, w.startDay)).toHaveLength(1);
    expect(filterHistory([row], { ...NO_FILTER, nation: GER }, w.startDay)).toHaveLength(1);
    process.stderr.write(`convoy raids: ${ours.length} row, ${told} gold of ${lost.toFixed(2)} lost a month; ${other !== undefined ? 'two zones' : 'one zone'} of the way raided\n`);
    // The day's sea control: the boats hold nothing.
    const before = seaHolder(w, zone);
    s.step(24);
    expect(seaHolder(w, zone)).toBe(before === GER ? 0 : before);
    expect(seaHolder(w, zone)).not.toBe(GER);
  });

  it('no raid at peace, nor by a nation not at war with the convoy\'s bloc', () => {
    const s = sim();
    const w = s.world;
    s.step(1);
    const { zone } = britishLand(w);
    fleet(w, GER, 'submarine_flotilla', zone);
    expect(convoyLosses(w)).toBeNull();
    // Germany at war with Poland: still none on British convoys.
    expect(declareWar(w, GER, id('POL'), true)).not.toBeNull();
    expect(convoyLosses(w)?.kept.get(ENG)).toBeUndefined();
  });
});
