/**
 * PLAN 7.37g (critic run 10: Latvia on seed 1307 with 75 warheads, Lithuania on 8693 with 20,
 * "unexplained"): how a nation came to run a nuclear programme. Every `step` days from 1938 (or a
 * checkpoint): its income against NUKE_PROGRAMME_INCOME, the parts of it (the multiplier, the
 * bonus), its land and output by the nation that held it in 1938, its overlord and puppets, whether
 * it knows the bomb and its warheads; and the events that moved its land or its programme (wars,
 * peaces, unions, annexations, revolts, the bomb's techs).
 *
 * Usage: npx tsx tools/diag/nukeProgramme.ts <seed> <years> <TAG> [step days = 90] [from.bin | new] [out.json] [ALSO,TAGS]
 * (the events of the nations ALSO too: whose land it came to hold).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { goesForBomb, NUKE_PROGRAMME_INCOME, warheadsOf } from '../../src/sim/systems/nuclear';
import { knowsTechs, techMask } from '../../src/sim/tech';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 12);
const T = process.argv[4]!;
const step = Number(process.argv[5] ?? 90);
const from = process.argv[6] ?? 'new';
const outPath = process.argv[7] ?? `.cache/nukeProgramme_${seed}_${T}.json`;
const also = new Set((process.argv[8] ?? '').split(',').filter(Boolean).map((t) => TAGS_1938.indexOf(t) + 1));
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
if (from !== 'new') sim.load(new Uint8Array(readFileSync(from)));
const w = sim.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const n = TAGS_1938.indexOf(T) + 1;
if (n <= 0) throw new Error(`no tag ${T}`);
const nc = w.nations.cols;
const rules = w.rules!;
const techIds = rules.techs.map((t) => t.id);
const nuclear = new Set(['atomic_bomb', ...rules.techs.filter((t) => /nuclear|atomic|missile|hydrogen/.test(t.id)).map((t) => t.id)]);
const bombMask = techMask([techIds.indexOf('atomic_bomb')]);
// The 1938 owner of each cell (from a checkpoint: its owner then, `from` in the output).
const owner0 = new Uint16Array(w.cells.owner);
const kinds = new Map<number, string>(Object.entries(EventKind).map(([k, v]) => [v as number, k]));
const MOVES = new Set<number>([
  EventKind.WarDeclared, EventKind.PeaceSigned, EventKind.NationAnnexed, EventKind.PuppetCreated,
  EventKind.PuppetReleased, EventKind.LandCeded, EventKind.CapitalCaptured, EventKind.NationEliminated, EventKind.WarEnded,
]);
const r1 = (v: number): number => Math.round(v * 10) / 10;
const events: Record<string, unknown>[] = [];
const samples: Record<string, unknown>[] = [];

function sample(): void {
  const { owner, controller, econ } = w.cells;
  const byOwner0 = new Map<number, { cells: number; econ: number }>();
  let cells = 0, held = 0, econOwn = 0;
  for (let c = 0; c < owner.length; c++) {
    if (owner[c] === n) { cells++; econOwn += econ[c]!; }
    if (controller[c] !== n) continue;
    held++;
    const o = owner0[c]!;
    const b = byOwner0.get(o) ?? { cells: 0, econ: 0 };
    b.cells++;
    b.econ += econ[c]!;
    byOwner0.set(o, b);
  }
  const puppets: string[] = [];
  w.nations.forEach((m) => { if (nc.living[m] === 1 && nc.overlord[m] === n) puppets.push(tag(m)); });
  const known = [...nuclear].filter((id) => { const i = techIds.indexOf(id); return i >= 0 && knowsTechs(w, n, techMask([i])); });
  let men = 0, divisions = 0;
  w.formations.forEach((f) => { if (w.formations.cols.nation[f] === n && !w.isFleet(f) && !w.isWing(f)) { men += w.formations.cols.strength[f]!; divisions++; } });
  let rank = 1;
  w.nations.forEach((m) => { if (m !== n && nc.living[m] === 1 && nc.income[m]! > nc.income[n]!) rank++; });
  samples.push({
    day: Math.round(w.tick / 24), year: r1(w.tick / 24 / 365), living: nc.living[n], income: r1(nc.income[n]!), rankByIncome: rank,
    programme: goesForBomb(w, n), incomeMult: nc.incomeMult[n], incomeBonus: nc.incomeBonus[n], gold: Math.round(nc.gold[n]!),
    men: Math.round(men), divisions, expenses: r1(nc.expenses[n]!), owned: cells, held, econOwn: Math.round(econOwn), overlord: nc.overlord[n] ? tag(nc.overlord[n]!) : null, puppets,
    knowsBomb: knowsTechs(w, n, bombMask), nuclearTechs: known, warheads: warheadsOf(w, n), research: nc.research[n],
    heldBy1938Owner: [...byOwner0.entries()].sort((a, b) => b[1].econ - a[1].econ).slice(0, 8).map(([o, b]) => [o === 0 ? 'none' : tag(o), b.cells, Math.round(b.econ)]),
  });
}

const end = w.tick + years * 365 * 24;
sample();
let next = w.tick + step * 24;
while (w.tick < end) {
  sim.step(24, (wd) => {
    const e = wd.out.events;
    for (let i = 0; i < e.length; i += 6) {
      const k = e[i + 1]!, a = e[i + 2]!, b = e[i + 3]!;
      const tech = k === EventKind.TechResearched && a === n && nuclear.has(techIds[b] ?? '');
      if (tech || (MOVES.has(k) && (a === n || b === n || also.has(a) || also.has(b)))) events.push({ day: Math.round(e[i]! / 24), kind: kinds.get(k), a: tag(a), b: k === EventKind.TechResearched ? techIds[b] : tag(b), income: r1(nc.income[n]!) });
    }
    wd.out.events.length = 0;
    wd.out.fires.length = 0;
  });
  if (w.tick >= next) { sample(); next += step * 24; }
}
writeFileSync(outPath, JSON.stringify({ seed, tag: T, from, NUKE_PROGRAMME_INCOME, samples, events }, null, 1));
process.stderr.write(`done: ${outPath}\n`);
