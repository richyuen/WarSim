import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { FRONT_KM, placeParts, TARGET_SCALE, THEATRE_FLOOR, THEATRE_MEN_MIN } from '../../src/sim/systems/nuclear';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.18j (ADR-492; critic R8-B1's "a small third party for a thousand dead"): a place's enemy
// men were weighed as a share of the enemy side's men within FRONT_KM of it, its theatre (7.18c),
// so a lone garrison was the whole of its theatre: seed 4's Britain struck Japanese garrisons of
// 2,267 to 5,229 men for 935 to 2,305 dead. The theatre counts for at least THEATRE_FLOOR of all
// the side's men, and at least THEATRE_MEN_MIN men (PLAN 7.32, ADR-528).

const { w: W, h: H } = SIZE_1938;
const [ENG, JAP] = ['ENG', 'JAP'].map(nationId) as [number, number];

describe("a place's men weighed against a theatre of weight (PLAN 7.18j)", () => {
  it('a lone Japanese garrison is a small share of the side, not the whole of its theatre; a massed army is weighed as before', () => {
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    const w = s.world;
    const war = w.wars.start([ENG], [JAP], 0);
    const c = w.formations.cols;
    const enemy = new Set(war.sides[1]);
    const ids: number[] = [];
    w.formations.forEach((id) => {
      if (enemy.has(c.nation[id]!) && !w.offLand(id)) ids.push(id);
    });
    expect(ids.length).toBeGreaterThan(5);

    // A garrison alone: the Japanese formation nearest 5,000 men (the measured garrisons: 456 to
    // 5,229), set down where no other enemy formation is within FRONT_KM (found on a grid of the
    // map), its theatre itself.
    const lone = ids.reduce((a, b) => (Math.abs(c.strength[b]! - 5000) < Math.abs(c.strength[a]! - 5000) ? b : a));
    const others = ids.filter((id) => id !== lone);
    let at: [number, number] | null = null;
    for (let y = 10; y < H - 10 && !at; y += 8) {
      for (let x = 0; x < W && !at; x += 8) {
        if (others.every((id) => seaKm(w, x, y, c.x[id]!, c.y[id]!) > FRONT_KM * 1.1)) at = [x + 0.5, y + 0.5];
      }
    }
    expect(at, 'a place a theatre away from every other enemy formation').not.toBeNull();
    c.x[lone] = at![0];
    c.y[lone] = at![1];
    const g = placeParts(w, ENG, war, 0, at![0], at![1]);
    const strength = c.strength[lone]!;
    process.stderr.write(`lone garrison of ${strength} men: theatre ${Math.round(g.menAll)}, weighed against ${Math.round(g.theatreMen)} (side ${Math.round(g.sideMen)}), men share ${g.menShare.toFixed(4)}, value ${g.value.toFixed(3)}\n`);
    expect(g.menAll).toBe(strength);
    expect(strength).toBeLessThan(0.01 * g.sideMen);
    expect(g.theatreMen).toBeCloseTo(Math.max(THEATRE_FLOOR * g.sideMen, THEATRE_MEN_MIN));
    // Before 7.18j: menHit / menAll, near 1 (a value of 1). Now at most its men / the floor.
    expect(g.menShare).toBeLessThanOrEqual(strength / (THEATRE_FLOOR * g.sideMen) + 1e-9);
    expect(g.capital).toBe(0);
    // Its whole value was the chance through (a share of 1 × TARGET_SCALE, to 1); now under a third of it.
    expect(g.value).toBeLessThan(g.through / 3);

    // Where the side's men are massed (the place of most Japanese men within a blast), the theatre
    // is above the floor and the share is the theatre's, as before.
    let best = { men: -1, x: 0, y: 0 };
    for (const id of others) {
      let men = 0;
      for (const o of others) if (seaKm(w, c.x[id]!, c.y[id]!, c.x[o]!, c.y[o]!) < 30) men += c.strength[o]!;
      if (men > best.men) best = { men, x: c.x[id]!, y: c.y[id]! };
    }
    const m = placeParts(w, ENG, war, 0, best.x, best.y);
    process.stderr.write(`massed: ${best.men} men within 30 km, theatre ${Math.round(m.menAll)} of ${Math.round(m.sideMen)}, men share ${m.menShare.toFixed(4)}, value ${m.value.toFixed(3)}\n`);
    expect(m.menAll).toBeGreaterThan(THEATRE_FLOOR * m.sideMen);
    expect(m.theatreMen).toBe(m.menAll);
    expect(TARGET_SCALE * m.menShare).toBeGreaterThan(TARGET_SCALE * g.menShare);
  }, 300_000);
});
