/**
 * PLAN 7.100's read: where the walk-ins of years FROM–N come from, from 1938. A walk-in is a cell
 * flipped by the territory system with no formation of the holder's side pressing on it
 * (`FlipCause.walkIn`: defence at GARRISON). The world's `setController` is wrapped on the instance
 * (the tool's, not the sim's: the state and its hash are as without it), and each walk-in of years
 * FROM–N is classed, at the end of its hour:
 * - the loser (the old controller): founded (a revolt's or a revival's, `people` set or not of the
 *   scenario) or of the scenario; a puppet or not; its owned cells; its own land formations;
 * - the cell: the loser's own land, the taker's own (taken back), another's (given back to a living
 *   owner not at war with the taker: liberation) or a third's held by the loser;
 * - the cell's last change before this one: its cause and how long ago;
 * - the defence: the land formations of the loser's side (its bloc, or on its side in a war),
 *   aboard ones left out: none at all, none on the cell's landmass, else the nearest on it by
 *   distance, and what that nearest one was doing;
 * - the pair (taker, loser).
 * Battles (`FlipCause.battle`) of the same years are counted by year beside them. With `--save10`
 * the state at the start of year FROM is written (a checkpoint for the rule's A/B).
 *
 * With `--load` it starts from a checkpoint (one `--save10` wrote) and counts from its year on.
 *
 * Usage: npx tsx tools/diag/walkIns.ts <seed> <years> <out.json> [--save10 <file.bin>] [--load <file.bin>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { blocOf } from '../../src/sim/systems/supply';
import { FlipCause, type FlipCauseId, navOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const FROM = 10;
const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const out = process.argv[4] ?? `.cache/walkIns_${seed}.json`;
const saveAt = process.argv.indexOf('--save10');
const save10 = saveAt > 0 ? process.argv[saveAt + 1] : undefined;
const loadAt = process.argv.indexOf('--load');
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
if (loadAt > 0) s.load(new Uint8Array(readFileSync(process.argv[loadAt + 1]!)));
const w = s.world;
const firstYear = Math.floor(w.tick / (365 * 24)) + 1;
const tag = (n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;
const causeName = Object.fromEntries(Object.entries(FlipCause).map(([k, v]) => [v, k])) as Record<number, string>;
const quiet = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};

const { w: cw, controller: ctl, owner } = w.cells;
const loop = w.settings.loopingMap;
const lastCause = new Uint8Array(ctl.length).fill(255);
const lastTick = new Uint32Array(ctl.length);
type Walk = { cell: number; taker: number; loser: number; o: number; prevCause: number; prevAge: number };
let pending: Walk[] = [];
let counting = false;
const orig = w.setController.bind(w);
w.setController = (i: number, nation: number, keepFrontier = false, cause: FlipCauseId = FlipCause.other): void => {
  const was = ctl[i]!;
  if (counting && cause === FlipCause.walkIn && was !== 0)
    pending.push({ cell: i, taker: nation, loser: was, o: owner[i]!, prevCause: lastCause[i]!, prevAge: w.tick - lastTick[i]! });
  orig(i, nation, keepFrontier, cause);
  if (ctl[i] !== was) {
    lastCause[i] = cause;
    lastTick[i] = w.tick;
  }
};

const tally = new Map<string, Map<string, number>>();
const add = (table: string, key: string, n = 1): void => {
  let t = tally.get(table);
  if (!t) tally.set(table, (t = new Map()));
  t.set(key, (t.get(key) ?? 0) + n);
};
const bucket = (v: number, edges: number[], names: string[]): string => {
  for (let i = 0; i < edges.length; i++) if (v < edges[i]!) return names[i]!;
  return names[edges.length]!;
};
const enemies = (d: number): number => {
  const e = new Set<number>();
  for (const war of w.wars.list) {
    const i = war.sides[0].includes(d) ? 1 : war.sides[1].includes(d) ? 0 : -1;
    if (i >= 0) for (const n of war.sides[i as 0 | 1]) e.add(n);
  }
  return e.size;
};
const founded = (n: number): boolean => w.nations.cols.people[n] !== 0 || n > TAGS_1938.length;

/** The hour's walk-ins, classed against the formations as they stand at its end. */
function classify(): void {
  const nat = w.nations.cols;
  const c = w.formations.cols;
  const comp = navOf(w).grid.component;
  const land: { n: number; x: number; y: number; id: number }[] = [];
  const own = new Map<number, number>();
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id)) return;
    const n = c.nation[id]!;
    own.set(n, (own.get(n) ?? 0) + 1);
    if (!w.offLand(id)) land.push({ n, x: c.x[id]!, y: c.y[id]!, id });
  });
  const sides = new Map<number, typeof land>();
  const sideOf = (d: number): typeof land => {
    let l = sides.get(d);
    if (l) return l;
    const bd = blocOf(w, d);
    l = land.filter((f) => f.n === d || blocOf(w, f.n) === bd || w.wars.sameSide(f.n, d));
    sides.set(d, l);
    return l;
  };
  for (const p of pending) {
    const d = p.loser;
    add('loser', `${founded(d) ? 'founded' : 'scenario'}${nat.overlord[d] !== 0 ? ' puppet' : ''}`);
    add('loserCells', bucket(nat.cells[d]!, [1000, 10000, 50000], ['<1k', '1k-10k', '10k-50k', '50k+']));
    add('loserArmy', bucket(own.get(d) ?? 0, [1, 5, 20, 60], ['0', '1-4', '5-19', '20-59', '60+']));
    add('taker', founded(p.taker) ? 'founded' : 'scenario');
    const now = ctl[p.cell]!;
    add('cell', p.o === d ? "loser's own" : p.o === p.taker ? "taker's own (taken back)" : now === p.o ? 'given back to its owner' : "a third's, held by the loser");
    const prev = p.prevCause === 255 ? 'none since 1938' : causeName[p.prevCause]!;
    const age = p.prevCause === 255 ? '' : ` ${bucket(p.prevAge / 24, [30, 365], ['<30d', '30d-1y', '>1y'])}`;
    add('lastChange', prev + age);
    add('pair', `${tag(p.taker)} on ${tag(d)}`);
    // The defence: the loser's side's land formations.
    const x = (p.cell % cw) + 0.5;
    const y = Math.floor(p.cell / cw) + 0.5;
    const mass = comp[p.cell]!;
    const side = sideOf(d);
    let best = Infinity;
    let near = -1;
    for (const f of side) {
      const fc = Math.floor(f.y) * cw + Math.floor(f.x);
      if (comp[fc] !== mass) continue;
      let dx = Math.abs(f.x - x);
      if (loop && dx > cw / 2) dx = cw - dx;
      const dist = Math.hypot(dx, f.y - y) / w.sizeScale;
      if (dist < best) {
        best = dist;
        near = f.id;
      }
    }
    const army = bucket(own.get(d) ?? 0, [5, 20], ['0-4', '5-19', '20+']);
    add('loserWars', `${army}: at war with ${bucket(enemies(d), [2, 4], ['1', '2-3', '4+'])}`);
    let defence: string;
    if (side.length === 0) defence = 'no land formation on its side';
    else if (near < 0) defence = 'none on the landmass';
    else {
      defence = bucket(best, [3, 6, 15, 40], ['nearest <3', 'nearest 3-6', 'nearest 6-15', 'nearest 15-40', 'nearest 40+']);
      const st =
        c.engaged[near] === 1
          ? 'engaged'
          : c.retreat[near]! > 0
            ? 'retreat'
            : c.moving[near] === 1
              ? w.wars.atWar(c.nation[near]!, ctl[c.targetCell[near]!]!)
                ? 'marching on an enemy cell'
                : 'marching to its side'
              : 'standing';
      add('nearestDoing', `${best < 15 ? '<15' : '15+'} ${st}`);
      if (best >= 15 && best < 60 && st === 'marching on an enemy cell') add('nearestAttacking', ctl[c.targetCell[near]!] === p.taker ? 'the taker' : 'another enemy');
    }
    add('armyByDefence', `${army}: ${side.length === 0 ? 'no side army' : near < 0 ? 'none on the landmass' : best < 15 ? '<15' : best < 60 ? '15-60 (deploy range)' : '60+'}`);
    add('defence', defence);
    add('defenceByLoser', `${founded(d) ? 'founded' : 'scenario'}: ${defence}`);
  }
  pending = [];
}

