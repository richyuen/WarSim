/**
 * New-game options (SPEC §9 "Seeds & randomisation", PLAN 1.39b1), applied once when a game
 * starts, deterministically from the seed:
 *   loopingMap  — the map wraps east–west (scenario default) or has hard edges;
 *   aggression  — each nation's AI aggression from the scenario, or uniform 0..100;
 *   traits      — the scenario's traits, or 1–3 random ones (respecting `excludes`): income and
 *                 manpower multipliers follow, and their aggression biases apply;
 *   gold        — starting gold from the scenario, scaled by a random 0.25–2×, or equal for all
 *                 (the median of living nations' gold);
 *   ceMode      — combat-efficiency mode (PLAN 1.22).
 */
import traitsJson from '../../data/traits/traits.json' with { type: 'json' };
import { hash32, hashToUnit } from './core/hash';
import type { GameOptions } from '../shared/gameOptions';

export type { GameOptions };
import type { World } from './world';


interface TraitDef {
  id: string;
  modifiers: { income?: number; manpower?: number };
  aggressionBias?: number;
  excludes?: string[];
}
const TRAITS = traitsJson.traits as unknown as TraitDef[];

const SALT_AGGR = 0x41474752;
const SALT_TRAIT = 0x54524954;
const SALT_GOLD = 0x474f4c44;

export function applyGameOptions(world: World, o: GameOptions): void {
  const nc = world.nations.cols;
  const u = (n: number, salt: number, k = 0): number => hashToUnit(hash32(world.seed, salt, n, k));
  if (o.loopingMap !== undefined && o.loopingMap !== world.settings.loopingMap) {
    world.settings.loopingMap = o.loopingMap;
    // The scenario build already made the pathing grid (wrapping): rebuild it on demand. A
    // path stays (PLAN 3.7k): a march does not take a step over the seam that is one no more.
    world.nav = null;
    world.sea = null;
    world.lanes = null;
    world.frontier = null;
    world.supplyDirty = true;
  }
  if (o.ceMode) world.settings.ceMode = o.ceMode;
  world.nations.forEach((n) => {
    if (o.aggression === 'random') nc.aggression[n] = Math.floor(u(n, SALT_AGGR) * 101);
    if (o.traits === 'random') {
      const count = 1 + Math.floor(u(n, SALT_TRAIT) * 3);
      const chosen: TraitDef[] = [];
      for (let k = 1; chosen.length < count && k < 40; k++) {
        const t = TRAITS[Math.floor(u(n, SALT_TRAIT, k) * TRAITS.length)]!;
        if (chosen.includes(t) || chosen.some((c) => c.excludes?.includes(t.id) || t.excludes?.includes(c.id))) continue;
        chosen.push(t);
      }
      nc.incomeMult[n] = 1 + chosen.reduce((s, t) => s + (t.modifiers.income ?? 0), 0);
      nc.manpowerMult[n] = 1 + chosen.reduce((s, t) => s + (t.modifiers.manpower ?? 0), 0);
      nc.aggression[n] = Math.max(0, Math.min(100, nc.aggression[n]! + chosen.reduce((s, t) => s + (t.aggressionBias ?? 0), 0)));
    }
    if (o.gold === 'random') nc.gold[n] = nc.gold[n]! * (0.25 + 1.75 * u(n, SALT_GOLD));
  });
  if (o.gold === 'equal') {
    const golds: number[] = [];
    world.nations.forEach((n) => {
      if (nc.living[n] === 1) golds.push(nc.gold[n]!);
    });
    golds.sort((a, b) => a - b);
    const median = golds.length > 0 ? golds[Math.floor(golds.length / 2)]! : 0;
    world.nations.forEach((n) => {
      if (nc.living[n] === 1) nc.gold[n] = median;
    });
  }
}
