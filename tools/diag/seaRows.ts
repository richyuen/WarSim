/**
 * PLAN 7.35a: the live sea battles that get no ticker row (critic R9, naval 6: Italy–UK on seed
 * 2251, 25 six-hour samples with a live battle and no row). A battle has a row while two of its
 * fleets at war stand within reach of a ship's weapon of either (`inShipReach`, the snapshot's
 * pair, `worker/server.ts`). From 1938 (or a checkpoint), with `A` declaring war on `D` at once
 * as the critic did, every hour for `days`: each live `SeaBattle` with whether it has such a pair,
 * the ships it sank that hour, and at its end its fleets (nation, template, ships) and, for the
 * hours with no pair, its nearest pair at war (km) and what each of the two could fire with.
 * Since ADR-542 a battle with no pair has a row where its carriers' wings strike (`strikeTarget`):
 * `sunkNoRow` counts the ships sunk in an hour with no row at its start or its end (the AT's
 * figure), `sunkRowGone` those of an hour whose row ended in it (the near fleet sunk whole or
 * broken off). `WHY=1` prints each hour that sank a ship with no row.
 *
 * Usage: npx tsx tools/diag/seaRows.ts <seed> <A> <D> [days = 12] [save.bin | new] [out = .cache/seaRows_<seed>.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938, TAGS_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { elementIndex } from '../../src/sim/systems/elements';
import { fleetDetection, inShipReach, seaKm, strikeTarget } from '../../src/sim/systems/navalCombat';
import type { SeaBattle, World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const A = process.argv[3] ?? 'ITA';
const D = process.argv[4] ?? 'ENG';
const days = Number(process.argv[5] ?? 12);
const bin = process.argv[6] ?? 'new';
const out = process.argv[7] ?? `.cache/seaRows_${seed}_${A}_${D}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
if (bin !== 'new') sim.load(new Uint8Array(readFileSync(bin)));
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const id = (t: string): number => TAGS_1938.indexOf(t) + 1;
if (A !== '-') sim.command({ kind: 'declareWar', attacker: id(A), defender: id(D) });

/** What fleet `f` carries: its live ships by class, its weapons' reach (gun, torpedo), depth charges. */
const kit = (w: World, f: number): { cls: Record<string, number>; gunKm: number; torpKm: number; asw: boolean } => {
  const units = w.rules!.units;
  const ec = w.elements.cols;
  const cls: Record<string, number> = {};
  let gunKm = 0;
  let torpKm = 0;
  let asw = false;
  for (const e of elementIndex(w).get(f) ?? []) {
    if (ec.strength[e]! <= 0) continue;
    const u = units[ec.unit[e]!]!;
    cls[u.cls] = (cls[u.cls] ?? 0) + ec.strength[e]!;
    if (u.hard > 0) gunKm = Math.max(gunKm, u.rangeKm);
    if (u.torpedo > 0) torpKm = Math.max(torpKm, u.torpedoKm);
    if (u.asw > 0) asw = true;
  }
  return { cls, gunKm, torpKm, asw };
};

