import { describe, expect, it } from 'vitest';
import { DECLARE_AT, RESTLESS, neighbourMap, seaTargets, sides, strengths, warTarget, warUtility } from '../../src/sim/ai/strategic';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { whyNotWar } from '../../src/sim/systems/war';
import { Refusal } from '../../src/shared/commands';
import { portSeaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.82d (ADR-670): the war choice looked at land neighbours alone, so a nation overseas with
// none over the bar was never a war's target (seed 845, years 8–26: the United States, its puppet
// Canada and Denmark's Greenland at peace for 19 years, fixed to 2 % of their cells, while the
// Soviet Union, its transports at its ports on their water, scored 1.0–1.7 on them). With no land
// target over DECLARE_AT, a nation takes the best of those it could land on (`seaTargets`).
// The United Kingdom, its one transport group at Glasgow's water: Iceland lies across the sea.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const ICE = id('ICE');

describe('a war across the sea (PLAN 7.82d)', () => {
  it('with no land target over the bar, the best of the nations it could land on; none without transports at a port', () => {
    const s = new Sim({ scenario: '1938', seed: 4601, assets: assets1938(W) });
    const w = s.world;
    const c = w.formations.cols;
    const nc = w.nations.cols;
    const water = portSeaOf(w);
    const glasgow = w.ports.findIndex((p) => p.name === 'Glasgow');
    expect(glasgow).toBeGreaterThanOrEqual(0);
    const sea = water[glasgow]!;
    // One British transport group, standing at Glasgow's water; the others gone.
    const groups: number[] = [];
    w.formations.forEach((f) => {
      if (w.isFleet(f) && c.nation[f] === ENG && transportRoom(w, f) > 0) groups.push(f);
    });
    expect(groups.length).toBeGreaterThan(0);
    const [tp, ...rest] = groups;
    for (const f of rest) destroyFormation(w, f);
    [c.x[tp!], c.y[tp!]] = [(sea % W) + 0.5, Math.floor(sea / W) + 0.5];
    c.moving[tp!] = 0;
    nc.aggression[ENG] = 100;

    // Iceland is no land neighbour of the United Kingdom, and is one it could land on.
    const land = [...(neighbourMap(w).get(ENG) ?? [])].sort((a, b) => a - b);
    expect(land).not.toContain(ICE);
    const over = seaTargets(w, ENG);
    expect(over).toContain(ICE);
    expect(over).not.toContain(ENG);

    const str = strengths(w);
    const { withAllies, defence } = sides(w, str);
    const attack = withAllies(ENG);
    const u = (t: number): number => warUtility(w, ENG, t, attack, defence(t), 0, RESTLESS).u;
    const valid = (t: number): boolean => whyNotWar(w, ENG, t) === Refusal.None;
    expect(valid(ICE) && u(ICE) > DECLARE_AT).toBe(true);
    // No land target: the sea's best over the bar (the highest utility, the lower id on a tie).
    const best = over.filter(valid).reduce((b, t) => (u(t) > (b === 0 ? DECLARE_AT : u(b)) ? t : b), 0);
    expect(best).not.toBe(0);
    expect(warTarget(w, ENG, [], attack, defence, 0, RESTLESS)).toBe(best);
    // A land target over the bar comes first, though the sea's may score higher.
    if (land.some((t) => valid(t) && u(t) > DECLARE_AT)) expect(land).toContain(warTarget(w, ENG, land, attack, defence, 0, RESTLESS));
    const other = over.find((t) => t !== ICE && valid(t) && u(t) > DECLARE_AT);
    if (other !== undefined) expect(warTarget(w, ENG, [other], attack, defence, 0, RESTLESS)).toBe(other);
    // The group sails away from the port: nothing across the sea.
    c.moving[tp!] = 1;
    expect(seaTargets(w, ENG)).toEqual([]);
    expect(warTarget(w, ENG, [], attack, defence, 0, RESTLESS)).toBe(0);
  }, 300_000);
});
