/**
 * PLAN 7.31: the sea battles that sink nothing (critic R9-B1). From a checkpoint, for `days`, every
 * `SeaBattle` row with what ended it: the fleets that broke off in its hour (`FormationRetreated`
 * of a fleet of either side), each with its template, whether it has a weapon (a gun, torpedoes or
 * depth charges), and the nearest fleet of the other side (km, same basin or not). Rows are
 * grouped by pair and place, with their losses, and by cause:
 * - `weaponlessBroke`: a fleet with no weapon broke off in the row's hour (the rule `reachOf(id)
 *   === 0 && theirs > 0`), and nothing was sunk;
 * - `zeroOther`: nothing sunk, no weaponless fleet broke off (contact lost, or a side broke off by
 *   its losses);
 * - `sank`: a ship lost.
 * Also the battles that stood more than a day (`long`: hours, ships lost), to see one that cannot
 * close (no sea way) and stands, engaged, with nothing sunk.
 *
 * Usage: npx tsx tools/diag/seaPhantom.ts <seed> <save.bin | new> [days = 120] [out = .cache/seaPhantom_<seed>.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { SIDE_SHIPS } from '../../src/shared/history';
import { size1938, TAGS_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { elementIndex } from '../../src/sim/systems/elements';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { basinOf, seaOf } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const bin = process.argv[3]!;
const days = Number(process.argv[4] ?? 120);
const out = process.argv[5] ?? `.cache/seaPhantom_${seed}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
if (bin !== 'new') sim.load(new Uint8Array(readFileSync(bin)));
const w = sim.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;

const armed = (id: number): boolean => {
  const units = w.rules!.units;
  const ec = w.elements.cols;
  for (const e of elementIndex(w).get(id) ?? []) {
    if (ec.strength[e]! <= 0) continue;
    const u = units[ec.unit[e]!]!;
    if ((u.hard > 0 && u.rangeKm > 0) || (u.torpedo > 0 && u.torpedoKm > 0) || u.asw > 0) return true;
  }
  return false;
};
const basinAt = (id: number): number => {
  const c = w.formations.cols;
  const cell = Math.floor(c.y[id]!) * w.cells.w + Math.floor(c.x[id]!);
  return basinOf(w).basin[seaOf(w).zoneOf[cell]!] ?? -1;
};

type Row = { tick: number; a: string; b: string; lostA: number; lostB: number; x: number; y: number; cause: string; broke: { id: number; nation: string; template: string; armed: boolean; nearestKm: number; nearestArmed: boolean; sameBasin: boolean }[] };
const rows: Row[] = [];
const age = new Map<object, number>();
const long: { tick: number; a: string; b: string; hours: number; lost: number; x: number; y: number }[] = [];
for (let t = 0; t < days * 24; t++) {
  sim.step(1, (world) => {
    const e = world.out.events;
    const broke: Row['broke'] = [];
    const c = world.formations.cols;
    for (let i = 0; i < e.length; i += 6) {
      if (e[i + 1] !== EventKind.FormationRetreated) continue;
      const id = e[i + 2]!;
      if (!world.formations.has(id) || !world.isFleet(id)) continue;
      // The nearest fleet at war with it.
      let nd = Infinity;
      let nid = 0;
      world.formations.forEach((o) => {
        if (!world.isFleet(o) || !world.wars.atWar(c.nation[id]!, c.nation[o]!)) return;
        const d = seaKm(world, c.x[id]!, c.y[id]!, c.x[o]!, c.y[o]!);
        if (d < nd) [nd, nid] = [d, o];
      });
      broke.push({ id, nation: tag(c.nation[id]!), template: TEMPLATES_1938[c.template[id]!]?.id ?? `#${c.template[id]!}`, armed: armed(id), nearestKm: Math.round(nd), nearestArmed: nid > 0 && armed(nid), sameBasin: nid > 0 && basinAt(id) === basinAt(nid) });
    }
    for (let i = 0; i < e.length; i += 6) {
      if (e[i + 1] !== EventKind.SeaBattle) continue;
      const A = e[i + 2]!;
      const B = e[i + 3]!;
      const r: Row = { tick: world.tick, a: tag(A % SIDE_SHIPS), b: tag(B % SIDE_SHIPS), lostA: Math.floor(A / SIDE_SHIPS), lostB: Math.floor(B / SIDE_SHIPS), x: e[i + 4]!, y: e[i + 5]!, cause: '', broke: broke.filter((f) => f.nation === tag(A % SIDE_SHIPS) || f.nation === tag(B % SIDE_SHIPS)) };
      r.cause = r.lostA + r.lostB > 0 ? 'sank' : r.broke.some((f) => !f.armed) ? 'weaponlessBroke' : 'zeroOther';
      rows.push(r);
    }
    const live = new Set<object>(world.seaBattles);
    for (const [rec, h] of age) {
      if (live.has(rec)) continue;
      const r = rec as (typeof world.seaBattles)[number];
      if (h > 24) long.push({ tick: world.tick, a: tag(r.a), b: tag(r.b), hours: h, lost: r.lostA + r.lostB, x: r.x, y: r.y });
      age.delete(rec);
    }
    for (const rec of world.seaBattles) age.set(rec, (age.get(rec) ?? 0) + 1);
    e.length = 0;
    world.out.fires.length = 0;
  });
}
for (const [rec, h] of age) {
  const r = rec as (typeof w.seaBattles)[number];
  if (h > 24) long.push({ tick: -1, a: tag(r.a), b: tag(r.b), hours: h, lost: r.lostA + r.lostB, x: r.x, y: r.y });
}
const causes: Record<string, number> = {};
const places: Record<string, { n: number; zero: number; causes: Record<string, number>; templates: Record<string, number> }> = {};
for (const r of rows) {
  causes[r.cause] = (causes[r.cause] ?? 0) + 1;
  const k = `${r.a}/${r.b}@${r.x},${r.y}`;
  const p = (places[k] ??= { n: 0, zero: 0, causes: {}, templates: {} });
  p.n++;
  if (r.lostA + r.lostB === 0) p.zero++;
  p.causes[r.cause] = (p.causes[r.cause] ?? 0) + 1;
  for (const f of r.broke) p.templates[`${f.nation}:${f.template}${f.armed ? '' : '(unarmed)'}`] = (p.templates[`${f.nation}:${f.template}${f.armed ? '' : '(unarmed)'}`] ?? 0) + 1;
}
const zero = rows.filter((r) => r.lostA + r.lostB === 0).length;
const summary = { seed, bin, days, n: rows.length, zero, causes, long: long.length, longNoLoss: long.filter((l) => l.lost === 0).length, longest: long.sort((p, q) => q.hours - p.hours).slice(0, 8), places: Object.fromEntries(Object.entries(places).sort((p, q) => q[1].n - p[1].n).slice(0, 25)) };
writeFileSync(out, JSON.stringify({ ...summary, rows: rows.slice(0, 300) }, null, 1));
console.log(JSON.stringify(summary, null, 1));
