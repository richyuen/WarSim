import { describe, expect, it } from 'vitest';
import combatJson from '../../data/combat.json' with { type: 'json' };
import unitsLand from '../../data/units/land.json' with { type: 'json' };
import { Terrain } from '../../src/shared/terrain';
import { TEMPLATES_LAND, UNIT_IDS_1938 } from '../../src/sim/scenario1938';
import { combatSystem } from '../../src/sim/systems/combat';
import { FIRE_STRIDE, type World } from '../../src/sim/world';
import { addDivision, battlefield, FIELD_X as X0, FIELD_Y as Y0, nationId } from '../helpers/sim1938';

// PLAN 3.4a: the combined-arms bonus (SPEC §6.1, the table's first row; `data/combat.json`).
// A side of a battle with infantry, artillery and armour all alive in it fires × `bonus`.

const GER = nationId('GER');
const ITA = nationId('ITA');
const POL = nationId('POL');
const template = (id: string): number => TEMPLATES_LAND.findIndex((t) => t.id === id);
const BONUS = combatJson.combinedArms.bonus;
const ARMS = combatJson.combinedArms.arms;
const SCREEN = combatJson.screen;
const CLASS_OF = new Map((unitsLand.types as unknown as { id: string; class: string }[]).map((u) => [u.id, u.class]));
const classOf = (unit: number): string => CLASS_OF.get(UNIT_IDS_1938[unit]!)!;

type Stand = [nation: number, template: string, dx: number, dy: number];

