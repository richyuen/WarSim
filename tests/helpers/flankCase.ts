import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { contactsOf, deployOf, elementIndex, slotCount } from '../../src/sim/systems/elements';
import { assets1938 } from './earth';

// Where a block comes to an enemy block from its flank (PLAN 3.11c2), found in Node: the worker
// runs the same sim (I4). The critic's other game: seed 4242, Germany declares war on Poland at
// tick 0 (God Mode).

export interface FlankCase {
  /** The day, whole days from the start, the three are in contact on. */
  day: number;
  /** The German formation the Pole's block faces, the German one that comes to it, and the Pole. */
  faced: number;
  comer: number;
  pole: number;
  /** How far round from the way the Pole's block faces the comer stands, degrees. */
  angle: number;
}

/** From the way a block faces, how far round a comer stands to come from its flank, degrees. */
const FLANK: readonly [number, number] = [45, 135];

/**
 * The first day from `firstDay` to `lastDay` (the lowest Pole's id on it) on which a Polish
 * formation in contact is front to front with a German one (each the other's nearest enemy in
 * contact) and one other German formation in contact, whose nearest enemy is that Pole, stands
 * off the way the Pole's block faces by FLANK degrees.
 */
export function flankCase(firstDay: number, lastDay: number): FlankCase {
  const sim = new Sim({ scenario: '1938', seed: 4242, assets: assets1938(SIZE_1938.w) });
  const tag = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
  const [GER, POL] = [tag('GER'), tag('POL')];
  sim.command({ kind: 'declareWar', attacker: GER, defender: POL });
  let found: FlankCase | null = null;
  for (let day = 1; day <= lastDay && found === null; day++) {
    sim.step(23);
    // The day's last hour, and the state after it.
    sim.step(1, day < firstDay ? undefined : (w) => {
      const c = w.formations.cols;
      const contacts = contactsOf(w);
      const idx = elementIndex(w);
      const cases: FlankCase[] = [];
      for (const [comer, pole] of contacts) {
        if (c.nation[comer] !== GER || c.nation[pole] !== POL) continue;
        const faced = contacts.get(pole);
        if (faced === undefined || faced === comer || c.nation[faced] !== GER || contacts.get(faced) !== pole) continue;
        // One comer alone: no line of others before or beside it.
        if ([...contacts].some(([o, p]) => p === pole && o !== comer && o !== faced)) continue;
        const block = deployOf(w, pole, slotCount(w, pole, idx.get(pole)?.length ?? 0));
        if (!block) continue;
        const off = Math.atan2(c.y[comer]! - block.y, c.x[comer]! - block.x) - block.facing;
        const angle = (Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) * 180) / Math.PI;
        if (angle >= FLANK[0] && angle <= FLANK[1]) cases.push({ day, faced, comer, pole, angle });
      }
      found = cases.sort((a, b) => a.pole - b.pole)[0] ?? null;
    });
  }
  if (found === null) throw new Error(`no block comes to a Polish block from its flank from day ${firstDay} to ${lastDay}`);
  return found;
}
