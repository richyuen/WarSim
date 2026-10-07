/**
 * `npx tsx tools/diag/spearheads.ts [--seed 99] [--days 360]`
 *
 * The spearhead metric of SPEC §7 (PLAN 3.5c, 3.5e), read from a headless 1938 run with no hook
 * in the planner. An *attack* is a nation's formations ordered to one cell that an enemy of
 * the nation holds at the hour of the order; it is open from its first order until the first of
 * its formations is in contact within a sector of that cell (a later order to the same cell
 * opens another). Printed: the attacks, those that came to contact, the share of them whose
 * first formation in contact is armour (`SPEARHEAD_ARMOUR` of its upkeep in tanks), and
 * armour's share of the formations sent; then the same for the attacks armour was sent to.
 */
import { SECTOR_CELLS, SPEARHEAD_ARMOUR } from '../../src/sim/ai/operational';
import { ECONOMY_TABLES_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : fallback;
}

const seed = Number(arg('seed', '99'));
const days = Number(arg('days', '360'));
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const world = sim.world;
const f = world.formations.cols;
const W = world.cells.w;
const isArmour = (id: number): boolean => (ECONOMY_TABLES_1938.templateArmour[f.template[id]!] ?? 0) >= SPEARHEAD_ARMOUR;

interface Attack {
  sent: Set<number>;
  armour: number;
  /** -1 open, 0 the first in contact was not armour, 1 it was. */
  first: number;
}
const open = new Map<string, Attack>();
const all: Attack[] = [];
/** The attack a formation was last sent to, and the target of the order it was seen with. */
const attackOf = new Map<number, { a: Attack; target: number }>();
const lastTarget = new Map<number, number>();

function near(id: number, target: number): boolean {
  let dx = Math.abs(Math.floor(f.x[id]!) - (target % W));
  if (dx > W / 2) dx = W - dx;
  return Math.max(dx, Math.abs(Math.floor(f.y[id]!) - Math.floor(target / W))) <= SECTOR_CELLS;
}

sim.step(days * 24, (w) => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
  w.formations.forEach((id) => {
    const n = f.nation[id]!;
    const target = f.moving[id] === 1 ? f.targetCell[id]! : -1;
    if (target >= 0 && lastTarget.get(id) !== target && f.retreat[id] === 0) {
      attackOf.delete(id);
      const holder = w.cells.controller[target]!;
      if (holder !== 0 && holder !== n && w.wars.atWar(n, holder)) {
        const key = `${n}:${target}`;
        let a = open.get(key);
        if (!a) {
          open.set(key, (a = { sent: new Set(), armour: 0, first: -1 }));
          all.push(a);
        }
        if (!a.sent.has(id)) {
          a.sent.add(id);
          if (isArmour(id)) a.armour++;
        }
        attackOf.set(id, { a, target });
      }
    }
    lastTarget.set(id, target);
    const at = attackOf.get(id);
    if (at && at.a.first < 0 && f.engaged[id] === 1 && near(id, at.target)) {
      at.a.first = isArmour(id) ? 1 : 0;
      open.delete(`${n}:${at.target}`);
    }
  });
});

function report(label: string, list: Attack[]): void {
  const met = list.filter((a) => a.first >= 0);
  const led = met.filter((a) => a.first === 1).length;
  const sent = list.reduce((s, a) => s + a.sent.size, 0);
  const armour = list.reduce((s, a) => s + a.armour, 0);
  const pct = (a: number, b: number): string => (b > 0 ? `${((100 * a) / b).toFixed(1)} %` : '-');
  console.log(`${label}: ${list.length} attacks, ${met.length} came to contact, armour first in ${led} (${pct(led, met.length)}); ${sent} formations sent, ${armour} of them armour (${pct(armour, sent)})`);
}
console.log(`seed ${seed}, ${days} days`);
report('all attacks', all);
report('attacks armour was sent to', all.filter((a) => a.armour > 0));
