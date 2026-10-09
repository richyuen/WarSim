/**
 * Fire at T2 (SPEC §8 "Effects", PLAN 2.4): a FireEvent of a snapshot is one shot, drawn as a
 * muzzle flash at the shooter, a tracer flying to the target and an impact there.
 *
 * Nothing here is sim state: shots live on the render clock, drawing changes nothing, and a
 * reload starts with none.
 *
 * - A tick is an hour and a volley one record, so the shots of a tick start spread over the
 *   tick's wall time by their `subtick` (the minute of the hour): at least MIN_SPREAD_MS, so that
 *   a fast game does not fire in salvoes, and STEP_SPREAD_MS for a tick stepped while paused.
 * - A shooter shows one shot at a time (ADR-66). At a day a second an element fires 24 volleys
 *   a second; an event whose shooter's shot would still be on screen when it starts is not
 *   drawn (`skipped`). So the fire on screen grows with the elements that fight, not with the
 *   game speed. Within one tick every FireEvent is a shot: an element fires once an hour.
 * - A cannon's shot starts TURN_MS after its minute (PLAN 3.6e1): its turret turns onto the target
 *   in that time and is there as the shot leaves. Every cannon, at every zoom: a volley does not
 *   fire at another time for the camera's sake.
 * - At T3 a shot leaves a barrel (PLAN 3.6c): the muzzle of one of its shooter's figures, where
 *   the snapshot that brought it had the shooter among its elements (`Shot.from`). The way
 *   there from the element's slot goes with the close tier's share, as the figures come in.
 */
