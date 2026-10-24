/**
 * PLAN 7.86 (critic run 12: bursts on the same 24 seeds 188 → 497): what raised the bursts, as
 * bursts = (days a nation held warheads and was at war) × (bursts a day of it). The first factor is
 * the volume (more wars, more warheads); the second is the rule. Read per seed from 1938, once a day.
 *
 * Only APIs that `dd3b730` has too (`world.warheads`, `world.wars.list`, the event stream), so the
 * same file runs in a worktree of it.
 *
 * Per seed: the bursts (`NukeCasualties`), the decisions (`NukeDecided`), each burst's dead and men
 * (`NukeToll`) and `civOver10x` as the critic counts it (civilians = dead − men; a burst counts when
 * its civilians are over ten times its men, or it killed civilians and no men); the wars declared;
 * nation-days at war; holder-days (stock ≥ 1), holder-war-days (stock ≥ 1 and at war) and the stock
 * summed over those days; warheads built (each day's rise of a stock); and the same by 10-year third.
 *
 * PLAN 7.109b: each burst's `back`, whether it was a strike back (its striker held a grievance at the
 * hour of its decision: launches of a striker are matched to its bursts in order, a stopped one
 * taken off), and `backCiv`, the strikes back among `civOver10x`.
 *
 * Usage: npx tsx tools/diag/nukeVolume.ts <seed> <years> [out.json]
 */
import { writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { nukeStrike, nukeToll } from '../../src/shared/history';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const out = process.argv[4] ?? `.cache/nukeVolume_${seed}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
const w = sim.world;

type Third = { bursts: number; decided: number; civOver10x: number; backs: number; backCiv: number; wars: number; warDays: number; holderDays: number; holderWarDays: number; stockWarDays: number; built: number };
const third = (): Third => ({ bursts: 0, decided: 0, civOver10x: 0, backs: 0, backCiv: 0, wars: 0, warDays: 0, holderDays: 0, holderWarDays: 0, stockWarDays: 0, built: 0 });
const thirds: Third[] = [third(), third(), third()];
const bursts: { year: number; by: number; on: number; yieldN: number; dead: number; men: number; back: boolean }[] = [];
// Each striker's launches in flight, in order: whether each is a strike back.
const inFlight = new Map<number, boolean[]>();
let pending: (typeof bursts)[number] | undefined;
const lastStock = new Map<number, number>();
const holders = new Set<number>();
const T = years * 365 * 24;
const t0 = performance.now();

while (w.tick < T) {
  const avenging = new Set(w.nukeGrievance.keys());
  sim.step(1, (world) => {
    const k = Math.min(2, Math.floor(world.tick / (8760 * 10)));
    const ev = world.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      const kind = ev[i + 1]!;
      if (kind === EventKind.WarDeclared) thirds[k]!.wars++;
      else if (kind === EventKind.NukeDecided) {
        thirds[k]!.decided++;
        const by = ev[i + 2]!;
        inFlight.set(by, [...(inFlight.get(by) ?? []), avenging.has(by)]);
      } else if (kind === EventKind.NukeIntercepted) inFlight.get(ev[i + 2]!)?.shift();
      else if (kind === EventKind.NukeCasualties) {
        const s = nukeStrike(ev[i + 3]!);
        const back = ev[i + 2]! !== 0 && (inFlight.get(ev[i + 2]!)?.shift() ?? false);
        pending = { year: +(world.tick / 8760).toFixed(2), by: ev[i + 2]!, on: s.nation, yieldN: s.yieldN, dead: s.dead, men: 0, back };
        bursts.push(pending);
        thirds[k]!.bursts++;
        if (back) thirds[k]!.backs++;
      } else if (kind === EventKind.NukeToll && pending) {
        pending.men = nukeToll(ev[i + 3]!).men;
        const civ = pending.dead - pending.men;
        if ((pending.men === 0 && civ > 0) || civ > 10 * pending.men) {
          thirds[k]!.civOver10x++;
          if (pending.back) thirds[k]!.backCiv++;
        }
        pending = undefined;
      }
    }
    // The reader clears the buffer (`Sim.step` leaves it to its consumer), or the next hour reads it again.
    world.out.events.length = 0;
    world.out.fires.length = 0;
  });
  if (w.tick % 24 !== 0) continue;
  const k = Math.min(2, Math.floor((w.tick - 1) / (8760 * 10)));
  const th = thirds[k]!;
  const atWar = new Set<number>();
  for (const war of w.wars.list) for (const side of war.sides) for (const n of side) atWar.add(n);
  th.warDays += atWar.size;
  for (const [n, h] of w.warheads) {
    const was = lastStock.get(n) ?? 0;
    if (h.stock > was) th.built += h.stock - was;
    lastStock.set(n, h.stock);
    if (h.stock < 1) continue;
    holders.add(n);
    th.holderDays++;
    if (atWar.has(n)) {
      th.holderWarDays++;
      th.stockWarDays += h.stock;
    }
  }
  if (w.tick % (8760 * 5) === 0) process.stderr.write(`seed ${seed} year ${w.tick / 8760} bursts ${bursts.length} ${((performance.now() - t0) / 1000).toFixed(0)} s\n`);
}

const sum = (f: (t: Third) => number): number => thirds.reduce((a, t) => a + f(t), 0);
const total: Third = { bursts: sum((t) => t.bursts), decided: sum((t) => t.decided), civOver10x: sum((t) => t.civOver10x), backs: sum((t) => t.backs), backCiv: sum((t) => t.backCiv), wars: sum((t) => t.wars), warDays: sum((t) => t.warDays), holderDays: sum((t) => t.holderDays), holderWarDays: sum((t) => t.holderWarDays), stockWarDays: sum((t) => t.stockWarDays), built: sum((t) => t.built) };
writeFileSync(out, JSON.stringify({ seed, years, total, thirds, holders: holders.size, bursts }, null, 1));
process.stderr.write(`done: seed ${seed} bursts ${total.bursts} holderWarDays ${total.holderWarDays} ${((performance.now() - t0) / 1000).toFixed(0)} s\n`);
