import { describe, expect, it } from 'vitest';
import { LOOKS } from '../../src/render/fx/fire';
import { Frame, frameOf, NOT_DRAWN_SMALL, smallFrameOf, symbolOf, turretOf, Weapon, weaponOf, Wreck, wreckOf } from '../../src/shared/unitLooks';
import { TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { AIR_CLASSES, LAND_CLASSES, SEA_CLASSES, UNIT_CLASSES } from '../../src/sim/data/schemas';

// What a unit class looks like to the view (`shared/unitLooks`): the worker turns the sim's
// classes into these for snapshot elements, fire records and ElementDestroyed events. The atlas
// has as many frames as `Frame` has names (checked in the browser, where the atlas is drawn).

describe('frameOf', () => {
  it('men, armour, guns, ships and aircraft each have their sprite', () => {
    for (const cls of ['inf', 'mot']) expect(frameOf(cls), cls).toBe(Frame.infantry);
    // PLAN 3.6a: a hull for each weight of tank, and a carrier for mechanised infantry (until then one frame for the four).
    expect(frameOf('armor_l')).toBe(Frame.tank);
    expect(frameOf('armor_m')).toBe(Frame.tankMedium);
    expect(frameOf('armor_h')).toBe(Frame.tankHeavy);
    expect(frameOf('mech')).toBe(Frame.halftrack);
    // PLAN 2.6: a battery is not twelve soldiers.
    for (const cls of ['art', 'at', 'aa']) expect(frameOf(cls), cls).toBe(Frame.gun);
    for (const cls of SEA_CLASSES) expect(frameOf(cls), cls).toBe(Frame.ship);
    for (const cls of AIR_CLASSES.filter((c) => c !== 'nuke_missile')) expect(frameOf(cls), cls).toBe(Frame.aircraft);
  });

  it('frames are the atlas order, without gaps, and every class has one', () => {
    // Five classes' frames and, since PLAN 2.14c2, the sixth: infantry prone, which no class has of itself (`shownFrame`).
    // Since PLAN 3.6a twelve: three hulls, a half-track and three turrets. Since PLAN 3.6e3b the
    // thirteenth, after them all (the snapshot's numbers stand): the tank's small mark.
    expect(Object.values(Frame)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const cls of UNIT_CLASSES) expect(Object.values(Frame)).toContain(frameOf(cls));
    for (const cls of UNIT_CLASSES) expect(frameOf(cls), cls).not.toBe(Frame.prone);
  });

  it('a tank has a turret of its weight; nothing else has one, and no class is a turret', () => {
    const turrets = [Frame.turretLight, Frame.turretMedium, Frame.turretHeavy];
    expect([Frame.tank, Frame.tankMedium, Frame.tankHeavy].map(turretOf)).toEqual(turrets);
    for (const f of Object.values(Frame)) if (f !== Frame.tank && f !== Frame.tankMedium && f !== Frame.tankHeavy) expect(turretOf(f), String(f)).toBe(-1);
    for (const cls of UNIT_CLASSES) expect(turrets, cls).not.toContain(frameOf(cls));
    for (const cls of UNIT_CLASSES) expect(turretOf(frameOf(cls)) >= 0, cls).toBe(cls.startsWith('armor'));
  });
});

// PLAN 3.6e3b (ADR-165): where a sprite is 5 px a hull was a dark blob that said neither "tank"
// nor "rifle" (ADR-164). There a tank of any weight is one mark that no other class has, and its
// turret is not drawn.
describe('smallFrameOf', () => {
  it('a tank of any weight is the small mark, and nothing else is', () => {
    for (const cls of UNIT_CLASSES) expect(smallFrameOf(frameOf(cls)) === Frame.tankSmall, cls).toBe(cls.startsWith('armor'));
    for (const cls of UNIT_CLASSES) if (!cls.startsWith('armor')) expect(smallFrameOf(frameOf(cls)), cls).toBe(frameOf(cls));
    // Infantry in contact and a half-track are themselves: the mark is the tank's alone.
    expect(smallFrameOf(Frame.prone)).toBe(Frame.prone);
    expect(smallFrameOf(Frame.halftrack)).toBe(Frame.halftrack);
  });

  it('a turret is not drawn at the least size; the mark has no turret and no class', () => {
    for (const f of [Frame.tank, Frame.tankMedium, Frame.tankHeavy]) expect(smallFrameOf(turretOf(f)), String(f)).toBe(NOT_DRAWN_SMALL);
    // Only the turrets go: every other frame is drawn as something.
    for (const f of Object.values(Frame)) expect(smallFrameOf(f) === NOT_DRAWN_SMALL, String(f)).toBe(f === Frame.turretLight || f === Frame.turretMedium || f === Frame.turretHeavy);
    expect(turretOf(Frame.tankSmall)).toBe(-1);
    expect(smallFrameOf(Frame.tankSmall)).toBe(Frame.tankSmall);
    for (const cls of UNIT_CLASSES) expect(frameOf(cls), cls).not.toBe(Frame.tankSmall);
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

describe('symbolOf', () => {
  it('a template has the marker symbol of what most of it is', () => {
    const symbol = (id: string): string => symbolOf(TEMPLATES_LAND.find((t) => t.id === id)!);
    expect(symbol('infantry_div')).toBe('infantry');
    expect(symbol('rifle_div_soviet')).toBe('infantry');
    expect(symbol('motorised_div')).toBe('motorised');
    expect(symbol('cavalry_div')).toBe('cavalry');
    expect(symbol('mountain_div')).toBe('mountain');
    expect(symbol('garrison_brigade')).toBe('garrison');
    for (const id of ['panzer_div', 'tank_brigade', 'tank_corps', 'light_mech_div']) expect(symbol(id), id).toBe('armour');
    // PLAN 3.1c: infantry in half-tracks is not infantry on foot (the mechanised division had the rifle cross).
    expect(symbol('mech_div')).toBe('motorised');
    for (const id of ['panzer_div_2', 'heavy_panzer_div', 'mbt_div']) expect(symbol(id), id).toBe('armour');
  });
});
