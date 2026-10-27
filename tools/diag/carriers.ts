/**
 * PLAN 7.133's read: the carriers of the world. From 1938 (`-`) or a checkpoint, the fleets with a carrier afloat
 * (`liveCarriers`): by nation, its carriers afloat, the wings aboard (`wingBase` the fleet's id, negative), and
 * whether the nation is at war; and the carrier groups in training. One line a save.
 *
 * Usage: npx tsx tools/diag/carriers.ts <seed> <state.bin | -> [...more saves]
 */
import { readFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { liveCarriers } from '../../src/sim/systems/air';

const seed = Number(process.argv[2]);
for (const src of process.argv.slice(3)) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  if (src !== '-') s.load(new Uint8Array(readFileSync(src)));
  const w = s.world;
  const c = w.formations.cols;
  const nc = w.nations.cols;
  const tag = (n: number): string => ((nc.origin[n] ?? 0) === 0 ? (TAGS_1938[n - 1] ?? `#${n}`) : `f${n}`);
  const aboard = new Map<number, number>();
  for (const [id, b] of w.wingBase) if (b < 0 && w.formations.has(id)) aboard.set(-b, (aboard.get(-b) ?? 0) + 1);
  const atWar = w.wars.nations();
  const by = new Map<string, { cv: number; wings: number; war: boolean }>();
  let cv = 0;
  let wings = 0;
  w.formations.forEach((id) => {
    if (!w.isFleet(id)) return;
    const k = liveCarriers(w, id);
    if (k === 0) return;
    const n = c.nation[id]!;
    const row = by.get(tag(n)) ?? { cv: 0, wings: 0, war: atWar.has(n) };
    row.cv += k;
    row.wings += aboard.get(id) ?? 0;
    by.set(tag(n), row);
    cv += k;
    wings += aboard.get(id) ?? 0;
  });
  // A template with a carrier among its elements in training.
  const rules = w.rules!;
  let training = 0;
  w.production.forEach((q) => {
    if (rules.templates[w.production.cols.template[q]!]!.elements.some((e) => rules.units[e.unit]!.cls === 'cv')) training++;
  });
  const rows = [...by].map(([k, v]) => `${k} ${v.cv}cv/${v.wings}w${v.war ? ' war' : ''}`).join(', ');
  console.log(`${seed} ${src} day ${Math.floor(w.tick / 24)}: carriers ${cv}, wings aboard ${wings}, carrier groups in training ${training}; ${rows}`);
}
console.log('done:');
