/**
 * PLAN 7.146: what holds the land army of long-front wars down late. From a saved state, for `days`
 * days: at each day's start, the wars with a land front of at least MIN_FRONT cells (the cells of
 * either side next to a cell of the other's) and their members, each side weak or strong by its men on
 * land (a nation in several such wars takes the role of the longest front's). Each system of the tick
 * is wrapped (as `Sim.profile` wraps them) and the land formations (not a fleet, a wing) of those
 * nations are read before and after it, per role:
 * - men lost (engaged before it, or not) and formations gone;
 * - men gained by formations that stood before it (refills, the fold's merges) and formations new in
 *   it, with their men (raised, released, revolts' armies are not the members');
 * and daily at hour 12 per role: nations, land formations, men, engaged formations.
 * Also each day's roles by nation tag (`roles`), to join `armyGatesNow.ts`' month rows.
 *
 * Usage: npx tsx tools/diag/longWarArmy.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const MIN_FRONT = 100;
const out = process.argv[2]!;
const days = Number(process.argv[3]);
type Role = 'weak' | 'strong';
type Flow = { lostEngaged: number; lostFree: number; goneEngaged: number; goneFree: number; gained: number; born: number; bornMen: number };
const flow0 = (): Flow => ({ lostEngaged: 0, lostFree: 0, goneEngaged: 0, goneFree: 0, gained: 0, born: 0, bornMen: 0 });
type Daily = { nations: number; formations: number; men: number; engaged: number; wars: number; front: number };
const daily0 = (): Daily => ({ nations: 0, formations: 0, men: 0, engaged: 0, wars: 0, front: 0 });
const tag = (w: World, n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;

const land = (w: World, id: number): boolean => !w.isFleet(id) && !w.isWing(id);

/** Each long-front war today: its sides, its front's length, and the role of each member. */
function roles(w: World): { role: Map<number, Role>; wars: number; front: number } {
  const { w: W, h, controller } = w.cells;
  const nb: number[] = [];
  const list = w.wars.list;
  const len = new Array<number>(list.length).fill(0);
  for (const c of frontierOf(w)) {
    const a = controller[c]!;
    if (a === 0) continue;
    const hit = new Set<number>();
    for (const q of neighbours4(c, W, h, w.settings.loopingMap, nb)) {
      const b = controller[q]!;
      if (b === 0 || b === a || !w.wars.atWar(a, b)) continue;
      for (let i = 0; i < list.length; i++) {
        const s = list[i]!.sides;
        if ((s[0].includes(a) && s[1].includes(b)) || (s[1].includes(a) && s[0].includes(b))) hit.add(i);
      }
    }
    for (const i of hit) len[i]!++;
  }
  const men = new Map<number, number>();
  const c = w.formations.cols;
  w.formations.forEach((id) => {
    if (!land(w, id) || w.embarked.has(id) || w.offLand(id)) return;
    men.set(c.nation[id]!, (men.get(c.nation[id]!) ?? 0) + c.strength[id]!);
  });
  const role = new Map<number, Role>();
  const best = new Map<number, number>();
  let wars = 0;
  let front = 0;
  for (let i = 0; i < list.length; i++) {
    if (len[i]! < MIN_FRONT) continue;
    wars++;
    front += len[i]!;
    const s = list[i]!.sides;
    const m = s.map((side) => side.reduce((t, n) => t + (men.get(n) ?? 0), 0));
    const weak = m[0]! <= m[1]! ? 0 : 1;
    for (let k = 0; k < 2; k++)
      for (const n of s[k]!) {
        if (w.nations.cols.living[n] !== 1 || (best.get(n) ?? -1) >= len[i]!) continue;
        best.set(n, len[i]!);
        role.set(n, k === weak ? 'weak' : 'strong');
      }
  }
  return { role, wars, front };
}

