/**
 * PLAN 7.92 (found at 7.91): `nukePoland1938.test.ts`'s set-up as the test makes it (a strategic bomber
 * group at Warsaw, 10 warheads, Germany's war on Poland), read only: Poland's first decision, launch and
 * burst with their places, the owner and controller of the cell and every nation's men on land within 3
 * cells of it, and the burst's toll.
 *
 * Usage: npx tsx tools/diag/nukePoland5591.ts [seed = 5591]
 */
import { EventKind } from '../../src/shared/events';
import { nukeStrike, nukeToll } from '../../src/shared/history';
import { BUILD_MIX_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../../tests/helpers/earth';
import { nationId } from '../../tests/helpers/sim1938';
const [POL, GER] = ['POL', 'GER'].map(nationId) as [number, number];
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const s = new Sim({ scenario: '1938', seed: Number(process.argv[2] ?? 5591), assets: assets1938(SIZE_1938.w) });
const w = s.world;
const warsaw = w.airbases.find((b) => b.name === 'Warsaw' && w.cells.controller[b.cell] === POL)!;
const [x, y] = w.cellPoint(warsaw.cell);
s.command({ kind: 'spawnWing', nation: POL, x, y, template: BUILD_MIX_1938.wings.strategic });
s.command({ kind: 'grantWarheads', nation: POL, count: 10 });
s.command({ kind: 'declareWar', attacker: GER, defender: POL });
s.step(1);
const around = (px: number, py: number): string => {
  const by = new Map<number, number>();
  const fc = w.formations.cols;
  w.formations.forEach((f) => {
    if (w.offLand(f) || Math.hypot(fc.x[f]! - px, fc.y[f]! - py) > 3) return;
    by.set(fc.nation[f]!, (by.get(fc.nation[f]!) ?? 0) + fc.strength[f]!);
  });
  const cell = Math.floor(py) * w.cells.w + Math.floor(px);
  return `owner ${tag(w.cells.owner[cell]!)} controller ${tag(w.cells.controller[cell]!)}; within 3 cells: ${[...by].map(([n, m]) => `${tag(n)} ${Math.round(m)}`).join(', ')}`;
};
let done = false;
for (let d = 0; d < 120 && !done; d++) {
  s.step(24, (ww) => {
    const ev = ww.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 2] !== POL) continue;
      const k = ev[i + 1];
      if (k === EventKind.NukeDecided) console.log(`day ${d} decided u ${ev[i + 3]! / 1000} at (${ev[i + 4]},${ev[i + 5]}): ${around(ev[i + 4]!, ev[i + 5]!)}`);
      if (k === EventKind.NukeLaunched) console.log(`day ${d} launched to (${ev[i + 4]},${ev[i + 5]})`);
      if (k === EventKind.NukeCasualties) {
        const st = nukeStrike(ev[i + 3]!);
        console.log(`day ${d} burst on ${tag(st.nation)} dead ${st.dead} at (${ev[i + 4]},${ev[i + 5]}): ${around(ev[i + 4]!, ev[i + 5]!)}`);
        done = true;
      }
      if (k === EventKind.NukeToll) console.log(`  toll ${JSON.stringify(nukeToll(ev[i + 3]!))}`);
    }
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
}
