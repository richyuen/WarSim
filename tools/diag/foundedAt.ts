/**
 * PLAN 7.106's measure and AT, from 1938: the founded nations (origin ≠ 0: a revolt's, a
 * collapse's, God Mode's, and one of those revived) by how each was founded, how long it lived,
 * how it ended; at the end, those alive (the AT's figure, bar: at most 0.75 of HEAD's on the same
 * seeds) with their size, wars and overlord; and the land moved in the last five years (the
 * share of land cells whose owner at the end is not the owner five years before; bar: not below
 * 0.9 of HEAD's). Sampled once a day: a nation founded and dead within a day is not seen.
 * Saves the state at years 10, 20, years − 5 and the end beside the output (`<out>_yN.bin`).
 *
 * Usage: npx tsx tools/diag/foundedAt.ts <seed> <years> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { EventKind } from '../../src/shared/events';
import { Terrain } from '../../src/shared/terrain';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const out = process.argv[4] ?? `.cache/foundedAt_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const DAY = 24;

interface Life {
  id: number;
  born: number; // day
  cause: string;
  holder: number; // the nation it rose from (0: unknown)
  holderOrigin: number; // that nation's origin (0: a nation of the start)
  cells0: number; // its cells on its first day seen
  died: number; // day, -1 alive
  end: string; // how it left: annexed, eliminated, puppet (still alive), ''
  peaceWithHolder: number; // day of the first peace between it and its holder, -1 none
  maxCells: number;
  revolts: number; // revolts (RevoltSpawned) that joined it after its founding
}
const lives: Life[] = [];
const current = new Map<number, Life>();
// The day's events, by kind: [a, b] pairs.
let dayEvents: number[] = [];
const kindName = new Map<number, string>(Object.entries(EventKind).map(([k, v]) => [v as number, k]));
const kinds = new Set<number>([EventKind.RevoltSpawned, EventKind.NationRevived, EventKind.NationCollapsed, EventKind.NationSpawned, EventKind.NationEliminated, EventKind.NationAnnexed, EventKind.PeaceSigned, EventKind.PuppetCreated]);
const counts = new Map<string, number>();
let land = 0;
for (let c = 0; c < w.cells.terrain.length; c++) if (w.cells.terrain[c] !== Terrain.Water) land++;
let owner25: Uint16Array | Uint32Array | null = null;

for (let day = 0; day < years * 365; day++) {
  dayEvents = [];
  s.step(DAY, (ww) => {
    const e = ww.out.events;
    for (let i = 0; i < e.length; i += 6) {
      const k = e[i + 1]!;
      if (kinds.has(k)) dayEvents.push(k, e[i + 2]!, e[i + 3]!);
    }
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  const nc = w.nations.cols;
  const ev = (k: number, a: number): number | undefined => {
    for (let i = 0; i < dayEvents.length; i += 3) if (dayEvents[i] === k && dayEvents[i + 1] === a) return dayEvents[i + 2];
    return undefined;
  };
  for (let i = 0; i < dayEvents.length; i += 3) {
    const k = dayEvents[i]!;
    counts.set(kindName.get(k)!, (counts.get(kindName.get(k)!) ?? 0) + 1);
    const a = dayEvents[i + 1]!;
    const b = dayEvents[i + 2]!;
    if (k === EventKind.RevoltSpawned && current.has(a)) current.get(a)!.revolts++;
    if (k === EventKind.PeaceSigned) {
      for (const [x, y] of [
        [a, b],
        [b, a],
      ]) {
        const l = current.get(x!);
        if (l && l.holder === y && l.peaceWithHolder < 0) l.peaceWithHolder = day;
      }
    }
  }
  // Deaths.
  for (const [id, l] of current) {
    if (w.nations.has(id) && nc.living[id] === 1 && nc.origin[id] !== 0) {
      l.maxCells = Math.max(l.maxCells, nc.cells[id]!);
      continue;
    }
    l.died = day;
    l.end = ev(EventKind.NationAnnexed, id) !== undefined ? 'annexed' : ev(EventKind.NationEliminated, id) !== undefined ? 'eliminated' : 'gone';
    current.delete(id);
  }
  // Births.
  w.nations.forEach((id) => {
    if (nc.living[id] !== 1 || nc.origin[id] === 0 || current.has(id)) return;
    const revived = ev(EventKind.NationRevived, id) !== undefined;
    const spawnedBy = ev(EventKind.RevoltSpawned, id);
    const god = ev(EventKind.NationSpawned, id);
    const holder = spawnedBy ?? god ?? 0;
    let cause = revived ? 'revival' : god !== undefined ? 'god' : spawnedBy !== undefined ? 'revolt' : day === 0 ? 'start' : 'unseen';
    if (cause === 'revolt' && ev(EventKind.NationCollapsed, holder) !== undefined) cause = 'collapse';
    const l: Life = { id, born: day, cause, holder, holderOrigin: holder > 0 && w.nations.has(holder) ? nc.origin[holder]! : 0, cells0: nc.cells[id]!, died: -1, end: '', peaceWithHolder: -1, maxCells: nc.cells[id]!, revolts: 0 };
    lives.push(l);
    current.set(id, l);
  });
  if (day === (years - 5) * 365 - 1) owner25 = w.cells.owner.slice();
  const y = (day + 1) / 365;
  if ((day + 1) % 365 === 0) {
    process.stderr.write(`${seed} year ${y}: founded alive ${current.size}, founded so far ${lives.length}\n`);
    if (y === 10 || y === 20 || y === years - 5 || y === years) writeFileSync(out.replace(/\.json$/, `_y${y}.bin`), s.save());
  }
}

const nc = w.nations.cols;
let moved = 0;
for (let c = 0; c < w.cells.owner.length; c++) if (w.cells.terrain[c] !== Terrain.Water && owner25 && owner25[c] !== w.cells.owner[c]) moved++;
let living = 0;
w.nations.forEach((n) => {
  if (nc.living[n] === 1) living++;
});
const alive = [...current.values()].map((l) => ({
  ...l,
  cells: nc.cells[l.id]!,
  overlord: nc.overlord[l.id]!,
  wars: w.wars.list.filter((war) => war.sides[0].includes(l.id) || war.sides[1].includes(l.id)).length,
  atWarWithHolder: l.holder > 0 && w.wars.atWar(l.id, l.holder),
  holderAlive: l.holder > 0 && w.nations.has(l.holder) && nc.living[l.holder] === 1,
  ageYears: (years * 365 - l.born) / 365,
}));
const byCause = (ls: Life[]): Record<string, number> => {
  const r: Record<string, number> = {};
  for (const l of ls) r[l.cause] = (r[l.cause] ?? 0) + 1;
  return r;
};
const summary = {
  seed,
  years,
  living,
  foundedAlive: alive.length,
  aliveByCause: byCause(alive),
  foundedEver: lives.length,
  everByCause: byCause(lives),
  aliveAtPeaceWithHolder: alive.filter((l) => l.peaceWithHolder >= 0).length,
  alivePuppets: alive.filter((l) => l.overlord !== 0).length,
  aliveUnder50Cells: alive.filter((l) => l.cells < 50).length,
  movedLast5: moved / land,
  events: Object.fromEntries(counts),
};
writeFileSync(out, JSON.stringify({ summary, alive, lives }, null, 1));
console.log(`done: ${seed} founded alive ${alive.length} of ${living} living (${JSON.stringify(summary.aliveByCause)}); ever ${lives.length}; land moved in the last 5 years ${(100 * summary.movedLast5).toFixed(1)} %`);
