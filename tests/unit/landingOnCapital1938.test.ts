import { describe, expect, it } from 'vitest';
import { invasionAi } from '../../src/sim/ai/invasion';
import { STAGGER } from '../../src/sim/ai/strategic';
import { neighbours4 } from '../../src/sim/nav/grid';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { capitalCell } from '../../src/sim/systems/capitals';
import { keyAt, seaKm, waterKeys } from '../../src/sim/systems/navalCombat';
import { seaHolder } from '../../src/sim/systems/seaControl';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, portSeaOf, seaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.69: the AI's landing aimed at an enemy's port alone, so an enemy capital on a land where
// the enemy holds no port was never invaded (critic run 11, seed 8693 year 20: the Netherlands'
// capital on a one-cell Caribbean islet, land 529). The United Kingdom in 1938 at war with the
// Netherlands alone, every cell of the Netherlands' side (its puppet's too) but an islet with no port handed to Britain (so the
// Netherlands holds no port and has no land front with it), the Dutch capital on that islet, the
// British transports at Manama and a division there: on Britain's invasion day the division goes
// aboard, bound for the islet. Before, no target: nobody boarded.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const NED = id('NED');

describe('the landing on an enemy capital with no port (PLAN 7.69)', () => {
  it('a nation at war with the Netherlands, its capital on an islet with no port, lands on that islet', () => {
    const s = new Sim({ scenario: '1938', seed: 4601, assets: assets1938(W) });
    const w = s.world;
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    s.step(1);
    // To Britain's invasion day, at its start.
    s.step(24 - (w.tick % 24));
    while ((w.tick / 24 + ENG) % STAGGER !== 0) s.step(24);
    const c = w.formations.cols;
    const ctl = w.cells.controller;
    const own = w.cells.owner;
    const water = portSeaOf(w);
    const z = seaOf(w);
    const comp = navOf(w).grid.component;
    const mi = w.ports.findIndex((p) => p.name === 'Manama');
    expect(mi).toBeGreaterThanOrEqual(0);
    const port = w.ports[mi]!;
    const sea = water[mi]!;
    expect(ctl[port.cell]).toBe(ENG);
    // One British transport group, at Manama's water.
    const groups: number[] = [];
    w.formations.forEach((f) => {
      if (w.isFleet(f) && c.nation[f] === ENG && transportRoom(w, f) > 0) groups.push(f);
    });
    const [tp, ...rest] = groups;
    expect(tp).toBeDefined();
    for (const f of rest) destroyFormation(w, f);
    [c.x[tp!], c.y[tp!]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
    c.moving[tp!] = 0;
    // An islet with no port of anyone's, on a coast of an open zone in the transports' waters: the
    // nearest to them by sea.
    const keys = waterKeys(w, ENG);
    const mine = keyAt(w, keys, c.x[tp!]!, c.y[tp!]!);
    const ported = new Set(w.ports.map((p) => comp[p.cell]!));
    const size = new Map<number, number>();
    for (let k = 0; k < W * H; k++) if (comp[k]! > 0) size.set(comp[k]!, (size.get(comp[k]!) ?? 0) + 1);
    let islet = -1;
    let best = Infinity;
    for (let k = 0; k < W * H; k++) {
      const l = comp[k]!;
      if (l === 0 || ported.has(l) || size.get(l)! > 4 || own[k] === 0) continue;
      for (const q of neighbours4(k, W, H, w.settings.loopingMap, [])) {
        const zone = z.zoneOf[q]!;
        if (zone === 0 || z.closed[zone] === 1 || keys[zone] !== mine || seaHolder(w, zone) !== 0) continue;
        const d = seaKm(w, c.x[tp!]!, c.y[tp!]!, (q % W) + 0.5, Math.floor(q / W) + 0.5);
        if (d < best) [best, islet] = [d, k];
      }
    }
    expect(islet).toBeGreaterThanOrEqual(0);
    const land = comp[islet]!;
    // At war first (a nation overrun is refused a war), then the Netherlands holds that islet alone,
    // its capital there (a field capital).
    const war = declareWar(w, ENG, NED, true);
    expect(war).not.toBeNull();
    const theirs = new Set(war!.sides[war!.sides[0].includes(ENG) ? 1 : 0]);
    expect(theirs.has(NED)).toBe(true);
    for (let k = 0; k < W * H; k++) if (theirs.has(ctl[k]!)) w.setController(k, ENG);
    for (let k = 0; k < W * H; k++) {
      if (comp[k] !== land) continue;
      own[k] = NED;
      w.setController(k, NED);
    }
    w.cities.forEach((city) => {
      if (w.cities.cols.capitalOf[city] === NED) w.cities.cols.capitalOf[city] = 0;
    });
    const nc = w.nations.cols;
    [nc.capitalX[NED], nc.capitalY[NED]] = [(islet % W) + 0.5, Math.floor(islet / W) + 0.5];
    expect(capitalCell(w, NED)).toBe(islet);
    expect(w.ports.some((p, i) => water[i]! >= 0 && theirs.has(ctl[p.cell]!))).toBe(false);
    // A British division at Manama, standing.
    let div = -1;
    w.formations.forEach((f) => {
      if (div < 0 && c.nation[f] === ENG && !w.offLand(f) && !w.isWing(f) && transportRoom(w, tp!) >= c.strength[f]!) div = f;
    });
    expect(div).toBeGreaterThan(0);
    [c.x[div], c.y[div]] = w.cellPoint(port.cell);
    c.moving[div] = 0;
    w.paths.delete(div);
    // The invasion AI on that day: the division goes aboard, bound for the islet.
    w.settings.aiEnabled = true;
    invasionAi(w);
    w.settings.aiEnabled = false;
    expect(w.embarked.has(div)).toBe(true);
    const e = w.embarked.get(div)!;
    expect(comp[e.target]).toBe(land);
    expect(comp[e.land]).toBe(land);
  });
});
