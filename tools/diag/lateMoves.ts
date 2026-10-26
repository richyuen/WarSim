/**
 * PLAN 7.118: how much land moves late, and why a world stands still. The critic's figure (run 14,
 * `late5flip`): cells whose controller differs from the year before, summed over a world's last five
 * year-ends, over the land cells; and the founded nations alive at the end. Per year also the wars, the
 * nations at war, the largest nation's share and the events that move land without a war.
 *
 * Usage: npx tsx tools/diag/lateMoves.ts <seed> <years> <out.jsonl> [saveDir] [saveYears = 20,25]
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3]);
const out = process.argv[4]!;
const saveDir = process.argv[5] ?? '';
const saveYears = new Set((process.argv[6] ?? '20,25').split(',').map(Number));
const KINDS = ['WarDeclared', 'RevoltSpawned', 'NationAnnexed', 'UnionFormed', 'PuppetCreated', 'NationRevived', 'CapitalCaptured'] as const;
const kindOf = new Map<number, string>(KINDS.map((k) => [EventKind[k as keyof typeof EventKind] as number, k]));

const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const world = sim.world;
writeFileSync(out, '');
if (saveDir) mkdirSync(saveDir, { recursive: true });
let prev = world.cells.controller.slice();
for (let y = 1; y <= years; y++) {
  const ev: Record<string, number> = {};
  let atWarDays = 0;
  for (let d = 0; d < 365; d++) {
    sim.step(24, (w) => {
      const e = w.out.events;
      for (let i = 0; i < e.length; i += 6) {
        const k = kindOf.get(e[i + 1]!);
        if (k) ev[k] = (ev[k] ?? 0) + 1;
      }
      e.length = 0;
      w.out.fires.length = 0;
    });
    const n = new Set<number>();
    for (const wr of world.wars.list) for (const sd of wr.sides) for (const x of sd) n.add(x);
    atWarDays += n.size;
  }
  const c = world.cells.controller;
  let flipped = 0;
  let land = 0;
  const held = new Map<number, number>();
  for (let i = 0; i < c.length; i++) {
    if (c[i] !== prev[i]) flipped++;
    if (c[i] === 0) continue;
    land++;
    held.set(c[i]!, (held.get(c[i]!) ?? 0) + 1);
  }
  prev = c.slice();
  let living = 0;
  let founded = 0;
  world.nations.forEach((id) => {
    if (world.nations.cols.living[id] !== 1) return;
    living++;
    if ((world.nations.cols.origin[id] ?? 0) !== 0) founded++;
  });
  const top = [...held.values()].sort((a, b) => b - a);
  const row = {
    seed,
    year: y,
    flipped,
    land,
    living,
    founded,
    wars: world.wars.list.length,
    atWar: +(atWarDays / 365).toFixed(1),
    top1: +((100 * (top[0] ?? 0)) / land).toFixed(1),
    top3: +((100 * ((top[0] ?? 0) + (top[1] ?? 0) + (top[2] ?? 0))) / land).toFixed(1),
    ev,
    hash: sim.hash().toString(16),
  };
  appendFileSync(out, JSON.stringify(row) + '\n');
  if (saveDir && saveYears.has(y)) writeFileSync(`${saveDir}/s${seed}_y${y}.bin`, sim.save());
}
console.log('done:');
