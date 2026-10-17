/**
 * Statistics series (SPEC §9, PLAN 1.34b): at every month start, one sample per living nation,
 * stored as flat STAT_STRIDE f32 records [tick, nation, land, income, gold, men, casualties]:
 * owned land in km² (true area, ADR-52: never cells), last monthly gross income, treasury, men in its formations (the land domain;
 * naval and air join with their phases), and cumulative men lost. State: saved (f32, ~240 KB a
 * decade for the 1938 world) so charts survive a load; saves from before it start empty. So do
 * saves whose series counted land in cells (section `stats.rows`, before PLAN 1.42d2): a land
 * column of mixed units would draw a false cliff in the chart.
 *
 * The air (PLAN 5.11c): beside each record, AIR_STRIDE f32 [aircraft, airLost]: the aircraft of
 * its wings and those it has lost (`world.airTotals`). A section of its own (`stats.air`): a
 * save from before it has none, and its records read 0 there; the charts take the two joined
 * (`chartRows`).
 *
 * The nuclear age (PLAN 7.12, critic run 7: "add warheads, nuclear dead and fallout to the panel and
 * the charts"): beside each record NUKE_STRIDE f32 [warheads, nukeDead, fallout]: its stockpile, the
 * dead of bursts on its land all told (`world.nukeDead`), and the cells of its land under fallout.
 * A section of its own (`stats.nuke`), as the air's, saved once one of its numbers is not 0 (a
 * world with no warhead yet saves as before it; its records read 0 there).
 */
import { isMonthStart } from '../shared/calendar';
import type { Section } from './core/sections';
import type { Stateful } from './core/state';
import { ownedAreas } from './landArea';
import type { World } from './world';

export const STAT_STRIDE = 7;
const SECTION = 'stats.km2';
export const STAT_FIELDS = ['tick', 'nation', 'land', 'income', 'gold', 'men', 'casualties'] as const;
/** The air's numbers beside each record (PLAN 5.11c): aircraft, aircraft lost. */
export const AIR_STRIDE = 2;
const AIR_SECTION = 'stats.air';
/** The nuclear age's numbers beside each record (PLAN 7.12): warheads, the nuclear dead, cells under fallout. */
export const NUKE_STRIDE = 3;
const NUKE_SECTION = 'stats.nuke';

export class StatSeries implements Stateful {
  rows: number[] = [];
  /** AIR_STRIDE numbers for each record of `rows`, in its order (PLAN 5.11c). */
  air: number[] = [];
  /** NUKE_STRIDE numbers for each record of `rows`, in its order (PLAN 7.12). */
  nuke: number[] = [];

  get length(): number {
    return this.rows.length / STAT_STRIDE;
  }

  serialize(): Section[] {
    return [
      { name: SECTION, dtype: 'f32', data: Float32Array.from(this.rows) },
      { name: AIR_SECTION, dtype: 'f32', data: Float32Array.from(this.air) },
      // Only once it holds a number (PLAN 7.12): a world with no warhead yet saves as before it.
      ...(this.nuke.some((v) => v !== 0) ? [{ name: NUKE_SECTION, dtype: 'f32' as const, data: Float32Array.from(this.nuke) }] : []),
    ];
  }

  deserialize(sections: readonly Section[]): void {
    const s = sections.find((x) => x.name === SECTION);
    this.rows = s ? Array.from(s.data as Float32Array) : [];
    // A save from before the air's numbers (or of another length): 0 beside every record.
    const a = sections.find((x) => x.name === AIR_SECTION)?.data as Float32Array | undefined;
    const want = this.length * AIR_STRIDE;
    this.air = a && a.length === want ? Array.from(a) : new Array<number>(want).fill(0);
    // And before the nuclear age's (PLAN 7.12).
    const k = sections.find((x) => x.name === NUKE_SECTION)?.data as Float32Array | undefined;
    const wantK = this.length * NUKE_STRIDE;
    this.nuke = k && k.length === wantK ? Array.from(k) : new Array<number>(wantK).fill(0);
  }
}

/** The records with the air's and the nuclear age's numbers joined (PLAN 5.11c, 7.12): SERIES_STRIDE (12) f32 each, as the charts read them (`shared/statSeries`). */
export function chartRows(s: StatSeries): Float32Array {
  const n = s.length;
  const stride = STAT_STRIDE + AIR_STRIDE + NUKE_STRIDE;
  const out = new Float32Array(n * stride);
  for (let i = 0; i < n; i++) {
    out.set(s.rows.slice(i * STAT_STRIDE, (i + 1) * STAT_STRIDE), i * stride);
    out.set(s.air.slice(i * AIR_STRIDE, (i + 1) * AIR_STRIDE), i * stride + STAT_STRIDE);
    out.set(s.nuke.slice(i * NUKE_STRIDE, (i + 1) * NUKE_STRIDE), i * stride + STAT_STRIDE + AIR_STRIDE);
  }
  return out;
}

/** Monthly sampling (last system of the tick, so it sees the month's economy and battles). */
export function statsSystem(world: World): void {
  if (!isMonthStart(world.startDay, world.tick)) return;
  const nc = world.nations.cols;
  const men = new Float64Array(world.nations.highWater);
  const fc = world.formations.cols;
  // Its wings' aircraft (PLAN 5.11c): a wing's strength is its squadrons' aircraft.
  const aircraft = new Float64Array(world.nations.highWater);
  world.formations.forEach((f) => {
    if (world.isWing(f)) aircraft[fc.nation[f]!]! += fc.strength[f]!;
    else if (!world.isFleet(f)) men[fc.nation[f]!]! += fc.strength[f]!; // the army's men: a fleet's crews are not counted (PLAN 4.2b)
  });
  // Stored as f32: round here so the saved value equals the in-memory one.
  const f = Math.fround;
  const rows = world.stats.rows;
  const area = ownedAreas(world.cells.owner, world.cells.w, world.cells.h, world.nations.highWater);
  // The cells of each nation's land under fallout (PLAN 7.12).
  const fallout = new Float64Array(world.nations.highWater);
  for (const c of world.fallout.keys()) fallout[world.cells.owner[c]!]! += 1;
  world.nations.forEach((n) => {
    if (nc.living[n] !== 1) return;
    rows.push(world.tick, n, f(area[n]!), f(nc.income[n]!), f(nc.gold[n]!), men[n]!, f(nc.casualties[n]!));
    world.stats.air.push(f(aircraft[n]!), f(world.airTotals.get(n)?.lost ?? 0));
    world.stats.nuke.push(world.warheads.get(n)?.stock ?? 0, f(world.nukeDead.get(n) ?? 0), fallout[n]!);
  });
}