type Track = { start: number; hours: number; pairHours: number; rowHours: number; sunk: number; sunkNoPair: number; sunkNoRow: number; sunkRowGone: number; prevRow: boolean; lastLost: number; a: string; b: string; x: number; y: number; nearest: { km: number; p: string; q: string }[]; fleets: Set<string> };
const tracks = new Map<SeaBattle, Track>();
/** PLAN 7.41a: at every sixth hour (the critic's samples, `c11_n_seabattles.mjs`), each battle of `A` or `D` and its row: a pair, a carrier strike or none. */
const samples: { h: number; battles: { a: string; b: string; row: 'pair' | 'strike' | 'none'; km: number; reach: string }[] }[] = [];
const done: Track[] = [];
const fleetText = (w: World, f: number): string => {
  const c = w.formations.cols;
  const k = kit(w, f);
  return `${f}:${tag(c.nation[f]!)}:${TEMPLATES_1938[c.template[f]!]?.id ?? c.template[f]}:${JSON.stringify(k.cls)}:gun${k.gunKm}/torp${k.torpKm}${k.asw ? '/asw' : ''}:sees${Math.round(fleetDetection(w, f))}`;
};
for (let t = 0; t < days * 24; t++) {
  sim.step(1, (w) => {
    const c = w.formations.cols;
    for (const rec of w.seaBattles) {
      let tr = tracks.get(rec);
      if (!tr) tracks.set(rec, (tr = { start: w.tick, hours: 0, pairHours: 0, rowHours: 0, sunk: 0, sunkNoPair: 0, sunkNoRow: 0, sunkRowGone: 0, prevRow: false, lastLost: 0, a: tag(rec.a), b: tag(rec.b), x: rec.x, y: rec.y, nearest: [], fleets: new Set() }));
      tr.hours++;
      const live = rec.fleets.filter((f) => w.formations.has(f));
      let pair = false;
      let best = { km: Infinity, p: '', q: '' };
      for (let i = 0; i < live.length; i++)
        for (let j = i + 1; j < live.length; j++) {
          const [f, g] = [live[i]!, live[j]!];
          if (!w.wars.atWar(c.nation[f]!, c.nation[g]!)) continue;
          if (inShipReach(w, f, g)) pair = true;
          const km = seaKm(w, c.x[f]!, c.y[f]!, c.x[g]!, c.y[g]!);
          if (km < best.km) best = { km: Math.round(km * 10) / 10, p: fleetText(w, f), q: fleetText(w, g) };
        }
      for (const f of live) tr.fleets.add(fleetText(w, f).split(':').slice(0, 3).join(':'));
      const lost = rec.lostA + rec.lostB;
      const sunk = lost - tr.lastLost;
      tr.lastLost = lost;
      tr.sunk += sunk;
      // A row (PLAN 7.35a): a pair within a ship's reach, else a carrier's strike.
      const row = pair || strikeTarget(w, live) !== null;
      // A row at the hour's start (the last hour's end) and gone at its end: the fight the row
      // showed ended in the hour (the near fleet sunk whole or broken off), its ships counted apart.
      const had = tr.prevRow;
      tr.prevRow = row;
      if (row) tr.rowHours++;
      else if (had) tr.sunkRowGone += sunk;
      else {
        tr.sunkNoRow += sunk;
        if (sunk > 0 && process.env['WHY']) {
          const kmOf = (f: number, g: number): number => Math.round(seaKm(w, c.x[f]!, c.y[f]!, c.x[g]!, c.y[g]!));
          console.error(`t${w.tick} ${tag(rec.a)}/${tag(rec.b)} sank ${sunk}: ` + live.map((f) => `${fleetText(w, f)} eng${c.engaged[f]} ret${c.retreat[f]} near[${live.filter((g) => w.wars.atWar(c.nation[f]!, c.nation[g]!)).map((g) => `${g}@${kmOf(f, g)}`).join(' ')}]`).join(' | '));
        }
      }
      if (pair) tr.pairHours++;
      else {
        tr.sunkNoPair += sunk;
        if (tr.nearest.length < 3 || tr.hours % 24 === 0) tr.nearest.push(best);
      }
    }
    for (const [rec, tr] of tracks) {
      if (w.seaBattles.includes(rec)) continue;
      // Its last hour's losses (PLAN 7.57: a fleet sunk whole ends the battle in that hour, and
      // until then they were never read): the record's count when it ended, in the hour's row.
      const sunk = rec.lostA + rec.lostB - tr.lastLost;
      tr.sunk += sunk;
      if (tr.prevRow) tr.sunkRowGone += sunk;
      else tr.sunkNoRow += sunk;
      done.push(tr);
      tracks.delete(rec);
    }
    if (w.tick % 6 === 0) {
      const bs = [];
      for (const rec of w.seaBattles) {
        if (![rec.a, rec.b].includes(id(A)) && ![rec.a, rec.b].includes(id(D))) continue;
        const live = rec.fleets.filter((f) => w.formations.has(f));
        let pair = false;
        let best = { km: Infinity, reach: '' };
        for (let i = 0; i < live.length; i++)
          for (let j = i + 1; j < live.length; j++) {
            const [f, g] = [live[i]!, live[j]!];
            if (!w.wars.atWar(c.nation[f]!, c.nation[g]!)) continue;
            if (inShipReach(w, f, g)) pair = true;
            const km = seaKm(w, c.x[f]!, c.y[f]!, c.x[g]!, c.y[g]!);
            if (km < best.km) best = { km: Math.round(km * 10) / 10, reach: `${fleetText(w, f)} | ${fleetText(w, g)} | eng${c.engaged[f]}/${c.engaged[g]} ret${c.retreat[f]}/${c.retreat[g]}` };
          }
        bs.push({ a: tag(rec.a), b: tag(rec.b), row: pair ? ('pair' as const) : strikeTarget(w, live) ? ('strike' as const) : ('none' as const), km: best.km, reach: best.reach });
      }
      if (bs.length > 0) samples.push({ h: w.tick, battles: bs });
    }
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
}
for (const tr of tracks.values()) done.push({ ...tr, start: -tr.start });
const rows = done.map((t) => ({ ...t, fleets: [...t.fleets], nearest: t.nearest.slice(0, 6) }));
const mine = rows.filter((r) => [r.a, r.b].includes(A) || [r.a, r.b].includes(D));
const sum = (rs: typeof rows) => ({
  battles: rs.length,
  hours: rs.reduce((s, r) => s + r.hours, 0),
  hoursNoPair: rs.reduce((s, r) => s + r.hours - r.pairHours, 0),
  neverPair: rs.filter((r) => r.pairHours === 0).length,
  neverPairThatSank: rs.filter((r) => r.pairHours === 0 && r.sunk > 0).length,
  sunk: rs.reduce((s, r) => s + r.sunk, 0),
  sunkNoPair: rs.reduce((s, r) => s + r.sunkNoPair, 0),
  hoursNoRow: rs.reduce((s, r) => s + r.hours - r.rowHours, 0),
  sunkNoRow: rs.reduce((s, r) => s + r.sunkNoRow, 0),
  sunkRowGone: rs.reduce((s, r) => s + r.sunkRowGone, 0),
});
const summary = { seed, A, D, days, all: sum(rows), mine: sum(mine) };
writeFileSync(out, JSON.stringify({ ...summary, rows, samples }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const r of mine.filter((r) => r.rowHours < r.hours)) console.log(JSON.stringify({ a: r.a, b: r.b, start: r.start, hours: r.hours, pairHours: r.pairHours, rowHours: r.rowHours, sunk: r.sunk, sunkNoPair: r.sunkNoPair, sunkNoRow: r.sunkNoRow, fleets: r.fleets, nearest: r.nearest.slice(0, 2) }));
