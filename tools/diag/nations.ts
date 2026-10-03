/**
 * `npm run diag -- [--seed 99] [--at 5,12,20] [--load state.bin] [--save state.bin] [--top 14]`
 *
 * State dumps of a headless 1938 run for diagnosing the strategic layer (first used for critic
 * B1, 2026-10-03). At each year in `--at` (absolute sim years) it prints the wars (sides, age,
 * score, exhaustion, fight to the death) and, for the strongest and the largest nations, their
 * land, men, treasury, alliance, wars and what the strategic AI sees in each neighbour (why it
 * cannot attack, or the strength ratio). `--load` starts from a checkpoint written by `--save`
 * here or by `npm run sim -- --save`, so a late year costs only the years after the checkpoint.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ALLY_WEIGHT, neighbourMap, RATIO_CAP } from '../../src/sim/ai/strategic';
import { landStandings } from '../../src/sim/landArea';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { TICKS_PER_YEAR } from '../headless/runner';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : fallback;
}

const seed = Number(arg('seed', '99'));
const stops = arg('at', '5,12,20')
  .split(',')
  .map(Number)
  .sort((a, b) => a - b);
const top = Number(arg('top', '14'));
const load = arg('load', '');
const save = arg('save', '');
if (load && !existsSync(load)) throw new Error(`--load: no file '${load}'`);

const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
if (load) sim.load(new Uint8Array(readFileSync(load)));
const w = sim.world;
const name = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const k = (men: number): string => `${Math.round(men / 1000)}k`;

function dump(year: number): void {
  const nc = w.nations.cols;
  const al = w.alliances;
  const str = new Float64Array(w.nations.highWater + 1);
  w.formations.forEach((id) => (str[w.formations.cols.nation[id]!]! += w.formations.cols.strength[id]!));
  const nb = neighbourMap(w);
  const live: number[] = [];
  w.nations.forEach((n) => nc.living[n] === 1 && live.push(n));
  const { area, owned, ranked } = landStandings(w);
  console.log(`\n=== year ${year}: alive ${live.length}, wars ${w.wars.list.length}, alliances ${al.list.length} (${al.list.map((a) => `${a.nameKey.split('.')[1]}:${a.members.length}`).join(' ')}), guarantees ${al.guarantees.length}, truces ${w.wars.truces.length}`);
  for (const x of w.wars.list.slice(0, 40)) {
    const ftd = x.fightToDeath[0] || x.fightToDeath[1] ? ' FTD' : '';
    console.log(`  ${name(x.sides[0][0]!)}(${x.sides[0].length}) v ${name(x.sides[1][0]!)}(${x.sides[1].length})  ${Math.round((w.tick - x.startTick) / 24)}d  score ${x.score}  exhaustion ${Math.round(x.exhaustion[0])}/${Math.round(x.exhaustion[1])}${ftd}`);
  }
  const withAllies = (n: number): number => {
    let s = str[n]!;
    for (const m of al.allianceOf(n)?.members ?? []) if (m !== n) s += ALLY_WEIGHT * str[m]!;
    return s;
  };
  const defence = (t: number): number => {
    let s = withAllies(t);
    for (const g of al.guarantorsOf(t)) s += ALLY_WEIGHT * str[g]!;
    return Math.max(1, s);
  };
  const pick = new Set([...live].sort((a, b) => str[b]! - str[a]!).slice(0, top).concat(ranked.slice(0, 10)));
  for (const n of [...pick].sort((a, b) => area[b]! - area[a]! || a - b)) {
    const wars = w.wars.list.filter((x) => x.sides[0].includes(n) || x.sides[1].includes(n)).length;
    const targets = [...(nb.get(n) ?? [])]
      .filter((t) => nc.living[t] === 1)
      .sort((a, b) => a - b)
      .map((t) => {
        const why = w.wars.atWar(n, t) ? 'war' : al.allied(n, t) ? 'ally' : w.wars.inTruce(n, t, w.tick) ? 'truce' : nc.overlord[t] === n ? 'puppet' : nc.overlord[n] === t ? 'overlord' : '';
        return why ? `${name(t)}[${why}]` : `${name(t)}(${Math.min(RATIO_CAP, withAllies(n) / defence(t)).toFixed(1)})`;
      });
    console.log(
      `${name(n).padEnd(5)} land ${String(Math.round(area[n]! / 1000)).padStart(6)}k km² (${((100 * area[n]!) / owned).toFixed(1)}%, ${nc.cells[n]} cells)  men ${k(str[n]!).padStart(6)}  gold ${Math.round(nc.gold[n]!)}  income ${Math.round(nc.income[n]!)}  expenses ${Math.round(nc.expenses[n]!)}` +
        `${nc.bankrupt[n] === 1 ? '  BANKRUPT' : ''}  aggr ${nc.aggression[n]}  suppr ${nc.suppression[n]}  overlord ${nc.overlord[n] ? name(nc.overlord[n]!) : '-'}  alliance ${al.allianceOf(n)?.id ?? '-'}  wars ${wars}  manpower ${k(nc.manpower[n]!)} | ${targets.join(' ')}`,
    );
  }
}

for (const stop of stops) {
  const ticks = stop * TICKS_PER_YEAR - w.tick;
  if (ticks < 0) throw new Error(`--at ${stop}: the loaded state is already past year ${stop} (tick ${w.tick})`);
  sim.step(ticks);
  dump(stop);
}
if (save) {
  mkdirSync(path.dirname(path.resolve(save)), { recursive: true });
  writeFileSync(save, sim.save());
  console.log(`\nsaved year ${w.tick / TICKS_PER_YEAR} → ${save}`);
}
