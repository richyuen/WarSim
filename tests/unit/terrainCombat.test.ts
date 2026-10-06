import { describe, expect, it } from 'vitest';
import terrainJson from '../../data/terrain.json' with { type: 'json' };
import unitsLand from '../../data/units/land.json' with { type: 'json' };
import { Terrain, TERRAIN_IDS } from '../../src/shared/terrain';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_LAND, UNIT_IDS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { combatSystem } from '../../src/sim/systems/combat';
import { destroyFormation } from '../../src/sim/systems/elements';
import { FIRE_STRIDE, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 3.3a: the ground in a battle, by unit class (`data/terrain.json`, in since PLAN 1.13) and
// by unit type (`terrainMods` of `data/units/land.json`, read by nothing before this task).
// AT of 3.3: identical battles on plains and in forest yield the expected outcome swing.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const GER = nationId('GER');
const POL = nationId('POL');
const [X0, Y0] = cellOf(30.0, 50.0, W, H).map(Math.floor) as [number, number];
const template = (id: string): number => TEMPLATES_LAND.findIndex((t) => t.id === id);

type Mods = Partial<Record<string, { atk: number; def: number; speed: number }>>;
const UNITS = unitsLand.types as unknown as { id: string; class: string; terrainMods: Mods }[];
const unitOf = (i: number): { id: string; class: string; terrainMods: Mods } => UNITS.find((u) => u.id === UNIT_IDS_1938[i])!;

/** The same battle on one ground: `attacker` (on the move) against `defender` (holding), a cell apart. */
function battle(terrain: number, attacker: string, defender: string): { world: World; att: number; def: number } {
  const s = new Sim({ scenario: '1938', seed: 5, assets: assets1938(W) });
  const world = s.world;
  world.formations.ids().forEach((id) => destroyFormation(world, id));
  world.wars.set(GER, POL, true);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) world.cells.terrain[(Y0 + dy) * W + X0 + dx] = terrain;
  const att = addDivision(world, GER, X0 + 0.5, Y0 + 0.5, template(attacker));
  world.formations.cols.moving[att] = 1;
  const def = addDivision(world, POL, X0 + 1.5, Y0 + 0.5, template(defender));
  return { world, att, def };
}

/** The first hour's volleys: [shooter, target, shooter's unit, target's unit, damage, 1 if the target is the defender's]. */
function volleys(terrain: number, attacker: string, defender: string): number[][] {
  const { world, def } = battle(terrain, attacker, defender);
  combatSystem(world);
  const fr = world.out.fires;
  const out: number[][] = [];
  for (let i = 0; i < fr.length; i += FIRE_STRIDE) out.push([fr[i + 2]!, fr[i + 3]!, fr[i + 4]!, world.elements.cols.unit[fr[i + 3]!]!, fr[i + 5]!, world.elements.cols.formation[fr[i + 3]!] === def ? 1 : 0]);
  return out;
}

/** Men the defender loses in `hours` of that battle, and the attacker. */
function losses(terrain: number, attacker: string, defender: string, hours: number): { def: number; att: number } {
  const { world, att, def } = battle(terrain, attacker, defender);
  const c = world.formations.cols;
  const a0 = c.strength[att]!;
  const d0 = c.strength[def]!;
  for (let h = 0; h < hours; h++) {
    combatSystem(world);
    world.tick++;
    world.out.fires.length = 0;
  }
  return { def: d0 - (world.formations.has(def) ? c.strength[def]! : 0), att: a0 - (world.formations.has(att) ? c.strength[att]! : 0) };
}

/** What the tables say a volley on `terrain` is worth beside the same volley on plains. */
function expected(terrain: number, shooterUnit: number, targetUnit: number, targetHolds: boolean): number {
  const id = TERRAIN_IDS[terrain]!;
  const row = terrainJson.terrain[terrain]!;
  const su = unitOf(shooterUnit);
  const tu = unitOf(targetUnit);
  const atk = ((row.attack as Record<string, number | undefined>)[su.class] ?? 1) * (su.terrainMods[id]?.atk ?? 1);
  const def = targetHolds ? row.defense * (tu.terrainMods[id]?.def ?? 1) : 1;
  return atk / def;
}

