import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from './earth';

/** PLAN 1.26 AT: 10 peaceful 1938 years on `seed`: no AI nation goes bankrupt. */
export function econSweep(seed: number): void {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  // Peaceful: nobody starts a war, and the 1938 wars are over.
  w.nations.forEach((n) => (w.nations.cols.aggression[n] = 0));
  for (const war of [...w.wars.list]) w.wars.end(war);
  const bankrupt: string[] = [];
  let built = 0;
  let disbanded = 0;
  const t0 = performance.now();
  s.step(24 * 365 * 10, (ww) => {
    const ev = ww.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 1] === EventKind.Bankruptcy && ev[i + 3] === 1) bankrupt.push(`${TAGS_1938[ev[i + 2]! - 1] ?? `#${ev[i + 2]}`}@${Math.floor(ev[i]! / 24)}`);
      if (ev[i + 1] === EventKind.ProductionQueued) built++;
      if (ev[i + 1] === EventKind.FormationDestroyed) disbanded++;
    }
    ev.length = 0;
    ww.out.fires.length = 0;
  });
  if (process.env['EVIDENCE']) {
    const out = path.resolve(import.meta.dirname, '../../docs/evidence/1.26');
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, `peace-seed${seed}.json`), JSON.stringify({ seed, wallS: (performance.now() - t0) / 1000, bankrupt, built, disbanded, formations: w.formations.count }, null, 1));
  }
  expect(bankrupt, `seed ${seed}`).toEqual([]);
}
