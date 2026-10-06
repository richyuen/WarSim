/**
 * What a nation knows (SPEC §3.7, PLAN 3.1a). A tech is a bit: its index in
 * `ScenarioRules.techs` (the order of the scenario's tech files) is the bit's number in the
 * nation's `tech0` (bits 0..31) and `tech1` (32..63) columns. The columns are state: saved and
 * hashed with the nation table.
 *
 * A template asks for the techs of its unit types and all that leads to them (`techClosure`),
 * so a nation given a tech without its prerequisites does not build with it.
 *
 * The start (`grantStartTechs`): every living or dead nation knows the techs dated before the
 * scenario's first year (what every army of the day had), the techs of the templates its
 * formations of the start have (an army is not ahead of its own country), and what the
 * scenario's nation table gives it. A nation founded later knows what the nation it left knew
 * (`spawnRebels`); a nation that returns knows what it knew. After the start a nation learns by
 * research (`systems/research.ts`).
 */
import { civilFromDays } from '../shared/calendar';
import type { World } from './world';

export interface TechRule {
  id: string;
  /** The year from which it can be researched. */
  year: number;
  /** Indices into `ScenarioRules.techs`. */
  prereqs: readonly number[];
  /** The schema's category (`data/tech/*.json`). */
  category: string;
  /** What its research costs, and the days it takes at least (PLAN 3.1b, `systems/research.ts`). */
  gold: number;
  days: number;
}

/** Bits 0..31 and 32..63, both as unsigned 32-bit numbers. */
export type TechMask = readonly [number, number];

export const MAX_TECHS = 64;

export function techMask(indices: Iterable<number>): TechMask {
  let lo = 0;
  let hi = 0;
  for (const i of indices) {
    if (i < 0 || i >= MAX_TECHS) throw new Error(`tech index ${i}: a nation's techs are ${MAX_TECHS} bits`);
    if (i < 32) lo |= 1 << i;
    else hi |= 1 << (i - 32);
  }
  return [lo >>> 0, hi >>> 0];
}

/** `indices` and all their prerequisites, down to the roots. */
export function techClosure(techs: readonly TechRule[], indices: Iterable<number>): TechMask {
  const seen = new Set<number>();
  const stack = [...indices];
  while (stack.length > 0) {
    const i = stack.pop()!;
    if (seen.has(i)) continue;
    seen.add(i);
    stack.push(...techs[i]!.prereqs);
  }
  return techMask(seen);
}

export function knowsTechs(world: World, nation: number, need: TechMask): boolean {
  const nc = world.nations.cols;
  return (nc.tech0[nation]! & need[0]) >>> 0 === need[0] && (nc.tech1[nation]! & need[1]) >>> 0 === need[1];
}

export function grantTechs(world: World, nation: number, mask: TechMask): void {
  const nc = world.nations.cols;
  nc.tech0[nation] = (nc.tech0[nation]! | mask[0]) >>> 0;
  nc.tech1[nation] = (nc.tech1[nation]! | mask[1]) >>> 0;
}

/** The start of a scenario (module comment). `given`: tech indices by nation, from the scenario's nation table. */
export function grantStartTechs(world: World, given?: ReadonlyMap<number, readonly number[]>): void {
  const rules = world.rules;
  if (!rules) return;
  const year = civilFromDays(world.startDay).year;
  const common = techClosure(
    rules.techs,
    rules.techs.flatMap((t, i) => (t.year < year ? [i] : [])),
  );
  world.nations.forEach((n) => {
    grantTechs(world, n, common);
    const own = given?.get(n);
    if (own) grantTechs(world, n, techClosure(rules.techs, own));
  });
  const f = world.formations.cols;
  world.formations.forEach((id) => {
    const t = rules.templates[f.template[id]!];
    if (t) grantTechs(world, f.nation[id]!, t.techs);
  });
}