const perYear: { year: number; walkIn: number; battle: number; revolt: number; peace: number }[] = [];
let last = Float64Array.from(w.flipsBy);
if (firstYear > 1) counting = true;
for (let y = firstYear; y <= years; y++) {
  if (y === FROM && firstYear === 1) {
    counting = true;
    if (save10) writeFileSync(save10, s.save());
  }
  for (let hr = 0; hr < 365 * 24; hr++) {
    s.step(1, quiet);
    if (pending.length) classify();
  }
  const d = (k: number): number => w.flipsBy[k]! - last[k]!;
  perYear.push({ year: y, walkIn: d(FlipCause.walkIn), battle: d(FlipCause.battle), revolt: d(FlipCause.revolt), peace: d(FlipCause.peace) });
  last = Float64Array.from(w.flipsBy);
  const r = perYear[perYear.length - 1]!;
  process.stderr.write(`${seed} year ${y}: walk-in ${r.walkIn}, battle ${r.battle}, revolt ${r.revolt}, peace ${r.peace}\n`);
}
const tables: Record<string, [string, number][]> = {};
for (const [k, t] of tally) tables[k] = [...t].sort((a, b) => b[1] - a[1]).slice(0, k === 'pair' ? 25 : 40);
const walks = [...(tally.get('loser') ?? new Map<string, number>()).values()].reduce((a, b) => a + b, 0);
writeFileSync(out, JSON.stringify({ seed, years, from: FROM, walks, perYear, tables }, null, 1));
console.log(`done: ${seed} walk-ins in years ${FROM}-${years}: ${walks} -> ${out}`);
