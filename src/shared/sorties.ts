/**
 * A sortie's flight (PLAN 5.2a, SPEC §6.3): derived kinematics, never stored. A sortie is what
 * it was launched with: its base's place and its target's (cells), its launch hour, its speed,
 * the km between base and target, and its hours over the target. Where it is at any time,
 * fractional hours too (the page's frames), is a pure function of those: the sim's and the
 * page's (PLAN 5.7a), so it lives in `shared/`.
 */

/** A sortie as launched: all its flight follows from these. */
export interface Sortie {
  /** Its base's place and its target's, cells. */
  bx: number;
  by: number;
  tx: number;
  ty: number;
  /** The tick it took off. */
  launch: number;
  /** Its speed, km/h (the least of its aircraft's), and the km from base to target. */
  kmh: number;
  km: number;
  /** Hours over the target: 0 for a strike, which turns at once. */
  over: number;
}

/** The legs of a flight. */
export const Leg = { Out: 0, Over: 1, Back: 2, Home: 3 } as const;
export type Leg = (typeof Leg)[keyof typeof Leg];

/** The most hours a patrol stays over its zone. */
export const PATROL_MAX_HOURS = 4;

/**
 * Hours a patrol of a wing of range `rangeKm` and speed `kmh` stays over a zone `km` from its
 * base: the flight its range leaves it (a range is out and back, as a radius), at most
 * `PATROL_MAX_HOURS`; 0 beyond its range.
 */
export function patrolHours(rangeKm: number, kmh: number, km: number): number {
  if (km >= rangeKm || kmh <= 0) return 0;
  return Math.min(PATROL_MAX_HOURS, (2 * (rangeKm - km)) / kmh);
}

/** Hours out (and as many back). */
export const legHours = (s: Sortie): number => (s.kmh > 0 ? s.km / s.kmh : 0);

/** The tick a sortie is home. */
export const sortieEnd = (s: Sortie): number => s.launch + 2 * legHours(s) + s.over;

/**
 * Where sortie `s` is at time `t` (ticks, fractional allowed) on a map `w` cells round (0 for a
 * map that does not wrap): its place in cells and its leg. Before its launch and after its
 * end it is at its base (Home). Out and back it is on the straight line between base and
 * target, by the short way round where the map wraps; over the target it is at the target.
 */
export function sortieAt(s: Sortie, t: number, w: number): { x: number; y: number; leg: Leg } {
  const h = legHours(s);
  const e = t - s.launch;
  // The end by the same sum as `sortieEnd`, so that its tick is home whatever the rounding.
  if (e < 0 || t >= sortieEnd(s)) return { x: s.bx, y: s.by, leg: Leg.Home };
  let f: number;
  let leg: Leg;
  if (e < h) {
    f = e / h;
    leg = Leg.Out;
  } else if (e < h + s.over) {
    f = 1;
    leg = Leg.Over;
  } else {
    f = h > 0 ? 1 - (e - h - s.over) / h : 0;
    leg = Leg.Back;
  }
  let dx = s.tx - s.bx;
  if (w > 0 && dx > w / 2) dx -= w;
  else if (w > 0 && dx < -w / 2) dx += w;
  let x = s.bx + f * dx;
  if (w > 0) x = ((x % w) + w) % w;
  return { x, y: s.by + f * (s.ty - s.by), leg };
}
