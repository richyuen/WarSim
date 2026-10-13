import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, PORTS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { strayLanding } from '../../src/sim/systems/amphibious';
import { seaControlOf } from '../../src/sim/systems/seaControl';
import { destroyFormation } from '../../src/sim/systems/elements';
import { declareWar } from '../../src/sim/systems/war';
import { seaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision } from '../helpers/sim1938';

// PLAN 4.8n (the tenth read): transports that stood anywhere but the landing's water put their
// troops ashore at the nearest land of any holder, and with no question of the sea: sent on to
// Wilhelmshaven's water they took a German beachhead, sent off the Dutch coast they landed in
// the Netherlands at peace. Ashore there only on land of the formation's side or no one's, and
// on no one's not where an enemy holds the sea.

const { w: W, h: H } = SIZE_1938;
const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const [ENG, GER, NED] = [id('ENG'), id('GER'), id('NED')];

/** A British division aboard its transports at Portsmouth, ordered to Calais (the AI off). */
function aboard(war: boolean): { s: Sim; div: number; fleet: number } {
  const s = new Sim({ scenario: '1938', seed: 4501, assets: assets1938(W) });
  const w = s.world;
  w.settings.aiEnabled = false;
  if (war) declareWar(w, GER, ENG, true);
  const pc = w.ports.find((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === 'Portsmouth')!.cell;
  const [px, py] = w.cellPoint(pc);
  const div = addDivision(w, ENG, px, py);
  const [cx, cy] = cellOf(1.86, 50.95, W, H).map((v) => Math.floor(v) + 0.5);
  s.command({ kind: 'moveFormation', id: div, x: cx!, y: cy! });
  s.step(1);
  return { s, div, fleet: w.embarked.get(div)!.fleet };
}

/** Sails the transports to (x, y) and runs `hours`; the cell the division landed on, -1 for none. */
function sendTransports(s: Sim, div: number, fleet: number, x: number, y: number, hours: number): number {
  s.command({ kind: 'moveFormation', id: fleet, x, y });
  let at = -1;
  for (let h = 0; h < hours && at < 0; h++) {
    s.step(1, (world) => {
      const ev = world.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.FormationLanded && ev[i + 2] === div) at = Math.floor(ev[i + 5]!) * W + Math.floor(ev[i + 4]!);
    });
  }
  return at;
}

describe('transports that stand elsewhere land on their side\'s coast or no one\'s (PLAN 4.8n)', () => {
  it('sent off the Dutch coast at peace: no landing in the Netherlands', () => {
    const { s, div, fleet } = aboard(false);
    const [nx, ny] = cellOf(4.0, 52.4, W, H).map((v) => Math.floor(v) + 0.5);
    const at = sendTransports(s, div, fleet, nx!, ny!, 72);
    if (at >= 0) expect(s.world.cells.controller[at], 'landed in the Netherlands').not.toBe(NED);
  });

  it('sent to Wilhelmshaven\'s water at war: no German cell taken', () => {
    const { s, div, fleet } = aboard(true);
    const w = s.world;
    // No German ship to meet the transports on the way.
    for (const f of [...w.formations.ids()]) if (w.isFleet(f) && w.formations.cols.nation[f] === GER) destroyFormation(w, f);
    const wh = w.ports.find((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === 'Wilhelmshaven')!;
    const [tx, ty] = w.cellPoint(wh.cell);
    const before = w.cells.controller.slice();
    const at = sendTransports(s, div, fleet, tx, ty, 120);
    if (at >= 0) expect(before[at], 'landed on a German cell').not.toBe(GER);
    let taken = 0;
    for (let k = 0; k < before.length; k++) if (before[k] === GER && w.cells.controller[k] === ENG) taken++;
    expect(taken).toBe(0);
  });

  it('on no one\'s coast, not where an enemy holds the sea; on its own, whoever holds it', () => {
    const { s, fleet } = aboard(true);
    const w = s.world;
    const z = seaOf(w);
    // The transports' own water off Portsmouth: British coast.
    const at = Math.floor(w.formations.cols.y[fleet]!) * W + Math.floor(w.formations.cols.x[fleet]!);
    const zone = z.zoneOf[at]!;
    expect(zone).toBeGreaterThan(0);
    seaControlOf(w).holder[zone] = GER;
    const own = strayLanding(w, ENG, at);
    expect(own, 'its own coast').toBeGreaterThanOrEqual(0);
    expect(w.cells.controller[own]).toBe(ENG);
    // The same coast made no one's: the German-held sea keeps the troops aboard; a free sea lands them.
    const cells: number[] = [];
    for (let k = 0; k < w.cells.controller.length; k++) {
      const dx = Math.abs((k % W) - (at % W));
      const dy = Math.abs(Math.floor(k / W) - Math.floor(at / W));
      if (dx <= 4 && dy <= 4 && w.cells.controller[k] === ENG) cells.push(k);
    }
    for (const k of cells) w.cells.controller[k] = 0;
    expect(strayLanding(w, ENG, at), 'an enemy-held sea').toBe(-1);
    seaControlOf(w).holder[zone] = 0;
    const free = strayLanding(w, ENG, at);
    expect(free, 'a free sea').toBeGreaterThanOrEqual(0);
    expect(w.cells.controller[free]).toBe(0);
  });
});
