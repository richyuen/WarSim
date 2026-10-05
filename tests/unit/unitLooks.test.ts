import { describe, expect, it } from 'vitest';
import { LOOKS } from '../../src/render/fx/fire';
import { Frame, frameOf, Weapon, weaponOf, Wreck, wreckOf } from '../../src/shared/unitLooks';
import { AIR_CLASSES, LAND_CLASSES, SEA_CLASSES, UNIT_CLASSES } from '../../src/sim/data/schemas';

// What a unit class looks like to the view (`shared/unitLooks`): the worker turns the sim's
// classes into these for snapshot elements, fire records and ElementDestroyed events. The atlas
// has as many frames as `Frame` has names (checked in the browser, where the atlas is drawn).

describe('frameOf', () => {
  it('men, armour, guns, ships and aircraft each have their sprite', () => {
    for (const cls of ['inf', 'mot']) expect(frameOf(cls), cls).toBe(Frame.infantry);
    for (const cls of ['armor_l', 'armor_m', 'armor_h', 'mech']) expect(frameOf(cls), cls).toBe(Frame.tank);
    // PLAN 2.6: a battery is not twelve soldiers.
    for (const cls of ['art', 'at', 'aa']) expect(frameOf(cls), cls).toBe(Frame.gun);
    for (const cls of SEA_CLASSES) expect(frameOf(cls), cls).toBe(Frame.ship);
    for (const cls of AIR_CLASSES.filter((c) => c !== 'nuke_missile')) expect(frameOf(cls), cls).toBe(Frame.aircraft);
  });

  it('frames are the atlas order, without gaps, and every class has one', () => {
    // Five classes' frames and, since PLAN 2.14c2, the sixth: infantry prone, which no class has of itself (`shownFrame`).
    expect(Object.values(Frame)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const cls of UNIT_CLASSES) expect(Object.values(Frame)).toContain(frameOf(cls));
    for (const cls of UNIT_CLASSES) expect(frameOf(cls), cls).not.toBe(Frame.prone);
  });
});

describe('weaponOf', () => {
  it('artillery lobs shells, guns and tanks fire flat, the rest small arms', () => {
    expect(weaponOf('art')).toBe(Weapon.shell);
    for (const cls of ['at', 'aa', 'armor_l', 'armor_m', 'armor_h']) expect(weaponOf(cls), cls).toBe(Weapon.cannon);
    for (const cls of ['inf', 'mot', 'mech']) expect(weaponOf(cls), cls).toBe(Weapon.smallArms);
    // Every land class has a look.
    for (const cls of LAND_CLASSES) expect(LOOKS[weaponOf(cls)]).toBeDefined();
  });
});

describe('wreckOf', () => {
  it('infantry leaves the fallen, guns a broken gun, everything on wheels or tracks a hull', () => {
    expect(wreckOf('inf')).toBe(Wreck.men);
    for (const cls of ['art', 'at', 'aa']) expect(wreckOf(cls), cls).toBe(Wreck.gun);
    for (const cls of ['armor_l', 'armor_m', 'armor_h', 'mech', 'mot']) expect(wreckOf(cls), cls).toBe(Wreck.vehicle);
    expect(new Set(LAND_CLASSES.map(wreckOf)).size).toBe(3);
  });
});