describe('terrain in a battle, by class and by unit type (PLAN 3.3a)', () => {
  for (const [terrain, attacker, defender] of [
    [Terrain.Forest, 'panzer_div', 'infantry_div'],
    [Terrain.Forest, 'cavalry_div', 'infantry_div'],
    [Terrain.Urban, 'heavy_panzer_div', 'infantry_div'],
    [Terrain.Marsh, 'heavy_panzer_div', 'motorised_div'],
    [Terrain.Mountains, 'motorised_div', 'cavalry_div'],
  ] as const) {
    it(`every volley of ${attacker} against ${defender} on ${TERRAIN_IDS[terrain]} is the one on plains × the two tables`, () => {
      const plains = volleys(Terrain.Plains, attacker, defender);
      const there = volleys(terrain, attacker, defender);
      // The ground changes no target choice: the same volleys, one for one.
      expect(there.length).toBe(plains.length);
      expect(there.length).toBeGreaterThan(30);
      let unitMod = 0;
      for (let i = 0; i < there.length; i++) {
        const [s, t, su, tu, dmg, held] = there[i]!;
        const p = plains[i]!;
        expect([s, t]).toEqual([p[0], p[1]]);
        // The defender holds; the attacker is on the move and has no cover.
        const targetHolds = held === 1;
        const want = expected(terrain, su!, tu!, targetHolds);
        expect(dmg! / p[4]!, `${unitOf(su!).id} at ${unitOf(tu!).id}`).toBeCloseTo(want, 10);
        const id = TERRAIN_IDS[terrain]!;
        if ((unitOf(su!).terrainMods[id]?.atk ?? 1) !== 1 || (targetHolds && (unitOf(tu!).terrainMods[id]?.def ?? 1) !== 1)) unitMod++;
      }
      // The battle is one in which a unit type's own figure is in play, not the class table alone.
      expect(unitMod).toBeGreaterThan(0);
    });
  }

  it('the AT of 3.3: a panzer division takes from a holding infantry division in forest about half of what it takes on plains, and pays the same', () => {
    const plains = losses(Terrain.Plains, 'panzer_div', 'infantry_div', 48);
    const forest = losses(Terrain.Forest, 'panzer_div', 'infantry_div', 48);
    expect(plains.def).toBeGreaterThan(0);
    // Light tanks 0.8, medium 0.75, the motorised infantry 1, the guns 0.9; ÷ 1.25 for the
    // ground and ÷ 1.1 more for the infantry (÷ 1.15 the AT gun): between 0.75 ÷ 1.25 ÷ 1.15
    // and 1 ÷ 1.25 ÷ 1.1.
    const swing = forest.def / plains.def;
    expect(swing).toBeGreaterThan(0.75 / 1.25 / 1.15);
    expect(swing).toBeLessThan(1 / 1.25 / 1.1);
    // The infantry's fire at an attacker on the move is the same on both (its AT gun's 1.05 in
    // forest aside): the exchange swings by the defender's side of it.
    expect(forest.att / plains.att).toBeGreaterThan(0.9);
    expect(forest.att / plains.att).toBeLessThan(1.1);
    expect(forest.def / forest.att).toBeLessThan((plains.def / plains.att) * 0.75);
  });

  it('infantry holding a forest loses 1 ÷ (1.25 × 1.1) of what it loses on plains to infantry', () => {
    const plains = losses(Terrain.Plains, 'garrison_brigade', 'garrison_brigade', 48);
    const forest = losses(Terrain.Forest, 'garrison_brigade', 'garrison_brigade', 48);
    expect(plains.def).toBeGreaterThan(0);
    // The attacker has no cover on either ground; it loses a little more in the forest, where
    // more of the defender lives to fire. Its own fire is all but the same, so the defender's
    // loss is the table's figure within 2%.
    expect(forest.att).toBeGreaterThanOrEqual(plains.att);
    expect(forest.att).toBeLessThan(plains.att * 1.03);
    expect(forest.def / plains.def).toBeGreaterThan(0.98 / 1.375);
    expect(forest.def / plains.def).toBeLessThan(1.02 / 1.375);
  });
});
