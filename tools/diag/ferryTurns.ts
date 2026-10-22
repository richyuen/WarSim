/**
 * PLAN 7.88a: a nation's ferry turns. From a saved state, for `days` days: its actor days in the
 * invasion AI (`FERRY_PROBE`) by what took them (a formation aboard, a landing, a Normandy, no
 * front, the ferry), and for each ferry turn its free army, its transport groups standing at its
 * ports, and the groups tried (fleet, port, room, the way it went, whether it gave an order).
 *
 * Usage: npx tsx tools/diag/ferryTurns.ts <out.json> <days> <seed:state.bin:TAG> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { FERRY_PROBE, type FerryTurn } from '../../src/sim/ai/invasion';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const result: unknown[] = [];
for (const arg of process.argv.slice(4)) {
  const [seedS, bin, tag] = arg.split(':');
  const seed = Number(seedS);
  const n = TAGS_1938.indexOf(tag!) + 1;
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(bin!)));
  const w = s.world;
  const skips: Record<string, number> = {};
  const turns: (FerryTurn & { day: number; port: string[] })[] = [];
  FERRY_PROBE.skip = (m, why): void => {
    if (m === n) skips[why] = (skips[why] ?? 0) + 1;
  };
  FERRY_PROBE.turn = (t): void => {
    if (t.nation !== n) return;
    turns.push({ ...t, tries: t.tries.map((x) => ({ ...x })), day: w.tick / 24, port: t.tries.map((x) => w.ports[x.port]?.name ?? `#${x.port}`) });
  };
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  for (let d = 0; d < days; d++) s.step(24, quiet);
  delete FERRY_PROBE.skip;
  delete FERRY_PROBE.turn;
  const acted = turns.filter((t) => t.tries.some((x) => x.acted)).length;
  const row = { seed, bin, tag, skips, ferryTurns: turns.length, acted, turns };
  result.push(row);
  console.log(`${seed} ${bin} ${tag}: skips ${JSON.stringify(skips)} ferry turns ${turns.length} acted ${acted}`);
  for (const t of turns) console.log(`  day ${t.day} free ${t.free} groups ${t.groups}: ${t.tries.map((x, i) => `${x.fleet}@${t.port[i]} room ${x.room} ${x.way} ${x.acted ? 'ORDER' : '-'}`).join('; ')}`);
}
writeFileSync(out, JSON.stringify(result, null, 1));