import { FIRE_STRIDE, FireField } from '../../shared/events';
import { turretOf, Weapon } from '../../shared/unitLooks';
import { SEAM_MARGIN, worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../camera';
import { hash2, pair } from '../hash';
import { ANIM_TAIL_MS, progress } from '../timing';
import { muzzleOf } from '../units/atlas';
import { figureCells, type FiringFigure } from '../units/individuals';
import { TURN_MS } from '../units/turrets';

/** Over how long the shots of one tick start: the tick's wall time, within these. */
export const MIN_SPREAD_MS = 250;
export const MAX_SPREAD_MS = 1000;
/** The same for a tick stepped while paused (its wall time is 0). */
export const STEP_SPREAD_MS = 400;
/** Shots alive at once; a snapshot's shots beyond it are not shown (counted in `skipped`). */
export const MAX_SHOTS = 3000;
/** Shots land around their target: up to this far from its slot, in cells (slots are 0.03 apart). */
export const SCATTER_CELLS = 0.012;
/** A shot is drawn when it comes within this many CSS px of the viewport. */
export const CULL_PX = 12;

interface Look {
  /** ms: the tracer's flight, the muzzle flash, the impact after the flight. */
  flight: number;
  flash: number;
  impact: number;
  /** Length of the streak as a share of the path, and its cap in CSS px. */
  streak: number;
  streakPx: number;
  width: number;
  color: string;
  /** Radii in CSS px: the muzzle flash, the impact's burst and its smoke at the end. */
  flashR: number;
  /** At a barrel the flash is a tongue along it: this many of its radii long (0: a disc there too). */
  tongue: number;
  burstR: number;
  smokeR: number;
  /** Height of the trajectory's arc as a share of the distance (indirect fire). */
  arc: number;
  smoke: string;
}

export const LOOKS: Readonly<Record<Weapon, Look>> = {
  [Weapon.smallArms]: { flight: 150, flash: 60, impact: 160, streak: 0.35, streakPx: 22, width: 1, color: '#fff2a8', flashR: 1.6, tongue: 0, burstR: 0, smokeR: 2.2, arc: 0, smoke: '226, 214, 186' },
  [Weapon.cannon]: { flight: 190, flash: 100, impact: 300, streak: 0.25, streakPx: 30, width: 1.6, color: '#ffc061', flashR: 2.8, tongue: 3.2, burstR: 2.2, smokeR: 4.5, arc: 0, smoke: '84, 76, 68' },
  [Weapon.shell]: { flight: 420, flash: 120, impact: 460, streak: 0.14, streakPx: 18, width: 1.8, color: '#ffab4d', flashR: 3.2, tongue: 3.6, burstR: 3.4, smokeR: 7.5, arc: 0.14, smoke: '64, 58, 52' },
};
const WEAPONS: readonly Weapon[] = [Weapon.smallArms, Weapon.cannon, Weapon.shell];
/** Opacity of an impact's smoke over its four quarters. */
const SMOKE_ALPHA = [0.55, 0.42, 0.28, 0.13] as const;
/** The bright burst is the first part of an impact. */
const BURST_PART = 0.3;
const TAU = Math.PI * 2;

export interface Shot {
  /** Element ids. */
  shooter: number;
  target: number;
  weapon: Weapon;
  /** Cells, as the sim gave them; `x1` is unwrapped the short way from `x0` on a looping map. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Where it lands, from the target's slot (cells; presentation only). */
  dx: number;
  dy: number;
  /** ms on the render clock. */
  start: number;
  /** The figure of the shooter it leaves at T3, or null: the shooter was not among the view's elements. */
  from: FiringFigure | null;
}

/** The close tier in a frame (PLAN 3.6c): what `draw` needs to put a shot at a figure's muzzle. */
export interface CloseTier {
  /** The figures' share of the unit layer, 0–1 (the handover from the element sprites). */
  share: number;
  /** A figure is at least this many CSS px (before the unit-size setting). */
  minPx: number;
  /** Where the turret of a tank of element `shooter` points at `now`, its hull facing `hull` (radians). */
  turret(shooter: number, hull: number, now: number): number;
}

/**
 * Where a shot starts in a frame: cells, the barrel's direction (radians), how far it is a
 * barrel's (0–1), and the side of the figure it leaves as it is drawn (cells; 0 without one).
 */
export interface Origin {
  x: number;
  y: number;
  angle: number;
  atBarrel: number;
  side: number;
}
/** At a barrel a gun's flash is at least this share of its figure's side in radius: it grows with the figure. */
export const FLASH_OF_FIGURE = 0.09;

/**
 * Where a shot starts at `now`. With the figures all in (`close.share` 1) it is the muzzle of
 * the shot's figure as the sprite renderer draws it: `scale` CSS px a cell, the unit-size
 * setting `size`. Without a figure, or without the close tier, it is the element's slot and
 * the line to the target.
 */
export function originOf(s: Shot, now: number, scale: number, size: number, close?: CloseTier): Origin {
  const f = s.from;
  if (!f || !close || close.share <= 0) return { x: s.x0, y: s.y0, angle: Math.atan2(s.y1 - s.y0, s.x1 - s.x0), atBarrel: 0, side: 0 };
  const angle = turretOf(f.frame) >= 0 ? close.turret(s.shooter, f.facing, now) : f.facing;
  const [mx, my] = muzzleOf(f.frame);
  // The side of the figure's sprite in cells: the shader's rule.
  const side = (Math.max(figureCells(f.side) * scale, close.minPx) * size) / scale;
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  return { x: s.x0 + close.share * (f.dx + (c * mx - sn * my) * side), y: s.y0 + close.share * (f.dy + (sn * mx + c * my) * side), angle, atBarrel: close.share, side };
}

/** How long a shot is on screen. */
export function lifeOf(weapon: Weapon): number {
  const l = LOOKS[weapon];
  return l.flight + l.impact;
}

/** Progress of a shot's three parts at `now`, each 0–1; 1 = over, or not begun. */
export function phasesOf(s: Shot, now: number): { flash: number; tracer: number; impact: number } {
  const l = LOOKS[s.weapon];
  return { flash: progress(now, s.start, l.flash), tracer: progress(now, s.start, l.flight), impact: progress(now, s.start + l.flight, l.impact) };
}

export class FireFx {
  shots: Shot[] = [];
  /** FireEvents so far that were not drawn: their shooter's shot was still on screen, or MAX_SHOTS were. */
  skipped = 0;
  /** What the last `draw` put on screen (tests): the shots whose tracer is in flight, and where each flash is (cells). */
  tracers: Shot[] = [];
  flashAt: { shot: Shot; x: number; y: number }[] = [];
  flashes = 0;
  impacts = 0;
  /** Render-clock span of the shots held: from the last snapshot that brought any to the last end. */
  from = -Infinity;
  until = -Infinity;
  /** When each shooter's shot on screen is over. */
  private readonly busy = new Map<number, number>();

  /** Another game is shown from here on (a load): the shots of the one before are not its own. */
  clear(): void {
    this.shots.length = 0;
    this.busy.clear();
    this.until = -Infinity;
  }

  /**
   * Takes the fire records of a snapshot that arrived at `now` (they are copied). Returns how
   * many of them are shots now: the last of `shots`. `figure` gives the figure of a shooter
   * that its volley of a tick leaves, where the snapshot has the shooter's element.
   */
  add(count: number, data: ArrayLike<number>, now: number, tickMs: number, geo: MapGeometry, figure?: (shooter: number, tick: number) => FiringFigure | null): number {
    // Shots that are over leave here, and only here.
    let kept = 0;
    this.busy.clear();
    for (const s of this.shots) {
      const end = s.start + lifeOf(s.weapon);
      if (now >= end) continue;
      this.shots[kept++] = s;
      this.busy.set(s.shooter, end);
    }
    this.shots.length = kept;
    if (count === 0) return 0;
    const spread = tickMs > 0 ? Math.min(MAX_SPREAD_MS, Math.max(MIN_SPREAD_MS, tickMs)) : STEP_SPREAD_MS;
    for (let i = 0; i < count; i++) {
      const o = i * FIRE_STRIDE;
      const shooter = data[o + FireField.shooter]!;
      const weapon = data[o + FireField.weapon]! as Weapon;
      // A cannon waits for its turret's turn (`TurretAims.add` begins it TURN_MS before the shot).
      const start = now + (data[o + FireField.subtick]! / 60) * spread + (weapon === Weapon.cannon ? TURN_MS : 0);
      if (this.shots.length >= MAX_SHOTS || (this.busy.get(shooter) ?? -Infinity) > start) {
        this.skipped++;
        continue;
      }
      const x0 = data[o + FireField.x0]!;
      let x1 = data[o + FireField.x1]!;
      if (geo.wrapX && Math.abs(x1 - x0) > geo.w / 2) x1 += x1 < x0 ? geo.w : -geo.w;
      // Where it lands: by the volley's shooter and tick.
      const tick = data[o + FireField.tick]!;
      const [jx, jy] = pair(hash2(shooter, tick));
      this.shots.push({ shooter, target: data[o + FireField.target]!, weapon, x0, y0: data[o + FireField.y0]!, x1, y1: data[o + FireField.y1]!, dx: jx * SCATTER_CELLS, dy: jy * SCATTER_CELLS, start, from: figure?.(shooter, tick) ?? null });
      const end = start + lifeOf(weapon);
      this.busy.set(shooter, end);
      this.from = now;
      this.until = Math.max(this.until, end);
    }
    return this.shots.length - kept;
  }

  /**
   * Whether a shot is still to be drawn at `now`. There is no lower bound on `now`: a frame's
   * clock (the rAF time) can be earlier than the arrival of the snapshot it draws, and at a day
   * a second every frame has a newer snapshot. Shots are only ever added at the real time.
   */
  animating(now: number): boolean {
    return now < this.until + ANIM_TAIL_MS;
  }

  /**
   * Draws the shots at `now` (already in the CSS-px transform of `ctx`), `alpha` being the
   * opacity of the element layer and `size` the unit-size setting. Pure: the same `now` draws
   * the same frame. With `close`, a shot leaves a figure's muzzle (`originOf`).
   */
  draw(ctx: CanvasRenderingContext2D, cam: Camera, geo: MapGeometry, vw: number, vh: number, now: number, alpha: number, size = 1, close?: CloseTier): void {
    this.tracers.length = 0;
    this.flashAt.length = 0;
    this.flashes = 0;
    this.impacts = 0;
    if (alpha <= 0.01 || this.shots.length === 0 || now >= this.until) return;
    const offs = wrapOffsets(cam, geo, vw, SEAM_MARGIN);
    const tracer = WEAPONS.map(() => new Path2D());
    const flash = WEAPONS.map(() => new Path2D());
    const tongue = new Path2D();
    const burst = WEAPONS.map(() => new Path2D());
    const smoke = WEAPONS.map(() => SMOKE_ALPHA.map(() => new Path2D()));
    const disc = (p: Path2D, x: number, y: number, r: number): void => {
      p.moveTo(x + r, y);
      p.arc(x, y, r, 0, TAU);
    };
    for (const s of this.shots) {
      const l = LOOKS[s.weapon];
      const { flash: fl, tracer: tr, impact: im } = phasesOf(s, now);
      if (fl >= 1 && tr >= 1 && im >= 1) continue;
      let flying = false;
      let flashed = false;
      const from = originOf(s, now, cam.scale, size, close);
      for (const off of offs) {
        const [ax, ay] = worldToScreen(cam, from.x + off, from.y, vw, vh);
        const [bx, by] = worldToScreen(cam, s.x1 + s.dx + off, s.y1 + s.dy, vw, vh);
        const len = Math.hypot(bx - ax, by - ay);
        const lift = l.arc * len;
        if (Math.max(ax, bx) < -CULL_PX || Math.min(ax, bx) > vw + CULL_PX || Math.max(ay, by) < -CULL_PX || Math.min(ay, by) - lift > vh + CULL_PX) continue;
        if (fl < 1) {
          const r0 = l.flashR * size;
          if (l.tongue > 0 && from.atBarrel > 0) {
            // At a barrel a gun's flash is a tongue along it, its tail at the muzzle (PLAN 3.6c).
            const r = (r0 + from.atBarrel * Math.max(0, FLASH_OF_FIGURE * from.side * cam.scale - r0)) * (1 - 0.6 * fl);
            const long = r * (1 + (l.tongue - 1) * from.atBarrel);
            const c = Math.cos(from.angle);
            const sn = Math.sin(from.angle);
            const mx = ax + c * (long - r);
            const my = ay + sn * (long - r);
            tongue.moveTo(mx + c * long, my + sn * long);
            tongue.ellipse(mx, my, long, r * (1 - 0.3 * from.atBarrel), from.angle, 0, TAU);
          } else disc(flash[s.weapon]!, ax, ay, r0 * (1 - 0.6 * fl));
          this.flashes++;
          flashed = true;
        }
        if (tr < 1) {
          // The streak: from a little behind the head to the head, along the (arced) path.
          const back = Math.min(l.streak, len > 0 ? (l.streakPx * size) / len : 1);
          const at = (p: number): [number, number] => [ax + (bx - ax) * p, ay + (by - ay) * p - 4 * lift * p * (1 - p)];
          const [hx, hy] = at(tr);
          const [tx, ty] = at(Math.max(0, tr - back));
          tracer[s.weapon]!.moveTo(tx, ty);
          tracer[s.weapon]!.lineTo(hx, hy);
          flying = true;
        }
        if (im < 1) {
          if (im < BURST_PART && l.burstR > 0) disc(burst[s.weapon]!, bx, by, l.burstR * size * (1 - 0.5 * (im / BURST_PART)));
          disc(smoke[s.weapon]![Math.min(SMOKE_ALPHA.length - 1, Math.floor(im * SMOKE_ALPHA.length))]!, bx, by, l.smokeR * size * (0.4 + 0.6 * im));
          this.impacts++;
        }
      }
      if (flying) this.tracers.push(s);
      if (flashed) this.flashAt.push({ shot: s, x: from.x, y: from.y });
    }
    ctx.save();
    ctx.lineCap = 'round';
    for (const w of WEAPONS) {
      const l = LOOKS[w];
      for (let q = 0; q < SMOKE_ALPHA.length; q++) {
        ctx.fillStyle = `rgba(${l.smoke}, ${(SMOKE_ALPHA[q]! * alpha).toFixed(3)})`;
        ctx.fill(smoke[w]![q]!);
      }
    }
    ctx.globalAlpha = alpha;
    for (const w of WEAPONS) {
      const l = LOOKS[w];
      // A dark edge under the bright core, so a tracer reads on a pale nation colour too.
      ctx.strokeStyle = 'rgba(60, 24, 0, 0.4)';
      ctx.lineWidth = (l.width + 1.2) * size;
      ctx.stroke(tracer[w]!);
      ctx.strokeStyle = l.color;
      ctx.lineWidth = l.width * size;
      ctx.stroke(tracer[w]!);
      ctx.fillStyle = '#ffe08a';
      ctx.fill(burst[w]!);
      ctx.fillStyle = '#fffbe6';
      ctx.fill(flash[w]!);
    }
    // The tongues: a flame's edge around the bright core, so that it reads on a pale hull.
    ctx.strokeStyle = 'rgba(255, 138, 30, 0.9)';
    ctx.lineWidth = 1.6 * size;
    ctx.stroke(tongue);
    ctx.fill(tongue);
    ctx.restore();
  }
}
