import { describe, expect, it } from 'vitest';
import { invasionAi } from '../../src/sim/ai/invasion';
import { STAGGER } from '../../src/sim/ai/strategic';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { keyAt, waterKeys } from '../../src/sim/systems/navalCombat';
import { declareWar } from '../../src/sim/systems/war';
import { portSeaOf, seaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.56b (ADR-597): the invasion AI aimed its landing at the enemy port nearest its transports
// by straight km, which may be on a lake across land (seed 1129 year 20: Britain's at Adana aimed at
// Baku on the Caspian); `orderSail` refused the way, the landing was refused every invasion day, and
// the army at the port never boarded. The United Kingdom in 1938 at war with the Soviet Union (no
// land front), its transports at Manama, whose nearest Soviet ports are on the Caspian
// (`tools/diag/lakeTargets.ts`), a British division at Manama: on the invasion day it goes aboard,
// bound for a Soviet port the transports sail to.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const SOV = id('SOV');

describe("the landing's target is over the sea (PLAN 7.56b)", () => {
  it('transports in the Gulf aim at a Soviet port they sail to, not at the Caspian, and a division boards', () => {
    const s = new Sim({ scenario: '1938', seed: 4601, assets: assets1938(W) });
    const w = s.world;
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    s.step(1);
    const c = w.formations.cols;
    const water = portSeaOf(w);
    const z = seaOf(w);
    const mi = w.ports.findIndex((p) => p.name === 'Manama');
    expect(mi).toBeGreaterThanOrEqual(0);
    const port = w.ports[mi]!;
    const sea = water[mi]!;
    expect(w.cells.controller[port.cell]).toBe(ENG);
    expect(sea).toBeGreaterThanOrEqual(0);
    expect(declareWar(w, ENG, SOV, true)).not.toBeNull();
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
    // The Soviet port nearest them is on the Caspian: no way there by sea.
    const keys = waterKeys(w, ENG);
    const mine = keyAt(w, keys, c.x[tp!]!, c.y[tp!]!);
    const caspian = w.ports.findIndex((p) => p.name === 'Türkmenbaşy');
    expect(caspian).toBeGreaterThanOrEqual(0);
    expect(keys[z.zoneOf[water[caspian]!]!]).not.toBe(mine);
    // A British division at Manama, standing.
    let div = -1;
    w.formations.forEach((f) => {
      if (div < 0 && c.nation[f] === ENG && !w.offLand(f) && transportRoom(w, tp!) >= c.strength[f]!) div = f;
    });
    expect(div).toBeGreaterThan(0);
    [c.x[div], c.y[div]] = w.cellPoint(port.cell);
    c.moving[div] = 0;
    w.paths.delete(div);
    // The invasion AI on Britain's invasion days for two weeks: the division goes aboard, and its
    // transports sail for water the Soviet Union holds a port by, in their own waters.
    s.step(24 - (w.tick % 24));
    let boarded = false;
    for (let d = 0; d < 14 && !boarded; d++) {
      if ((w.tick / 24 + ENG) % STAGGER === 0) {
        w.settings.aiEnabled = true;
        invasionAi(w);
        w.settings.aiEnabled = false;
        boarded = w.embarked.has(div);
      }
      if (!boarded) s.step(24);
    }
    expect(boarded).toBe(true);
    const goal = w.embarked.get(div)!.water;
    expect(keys[z.zoneOf[goal]!]).toBe(mine);
  });
});
