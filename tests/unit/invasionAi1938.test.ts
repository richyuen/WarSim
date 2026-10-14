import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { declareWar } from '../../src/sim/systems/war';
import { navOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 4.6b: the AI's invasions. The United Kingdom at war with Iceland, with which it has no
// land anywhere (Denmark, Iceland's king's, joins Iceland's side): its AI sends divisions to a
// port with transports, puts them aboard and lands them on its enemies' coast, the nearest
// enemy port to its transports: Denmark's.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const ICE = id('ICE');
const DEN = id('DEN');

describe('the AI\'s invasions (PLAN 4.6b)', () => {
  it('the United Kingdom at war with Iceland and Denmark lands divisions on their coast within 60 days, and takes the cell', () => {
    const s = new Sim({ scenario: '1938', seed: 4601, assets: assets1938(W) });
    const w = s.world;
    const home = navOf(w).grid.component[Math.floor(w.nations.cols.capitalY[ENG]!) * W + Math.floor(w.nations.cols.capitalX[ENG]!)]!;
    expect(declareWar(w, ENG, ICE, true)).not.toBeNull();
    // The air out of it (PLAN 5.12b): British strikes on Denmark's forces, in contact or not, won
    // Britain the peace on the seventh day, before its landing on the ninth. The case is the landing.
    for (const [wing] of [...w.wingBase]) if ([ENG, ICE, DEN].includes(w.formations.cols.nation[wing]!)) destroyFormation(w, wing);
    let embarked = -1;
    let landed = -1;
    let where = -1;
    for (let d = 0; d < 60 && landed < 0; d++) {
      s.step(24, (world) => {
        const ev = world.out.events;
        for (let i = 0; i < ev.length; i += 6) {
          const f = ev[i + 2]!;
          if (ev[i + 3] !== ENG) continue;
          if (ev[i + 1] === EventKind.FormationEmbarked && embarked < 0) embarked = d;
          const cell = Math.floor(world.formations.cols.y[f]!) * W + Math.floor(world.formations.cols.x[f]!);
          if (ev[i + 1] === EventKind.FormationLanded && landed < 0 && navOf(world).grid.component[cell] !== home) [landed, where] = [d, cell];
        }
      });
    }
    expect(embarked).toBeGreaterThanOrEqual(0);
    expect(landed).toBeGreaterThanOrEqual(0);
    // An enemy's land, the beachhead British now.
    expect([ICE, DEN]).toContain(w.cells.owner[where]);
    expect(w.cells.controller[where]).toBe(ENG);
    process.stderr.write(`ENG–ICE: aboard on day ${embarked}, ashore on day ${landed} at (${where % W}, ${Math.floor(where / W)}), land of ${NATIONS_1938[w.cells.owner[where]! - 1]!.tag}\n`);
  });

  it('a nation with a land front plans no landing: Germany at war with Poland embarks nobody in 30 days', () => {
    const s = new Sim({ scenario: '1938', seed: 4602, assets: assets1938(W) });
    const w = s.world;
    expect(declareWar(w, id('GER'), id('POL'), true)).not.toBeNull();
    let embarked = 0;
    s.step(30 * 24, (world) => {
      const ev = world.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.FormationEmbarked && (ev[i + 3] === id('GER') || ev[i + 3] === id('POL'))) embarked++;
    });
    expect(embarked).toBe(0);
  });
});
