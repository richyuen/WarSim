/**
 * PLAN 7.37b (critic run 10, `c10_g2_5309_CZS.json`): Czechoslovakia, given a strategic bomber
 * group at Prague and 10 warheads in the editor, lost its 6 wings by day 10 and died holding all 10.
 * On 1938 seed <seed>, <holder> gets a strategic bomber group at its capital and <warheads>, and
 * <attacker> declares war on it; each of the holder's wings is followed hour by hour, and where one
 * is removed the call that removed it (its stack's sim frames), its last mission, sortie, base and
 * the base's controller are printed. Last, day by day, its wings and `canDeliver`.
 *
 * Usage: npx tsx tools/diag/wingsLost.ts <seed> <holder> <attacker> [warheads = 10] [days = 30]
 */
import { Sim } from '../../src/sim/sim';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { canDeliver, warheadsOf } from '../../src/sim/systems/nuclear';

const [seedArg, holderTag, attackerTag] = process.argv.slice(2);
const warheads = Number(process.argv[5] ?? 10);
const days = Number(process.argv[6] ?? 30);
const s = new Sim({ scenario: '1938', seed: Number(seedArg), assets: assets1938(SIZE_1938.w) });
const w = s.world;
const id = (t: string): number => TAGS_1938.indexOf(t) + 1;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const H = id(holderTag!);
const A = id(attackerTag!);
const rules = w.rules!;
const strat = rules.templates.findIndex((t) => t.elements.length > 0 && rules.units[t.elements[0]!.unit]!.cls === 'bomber_str');
const nc = w.nations.cols;
s.command({ kind: 'spawnWing', nation: H, x: nc.capitalX[H]!, y: nc.capitalY[H]!, template: strat });
s.command({ kind: 'grantWarheads', nation: H, count: warheads });
s.command({ kind: 'declareWar', attacker: A, defender: H });
const c = w.formations.cols;
const clsOf = (fid: number): string => rules.units[rules.templates[c.template[fid]!]!.elements[0]!.unit]!.cls;
const wings = (): number[] => {
  const r: number[] = [];
  w.formations.forEach((fid) => {
    if (c.nation[fid] === H && w.isWing(fid)) r.push(fid);
  });
  return r;
};
// The last state seen of each of the holder's wings, and the call that removes one.
const last = new Map<number, Record<string, unknown>>();
const removeOrig = w.formations.remove.bind(w.formations);
const lost: Record<string, unknown>[] = [];
w.formations.remove = (fid: number): void => {
  if (c.nation[fid] === H && w.isWing(fid)) {
    const stack = (new Error().stack ?? '').split('\n').filter((l) => l.includes('src')).slice(1, 6).map((l) => l.trim().replace(/^at /, '').replace(/\(.*[\\/]src[\\/]/, '(').replace(/:\d+\)$/, ')'));
    lost.push({ day: +(w.tick / 24).toFixed(2), wing: fid, cls: clsOf(fid), strength: c.strength?.[fid], ...last.get(fid), stack });
  }
  removeOrig(fid);
};
console.log(JSON.stringify({ start: wings().map((f) => ({ wing: f, cls: clsOf(f), base: w.wingBase.get(f) })), canDeliver: canDeliver(w, H) }));
for (let h = 0; h < days * 24; h++) {
  for (const fid of wings()) {
    const base = w.wingBase.get(fid) ?? 0;
    const cell = base > 0 ? w.airbases[base - 1]!.cell : -1;
    last.set(fid, { mission: w.wingMission.get(fid), sortie: w.sorties.has(fid), base, baseHeldBy: cell >= 0 ? tag(w.cells.controller[cell]!) : null, at: [+c.x[fid]!.toFixed(1), +c.y[fid]!.toFixed(1)] });
  }
  s.step(1, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  if (h % 24 === 23) console.log(JSON.stringify({ day: (h + 1) / 24, wings: wings().length, strategic: wings().filter((f) => clsOf(f) === 'bomber_str').length, canDeliver: canDeliver(w, H), warheads: warheadsOf(w, H), alive: nc.living[H] === 1 }));
}
for (const l of lost) console.log(JSON.stringify(l));
