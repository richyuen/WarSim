/**
 * What a unit class looks like to the view: its sprite, how its fire is drawn, and what it
 * leaves where it is destroyed. The sim knows the classes and the view knows none of the unit
 * rules, so the worker translates with these: snapshot elements carry a `Frame`, fire records a
 * `Weapon`, ElementDestroyed events a `Wreck`.
 */
import type { UnitSymbol } from './protocol';

/**
 * How units are drawn (PLAN 7.174, ADR-777): as countryballs, a disc of the nation's flag with
 * eyes, or as the tinted sprites, markers and counters drawn until then. The default stays
 * classic while the balls are built; PLAN 7.174h makes it countryballs and pins the e2e specs
 * to classic in the same commit (one full e2e run, the user's decision).
 */
export const UNIT_LOOKS = ['balls', 'classic'] as const;
export type UnitLook = (typeof UNIT_LOOKS)[number];
export const DEFAULT_UNIT_LOOK: UnitLook = 'classic';

/** The look a stored value names, or the default for anything else (none stored, an unknown word). */
export function parseUnitLook(v: string | null | undefined): UnitLook {
  return (UNIT_LOOKS as readonly string[]).includes(v ?? '') ? (v as UnitLook) : DEFAULT_UNIT_LOOK;
}

/**
 * Frames of the unit sprite atlas (`render/units/atlas`), in its order. `tank`, `tankMedium` and
 * `tankHeavy` are hulls (PLAN 3.6a): the turret of each is a frame of its own (`turretOf`),
 * drawn over the hull as a second sprite, so that it can turn. No class has a turret's frame.
 * `tankSmall` is no class's either: it is what a hull is drawn as where a sprite is too small to
 * hold one (`smallFrameOf`, PLAN 3.6e3b). Since PLAN 4.7b each ship class has its frame (`ship` the
 * cruisers'), and `wake`, no class's, is the foam behind a ship under way.
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
  tankSmall: 12,
  // A ship of each class (PLAN 4.7b): `ship` is the cruiser's.
  battleship: 13,
  carrier: 14,
  submarine: 15,
  transport: 16,
  destroyer: 17,
  /** The foam behind a ship under way (PLAN 4.7b): no class's; drawn after the ships, untinted. */
  wake: 18,
} as const;
export type Frame = (typeof Frame)[keyof typeof Frame];

/** The frames of the ships (PLAN 4.7b). */
export const SHIP_FRAMES: readonly number[] = [Frame.ship, Frame.battleship, Frame.carrier, Frame.submarine, Frame.transport, Frame.destroyer];

/** Whether `frame` is a ship's. */
export function isShipFrame(frame: number): boolean {
  return SHIP_FRAMES.includes(frame);
}

/** The frame of the turret that stands on the hull of `frame`, or -1 for what has none. */
export function turretOf(frame: number): number {
  if (frame === Frame.tank) return Frame.turretLight;
  if (frame === Frame.tankMedium) return Frame.turretMedium;
  if (frame === Frame.tankHeavy) return Frame.turretHeavy;
  return -1;
}

/** What `smallFrameOf` says of a frame that is not drawn at the least size. */
export const NOT_DRAWN_SMALL = -1;

/**
 * What `frame` is drawn as where a sprite is at its least size (PLAN 3.6e3b, ADR-165): a hull of
 * any weight is the tank's small mark, one solid shape made for 5 px; its turret is not drawn
 * there (NOT_DRAWN_SMALL); every other frame is itself.
 */
export function smallFrameOf(frame: number): number {
  if (turretOf(frame) >= 0) return Frame.tankSmall;
  if (frame === Frame.turretLight || frame === Frame.turretMedium || frame === Frame.turretHeavy) return NOT_DRAWN_SMALL;
  return frame;
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
  // A ship of each class (PLAN 4.7b; until then one ship for the seven).
  if (cls === 'bb') return Frame.battleship;
  if (cls === 'cv') return Frame.carrier;
  if (cls === 'ss') return Frame.submarine;
  if (cls === 'tp') return Frame.transport;
  if (cls === 'dd') return Frame.destroyer;
  if (cls === 'cl' || cls === 'ca') return Frame.ship;
  if (['fighter', 'bomber_tac', 'bomber_str', 'cas', 'naval_bomber', 'transport_air'].includes(cls)) return Frame.aircraft;
  return Frame.infantry;
}

/**
 * How a volley is drawn (PLAN 2.4): rifles and machine guns, direct-fire guns, indirect fire;
 * since PLAN 4.7c a ship's guns (`naval`: a long arc, a splash) and a torpedo (its track on the
 * water).
 */
export const Weapon = { smallArms: 0, cannon: 1, shell: 2, naval: 3, torpedo: 4 } as const;
export type Weapon = (typeof Weapon)[keyof typeof Weapon];

export function weaponOf(cls: string): Weapon {
  if (cls === 'art') return Weapon.shell;
  // A ship's guns (PLAN 4.7c); its torpedoes are told by the fire record (`FireField.weapon` < 0).
  if (['dd', 'cl', 'ca', 'bb', 'cv', 'ss', 'tp'].includes(cls)) return Weapon.naval;
  if (cls === 'inf' || cls === 'mot' || cls === 'mech') return Weapon.smallArms;
  return Weapon.cannon;
}

/** What a destroyed element leaves where it stood (PLAN 2.4b): the fallen, a broken gun, a burnt-out vehicle; a ship going down (PLAN 4.7c). */
export const Wreck = { men: 0, gun: 1, vehicle: 2, ship: 3 } as const;
export type Wreck = (typeof Wreck)[keyof typeof Wreck];

export function wreckOf(cls: string): Wreck {
  if (cls === 'inf') return Wreck.men;
  if (['dd', 'cl', 'ca', 'bb', 'cv', 'ss', 'tp'].includes(cls)) return Wreck.ship;
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
