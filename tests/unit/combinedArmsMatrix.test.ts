import { describe, expect, it } from 'vitest';
import combatJson from '../../data/combat.json' with { type: 'json' };
import unitsLand from '../../data/units/land.json' with { type: 'json' };
import { Terrain } from '../../src/shared/terrain';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_LAND, UNIT_IDS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { combatSystem } from '../../src/sim/systems/combat';
import { destroyFormation } from '../../src/sim/systems/elements';
import { FIRE_STRIDE } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 3.4, the task's AT: a matrix of unit mixes, 48 hours each on plains and in a forest,
// whose outcomes stand to one another as the four rules of the design table say (SPEC §6.1).
// Ratios between mixes, not men: a rule is a factor on a volley (`combinedArms.test.ts` has
// each to ten places), and over 48 hours the dead stop firing, so a ratio is asked a band.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const GER = nationId('GER');
const POL = nationId('POL');
const [X0, Y0] = cellOf(30.0, 50.0, W, H).map(Math.floor) as [number, number];
const HOURS = 48;
const ARMS = combatJson.combinedArms.arms;
const UNITS = new Map((unitsLand.types as unknown as { id: string; class: string; stats: { hpPerUnit: number } }[]).map((u) => [u.id, u]));
const classOf = (unit: number): string => UNITS.get(UNIT_IDS_1938[unit]!)!.class;
const isTank = (unit: number): boolean => ARMS.armour.includes(classOf(unit));

/** A formation of the matrix: a template, and the unit classes of it destroyed before the first hour. */
type Mix = { template: string; without: string[] };
const INFANTRY = [...ARMS.infantry];
const HOWITZERS = [...ARMS.artillery];
const AT = [...combatJson.gunsOnGuns.shooter];
const ATTACKERS = {
  brigade: { template: 'tank_brigade', without: [] },
  tanksAlone: { template: 'tank_brigade', without: INFANTRY },
  panzer: { template: 'panzer_div', without: [] },
  panzerNoGuns: { template: 'panzer_div', without: HOWITZERS },
} satisfies Record<string, Mix>;
const DEFENDERS = {
  rifle: { template: 'infantry_div', without: [] },
  noAt: { template: 'infantry_div', without: AT },
  noHowitzers: { template: 'infantry_div', without: HOWITZERS },
  riflesOnly: { template: 'infantry_div', without: [...AT, ...HOWITZERS] },
} satisfies Record<string, Mix>;
const GROUNDS = { plains: Terrain.Plains, forest: Terrain.Forest };

type Outcome = {
  /** Men of the defender's battalions lost. */
  men: number;
  /** Of those, to the fire of the attacker's tanks. */
  menToTanks: number;
  /** Tanks the attacker lost. */
  tanks: number;
  /** Of those, to the defender's AT battery. */
  tanksToAt: number;
  /** Health (tanks × `hpPerUnit`) the AT battery took off the attacker's tanks. */
  atHealth: number;
};

function fight(attacker: Mix, defender: Mix, terrain: number): Outcome {
  const s = new Sim({ scenario: '1938', seed: 5, assets: assets1938(W) });
  const world = s.world;
  world.formations.ids().forEach((id) => destroyFormation(world, id));
  world.wars.set(GER, POL, true);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) world.cells.terrain[(Y0 + dy) * W + X0 + dx] = terrain;
  const place = (nation: number, mix: Mix, dx: number): number => {
    const id = addDivision(world, nation, X0 + 0.5 + dx, Y0 + 0.5, TEMPLATES_LAND.findIndex((t) => t.id === mix.template));
    world.elements.forEach((el) => {
      if (ec.formation[el] === id && mix.without.includes(classOf(ec.unit[el]!))) ec.strength[el] = 0;
    });
    return id;
  };
  const ec = world.elements.cols;
  const a = place(GER, attacker, 0);
  const d = place(POL, defender, 1);
  const out: Outcome = { men: 0, menToTanks: 0, tanks: 0, tanksToAt: 0, atHealth: 0 };
  for (let h = 0; h < HOURS; h++) {
    world.out.fires.length = 0;
    // What each element has left to lose this hour: a volley at a battalion nearly dead counts for no more.
    const left = new Map<number, number>();
    world.elements.forEach((el) => left.set(el, ec.strength[el]!));
    combatSystem(world);
    const fr = world.out.fires;
    for (let i = 0; i < fr.length; i += FIRE_STRIDE) {
      const shooter = fr[i + 4]!;
      const t = fr[i + 3]!;
      const target = ec.unit[t]!;
      const dmg = Math.min(fr[i + 5]!, left.get(t) ?? 0);
      left.set(t, (left.get(t) ?? 0) - dmg);
      if (ec.formation[t] === d && classOf(target) === 'inf') {
        out.men += dmg;
        if (isTank(shooter)) out.menToTanks += dmg;
      } else if (ec.formation[t] === a && isTank(target)) {
        out.tanks += dmg;
        if (AT.includes(classOf(shooter))) {
          out.tanksToAt += dmg;
          out.atHealth += dmg * UNITS.get(UNIT_IDS_1938[target]!)!.stats.hpPerUnit;
        }
      }
    }
    world.tick++;
  }
  return out;
}

