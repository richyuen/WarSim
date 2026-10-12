import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, PORTS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { declareWar } from '../../src/sim/systems/war';
import { assets1938 } from '../helpers/earth';
import { addDivision } from '../helpers/sim1938';

// PLAN 4.8m (the tenth read): a formation's place aboard (`world.embarked`) went with neither
// it nor its transports when they were destroyed, and a formation made before the next hour took
// the dead one's id (the table gives the last freed id first): a British division aboard was set
// in Berlin, or a new German division was aboard British transports. God Mode's remove and spawn
// do it; so do transports sunk at 23:00 and a delivery at 00:00.

const { w: W, h: H } = SIZE_1938;
const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const [ENG, GER] = [id('ENG'), id('GER')];

/** A British division aboard its transports at Portsmouth, ordered to Calais (Germany and Britain at war, the AI off). */
function aboard(): { s: Sim; div: number; fleet: number } {
  const s = new Sim({ scenario: '1938', seed: 4501, assets: assets1938(W) });
  const w = s.world;
  w.settings.aiEnabled = false;
  declareWar(w, GER, ENG, true);
  const pc = w.ports.find((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === 'Portsmouth')!.cell;
  const [px, py] = w.cellPoint(pc);
  const div = addDivision(w, ENG, px, py);
  const [cx, cy] = cellOf(1.86, 50.95, W, H).map((v) => Math.floor(v) + 0.5);
  s.command({ kind: 'moveFormation', id: div, x: cx!, y: cy! });
  s.step(1);
  return { s, div, fleet: w.embarked.get(div)!.fleet };
}

/** A German division spawned in Berlin in the same hour: it takes the freed id. */
function spawnInBerlin(s: Sim): void {
  const [bx, by] = cellOf(13.4, 52.5, W, H).map((v) => Math.floor(v) + 0.5);
  s.command({ kind: 'spawnFormation', nation: GER, x: bx!, y: by!, strength: 1, template: 0 });
}

describe('a place aboard goes with the formation and with its transports (PLAN 4.8m)', () => {
  it('the division removed and a German one spawned: the German one is not aboard', () => {
    const { s, div } = aboard();
    s.command({ kind: 'removeFormation', id: div });
    spawnInBerlin(s);
    s.step(1);
    const w = s.world;
    expect(w.formations.has(div), 'the id given out again').toBe(true);
    expect(w.formations.cols.nation[div]).toBe(GER);
    expect(w.embarked.has(div)).toBe(false);
    expect(w.afloat(div)).toBe(false);
  });

  it('the transports removed and a German division spawned in its id: the British division is lost with them, the German one stays in Berlin', () => {
    const { s, div, fleet } = aboard();
    s.command({ kind: 'removeFormation', id: fleet });
    spawnInBerlin(s);
    s.step(1);
    const w = s.world;
    const c = w.formations.cols;
    expect(w.formations.has(fleet) && c.nation[fleet]).toBe(GER);
    expect(w.formations.has(div), 'the British division, lost at sea with its transports').toBe(false);
    const [bx, by] = cellOf(13.4, 52.5, W, H);
    expect(Math.hypot(c.x[fleet]! - bx, c.y[fleet]! - by)).toBeLessThan(2);
    expect(w.cells.controller[Math.floor(by) * W + Math.floor(bx)]).toBe(GER);
  });
});
