/**
 * Statistics series (SPEC §9, PLAN 1.34b): at every month start, one sample per living nation,
 * stored as flat STAT_STRIDE f32 records [tick, nation, land, income, gold, men, casualties]:
 * owned cells, last monthly gross income, treasury, men in its formations (the land domain;
 * naval and air join with their phases), and cumulative men lost. State: saved (f32, ~240 KB a
 * decade for the 1938 world) so charts survive a load; saves from before it start empty.
 */
import { isMonthStart } from '../shared/calendar';
import type { Section } from './core/sections';
import type { Stateful } from './core/state';
import type { World } from './world';

export const STAT_STRIDE = 7;
export const STAT_FIELDS = ['tick', 'nation', 'land', 'income', 'gold', 'men', 'casualties'] as const;

export class StatSeries implements Stateful {
  rows: number[] = [];

  get length(): number {
    return this.rows.length / STAT_STRIDE;
  }

  serialize(): Section[] {
    return [{ name: 'stats.rows', dtype: 'f32', data: Float32Array.from(this.rows) }];
  }

  deserialize(sections: readonly Section[]): void {
    const s = sections.find((x) => x.name === 'stats.rows');
    this.rows = s ? Array.from(s.data as Float32Array) : [];
  }
}

/** Monthly sampling (last system of the tick, so it sees the month's economy and battles). */
export function statsSystem(world: World): void {
  if (!isMonthStart(world.startDay, world.tick)) return;
  const nc = world.nations.cols;
  const men = new Float64Array(world.nations.highWater);
  const fc = world.formations.cols;
  world.formations.forEach((f) => (men[fc.nation[f]!]! += fc.strength[f]!));
  // Stored as f32: round here so the saved value equals the in-memory one.
  const f = Math.fround;
  const rows = world.stats.rows;
  world.nations.forEach((n) => {
    if (nc.living[n] !== 1) return;
    rows.push(world.tick, n, nc.cells[n]!, f(nc.income[n]!), f(nc.gold[n]!), men[n]!, f(nc.casualties[n]!));
  });
}
