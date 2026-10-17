// Critic run 7: which nations know the nuclear techs in a saved headless state, and their warheads.
// Usage: npx tsx critic/scripts/c7_techs.ts <seed> <save.bin> [years to run on]
import { readFileSync } from 'node:fs';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { laneOf } from '../../src/sim/world';
import { knowsTechs, techMask } from '../../src/sim/tech';
import { loadAssets1938 } from '../../tools/headless/assets';
import en from '../../src/ui/i18n/en.json' with { type: 'json' };

const seed = Number(process.argv[2]);
const file = process.argv[3]!;
const more = Number(process.argv[4] ?? 0);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
sim.load(new Uint8Array(readFileSync(file)));
const world = sim.world;
if (world.ports.length > 0 && world.seaSeeds.length > 0) laneOf(world);
const nm = (id: number): string => {
  const d = NATIONS_1938[id - 1];
  if (d && (world.nations.cols.origin[id] ?? 0) === 0) return (en as Record<string, string>)[d.nameKey] ?? d.tag;
  return `founded#${id}`;
};
const ids = ['atomic_bomb', 'rocketry', 'ballistic_missiles', 'thermonuclear'];
const report = (): void => {
  const idx = ids.map((t) => world.rules.techs.findIndex((r) => r.id === t));
  const rows: Record<string, string[]> = {};
  world.nations.forEach((id) => {
    if (world.nations.cols.living[id] !== 1) return;
    const k = ids.filter((_, i) => idx[i]! >= 0 && knowsTechs(world, id, techMask([idx[i]!])));
    if (k.length) rows[nm(id)] = k;
  });
  console.log(JSON.stringify({ year: Math.floor(world.tick / 8760), techs: rows, warheads: Object.fromEntries([...world.warheads].map(([n, h]) => [nm(n), h.stock])) }));
};
report();
for (let y = 0; y < more; y++) {
  sim.step(8760, (w) => { w.out.events.length = 0; w.out.fires.length = 0; });
  report();
}
