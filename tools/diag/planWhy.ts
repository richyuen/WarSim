/**
 * PLAN 7.138: per nation, what its plans do with its free land formations over some days (`OP_PROBE`):
 * the free formations (`mine`), those within the range of a sector (`near`), the far (`far`: on their
 * day and not waiting, or near and given no sector); of the marches from afar, the empty sectors
 * found, those their class reaches, those on another landmass, those `reaches` refused; the asks of
 * the marches from afar and of the orders by answer.
 *
 * Usage: npx tsx tools/diag/planWhy.ts <seed> <state.bin|1938> <days> <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { OP_PROBE } from '../../src/sim/ai/operational';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const [seedArg, bin, daysArg, out] = process.argv.slice(2);
const s = new Sim({ scenario: '1938', seed: Number(seedArg), assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const quiet = (ww: World): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
if (bin === '1938') for (let d = 0; d < 60; d++) s.step(24, quiet);
else s.load(new Uint8Array(readFileSync(bin!)));
const tag = (n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;
type T = Record<string, number>;
const by = new Map<number, T>();
const t = (n: number): T => {
  let x = by.get(n);
  if (!x) by.set(n, (x = {}));
  return x;
};
const add = (n: number, k: string, v = 1): void => {
  const x = t(n);
  x[k] = (x[k] ?? 0) + v;
};
OP_PROBE.now = () => performance.now();
OP_PROBE.plan = (p) => {
  add(p.nation, 'plans');
  add(p.nation, 'sectors', p.sectors);
  add(p.nation, 'mine', p.mine);
  add(p.nation, 'near', p.near);
  add(p.nation, 'far', p.far);
};
OP_PROBE.ask = (a) => add(w.formations.cols.nation[a.id]!, `${a.afar ? 'afar' : 'order'} ${a.answer}`);
OP_PROBE.sectors = (p) => {
  const e = p.empty;
  if (!e) return;
  add(p.nation, 'probedPlans');
  add(p.nation, 'farSeen', e.far);
  if (e.empties >= 0) add(p.nation, 'empties', e.empties);
  else add(p.nation, 'emptiesNotLooked');
  add(p.nation, 'reachedEmpty', e.reachedEmpty);
  add(p.nation, 'otherLand', e.otherLand);
  add(p.nation, 'unreached', e.unreached);
  add(p.nation, 'skipTakers', e.takers);
  add(p.nation, 'skipStood', e.stood);
  add(p.nation, 'skipSideStood', e.sideStood);
  for (const c of e.classes ?? []) {
    add(p.nation, 'cls', 1);
    add(p.nation, 'clsFar', c.far);
    add(p.nation, 'clsReachedEmpty', c.reached);
    add(p.nation, 'clsSnap', c.snap);
    add(p.nation, 'clsGroup', c.group);
    add(p.nation, 'clsPocket', c.pocket);
    if (c.ground > 0) add(p.nation, 'clsInPocket', c.far);
    else if (c.ground < 0) add(p.nation, 'clsInWide', c.far);
    else add(p.nation, 'clsOpen', c.far);
    if (c.provinceGroup < 0) add(p.nation, 'clsClosed', c.far);
  }
};
const days = Number(daysArg);
for (let d = 0; d < days; d++) s.step(24, quiet);
const rows = [...by].map(([n, x]) => ({ nation: tag(n), ...Object.fromEntries(Object.entries(x).map(([k, v]) => [k, Math.round((v / days) * 10) / 10])) }));
rows.sort((a, b) => ((b as unknown as T).mine ?? 0) - ((a as unknown as T).mine ?? 0));
for (const r of rows.slice(0, 12)) process.stderr.write(JSON.stringify(r) + '\n');
writeFileSync(out!, JSON.stringify(rows, null, 1));