/** A battle on `terrain`: the formations of `stands` around one cell, Germany and Italy at war with Poland. */
function battle(stands: Stand[], terrain: number = Terrain.Plains): { world: World; ids: number[] } {
  const world = battlefield(terrain, [[GER, POL], [ITA, POL]]);
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

// PLAN 3.4b: the screen (SPEC §6.1, the table's second row; `screen` of `data/combat.json`).
// Armour on close ground whose side has no infantry alive in the battle takes × `taken`.
// Every template with tanks has infantry of its own, so the tests destroy it first.
describe('the screen of infantry for armour on close ground (PLAN 3.4b)', () => {
  /**
   * The Polish division's volleys at the German formation `of` (stand 0), by shooter and target
   * type. `dead`: the arm of that formation destroyed before the hour. A formation beside it
   * changes whom the Poles pick, not what a volley of one type at another does.
   */
  const taken = (terrain: number, of: string, dead: keyof typeof ARMS, beside?: string): Map<string, number> => {
    const stands: Stand[] = [[GER, of, 0, 0], [POL, 'infantry_div', 1, 0]];
    if (beside) stands.push([GER, beside, 0, 1]);
    const { world, ids } = battle(stands, terrain);
    const ec = world.elements.cols;
    world.elements.forEach((el) => {
      if (ec.formation[el] === ids[0] && ARMS[dead].includes(classOf(ec.unit[el]!))) ec.strength[el] = 0;
    });
    const out = new Map<string, number>();
    for (const [s, [target, dmg]] of volleysOf(world, ids[1]!)) {
      if (ec.formation[target] === ids[0]) out.set(`${UNIT_IDS_1938[ec.unit[s]!]}>${UNIT_IDS_1938[ec.unit[target]!]}`, dmg);
    }
    return out;
  };
  /** Every volley of `alone` whose kind is in `screened` too is that one × `factor`; how many kinds. */
  const expectTaken = (screened: Map<string, number>, alone: Map<string, number>, factor: number): number => {
    let compared = 0;
    for (const [k, dmg] of alone) {
      if (!screened.has(k)) continue;
      expect(dmg / screened.get(k)!, k).toBeCloseTo(factor, 10);
      compared++;
    }
    return compared;
  };

  it('the data names forest and urban ground and a figure above 1', () => {
    expect(SCREEN.taken).toBeGreaterThan(1);
    expect(SCREEN.terrain).toEqual(['forest', 'urban']);
  });

  it.each([[Terrain.Forest, SCREEN.taken], [Terrain.Urban, SCREEN.taken], [Terrain.Plains, 1], [Terrain.Hills, 1]])('on ground %i the tanks of a brigade with no infantry take × %f of what they take with a rifle brigade beside them', (terrain, factor) => {
    const screened = taken(terrain, 'tank_brigade', 'infantry', 'garrison_brigade');
    const alone = taken(terrain, 'tank_brigade', 'infantry');
    for (const k of alone.keys()) expect(k.endsWith('>tank_light'), k).toBe(true);
    expect(expectTaken(screened, alone, factor)).toBeGreaterThan(0);
  });

  it('its own infantry is a screen: the brigade as it is takes the same alone and with a rifle brigade beside it', () => {
    const tanksOnly = (m: Map<string, number>): Map<string, number> => new Map([...m].filter(([k]) => k.endsWith('>tank_light')));
    const dead = tanksOnly(taken(Terrain.Forest, 'tank_brigade', 'infantry'));
    // `artillery`: the brigade has none, so nothing of it is destroyed.
    const whole = tanksOnly(taken(Terrain.Forest, 'tank_brigade', 'artillery'));
    expect(expectTaken(whole, dead, SCREEN.taken)).toBeGreaterThan(0);
    expect(expectTaken(tanksOnly(taken(Terrain.Forest, 'tank_brigade', 'artillery', 'garrison_brigade')), whole, 1)).toBeGreaterThan(0);
  });

  it('what is not armour takes × 1: the guns of a division with no infantry left, in a forest', () => {
    const screened = taken(Terrain.Forest, 'infantry_div', 'infantry', 'garrison_brigade');
    const alone = taken(Terrain.Forest, 'infantry_div', 'infantry');
    expect([...alone.keys()].some((k) => k.endsWith('>artillery'))).toBe(true);
    expect(expectTaken(screened, alone, 1)).toBeGreaterThan(0);
  });

  it('the screen is of the target’s side: the tanks’ own fire is as it was', () => {
    const fire = (beside: boolean): Map<number, [number, number]> => {
      const stands: Stand[] = [[GER, 'tank_brigade', 0, 0], [POL, 'infantry_div', 1, 0]];
      if (beside) stands.push([GER, 'garrison_brigade', 0, 1]);
      const { world, ids } = battle(stands, Terrain.Forest);
      const ec = world.elements.cols;
      world.elements.forEach((el) => {
        if (ec.formation[el] === ids[0] && ARMS.infantry.includes(classOf(ec.unit[el]!))) ec.strength[el] = 0;
      });
      return volleysOf(world, ids[0]!);
    };
    expectScaled(fire(true), fire(false), 1);
  });
});

// PLAN 3.4c: guns on guns (SPEC §6.1, the table's third row; `gunsOnGuns` of `data/combat.json`).
// An AT gun whose enemy has artillery alive in the battle fires × `fire`.
describe('artillery on the enemy side holds down the AT guns (PLAN 3.4c)', () => {
  const GUNS = combatJson.gunsOnGuns;
  /**
   * The Polish division's volleys on plains at the German formation `of` (stand 0) and at
   * `beside`, another formation of its side, by shooter and target type (the ground and the
   * stance are the same for both, so a volley of one type at another is one figure). `dead`:
   * the arm destroyed before the hour, in every formation of that side.
   */
  const fired = (of: string, dead?: keyof typeof ARMS, beside?: Stand): Map<string, number> => {
    const stands: Stand[] = [[GER, of, 0, 0], [POL, 'infantry_div', 1, 0]];
    if (beside) stands.push(beside);
    const { world, ids } = battle(stands);
    const ec = world.elements.cols;
    world.elements.forEach((el) => {
      if (dead && ec.formation[el] !== ids[1] && ARMS[dead].includes(classOf(ec.unit[el]!))) ec.strength[el] = 0;
    });
    const out = new Map<string, number>();
    for (const [s, [target, dmg]] of volleysOf(world, ids[1]!)) out.set(`${UNIT_IDS_1938[ec.unit[s]!]}>${UNIT_IDS_1938[ec.unit[target]!]}`, dmg);
    return out;
  };
  /** The one volley of the division's AT gun: its target's type, and the damage. */
  const atVolley = (m: Map<string, number>): [string, number] => {
    const at = [...m].filter(([k]) => k.startsWith('anti_tank>'));
    expect(at.length).toBe(1);
    return at[0]!;
  };
  const AT_ON_TANK = 'anti_tank>tank_light';
  /** The tank brigade has no guns: what the Poles fire at it is the volley the rule leaves alone. */
  const base = (): Map<string, number> => fired('tank_brigade');

  it('the data names the AT guns and a figure below 1', () => {
    expect(GUNS.fire).toBeLessThan(1);
    expect(GUNS.fire).toBeGreaterThan(0);
    expect(GUNS.shooter).toEqual(['at']);
    expect(CLASS_OF.get('anti_tank')).toBe('at');
    expect(base().has(AT_ON_TANK)).toBe(true);
  });

  it('an AT gun’s volley at a tank of a panzer division, which has guns, is its volley at one of a tank brigade × the figure', () => {
    expect(fired('panzer_div').get(AT_ON_TANK)! / base().get(AT_ON_TANK)!).toBeCloseTo(GUNS.fire, 10);
  });

  it('the howitzers’ and the rifles’ volleys are the same at both', () => {
    const atBrigade = base();
    const atDivision = fired('panzer_div');
    const shooters = new Set<string>();
    for (const [k, dmg] of atDivision) {
      if (k.startsWith('anti_tank>') || !atBrigade.has(k)) continue;
      expect(dmg / atBrigade.get(k)!, k).toBeCloseTo(1, 10);
      shooters.add(k.split('>')[0]!);
    }
    expect([...shooters].sort()).toEqual(['artillery', 'infantry']);
  });

  it('the guns must be alive: with the panzer division’s artillery destroyed the AT gun fires in full', () => {
    expect(fired('panzer_div', 'artillery').get(AT_ON_TANK)! / base().get(AT_ON_TANK)!).toBeCloseTo(1, 10);
  });

  it('the guns of an ally of the enemy count, and so do those of another formation of his', () => {
    // Against the same battle with those guns destroyed: the gun picks among the same targets but two batteries.
    for (const nation of [GER, ITA]) {
      const beside: Stand = [nation, 'infantry_div_cadre', 0, 1];
      const [target, dmg] = atVolley(fired('tank_brigade', undefined, beside));
      const [targetFree, dmgFree] = atVolley(fired('tank_brigade', 'artillery', beside));
      expect(target).toBe(targetFree);
      expect(dmg / dmgFree).toBeCloseTo(GUNS.fire, 10);
    }
    // Rifles alone beside the brigade: no guns, the volley in full.
    const [target, dmg] = atVolley(fired('tank_brigade', undefined, [GER, 'garrison_brigade', 0, 1]));
    const [targetFree, dmgFree] = atVolley(fired('tank_brigade', 'artillery', [GER, 'infantry_div_cadre', 0, 1]));
    expect(target).toBe(targetFree);
    expect(dmg / dmgFree).toBeCloseTo(1, 10);
  });
});

// PLAN 3.4d: the open (SPEC §6.1, the table's fourth row; `open` of `data/combat.json`).
// Armour's fire at a target with no armour on open ground is × `fire`, unless the target's
// side has an AT gun alive in the battle.
describe('armour against the unarmoured in the open (PLAN 3.4d)', () => {
  const OPEN = combatJson.open;
  const AT = combatJson.gunsOnGuns.shooter;
  /**
   * The volleys of the first stand, a Polish formation, at its enemies, by shooter type, target
   * type and the target's stand. `noAt`: the enemies' AT guns destroyed before the hour (the
   * same battle but those guns, so the same targets to pick among but one battery).
   */
  const fired = (stands: Stand[], noAt: boolean, terrain: number = Terrain.Plains): Map<string, number> => {
    const { world, ids } = battle(stands, terrain);
    const ec = world.elements.cols;
    world.elements.forEach((el) => {
      if (noAt && ec.formation[el] !== ids[0] && AT.includes(classOf(ec.unit[el]!))) ec.strength[el] = 0;
    });
    const out = new Map<string, number>();
    for (const [s, [target, dmg]] of volleysOf(world, ids[0]!)) {
      out.set(`${UNIT_IDS_1938[ec.unit[s]!]}>${UNIT_IDS_1938[ec.unit[target]!]}@${ids.indexOf(ec.formation[target]!)}`, dmg);
    }
    return out;
  };
  /** Of the volleys both have whose key `pick` takes: each of `free` is that of `covered` × `factor`; how many. */
  const expectFire = (covered: Map<string, number>, free: Map<string, number>, pick: (k: string) => boolean, factor: number): number => {
    let compared = 0;
    for (const [k, dmg] of free) {
      if (!pick(k) || !covered.has(k)) continue;
      expect(dmg / covered.get(k)!, k).toBeCloseTo(factor, 10);
      compared++;
    }
    return compared;
  };
  const tankAt = (target: string, stand = 1) => (k: string): boolean => k === `tank_light>${target}@${stand}`;

  it('the data names plains, grassland and desert and a figure above 1', () => {
    expect(OPEN.fire).toBeGreaterThan(1);
    expect(OPEN.terrain).toEqual(['plains', 'grassland', 'desert']);
  });

  it.each([
    [Terrain.Plains, OPEN.fire], [Terrain.Grassland, OPEN.fire], [Terrain.Desert, OPEN.fire],
    [Terrain.Forest, 1], [Terrain.Hills, 1], [Terrain.Urban, 1],
  ])('on ground %i a tank’s volley at the infantry and the howitzers of a division with no AT gun left is × %f of the one with the gun alive', (terrain, factor) => {
    const stands: Stand[] = [[POL, 'tank_brigade', 0, 0], [GER, 'infantry_div', 1, 0]];
    const covered = fired(stands, false, terrain);
    const free = fired(stands, true, terrain);
    expect(expectFire(covered, free, tankAt('infantry'), factor)).toBe(1);
    expect(expectFire(covered, free, (k) => k.startsWith('tank_light>'), factor)).toBeGreaterThan(0);
    // The brigade's own infantry is not armour: its fire is the same.
    expect(expectFire(covered, free, (k) => k.startsWith('infantry_motorised>'), 1)).toBeGreaterThan(0);
  });

  it('a target with armour takes × 1: the tanks and the mechanised infantry of a heavy panzer division', () => {
    // The Italian division beside it brings the AT gun, and its own infantry is what the rule is read on.
    const stands: Stand[] = [[POL, 'tank_corps', 0, 0], [GER, 'heavy_panzer_div', 1, 0], [ITA, 'infantry_div', 0, 1]];
    const covered = fired(stands, false);
    const free = fired(stands, true);
    expect(expectFire(covered, free, tankAt('infantry_mechanised'), 1)).toBe(1);
    expect(expectFire(covered, free, (k) => /^tank_light>tank_/.test(k), 1)).toBeGreaterThan(0);
    expect(expectFire(covered, free, tankAt('infantry', 2), OPEN.fire)).toBe(1);
    // The corps's howitzers are not armour either.
    expect(expectFire(covered, free, (k) => k.startsWith('artillery_heavy>'), 1)).toBeGreaterThan(0);
  });

  it('the AT gun of another formation of the target’s side covers it, and so does an ally’s', () => {
    for (const nation of [GER, ITA]) {
      const stands: Stand[] = [[POL, 'tank_brigade', 0, 0], [GER, 'garrison_brigade', 1, 0], [nation, 'infantry_div', 0, 1]];
      expect(expectFire(fired(stands, false), fired(stands, true), tankAt('infantry'), OPEN.fire)).toBe(1);
    }
    // With no gun on that side the fire is the same as with its guns destroyed.
    const stands: Stand[] = [[POL, 'tank_brigade', 0, 0], [GER, 'garrison_brigade', 1, 0], [ITA, 'infantry_div_cadre', 0, 1]];
    expect(expectFire(fired(stands, false), fired(stands, true), tankAt('infantry'), 1)).toBe(1);
  });

  it('the gun covers its side and not its enemy: the tanks’ own AT gun gives the target nothing', () => {
    // A Polish division with a gun beside the Polish tanks: the garrison has none, and takes the fire in full
    // (× the bonus of the three arms: that division's howitzers are the tanks' third arm).
    const lone: Stand[] = [[POL, 'tank_brigade', 0, 0], [GER, 'garrison_brigade', 1, 0]];
    const withGun: Stand[] = [...lone, [POL, 'infantry_div', 0, 1]];
    const covered: Stand[] = [[POL, 'tank_brigade', 0, 0], [GER, 'infantry_div', 1, 0]];
    const open = fired(covered, true).get('tank_light>infantry@1')! / fired(covered, false).get('tank_light>infantry@1')!;
    expect(open).toBeCloseTo(OPEN.fire, 10);
    expect(fired(withGun, false).get('tank_light>infantry@1')! / fired(lone, false).get('tank_light>infantry@1')!).toBeCloseTo(BONUS, 10);
    expect(fired(lone, false).get('tank_light>infantry@1')! / fired(covered, true).get('tank_light>infantry@1')!).toBeCloseTo(1, 10);
  });
});
