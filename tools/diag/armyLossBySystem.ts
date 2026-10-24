/**
 * PLAN 7.110a: which system takes the land army's men. From a saved state, for `days` days, each
 * system of the tick is wrapped (as `Sim.profile` wraps them: the game is the same game) and the
 * strength of every land formation (not a fleet or a wing) of a living nation at war is read before
 * and after it: the men lost in it and the formations gone in it are put down to that system, split
 * by whether the formation was engaged before it.
 *
 * Usage: npx tsx tools/diag/armyLossBySystem.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3]);
type Tally = { menEngaged: number; menFree: number; goneEngaged: number; goneFree: number };
const all = new Map<string, Tally>();
const rows: unknown[] = [];
for (const a of process.argv.slice(4)) {
  const [seedS, bin] = a.split(':');
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(bin!)));
  const per = new Map<string, Tally>();
  // The systems and their names are private: read and replaced as `profile` does.
  const inner = s as unknown as { systems: readonly ((w: World) => void)[]; systemNames: readonly string[] };
  const names = inner.systemNames;
  inner.systems = inner.systems.map((sys, i) => (world: World) => {
    const atWar = world.wars.nations();
    const c = world.formations.cols;
    const before = new Map<number, { men: number; engaged: boolean }>();
    world.formations.forEach((id) => {
      if (world.isFleet(id) || world.isWing(id) || !atWar.has(c.nation[id]!) || world.nations.cols.living[c.nation[id]!] !== 1) return;
      before.set(id, { men: c.strength[id]!, engaged: c.engaged[id] === 1 });
    });
    sys(world);
    const t = per.get(names[i]!) ?? { menEngaged: 0, menFree: 0, goneEngaged: 0, goneFree: 0 };
    for (const [id, b] of before) {
      const gone = !world.formations.has(id);
      const d = b.men - (gone ? 0 : c.strength[id]!);
      if (d <= 0 && !gone) continue;
      if (b.engaged) {
        t.menEngaged += Math.max(0, d);
        if (gone) t.goneEngaged++;
      } else {
        t.menFree += Math.max(0, d);
        if (gone) t.goneFree++;
      }
    }
    per.set(names[i]!, t);
  });
  s.step(days * 24, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  const sorted = [...per].filter(([, t]) => t.menEngaged + t.menFree + t.goneEngaged + t.goneFree > 0).sort((x, y) => y[1].menEngaged + y[1].menFree - (x[1].menEngaged + x[1].menFree));
  rows.push({ seed: Number(seedS), bin, days, per: Object.fromEntries(sorted.map(([k, t]) => [k, { ...t, menEngaged: Math.round(t.menEngaged), menFree: Math.round(t.menFree) }])) });
  for (const [k, t] of per) {
    const e = all.get(k) ?? { menEngaged: 0, menFree: 0, goneEngaged: 0, goneFree: 0 };
    e.menEngaged += t.menEngaged;
    e.menFree += t.menFree;
    e.goneEngaged += t.goneEngaged;
    e.goneFree += t.goneFree;
    all.set(k, e);
  }
  process.stderr.write(`${seedS} ${bin}: ${sorted.map(([k, t]) => `${k} ${Math.round(t.menEngaged)}+${Math.round(t.menFree)} men, ${t.goneEngaged}+${t.goneFree} gone`).join('; ')}\n`);
}
const total = [...all].filter(([, t]) => t.menEngaged + t.menFree + t.goneEngaged + t.goneFree > 0).sort((x, y) => y[1].menEngaged + y[1].menFree - (x[1].menEngaged + x[1].menFree));
writeFileSync(out, JSON.stringify({ total: Object.fromEntries(total), rows }, null, 1));
console.log(`done: ${total.map(([k, t]) => `${k} ${Math.round(t.menEngaged)}+${Math.round(t.menFree)} men, ${t.goneEngaged}+${t.goneFree} gone`).join('; ')} (engaged+free)`);
