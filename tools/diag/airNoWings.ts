/**
 * PLAN 7.133's read: the AI nations at war with no wing late, and whether a wing of theirs would meet
 * the enemy. From a checkpoint, each 10th day at 00:00 for `days` days, every living AI nation at war
 * with no wing (and none in training) is put in one bucket by the first gate the economic AI's wing
 * order (`economic.ts` 3c) would stop at: `poor` (income under POOR_INCOME), `noAirbase` (none of the
 * airbases is its own), else `could`. Of the `could` ones, whether an enemy land formation stands
 * within REACH_KM of one of its airbases (`couldNear`), and their income summed (`couldIncome`). Also
 * the nations at war with wings, and their wings, for scale.
 *
 * Usage: npx tsx tools/diag/airNoWings.ts <save.bin> [days = 60] [out = .cache/airNoWings.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { ECONOMY_TABLES_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { monthlyAccounts } from '../../src/sim/systems/economy';
import { POOR_INCOME } from '../../src/sim/ai/economic';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { Domain } from '../../src/sim/world';

/** About a fighter group's range, km: a wing at an airbase this near an enemy formation could fly at it. */
const REACH_KM = 600;

const save = process.argv[2]!;
const days = Number(process.argv[3] ?? 60);
const out = process.argv[4] ?? '.cache/airNoWings.json';
const s = new Sim({ scenario: '1938', seed: 1, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(save)));
const w = s.world;
const r: Record<string, number> = {};
const add = (k: string, v = 1): void => {
  r[k] = (r[k] ?? 0) + v;
};
const names: Record<string, number> = {};

for (let d = 0; d < days; d += 10) {
  s.step(24 * 10, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  const c = w.formations.cols;
  const nc = w.nations.cols;
  const acc = monthlyAccounts(w, ECONOMY_TABLES_1938);
  const wings = new Map<number, number>();
  for (const [id] of w.wingBase) if (w.formations.has(id)) wings.set(c.nation[id]!, (wings.get(c.nation[id]!) ?? 0) + 1);
  w.production.forEach((q) => {
    const pn = w.production.cols.nation[q]!;
    if (w.rules!.templates[w.production.cols.template[q]!]?.domain === Domain.air) wings.set(pn, (wings.get(pn) ?? 0) + 1);
  });
  const land: number[] = [];
  w.formations.forEach((g) => {
    if (!w.isFleet(g) && !w.isWing(g) && !w.offLand(g) && !w.embarked.has(g)) land.push(g);
  });
  add('reads');
  for (const n of [...w.wars.nations()].sort((a, b) => a - b)) {
    if (nc.living[n] !== 1 || nc.aiOff[n] === 1) continue;
    add('atWar');
    if (wings.has(n)) {
      add('withWings');
      add('wings', wings.get(n)!);
      continue;
    }
    const income = Math.max(0, acc.gross[n]!);
    const bases = w.airbases.filter((b) => w.cells.controller[b.cell] === n);
    if (income < POOR_INCOME) {
      add('poor');
      add('poorIncome', income);
      continue;
    }
    if (bases.length === 0) {
      add('noAirbase');
      continue;
    }
    add('could');
    add('couldIncome', income);
    const near = bases.some((b) => {
      const [x, y] = w.cellPoint(b.cell);
      return land.some((g) => w.wars.atWar(n, c.nation[g]!) && seaKm(w, x, y, c.x[g]!, c.y[g]!) <= REACH_KM);
    });
    if (near) {
      add('couldNear');
      const k = w.names.get(n) ?? `#${n}`;
      names[k] = (names[k] ?? 0) + 1;
    }
  }
}
writeFileSync(out, JSON.stringify({ save, days, r, names }, null, 1));
console.log(`done: ${save} ${JSON.stringify(r)} ${JSON.stringify(names)}`);
