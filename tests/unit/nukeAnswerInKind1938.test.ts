import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { ARMY_STRIKE_CIVILIANS, blastRadius, CAPITAL_MEN_MIN, dayIndustry, detonate, placeParts, restraintOf, TARGET_CAPITAL, weighWar } from '../../src/sim/systems/nuclear';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { grantTechs, techMask } from '../../src/sim/tech';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 7.109b (critic run 13, seed 1129 year 15: the United Kingdom killed 67,951 US soldiers and no
// civilians near Molepolole, and the United States answered on London, 248,000 civilians and 160
// men): an answer is weighed against the strike it answers. Struck at its forces, Germany answers at
// the French places with an army in the blast, not at an emptied Paris, and whole when the strike it
// answers fell on a city. PLAN 7.114: only at places whose toll is of forces, and with none it waits.

const { w: W, h: H } = SIZE_1938;
const [FRA, GER] = ['FRA', 'GER'].map(nationId) as [number, number];

function world(): { s: Sim; w: World; px: number; py: number } {
  const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
  const w = s.world;
  grantTechs(w, GER, techMask([w.rules!.techs.findIndex((t) => t.id === 'ballistic_missiles')]));
  s.command({ kind: 'grantWarheads', nation: GER, count: 5 });
  // Commands apply at the next tick.
  s.step(1);
  w.nations.cols.aggression[GER] = Math.max(0, w.nations.cols.aggression[GER]!);
  const [px, py] = cellOf(2.35, 48.86, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];
  // Paris emptied: no French formation within two blast radii.
  const c = w.formations.cols;
  w.formations.ids().forEach((id) => {
    if (c.nation[id] === FRA && seaKm(w, px, py, c.x[id]!, c.y[id]!) < 2 * blastRadius(1)) destroyFormation(w, id);
  });
  return { s, w, px, py };
}

const nearParis = (w: World, px: number, py: number, x: number, y: number): boolean => seaKm(w, px, py, x, y) < blastRadius(1);

describe('an answer weighed against the strike it answers (PLAN 7.109b)', () => {
  it('struck at its forces, Germany answers at French forces, not at an emptied Paris', () => {
    const { w, px, py } = world();
    const war = w.wars.start([GER], [FRA], 0);
    w.nukeGrievance.set(GER, { by: FRA, until: w.tick + 24 * 90, army: true });
    const r = weighWar(w, GER, war, 0, dayIndustry(w));
    process.stderr.write(`army answer: ${r.places.length} places, ${r.places.filter((p) => nearParis(w, px, py, p.x, p.y)).length} at Paris\n`);
    expect(r.places.length).toBeGreaterThan(0);
    expect(r.places.some((p) => nearParis(w, px, py, p.x, p.y))).toBe(false);
    for (const p of r.places) expect(placeParts(w, GER, war, 0, p.x, p.y).menShare).toBeGreaterThanOrEqual(CAPITAL_MEN_MIN);
    // Paris, weighed alone, is no capital whole while forces are worth the warhead.
    expect(placeParts(w, GER, war, 0, px, py).capital).toBe(0);
    const best = restraintOf(w, GER, war, 0);
    process.stderr.write(`army answer: ${best.reason} at utility ${best.u.toFixed(3)}, ${seaKm(w, px, py, best.x, best.y).toFixed(0)} km from Paris\n`);
    expect(best.reason).toBe('strikes');
    expect(nearParis(w, px, py, best.x, best.y)).toBe(false);
  }, 300_000);

  it('struck at a city, Germany weighs Paris whole, as before', () => {
    const { w, px, py } = world();
    const war = w.wars.start([GER], [FRA], 0);
    w.nukeGrievance.set(GER, { by: FRA, until: w.tick + 24 * 90 });
    const r = weighWar(w, GER, war, 0, dayIndustry(w));
    expect(r.places.some((p) => nearParis(w, px, py, p.x, p.y))).toBe(true);
    expect(placeParts(w, GER, war, 0, px, py).capital).toBe(TARGET_CAPITAL);
  }, 300_000);

  // PLAN 7.114 (ADR-697): with no place of forces, the answer waits or lapses. Until then (7.109b)
  // Germany fell back on Paris, whole: a city for an army.
  it('struck at its forces with no French force left: no place, the answer waits', () => {
    const { w, px, py } = world();
    const c = w.formations.cols;
    w.formations.ids().forEach((id) => {
      if (c.nation[id] === FRA) destroyFormation(w, id);
    });
    const war = w.wars.start([GER], [FRA], 0);
    w.nukeGrievance.set(GER, { by: FRA, until: w.tick + 24 * 90, army: true });
    const r = weighWar(w, GER, war, 0, dayIndustry(w));
    expect(r.places).toEqual([]);
    expect(placeParts(w, GER, war, 0, px, py).capital).toBe(0);
    expect(restraintOf(w, GER, war, 0).reason).toBe('noPlace');
  }, 300_000);

  // PLAN 7.114 (critic run 13's measure; seed 968 of 7.109b: a garrison with a hundredth of the
  // theatre's men taken for forces, 96,000 civilians dead and no men): a place whose burst is expected
  // to kill over ten times more civilians than men is no answer to a strike on forces.
  it('a garrison in Paris is no place of forces: its burst would kill a city', () => {
    const { w, px, py } = world();
    const c = w.formations.cols;
    w.formations.ids().forEach((id) => {
      if (c.nation[id] === FRA) destroyFormation(w, id);
    });
    addDivision(w, FRA, px, py);
    const war = w.wars.start([GER], [FRA], 0);
    w.nukeGrievance.set(GER, { by: FRA, until: w.tick + 24 * 90, army: true });
    const parts = placeParts(w, GER, war, 0, px, py);
    process.stderr.write(`garrison: men share ${parts.menShare.toFixed(4)}, men ${parts.men.toFixed(0)}, people ${parts.people}\n`);
    // Forces in the blast as 7.109b counted them, and a city's toll.
    expect(parts.menShare).toBeGreaterThanOrEqual(CAPITAL_MEN_MIN);
    expect(parts.people).toBeGreaterThan(ARMY_STRIKE_CIVILIANS * parts.men);
    const r = weighWar(w, GER, war, 0, dayIndustry(w));
    expect(r.places.some((p) => nearParis(w, px, py, p.x, p.y))).toBe(false);
    expect(restraintOf(w, GER, war, 0).reason).not.toBe('strikes');
  }, 300_000);

  it("a burst's grievance knows what it struck, and a save keeps it", () => {
    const { s, w } = world();
    const c = w.formations.cols;
    // On a German army (six divisions in the open near Kassel): a strike on forces.
    const [ax, ay] = cellOf(9.5, 51.3, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];
    w.formations.ids().forEach((id) => {
      if (seaKm(w, ax, ay, c.x[id]!, c.y[id]!) < 2 * blastRadius(1)) destroyFormation(w, id);
    });
    for (let k = 0; k < 6; k++) addDivision(w, GER, ax, ay);
    detonate(w, FRA, 1, ax, ay);
    expect(w.nukeGrievance.get(GER)).toMatchObject({ by: FRA, army: true });
    const t = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    t.load(s.save());
    expect(t.world.nukeGrievance.get(GER)?.army).toBe(true);
    // On Berlin emptied of men: a strike on a city, no flag.
    const [bx, by] = [w.nations.cols.capitalX[GER]!, w.nations.cols.capitalY[GER]!];
    w.formations.ids().forEach((id) => {
      if (seaKm(w, bx, by, c.x[id]!, c.y[id]!) < 2 * blastRadius(1)) destroyFormation(w, id);
    });
    detonate(w, FRA, 1, bx, by);
    expect(w.nukeGrievance.get(GER)?.by).toBe(FRA);
    expect(w.nukeGrievance.get(GER)?.army).toBeUndefined();
  }, 300_000);
});
