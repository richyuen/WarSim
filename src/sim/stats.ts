/**
 * Statistics series (SPEC §9, PLAN 1.34b): at every month start, one sample per living nation,
 * stored as flat STAT_STRIDE f32 records [tick, nation, land, income, gold, men, casualties]:
 * owned land in km² (true area, ADR-52: never cells), last monthly gross income, treasury, men in its formations (the land domain;
 * naval and air join with their phases), and cumulative men lost. State: saved (f32, ~240 KB a
 * decade for the 1938 world) so charts survive a load; saves from before it start empty. So do
 * saves whose series counted land in cells (section `stats.rows`, before PLAN 1.42d2): a land
 * column of mixed units would draw a false cliff in the chart.
 */
import { isMonthStart } from '../shared/calendar';
import type { Section } from './core/sections';
import type { Stateful } from './core/state';
import { ownedAreas } from './landArea';
import type { World } from './world';

export const STAT_STRIDE = 7;
const SECTION = 'stats.km2';
export const STAT_FIELDS = ['tick', 'nation', 'land', 'income', 'gold', 'men', 'casualties'] as const;

export class StatSeries implements Stateful {
  rows: number[] = [];

  get length(): number {
    return this.rows.length / STAT_STRIDE;
  }

  serialize(): Section[] {
    return [{ name: SECTION, dtype: 'f32', data: Float32Array.from(this.rows) }];
  }

  deserialize(sections: readonly Section[]): void {
    const s = sections.find((x) => x.name === SECTION);
    this.rows = s ? Array.from(s.data as Float32Array) : [];
  }
}

/** Monthly sampling (last system of the tick, so it sees the month's economy and battles). */
export function statsSystem(world: World): void {
  if (!isMonthStart(world.startDay, world.tick)) return;
  const nc = world.nations.cols;
  const men = new Float64Array(world.nations.highWater);
  const fc = world.formations.cols;
  world.formations.forEach((f) => {
    if (!world.afloat(f)) men[fc.nation[f]!]! += fc.strength[f]!; // the army's men: a fleet's crews are not counted (PLAN 4.2b)
  });
  // Stored as f32: round here so the saved value equals the in-memory one.
  const f = Math.fround;
  const rows = world.stats.rows;
  const area = ownedAreas(world.cells.owner, world.cells.w, world.cells.h, world.nations.highWater);
  world.nations.forEach((n) => {
    if (nc.living[n] !== 1) return;
    rows.push(world.tick, n, f(area[n]!), f(nc.income[n]!), f(nc.gold[n]!), men[n]!, f(nc.casualties[n]!));
  });
}
