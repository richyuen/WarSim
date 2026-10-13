import { expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { BOMB_SUPERIORITY } from '../../src/sim/ai/air';
import { airSuperiority } from '../../src/sim/systems/airSuperiority';
import { airOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 5.6, the AT: a headless run (seed 99, a year): air superiority contested over active
// fronts; strategic bombing appears when superiority is high.

it('seed 99, a year: the air contested over the fronts, and the strategic bombers bomb where their side holds the air', () => {
  const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  const zoneOf = airOf(w).zoneOf;
  const W = w.cells.w;
  let contested = 0;
  let frontDays = 0;
  let contestedFront = 0;
  const strategic: number[] = [];
  let strikes = 0;
  s.step(24 * 365, (ww) => {
    const c = ww.formations.cols;
    for (let i = 0; i < ww.out.events.length; i += 6) {
      if (ww.out.events[i + 1] !== EventKind.AirStrike) continue;
      strikes++;
      const wing = ww.out.events[i + 2]!;
      if (!ww.formations.has(wing)) continue;
      const cls = ww.rules!.units[ww.rules!.templates[c.template[wing]!]!.elements[0]!.unit]!.cls;
      if (cls !== 'bomber_str') continue;
      const [x, y] = [ww.out.events[i + 4]!, ww.out.events[i + 5]!];
      strategic.push(airSuperiority(ww, c.nation[wing]!, zoneOf[Math.floor(y) * W + Math.floor(x)]!));
    }
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
    if (ww.tick % 24 !== 0) return;
    // The fronts' zones today: where land formations are in contact.
    const front = new Set<number>();
    ww.formations.forEach((id) => {
      if (!ww.offLand(id) && c.engaged[id] === 1) front.add(zoneOf[Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!)]!);
    });
    frontDays += front.size;
    // A zone contested: two nations at war have both flown there.
    for (const [z, byNation] of ww.airPower) {
      const ns = [...byNation.keys()];
      if (!ns.some((a) => ns.some((b) => ww.wars.atWar(a, b)))) continue;
      contested++;
      if (front.has(z)) contestedFront++;
    }
  });
  const high = strategic.filter((v) => v >= BOMB_SUPERIORITY).length;
  console.log(`a year of seed 99: ${strikes} strikes, ${strategic.length} by strategic bombers (${high} at superiority ${BOMB_SUPERIORITY} or more, median ${[...strategic].sort((a, b) => a - b)[strategic.length >> 1]?.toFixed(2)}); zone-days contested ${contested}, of them over a front ${contestedFront}, front zone-days ${frontDays}`);
  expect(contestedFront).toBeGreaterThan(0);
  expect(strategic.length).toBeGreaterThan(0);
  expect(high / strategic.length).toBeGreaterThan(0.8);
}, 900_000);
