// Critic run 17: carriers in a save: each fleet with a live carrier, its wings aboard, place, the nation's wars.
import { readFileSync } from 'node:fs';
import { size1938, NATIONS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../../tools/headless/assets';
import { liveCarriers } from '../../src/sim/systems/air';
const [seedS, ...files] = process.argv.slice(2);
for (const f of files) {
  const sim = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(size1938(undefined).w) });
  sim.load(new Uint8Array(readFileSync(f)));
  const w = sim.world; const fc = w.formations.cols;
  const aboard = new Map<number, number>();
  for (const [id, base] of w.wingBase) if (base < 0 && w.formations.has(id)) aboard.set(-base, (aboard.get(-base) ?? 0) + 1);
  const tag = (n: number) => NATIONS_1938[n - 1]?.tag ?? `#${n}`;
  const rows: unknown[] = [];
  w.formations.forEach((id) => {
    if (!w.isFleet(id)) return; const k = liveCarriers(w, id); if (!k) return;
    const n = fc.nation[id]!; const wars = w.wars.list.filter((x) => x.sides.some((s) => s.includes(n))).length;
    rows.push({ id, nation: tag(n), carriers: k, wingsAboard: aboard.get(id) ?? 0, x: +fc.x[id]!.toFixed(1), y: +fc.y[id]!.toFixed(1), wars });
  });
  console.log(f, 'tick', w.tick, JSON.stringify(rows));
}
