/**
 * PLAN 7.110a: where the land army's men go. From a saved state, hour by hour for `days` days: for
 * each land formation (not a fleet or a wing) of a living nation, the men it lost in the hour
 * (strength before less after), put down to:
 * - combat: engaged before or after the hour;
 * - supply: not engaged, its supply at 0 after the hour (attrition, `supply.ts`);
 * - other: not engaged, in supply (desertion of a bankrupt nation, bombing, a nuclear burst, ...);
 * and a formation gone in the hour, with its last strength: `nation` (its nation died in the hour),
 * `disbanded` (its nation's `FormationsDisbanded` in the hour), `sea` (off land before it: lost
 * aboard), else as above by its flags before the hour. And the men and formations raised
 * (`FormationSpawned` of a land formation). All split by whether the nation was at war at the
 * hour's start (`wars.nations()`).
 *
 * Usage: npx tsx tools/diag/armyLosses.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const KEYS = ['combat', 'supply', 'other', 'nation', 'disbanded', 'sea'] as const;
type Key = (typeof KEYS)[number];
const rows: unknown[] = [];
for (const a of process.argv.slice(4)) {
  const [seedS, bin] = a.split(':');
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(bin!)));
  const w = s.world;
  const lost = { war: Object.fromEntries(KEYS.map((k) => [k, 0])) as Record<Key, number>, peace: Object.fromEntries(KEYS.map((k) => [k, 0])) as Record<Key, number> };
  const gone = { war: Object.fromEntries(KEYS.map((k) => [k, 0])) as Record<Key, number>, peace: Object.fromEntries(KEYS.map((k) => [k, 0])) as Record<Key, number> };
  const raised = { war: { f: 0, men: 0 }, peace: { f: 0, men: 0 } };
  const prev = new Map<number, { men: number; engaged: boolean; offLand: boolean; nation: number }>();
  const snap = (ww: World): void => {
    prev.clear();
    const c = ww.formations.cols;
    ww.formations.forEach((id) => {
      if (ww.isFleet(id) || ww.isWing(id) || ww.nations.cols.living[c.nation[id]!] !== 1) return;
      prev.set(id, { men: c.strength[id]!, engaged: c.engaged[id] === 1, offLand: ww.offLand(id), nation: c.nation[id]! });
    });
  };
  let atWar: ReturnType<typeof w.wars.nations>;
  const spawned = new Set<number>();
  const disbandedBy = new Set<number>();
  const quiet = (ww: World): void => {
    const e = ww.out.events;
    for (let i = 0; i < e.length; i += 6) {
      if (e[i + 1] === EventKind.FormationSpawned) spawned.add(e[i + 2]!);
      else if (e[i + 1] === EventKind.FormationsDisbanded) disbandedBy.add(e[i + 2]!);
    }
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  snap(w);
  let hours = 0;
  let atWarFormationHours = 0;
  for (let h = 0; h < days * 24; h++) {
    atWar = w.wars.nations();
    spawned.clear();
    disbandedBy.clear();
    s.step(1, quiet);
    hours++;
    const c = w.formations.cols;
    const nat = w.nations.cols;
    for (const [id, p] of prev) {
      const side = atWar.has(p.nation) ? 'war' : 'peace';
      if (side === 'war') atWarFormationHours++;
      if (!w.formations.has(id) || c.nation[id] !== p.nation) {
        const k: Key = nat.living[p.nation] !== 1 ? 'nation' : disbandedBy.has(p.nation) ? 'disbanded' : p.offLand ? 'sea' : p.engaged ? 'combat' : 'other';
        lost[side][k] += p.men;
        gone[side][k]++;
        continue;
      }
      const d = p.men - c.strength[id]!;
      if (d <= 0) continue;
      const k: Key = p.engaged || c.engaged[id] === 1 ? 'combat' : c.supply[id] === 0 ? 'supply' : 'other';
      lost[side][k] += d;
    }
    for (const id of spawned) {
      if (!w.formations.has(id) || w.isFleet(id) || w.isWing(id)) continue;
      const side = atWar.has(c.nation[id]!) ? 'war' : 'peace';
      raised[side].f++;
      raised[side].men += c.strength[id]!;
    }
    snap(w);
  }
  const row = { seed: Number(seedS), bin, days, lost, gone, raised, atWarFormations: atWarFormationHours / hours };
  rows.push(row);
  const fmt = (r: Record<Key, number>): string => KEYS.map((k) => `${k} ${Math.round(r[k])}`).join(', ');
  process.stderr.write(`${seedS} ${bin}: at war lost ${fmt(lost.war)}; gone ${fmt(gone.war)}; raised ${raised.war.f} (${raised.war.men}); at peace lost ${fmt(lost.peace)}; raised ${raised.peace.f} (${raised.peace.men})\n`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`done: ${rows.length} saves`);
