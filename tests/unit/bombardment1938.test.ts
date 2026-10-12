import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { equipFormation } from '../../src/sim/systems/elements';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, seaOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision } from '../helpers/sim1938';

// PLAN 4.5c: naval bombardment. AT: a fleet by a coast adds its guns to a land fight there: a
// British division and a Belgian one in a fight on the coast at Ostend; a British battle
// squadron in the water off it takes more of the Belgian division than the fight alone does.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const template = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);
const ENG = id('ENG');
const BEL = id('BEL');
const [OX, OY] = cellOf(2.92, 51.22, W, H).map(Math.floor) as [number, number];

function fleet(w: World, nation: number, tpl: string, x: number, y: number): number {
  const f = w.formations;
  const fid = f.create();
  f.cols.nation[fid] = nation;
  f.cols.x[fid] = x;
  f.cols.y[fid] = y;
  f.cols.template[fid] = template(tpl);
  f.cols.supply[fid] = 1;
  f.cols.org[fid] = 1;
  equipFormation(w, fid, template(tpl));
  return fid;
}

/** The zoned water cell nearest Ostend's cell. */
function offOstend(w: World): [number, number] {
  const z = seaOf(w);
  let best: [number, number] = [0, 0];
  let bd = Infinity;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const k = (OY + dy) * W + OX + dx;
      if (z.zoneOf[k] === 0) continue;
      const d = dx * dx + dy * dy;
      if (d < bd) [bd, best] = [d, [OX + dx + 0.5, OY + dy + 0.5]];
    }
  }
  return best;
}

/**
 * The fight at Ostend for `hours`, with a British fleet of `tpl` off it or none: the Belgian
 * division's strength at the end, and the British fleet's.
 */
function fight(hours: number, tpl?: string, nation = ENG): { bel: number; start: number; fleet: number } {
  const s = new Sim({ scenario: '1938', seed: 4503, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  const w = s.world;
  expect(declareWar(w, ENG, BEL, true)).not.toBeNull();
  const comp = navOf(w).grid.component;
  expect(comp[OY * W + OX]).not.toBe(0);
  const bel = addDivision(w, BEL, OX + 0.5, OY + 0.5);
  // The British one a cell inland along the coast: in contact.
  const inland = [[1, 0], [1, 1], [0, 1], [-1, 1]].find(([dx, dy]) => comp[(OY + dy!) * W + OX + dx!] === comp[OY * W + OX])!;
  addDivision(w, ENG, OX + inland[0]! + 0.5, OY + inland[1]! + 0.5);
  let fl = 0;
  if (tpl) {
    const [fx, fy] = offOstend(w);
    fl = fleet(w, nation, tpl, fx, fy);
  }
  const start = w.formations.cols.strength[bel]!;
  s.step(hours);
  return { bel: w.formations.has(bel) ? w.formations.cols.strength[bel]! : 0, start, fleet: fl === 0 ? 0 : w.formations.cols.strength[fl]! };
}

describe('naval bombardment (PLAN 4.5c)', () => {
  it('the AT: a battle squadron off Ostend takes more of the Belgian division than the fight alone', () => {
    const alone = fight(12);
    const shelled = fight(12, 'battle_squadron');
    expect(alone.bel).toBeLessThan(alone.start);
    expect(shelled.bel).toBeLessThan(alone.bel);
    process.stderr.write(`Ostend, 12 hours: the Belgian division ${alone.start} → ${alone.bel} in the fight alone, → ${shelled.bel} with a battle squadron off the coast\n`);
  });

  it('a fleet of a nation not at war, or with no gun (a transport group), adds nothing', () => {
    const alone = fight(12);
    expect(fight(12, 'battle_squadron', id('FRA')).bel).toBe(alone.bel);
    expect(fight(12, 'transport_group').bel).toBe(alone.bel);
  });

  it('a ship fires within its gun\'s reach only: a destroyer flotilla off Ostend, its 12 km short of the division, adds nothing', () => {
    const w = new Sim({ scenario: '1938', seed: 4503, assets: assets1938(W) }).world;
    const [fx, fy] = offOstend(w);
    const km = seaKm(w, fx, fy, OX + 0.5, OY + 0.5);
    expect(km).toBeGreaterThan(12);
    expect(km).toBeLessThanOrEqual(32);
    const alone = fight(12);
    expect(fight(12, 'destroyer_flotilla').bel).toBe(alone.bel);
    process.stderr.write(`off Ostend: ${km.toFixed(1)} km from the division\n`);
  });

  it('a fleet with no fight on the coast fires at nothing', () => {
    const s = new Sim({ scenario: '1938', seed: 4503, assets: assets1938(W) });
    s.world.settings.aiEnabled = false;
    const w = s.world;
    expect(declareWar(w, ENG, BEL, true)).not.toBeNull();
    const bel = addDivision(w, BEL, OX + 0.5, OY + 0.5);
    const [fx, fy] = offOstend(w);
    fleet(w, ENG, 'battle_squadron', fx, fy);
    const start = w.formations.cols.strength[bel]!;
    s.step(12);
    expect(w.formations.cols.strength[bel]).toBe(start);
  });
});
