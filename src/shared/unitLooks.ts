/**
 * What a unit class looks like to the view: its sprite, how its fire is drawn, and what it
 * leaves where it is destroyed. The sim knows the classes and the view knows none of the unit
 * rules, so the worker translates with these: snapshot elements carry a `Frame`, fire records a
 * `Weapon`, ElementDestroyed events a `Wreck`.
 */
import type { UnitSymbol } from './protocol';

/**
 * Frames of the unit sprite atlas (`render/units/atlas`), in its order. `tank`, `tankMedium` and
 * `tankHeavy` are hulls (PLAN 3.6a): the turret of each is a frame of its own (`turretOf`),
 * drawn over the hull as a second sprite, so that it can turn. No class has a turret's frame.
 */
export const Frame = {
  infantry: 0,
  tank: 1,
  ship: 2,
  aircraft: 3,
  gun: 4,
  prone: 5,
  tankMedium: 6,
  tankHeavy: 7,
  halftrack: 8,
  turretLight: 9,
  turretMedium: 10,
  turretHeavy: 11,
} as const;
export type Frame = (typeof Frame)[keyof typeof Frame];

/** The frame of the turret that stands on the hull of `frame`, or -1 for what has none. */
export function turretOf(frame: number): number {
  if (frame === Frame.tank) return Frame.turretLight;
  if (frame === Frame.tankMedium) return Frame.turretMedium;
  if (frame === Frame.tankHeavy) return Frame.turretHeavy;
  return -1;
}

/**
 * The frame an element is drawn with: its class's (`frameOf`, what the snapshot carries), but
 * infantry in contact is down and firing (PLAN 2.14c2). A battalion under fire looked like one
 * at rest: men standing in their grid.
 */
export function shownFrame(frame: number, inContact: boolean): number {
  return inContact && frame === Frame.infantry ? Frame.prone : frame;
}

export function frameOf(cls: string): Frame {
  if (cls === 'armor_m') return Frame.tankMedium;
  if (cls === 'armor_h') return Frame.tankHeavy;
  if (cls.startsWith('armor')) return Frame.tank;
  // Infantry in half-tracks: a carrier, not a tank (PLAN 3.6a).
  if (cls === 'mech') return Frame.halftrack;
  if (cls === 'art' || cls === 'at' || cls === 'aa') return Frame.gun;
  if (['dd', 'cl', 'ca', 'bb', 'cv', 'ss', 'tp'].includes(cls)) return Frame.ship;
  if (['fighter', 'bomber_tac', 'bomber_str', 'cas', 'naval_bomber', 'transport_air'].includes(cls)) return Frame.aircraft;
  return Frame.infantry;
}

/** How a volley is drawn (PLAN 2.4): rifles and machine guns, direct-fire guns, indirect fire. */
export const Weapon = { smallArms: 0, cannon: 1, shell: 2 } as const;
export type Weapon = (typeof Weapon)[keyof typeof Weapon];

export function weaponOf(cls: string): Weapon {
  if (cls === 'art') return Weapon.shell;
  if (cls === 'inf' || cls === 'mot' || cls === 'mech') return Weapon.smallArms;
  return Weapon.cannon;
}

/** What a destroyed element leaves where it stood (PLAN 2.4b): the fallen, a broken gun, a burnt-out vehicle. */
export const Wreck = { men: 0, gun: 1, vehicle: 2 } as const;
export type Wreck = (typeof Wreck)[keyof typeof Wreck];

export function wreckOf(cls: string): Wreck {
  if (cls === 'inf') return Wreck.men;
  if (cls === 'art' || cls === 'at' || cls === 'aa') return Wreck.gun;
  return Wreck.vehicle;
}

/**
 * Marker symbol of a template (PLAN 2.1): by its dominant element type. Infantry in lorries and
 * infantry in half-tracks (PLAN 3.1c) are both the motorised symbol.
 */
export function symbolOf(t: { id: string; elements: readonly { type: string; count: number }[] }): UnitSymbol {
  if (t.id.startsWith('garrison')) return 'garrison';
  if (t.id.startsWith('mountain')) return 'mountain';
  let tanks = 0;
  let motor = 0;
  let horse = 0;
  let all = 0;
  for (const e of t.elements) {
    all += e.count;
    if (e.type.startsWith('tank')) tanks += e.count;
    else if (e.type.endsWith('motorised') || e.type.endsWith('mechanised')) motor += e.count;
    else if (e.type === 'cavalry') horse += e.count;
  }
  if (tanks * 2 >= all) return 'armour';
  if (horse * 2 >= all) return 'cavalry';
  if ((tanks + motor) * 2 >= all) return 'motorised';
  return 'infantry';
}
