/**
 * What a unit class looks like to the view: its sprite, how its fire is drawn, and what it
 * leaves where it is destroyed. The sim knows the classes and the view knows none of the unit
 * rules, so the worker translates with these: snapshot elements carry a `Frame`, fire records a
 * `Weapon`, ElementDestroyed events a `Wreck`.
 */

/** Frames of the unit sprite atlas (`render/units/atlas`), in its order. */
export const Frame = { infantry: 0, tank: 1, ship: 2, aircraft: 3, gun: 4 } as const;
export type Frame = (typeof Frame)[keyof typeof Frame];

export function frameOf(cls: string): Frame {
  if (cls.startsWith('armor') || cls === 'mech') return Frame.tank;
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
