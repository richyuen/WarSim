import { describe, expect, it } from 'vitest';
import combatJson from '../../data/combat.json' with { type: 'json' };
import unitsLand from '../../data/units/land.json' with { type: 'json' };
import { Terrain } from '../../src/shared/terrain';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_LAND, UNIT_IDS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { combatSystem } from '../../src/sim/systems/combat';
import { destroyFormation } from '../../src/sim/systems/elements';
import { FIRE_STRIDE, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 3.4a: the combined-arms bonus (SPEC §6.1, the table's first row; `data/combat.json`).
// A side of a battle with infantry, artillery and armour all alive in it fires × `bonus`.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const GER = nationId('GER');
const ITA = nationId('ITA');
const POL = nationId('POL');
const [X0, Y0] = cellOf(30.0, 50.0, W, H).map(Math.floor) as [number, number];
const template = (id: string): number => TEMPLATES_LAND.findIndex((t) => t.id === id);
const BONUS = combatJson.combinedArms.bonus;
const ARMS = combatJson.combinedArms.arms;
const CLASS_OF = new Map((unitsLand.types as unknown as { id: string; class: string }[]).map((u) => [u.id, u.class]));
const classOf = (unit: number): string => CLASS_OF.get(UNIT_IDS_1938[unit]!)!;

type Stand = [nation: number, template: string, dx: number, dy: number];

/** A battle on plains: the formations of `stands` around one cell, Germany and Italy at war with Poland. */
function battle(stands: Stand[]): { world: World; ids: number[] } {
  const s = new Sim({ scenario: '1938', seed: 5, assets: assets1938(W) });
  const world = s.world;
  world.formations.ids().forEach((id) => destroyFormation(world, id));
  world.wars.set(GER, POL, true);
  world.wars.set(ITA, POL, true);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) world.cells.terrain[(Y0 + dy) * W + X0 + dx] = Terrain.Plains;
  const ids = stands.map(([nation, t, dx, dy]) => addDivision(world, nation, X0 + 0.5 + dx, Y0 + 0.5 + dy, template(t)));
  return { world, ids };
}

/** The hour's volleys of the elements of formation `of`: shooter element → [target, damage]. */
function volleysOf(world: World, of: number): Map<number, [number, number]> {
  world.out.fires.length = 0;
  combatSystem(world);
  const fr = world.out.fires;
  const out = new Map<number, [number, number]>();
  for (let i = 0; i < fr.length; i += FIRE_STRIDE) {
    if (world.elements.cols.formation[fr[i + 2]!] === of) out.set(fr[i + 2]!, [fr[i + 3]!, fr[i + 5]!]);
  }
  return out;
}

/** Every volley of `b` is the volley of the same element at the same target in `a`, × `factor`. */
function expectScaled(a: Map<number, [number, number]>, b: Map<number, [number, number]>, factor: number): void {
  expect(b.size).toBe(a.size);
  expect(b.size).toBeGreaterThan(10);
  for (const [s, [t, dmg]] of b) {
    const base = a.get(s)!;
    expect(t).toBe(base[0]);
    expect(dmg / base[1]).toBeCloseTo(factor, 10);
  }
}

describe('the combined-arms bonus (PLAN 3.4a)', () => {
  it('the data names three arms of land unit classes and a bonus above 1', () => {
    expect(BONUS).toBeGreaterThan(1);
    expect(Object.keys(ARMS)).toEqual(['infantry', 'artillery', 'armour']);
    // What the tests below take for granted of the templates.
    const arms = (id: string): string[] => {
      const classes = TEMPLATES_LAND.find((t) => t.id === id)!.elements.map((e) => CLASS_OF.get(e.type)!);
      return Object.entries(ARMS).filter(([, cls]) => classes.some((c) => cls.includes(c))).map(([arm]) => arm);
    };
    expect(arms('tank_brigade')).toEqual(['infantry', 'armour']);
    expect(arms('infantry_div_cadre')).toEqual(['infantry', 'artillery']);
    expect(arms('garrison_brigade')).toEqual(['infantry']);
    expect(arms('infantry_div')).toEqual(['infantry', 'artillery']);
    expect(arms('panzer_div')).toEqual(['infantry', 'artillery', 'armour']);
  });

  it('a tank brigade fires × the bonus with a division that has guns beside it, and its enemy’s guns give it nothing', () => {
    // Alone: its own infantry and armour, and the artillery in the battle is the enemy's.
    const alone = battle([[GER, 'tank_brigade', 0, 0], [POL, 'infantry_div', 1, 0]]);
    const withGuns = battle([[GER, 'tank_brigade', 0, 0], [POL, 'infantry_div', 1, 0], [GER, 'infantry_div_cadre', 0, 1]]);
    const withRifles = battle([[GER, 'tank_brigade', 0, 0], [POL, 'infantry_div', 1, 0], [GER, 'garrison_brigade', 0, 1]]);
    const base = volleysOf(alone.world, alone.ids[0]!);
    expectScaled(base, volleysOf(withGuns.world, withGuns.ids[0]!), BONUS);
    // A second formation of an arm it has gives nothing.
    expectScaled(base, volleysOf(withRifles.world, withRifles.ids[0]!), 1);
  });

  it('the division beside it fires × the bonus too, and so does an ally’s', () => {
    const alone = battle([[GER, 'infantry_div_cadre', 0, 1], [POL, 'infantry_div', 1, 0]]);
    const own = battle([[GER, 'infantry_div_cadre', 0, 1], [POL, 'infantry_div', 1, 0], [GER, 'tank_brigade', 0, 0]]);
    const ally = battle([[ITA, 'infantry_div_cadre', 0, 1], [POL, 'infantry_div', 1, 0], [GER, 'tank_brigade', 0, 0]]);
    const base = volleysOf(alone.world, alone.ids[0]!);
    expectScaled(base, volleysOf(own.world, own.ids[0]!), BONUS);
    expectScaled(base, volleysOf(ally.world, ally.ids[0]!), BONUS);
  });

  it('a light tank company of a panzer division fires × the bonus of one of a tank brigade, at the same kind of target', () => {
    const perTarget = (t: string): Map<string, number> => {
      const { world, ids } = battle([[GER, t, 0, 0], [POL, 'infantry_div', 1, 0]]);
      const ec = world.elements.cols;
      const out = new Map<string, number>();
      for (const [s, [target, dmg]] of volleysOf(world, ids[0]!)) {
        if (UNIT_IDS_1938[ec.unit[s]!] === 'tank_light') out.set(UNIT_IDS_1938[ec.unit[target]!]!, dmg);
      }
      return out;
    };
    const brigade = perTarget('tank_brigade');
    const division = perTarget('panzer_div');
    let compared = 0;
    for (const [target, dmg] of division) {
      if (!brigade.has(target)) continue;
      expect(dmg / brigade.get(target)!).toBeCloseTo(BONUS, 10);
      compared++;
    }
    expect(compared).toBeGreaterThan(0);
  });

  it('the bonus is of arms alive in the battle: with the guns of the side destroyed it is gone', () => {
    const alone = battle([[GER, 'tank_brigade', 0, 0], [POL, 'infantry_div', 1, 0]]);
    const { world, ids } = battle([[GER, 'tank_brigade', 0, 0], [POL, 'infantry_div', 1, 0], [GER, 'infantry_div_cadre', 0, 1]]);
    const ec = world.elements.cols;
    world.elements.forEach((el) => {
      if (ec.formation[el] === ids[2] && ARMS.artillery.includes(classOf(ec.unit[el]!))) ec.strength[el] = 0;
    });
    expectScaled(volleysOf(alone.world, alone.ids[0]!), volleysOf(world, ids[0]!), 1);
  });

  it('the side without the three arms fires as it did', () => {
    // The Polish division's volleys at the tank brigade: the same with a German division with guns in the battle, target for target.
    const perTarget = (stands: Stand[]): Map<string, number> => {
      const { world, ids } = battle(stands);
      const ec = world.elements.cols;
      const tank = ids[0]!;
      const out = new Map<string, number>();
      for (const [s, [target, dmg]] of volleysOf(world, ids[1]!)) {
        if (ec.formation[target] === tank) out.set(`${UNIT_IDS_1938[ec.unit[s]!]}>${UNIT_IDS_1938[ec.unit[target]!]}`, dmg);
      }
      return out;
    };
    const alone = perTarget([[GER, 'tank_brigade', 0, 0], [POL, 'infantry_div', 1, 0]]);
    const withGuns = perTarget([[GER, 'tank_brigade', 0, 0], [POL, 'infantry_div', 1, 0], [GER, 'infantry_div_cadre', 0, 1]]);
    let compared = 0;
    for (const [k, dmg] of withGuns) {
      if (!alone.has(k)) continue;
      expect(dmg / alone.get(k)!).toBeCloseTo(1, 10);
      compared++;
    }
    expect(compared).toBeGreaterThan(0);
  });
});
