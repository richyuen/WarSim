import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { declareWar } from '../../src/sim/systems/war';
import { neighbours4 } from '../../src/sim/nav/grid';
import { DEPLOY_RANGE_CELLS } from '../../src/sim/ai/operational';
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
const JAP = id('JAP');
const CHI = id('CHI');
const SIA = id('SIA');

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

  it('the landing per war (PLAN 7.26c3a): Japan, with a land front against China, lands on Siam, its enemy of another war', () => {
    const s = new Sim({ scenario: '1938', seed: 4603, assets: assets1938(W) });
    const w = s.world;
    const home = navOf(w).grid.component[Math.floor(w.nations.cols.capitalY[JAP]!) * W + Math.floor(w.nations.cols.capitalX[JAP]!)]!;
    expect(w.wars.atWar(JAP, CHI)).toBe(true);
    const war = declareWar(w, JAP, SIA, true);
    expect(war).not.toBeNull();
    const siam = war!.sides[1];
    const { h, controller } = w.cells;
    // Japan's front cells against China, and the nearest's distance from a formation (cells).
    const front = (): number[] => {
      const nb: number[] = [];
      const out: number[] = [];
      for (let k = 0; k < controller.length; k++) {
        if (controller[k] !== JAP) continue;
        for (const q of neighbours4(k, W, h, w.settings.loopingMap, nb)) if (controller[q] === CHI) { out.push(k); break; }
      }
      return out;
    };
    const fc = w.formations.cols;
    const fromFront = (id: number, cells: number[]): number => Math.min(...cells.map((k) => Math.hypot(fc.x[id]! - (k % W) - 0.5, fc.y[id]! - Math.floor(k / W) - 0.5)));
    let embarked = -1;
    let frontThen = false;
    let away = 0;
    let landed = -1;
    let where = -1;
    // The formations aboard for a cell of Siam's side: the landing. Since PLAN 7.89 (ADR-643) the
    // ferry sails while a landing is at sea, and Japan's ferry to its China front lands first.
    const bound = new Set<number>();
    for (let d = 0; d < 90 && landed < 0; d++) {
      s.step(24, (world) => {
        const ev = world.out.events;
        for (let i = 0; i < ev.length; i += 6) {
          if (ev[i + 3] !== JAP) continue;
          const f = ev[i + 2]!;
          if (ev[i + 1] === EventKind.FormationEmbarked) {
            const target = world.embarked.get(f)?.target;
            if (target === undefined || !siam.includes(world.cells.controller[target]!)) continue;
            bound.add(f);
            if (embarked < 0) {
              const cells = front();
              [embarked, frontThen, away] = [d, world.wars.atWar(JAP, CHI) && cells.length > 0, fromFront(f, cells)];
            }
          }
          const cell = Math.floor(world.formations.cols.y[f]!) * W + Math.floor(world.formations.cols.x[f]!);
          if (ev[i + 1] === EventKind.FormationLanded && landed < 0 && bound.has(f) && navOf(world).grid.component[cell] !== home) [landed, where] = [d, cell];
        }
      });
    }
    // It went aboard while it fought China across a land front, from beyond the deploy range of that
    // front (the army there is the operational AI's), and landed on the other war's side.
    expect(embarked).toBeGreaterThanOrEqual(0);
    expect(frontThen).toBe(true);
    expect(away).toBeGreaterThan(w.atSize(DEPLOY_RANGE_CELLS));
    expect(landed).toBeGreaterThanOrEqual(0);
    expect(siam).toContain(w.cells.owner[where]);
    process.stderr.write(`JAP–CHI and JAP–SIA: aboard on day ${embarked} ${away.toFixed(0)} cells from the front, ashore on day ${landed}, land of ${NATIONS_1938[w.cells.owner[where]! - 1]!.tag}
`);
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