type Attacker = keyof typeof ATTACKERS;
type Defender = keyof typeof DEFENDERS;
type Ground = keyof typeof GROUNDS;
const fought = new Map<string, Outcome>();
/** The outcome of one cell of the matrix (fought once). */
function cell(ground: Ground, attacker: Attacker, defender: Defender = 'rifle'): Outcome {
  const k = `${ground} ${attacker} ${defender}`;
  let o = fought.get(k);
  if (!o) fought.set(k, (o = fight(ATTACKERS[attacker], DEFENDERS[defender], GROUNDS[ground])));
  return o;
}
/** A ratio of two outcomes is a rule's factor, to 3 %: what 48 hours of losses move it by. */
const expectRatio = (a: number, b: number, factor: number): void => {
  expect(b).toBeGreaterThan(0);
  expect(a / b / factor).toBeGreaterThan(0.97);
  expect(a / b / factor).toBeLessThan(1.03);
};
const GROUND_IDS = Object.keys(GROUNDS) as Ground[];
const WHOLE = ['brigade', 'panzer'] as const;
const TIMEOUT = 60_000;

describe('the matrix of unit mixes (PLAN 3.4)', () => {
  it('rule 1, the three arms: the tanks of a panzer division take × the bonus of what they take with its howitzers destroyed', () => {
    for (const g of GROUND_IDS) expectRatio(cell(g, 'panzer').menToTanks, cell(g, 'panzerNoGuns').menToTanks, combatJson.combinedArms.bonus);
    // The tank brigade has no guns: no formation of the matrix gives it the third arm.
    expect(cell('plains', 'brigade').menToTanks / 20).toBeLessThan(cell('plains', 'panzerNoGuns').menToTanks / 34);
  }, TIMEOUT);

  it('rule 2, the screen: in a forest the AT gun takes × the figure of tanks from a brigade with no infantry left; on plains the same', () => {
    expectRatio(cell('forest', 'tanksAlone').tanksToAt, cell('forest', 'brigade').tanksToAt, combatJson.screen.taken);
    expectRatio(cell('plains', 'tanksAlone').tanksToAt, cell('plains', 'brigade').tanksToAt, 1);
  }, TIMEOUT);

  it('rule 3, guns on guns: the AT gun takes × the figure from a panzer division of what it takes with that division’s howitzers destroyed', () => {
    for (const g of GROUND_IDS) expectRatio(cell(g, 'panzer').atHealth, cell(g, 'panzerNoGuns').atHealth, combatJson.gunsOnGuns.fire);
  }, TIMEOUT);

  it('AT against armour: one battery of 28 elements takes most of the tanks a division takes, the howitzers few', () => {
    for (const g of GROUND_IDS) {
      for (const a of WHOLE) {
        const whole = cell(g, a);
        expect(whole.tanksToAt / whole.tanks).toBeGreaterThan(0.7);
        expect(cell(g, a, 'noAt').tanks / whole.tanks).toBeLessThan(0.3);
        // In order: the division, without its howitzers, without its AT gun, its rifles alone.
        const tanks = (['rifle', 'noHowitzers', 'noAt', 'riflesOnly'] as const).map((d) => cell(g, a, d).tanks);
        expect([...tanks].sort((p, q) => q - p)).toEqual(tanks);
        expect(tanks[1]! / tanks[0]!).toBeGreaterThan(0.9);
      }
    }
  }, TIMEOUT);

  it('rule 4, the open: on plains the tanks take × the figure of men from a division with no AT gun; in a forest the same', () => {
    for (const a of WHOLE) {
      expectRatio(cell('plains', a, 'noAt').menToTanks, cell('plains', a).menToTanks, combatJson.open.fire);
      expectRatio(cell('plains', a, 'riflesOnly').menToTanks, cell('plains', a, 'noHowitzers').menToTanks, combatJson.open.fire);
      expectRatio(cell('forest', a, 'noAt').menToTanks, cell('forest', a).menToTanks, 1);
      expectRatio(cell('forest', a, 'riflesOnly').menToTanks, cell('forest', a, 'noHowitzers').menToTanks, 1);
    }
  }, TIMEOUT);

  it('the ground: every mix takes fewer men in a forest than on plains, and with no AT gun the open is worth more', () => {
    for (const a of WHOLE) {
      for (const d of Object.keys(DEFENDERS) as Defender[]) expect(cell('forest', a, d).men).toBeLessThan(cell('plains', a, d).men);
      const covered = cell('plains', a).men / cell('forest', a).men;
      const free = cell('plains', a, 'noAt').men / cell('forest', a, 'noAt').men;
      expect(covered).toBeGreaterThan(1.5);
      expect(free).toBeGreaterThan(covered * 1.15);
    }
  }, TIMEOUT);
});