const result: unknown[] = [];
const total: Record<Role, Record<string, Flow>> = { weak: {}, strong: {} };
const totalDaily: Record<Role, Daily> = { weak: daily0(), strong: daily0() };
let totalDays = 0;
for (const a of process.argv.slice(4)) {
  const [seedS, bin] = a.split(':');
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(bin!)));
  const w = s.world;
  const c = w.formations.cols;
  let today = roles(w);
  const per: Record<Role, Record<string, Flow>> = { weak: {}, strong: {} };
  const dsum: Record<Role, Daily> = { weak: daily0(), strong: daily0() };
  const dayRoles: { day: number; weak: string[]; strong: string[] }[] = [];
  const inner = s as unknown as { systems: readonly ((w: World) => void)[]; systemNames: readonly string[] };
  const names = inner.systemNames;
  inner.systems = inner.systems.map((sys, i) => (world: World) => {
    const before = new Map<number, { men: number; engaged: boolean; role: Role }>();
    world.formations.forEach((id) => {
      if (!land(world, id)) return;
      const r = today.role.get(c.nation[id]!);
      if (r) before.set(id, { men: c.strength[id]!, engaged: c.engaged[id] === 1, role: r });
    });
    sys(world);
    const name = names[i]!;
    for (const [id, b] of before) {
      const t = (per[b.role][name] ??= flow0());
      const gone = !world.formations.has(id);
      const d = b.men - (gone ? 0 : c.strength[id]!);
      if (d < 0) t.gained += -d;
      else if (d > 0 || gone) {
        if (b.engaged) {
          t.lostEngaged += d;
          if (gone) t.goneEngaged++;
        } else {
          t.lostFree += d;
          if (gone) t.goneFree++;
        }
      }
    }
    world.formations.forEach((id) => {
      if (before.has(id) || !land(world, id)) return;
      const r = today.role.get(c.nation[id]!);
      if (!r) return;
      const t = (per[r][name] ??= flow0());
      t.born++;
      t.bornMen += c.strength[id]!;
    });
  });
  const quiet = (ww: World): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  for (let d = 0; d < days; d++) {
    today = roles(w);
    dayRoles.push({ day: Math.floor(w.tick / 24), weak: [...today.role].filter(([, r]) => r === 'weak').map(([n]) => tag(w, n)), strong: [...today.role].filter(([, r]) => r === 'strong').map(([n]) => tag(w, n)) });
    s.step(12, quiet);
    for (const r of ['weak', 'strong'] as const) {
      dsum[r].wars += today.wars;
      dsum[r].front += today.front;
    }
    for (const [, r] of today.role) dsum[r].nations++;
    w.formations.forEach((id) => {
      if (!land(w, id)) return;
      const r = today.role.get(c.nation[id]!);
      if (!r) return;
      dsum[r].formations++;
      dsum[r].men += c.strength[id]!;
      if (c.engaged[id] === 1) dsum[r].engaged++;
    });
    s.step(12, quiet);
  }
  const rd = (x: number): number => Math.round(x * 100) / 100;
  const perDay = (o: Daily): Record<string, number> => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, rd(v / days)]));
  const row = { seed: Number(seedS), bin, days, daily: { weak: perDay(dsum.weak), strong: perDay(dsum.strong) }, flows: per, roles: dayRoles.filter((_, k) => k % 30 === 0) };
  result.push(row);
  for (const r of ['weak', 'strong'] as const) {
    for (const [k, t] of Object.entries(per[r])) {
      const e = (total[r][k] ??= flow0());
      for (const f of Object.keys(t) as (keyof Flow)[]) e[f] += t[f];
    }
    for (const f of Object.keys(dsum[r]) as (keyof Daily)[]) totalDaily[r][f] += dsum[r][f];
  }
  totalDays += days;
  process.stderr.write(`${seedS} ${bin}: weak ${JSON.stringify(row.daily.weak)} strong ${JSON.stringify(row.daily.strong)}\n`);
}
const round = (o: Record<string, Flow>): Record<string, Flow> =>
  Object.fromEntries(Object.entries(o).map(([k, t]) => [k, Object.fromEntries(Object.entries(t).map(([f, v]) => [f, Math.round(v)])) as Flow]));
const td = (o: Daily): Record<string, number> => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round((100 * v) / Math.max(1, totalDays)) / 100]));
writeFileSync(out, JSON.stringify({ total: { weak: round(total.weak), strong: round(total.strong) }, daily: { weak: td(totalDaily.weak), strong: td(totalDaily.strong) }, rows: result }, null, 1));
console.log(`done: daily ${JSON.stringify({ weak: td(totalDaily.weak), strong: td(totalDaily.strong) })}`);
