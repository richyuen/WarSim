/**
 * PLAN 7.55's reach: on each saved state, the living nations at war for which ADR-518's want
 * (`wantsTransport`) holds with a group under a division's room left out (PLAN 7.55) and not
 * without it: those that now save for a transport group, and order no other fleet while they do.
 * Read on the state as saved (no step), with the room of their groups.
 *
 * Usage: npx tsx tools/diag/transportWant.ts <out.json> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { wantsTransport } from '../../src/sim/ai/economic';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const cases = process.argv.slice(3).map((a) => {
  const [seed, src] = a.split(':');
  return { seed: Number(seed), src: src! };
});
const transport = BUILD_MIX_1938.fleets!.transport;
const division = ECONOMY_TABLES_1938.templateStrength[BUILD_MIX_1938.infantry] ?? 0;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;

const rows: { seed: number; src: string; before: number; after: number; added: { nation: string; rooms: number[] }[] }[] = [];
for (const { seed, src } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  s.load(new Uint8Array(readFileSync(src)));
  const fleets = new Map<number, number[]>();
  w.formations.forEach((id) => {
    if (!w.isFleet(id)) return;
    const n = w.formations.cols.nation[id]!;
    (fleets.get(n) ?? fleets.set(n, []).get(n)!).push(id);
  });
  let before = 0;
  let after = 0;
  const added: { nation: string; rooms: number[] }[] = [];
  for (const n of w.wars.nations()) {
    if (w.nations.cols.living[n] !== 1) continue;
    const own = fleets.get(n) ?? [];
    const b = wantsTransport(w, n, transport, own);
    const a = wantsTransport(w, n, transport, own, division);
    if (b) before++;
    if (a) after++;
    if (a && !b) added.push({ nation: tag(n), rooms: own.filter((id) => w.formations.cols.template[id] === transport).map((id) => transportRoom(w, id)) });
  }
  rows.push({ seed, src, before, after, added });
  process.stderr.write(`${seed} ${src}: ${before} -> ${after} ${added.map((x) => `${x.nation}[${x.rooms.join(',')}]`).join(' ')}\n`);
}
const sum = (k: 'before' | 'after'): number => rows.reduce((t, r) => t + r[k], 0);
writeFileSync(out, JSON.stringify({ division, before: sum('before'), after: sum('after'), rows }, null, 1));
process.stderr.write(`total ${sum('before')} -> ${sum('after')}\n`);
