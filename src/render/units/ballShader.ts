/**
 * The countryball look of the element sprites (PLAN 7.174c, ADR-777): a second program of the
 * proxy renderer over the same instances. Each element is a disc of its nation's flag (its slot in
 * the flag atlas, `flagAtlas.ts`), shaded round, with a dark outline and two white eyes. A ball is
 * upright whatever its facing: its eyes are on the side it faces (left or right, a little up or
 * down), and the flag is never turned or mirrored. Where a ball is drawn small, its eyes go out
 * (EYES_NONE_PX to EYES_FULL_PX) and it is a dot of its flag; a nation with no slot is its tint.
 *
 * The outline is OUTLINE_SHARE of the ball and at least OUTLINE_PX, that least going with the eyes.
 *
 * The class shows by props (PLAN 7.174d, the user's choice): infantry wear a helmet, a tank's hull
 * stands on treads (a half-track's too) and its turret, an instance of its own that turns as the
 * classic turret does (`turrets.ts`), is a barrel out from the rim; a gun has its barrel and a wheel,
 * a ship's ball sits in a hull, a plane's has wings. Behind the ball: treads, wheel, the gun's barrel,
 * wings; in front: the helmet and the hull. The sprite's square is BALL_QUAD times the ball's by
 * class, so props reach past it; the ball keeps its size. Props go out with the eyes.
 *
 * They move on the render clock (PLAN 7.174e), nothing of it sim state: a ball on the march bobs
 * (`ballBob`, by its walk phase, the march fraction of its frame), a ball blinks now and then
 * (`blinkShut`, by a hash of its place), its eyes are angry while its formation is engaged and it
 * flinches, eyes squeezed and shaking, while it is under fire (the snapshot's `hit`); one destroyed
 * is a ball with crossed eyes that fades where it died (`deadBalls.ts`).
 *
 * The geometry is in ball units, p in [-1, 1]² over the sprite's square, y down; `eyeCentres` is
 * the shader's own sum, for tests.
 */
import { ATLAS_FRAMES } from './atlas';
import { FLAG_ATLAS_COLS, FLAG_ATLAS_W, FLAG_PAD, FLAG_SLOT_H, FLAG_SLOT_W } from './flagAtlas';
import { FLAG_H, FLAG_W } from '../../shared/flagPixels';
import { Frame, isShipFrame } from '../../shared/unitLooks';

/** The ball's radius in ball units (the rest of the square is clear). */
export const BALL_R = 0.9;
/** Where the eyes' pair sits: across toward the facing, and up (negative) from the middle. */
export const EYES_ACROSS = 0.3;
export const EYES_UP = -0.12;
/** How far the pair moves up or down with the facing's vertical part. */
export const EYES_TILT = 0.14;
/** Half the distance between the two eyes' centres. */
export const EYE_GAP = 0.21;
/** Each eye's radii (an upright oval). */
export const EYE_RX = 0.14;
export const EYE_RY = 0.2;
/** The outline's width: at least this share of a ball unit, and at least OUTLINE_PX CSS px. */
export const OUTLINE_SHARE = 0.08;
export const OUTLINE_PX = 1.2;
/** The outline's colour, 0–1. */
export const OUTLINE_RGB = [0.1, 0.1, 0.11] as const;
/** A ball's side in CSS px from which its eyes are drawn in full, and under which not at all. */
export const EYES_FULL_PX = 11;
export const EYES_NONE_PX = 6;

/** The shading: darker toward the rim by up to SHADE_RIM from SHADE_FROM out, a light of LIGHT at LIGHT_AT over LIGHT_R. */
export const SHADE_RIM = 0.3;
export const SHADE_FROM = 0.3;
export const LIGHT = 0.14;
export const LIGHT_AT = [-0.38, -0.42] as const;
export const LIGHT_R = 0.5;

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** What the flag's colour is multiplied by at (x, y), ball units: the shader's own sum (tests). */
export function ballShade(x: number, y: number): number {
  return 1 - SHADE_RIM * smoothstep(SHADE_FROM, BALL_R, Math.hypot(x, y)) + LIGHT * (1 - smoothstep(0, LIGHT_R, Math.hypot(x - LIGHT_AT[0], y - LIGHT_AT[1])));
}

/** The eyes' centres in ball units for a ball facing `facing` (radians, +x east, y down). */
export function eyeCentres(facing: number): [[number, number], [number, number]] {
  const sx = Math.cos(facing) >= 0 ? 1 : -1;
  const cx = EYES_ACROSS * sx;
  const cy = EYES_UP + EYES_TILT * Math.sin(facing);
  return [
    [cx - EYE_GAP, cy],
    [cx + EYE_GAP, cy],
  ];
}

/**
 * The sprite's quad, in the ball's squares, by what it wears (PLAN 7.174d): as far as its props
 * reach and no further, since every px of the quad is shaded (a quad of 1.75 for every ball made the
 * units' draw four times as dear on bench B).
 */
export const BALL_QUAD_MAX = 1.9;

/** What a frame's ball wears (PLAN 7.174d). */
export const BallClass = { infantry: 0, tank: 1, carrier: 2, gun: 3, ship: 4, aircraft: 5, turret: 6, none: 7 } as const;
export type BallClass = (typeof BallClass)[keyof typeof BallClass];

export function ballClassOf(frame: number): BallClass {
  if (frame === Frame.infantry || frame === Frame.prone) return BallClass.infantry;
  if (frame === Frame.tank || frame === Frame.tankMedium || frame === Frame.tankHeavy || frame === Frame.tankSmall) return BallClass.tank;
  if (frame === Frame.halftrack) return BallClass.carrier;
  if (frame === Frame.gun) return BallClass.gun;
  if (frame === Frame.aircraft) return BallClass.aircraft;
  if (frame === Frame.turretLight || frame === Frame.turretMedium || frame === Frame.turretHeavy) return BallClass.turret;
  if (isShipFrame(frame)) return BallClass.ship;
  return BallClass.none;
}

/** The quad of each class (`BallClass` order), in the ball's squares. */
export const BALL_QUAD: readonly number[] = [1.12, 1.3, 1.3, 1.82, 1.9, 1.72, 1.82, 1.0];

/** The props' colours, 0–1: drawn flat, with the outline at their edge. */
export const HELMET_RGB = [0.36, 0.4, 0.27] as const;
export const TREAD_RGB = [0.26, 0.27, 0.28] as const;
export const STEEL_RGB = [0.42, 0.44, 0.45] as const;
export const HULL_RGB = [0.55, 0.58, 0.62] as const;
export const WING_RGB = [0.72, 0.74, 0.76] as const;

/** The helmet: a dome of HELMET_R about HELMET_AT above the brim line HELMET_BRIM_Y, the brim to ±HELMET_BRIM_X. */
export const HELMET_AT = [0, -0.5] as const;
export const HELMET_R = [0.74, 0.52] as const;
export const HELMET_BRIM_Y = -0.4;
export const HELMET_BRIM_X = 0.95;
/** The treads under the ball: a rounded box. */
export const TREADS = { x: 1.12, top: 0.5, bottom: 1.12, round: 0.22 } as const;
/** The gun's barrel, from its root to its end toward the facing and up a little, and its half width; its wheel. */
export const GUN_BARREL = { from: [0.3, -0.05], to: [1.6, -0.5], half: 0.12 } as const;
export const GUN_WHEEL = { at: [-0.25, 0.72], r: 0.34 } as const;
/** The turret's barrel: along its aim, from the middle out to TURRET_BARREL_LEN, seen only out of the ball. */
export const TURRET_BARREL_LEN = 1.6;
export const TURRET_BARREL_HALF = 0.12;
/** A barrel's outline, a share of the others': a thin rod is its steel, not its edge. */
export const BARREL_OUTLINE = 0.45;
/** A prop's outline is at most this many ball units: where the ball's least outline px is a large share, a small hull is not all edge. */
export const PROP_OUTLINE_MAX = 0.1;
/** The hull: from the stern to the bow (toward the facing) at its deck and at its keel. */
export const SHIP_HULL = { deck: 0.3, keel: 0.92, sternDeck: -1.4, sternKeel: -1.2, bowDeck: 1.7, bowKeel: 1.15 } as const;
/** The wings: an oval behind the ball. */
export const WINGS = { y: 0.12, rx: 1.6, ry: 0.2 } as const;

/**
 * A point well inside the prop of `cls` for a ball facing `facing` (a turret: its aim), in ball
 * units, and the prop's colour there (tests); null for a class without one.
 */
export function propPoint(cls: BallClass, facing: number): { p: [number, number]; rgb: readonly [number, number, number] } | null {
  const sx = Math.cos(facing) >= 0 ? 1 : -1;
  switch (cls) {
    case BallClass.infantry:
      return { p: [0, HELMET_AT[1] - 0.18], rgb: HELMET_RGB };
    case BallClass.tank:
    case BallClass.carrier:
      return { p: [0.98, 0.82], rgb: TREAD_RGB };
    case BallClass.gun: {
      const t = 0.55;
      return { p: [sx * (GUN_BARREL.from[0] + t * (GUN_BARREL.to[0] - GUN_BARREL.from[0])), GUN_BARREL.from[1] + t * (GUN_BARREL.to[1] - GUN_BARREL.from[1])], rgb: STEEL_RGB };
    }
    case BallClass.turret:
      return { p: [1.3 * Math.cos(facing), 1.3 * Math.sin(facing)], rgb: STEEL_RGB };
    case BallClass.ship:
      return { p: [-0.5 * sx, (SHIP_HULL.deck + SHIP_HULL.keel) / 2], rgb: HULL_RGB };
    case BallClass.aircraft:
      return { p: [-1.3 * sx, WINGS.y], rgb: WING_RGB };
    default:
      return null;
  }
}

/** The bob on the march, ball units up at its height, and bobs a second, by class (`BallClass` order). */
export const BOB_H: readonly number[] = [0.2, 0.07, 0.07, 0.16, 0.06, 0.05, 0.07, 0];
export const BOB_HZ: readonly number[] = [2.2, 5, 5, 2.2, 0.8, 1, 5, 0];

/** How far up a ball of class `cls` is at `timeS`, ball units: |sin| of its walk, by `phase` (0–1). */
export function ballBob(cls: number, timeS: number, phase: number, moving: boolean): number {
  return moving ? BOB_H[cls]! * Math.abs(Math.sin(Math.PI * (timeS * BOB_HZ[cls]! + phase))) : 0;
}

/** A blink: every BLINK_EVERY_S to twice that by the ball's seed, shut over BLINK_S. */
export const BLINK_EVERY_S = 3;
export const BLINK_S = 0.18;

/** How shut a ball's eyes are at `timeS` (0 open, 1 shut), by its seed (0–1). */
export function blinkShut(timeS: number, seed: number): number {
  const period = BLINK_EVERY_S * (1 + seed);
  const t = (((timeS / period + seed) % 1) + 1) % 1;
  const share = BLINK_S / period;
  return t < share ? Math.sin((Math.PI * t) / share) : 0;
}

/** Under fire: the eyes' height (a share of theirs) and the shake, ball units and a second. */
export const FLINCH_OPEN = 0.35;
export const FLINCH_AMP = 0.07;
export const FLINCH_HZ = 7;
/** Engaged: the brow cuts the eye from this share of its height down, falling toward the other eye. */
export const ANGRY_CUT = 0.1;
export const ANGRY_SLOPE = 0.8;

/** What a ball's state carries (the instance's `aState`): its formation engaged, it fired at. */
export const BallState = { engaged: 1, hit: 2 } as const;

/** The eyes' height at `timeS` as a share of theirs, for a ball of `state` and seed `seed`. */
export function eyeOpen(state: number, timeS: number, seed: number): number {
  return Math.max(0.08, (1 - blinkShut(timeS, seed)) * ((state & BallState.hit) !== 0 ? FLINCH_OPEN : 1));
}

/** The flinch's shake at `timeS`, ball units across. */
export function flinchShake(state: number, timeS: number): number {
  return (state & BallState.hit) !== 0 ? FLINCH_AMP * Math.sin(2 * Math.PI * FLINCH_HZ * timeS) : 0;
}

const f = (v: number): string => v.toFixed(4);
const v3 = (c: readonly number[]): string => `vec3(${c.map(f).join(', ')})`;
const CLASS_OF = Array.from({ length: ATLAS_FRAMES }, (_, frame) => f(ballClassOf(frame))).join(', ');
const QUAD_OF = Array.from({ length: ATLAS_FRAMES }, (_, frame) => f(BALL_QUAD[ballClassOf(frame)]!)).join(', ');
const BOBS_H = BOB_H.map(f).join(', ');
const BOBS_HZ = BOB_HZ.map(f).join(', ');

export const BALL_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aPrevCur;
layout(location = 2) in vec4 aMisc;    // facing, size (cells), frame (+ march), alpha
layout(location = 3) in vec4 aColor;
layout(location = 4) in float aFlag;   // the nation's flag slot, -1 none
layout(location = 5) in float aState;  // BallState bits: engaged 1, hit 2
uniform vec2 uCam;
uniform float uTime;       // seconds, the render clock
uniform float uMarchSpan;  // the march fraction's span above a half (ProxyRenderer)
uniform float uScale;
uniform vec2 uViewport;
uniform float uT;
uniform float uMinPx;
uniform float uMaxPx;
uniform float uSizeMul;
uniform float uAlpha;
uniform float uDpr;
uniform float uFrameMinPx[${ATLAS_FRAMES}];
const float CLASS_OF[${ATLAS_FRAMES}] = float[${ATLAS_FRAMES}](${CLASS_OF});
const float QUAD_OF[${ATLAS_FRAMES}] = float[${ATLAS_FRAMES}](${QUAD_OF});
const float BOB_H[8] = float[8](${BOBS_H});
const float BOB_HZ[8] = float[8](${BOBS_HZ});
out float vOpen;     // the eyes' height, a share of theirs
out float vAngry;
out vec2 vP;
out vec4 vColor;
out float vSlot;
out vec2 vFlagOrigin;
out vec2 vLook;
out vec2 vAim;
flat out int vClass;
out float vPxP;      // ball units a device px
out float vEyes;     // the eyes' and props' share, 0–1
void main() {
  vec2 pos = mix(aPrevCur.xy, aPrevCur.zw, uT);
  int frame = int(floor(aMisc.z));
  float sizePx = min(max(aMisc.y * uScale, max(uMinPx, uFrameMinPx[frame])), uMaxPx) * uSizeMul;
  vEyes = smoothstep(${f(EYES_NONE_PX)}, ${f(EYES_FULL_PX)}, sizePx / uDpr);
  // Props out (small): the quad is the ball's.
  float quad = vEyes > 0.0 ? QUAD_OF[frame] : 1.0;
  int cls = int(CLASS_OF[frame]);
  // The march (PLAN 7.174e): the frame's fraction from a half is the walk's phase.
  float part = aMisc.z - float(frame);
  float phase = (part - 0.5) / uMarchSpan;
  float bob = part >= 0.25 ? BOB_H[cls] * abs(sin(3.14159265 * (uTime * BOB_HZ[cls] + phase))) : 0.0;
  bool hit = aState >= 2.0;
  vAngry = mod(aState, 2.0) >= 1.0 ? 1.0 : 0.0;
  float shake = hit ? ${f(FLINCH_AMP)} * sin(6.2831853 * ${f(FLINCH_HZ)} * uTime) : 0.0;
  // A blink by a hash of the ball's place.
  float seed = fract(sin(dot(floor(aPrevCur.zw * 256.0), vec2(12.9898, 78.233))) * 43758.5453);
  float period = ${f(BLINK_EVERY_S)} * (1.0 + seed);
  float bt = fract(uTime / period + seed);
  float share = ${f(BLINK_S)} / period;
  float shut = bt < share ? sin(3.14159265 * bt / share) : 0.0;
  vOpen = max(0.08, (1.0 - shut) * (hit ? ${f(FLINCH_OPEN)} : 1.0));
  vec2 px = (pos - uCam) * uScale + aCorner * sizePx * quad + vec2(shake, -bob) * sizePx * 0.5;
  gl_Position = vec4(px.x / (0.5 * uViewport.x), -px.y / (0.5 * uViewport.y), 0.0, 1.0);
  vP = aCorner * 2.0 * quad;
  vPxP = 2.0 / sizePx;
  vLook = vec2(cos(aMisc.x) >= 0.0 ? 1.0 : -1.0, sin(aMisc.x));
  vAim = vec2(cos(aMisc.x), sin(aMisc.x));
  vClass = int(CLASS_OF[frame]);
  vSlot = aFlag;
  float col = mod(aFlag, ${f(FLAG_ATLAS_COLS)});
  float row = floor(aFlag / ${f(FLAG_ATLAS_COLS)} + 0.0001);
  vFlagOrigin = vec2(col * ${f(FLAG_SLOT_W)} + ${f(FLAG_PAD)}, row * ${f(FLAG_SLOT_H)} + ${f(FLAG_PAD)});
  vColor = vec4(aColor.rgb, aColor.a * aMisc.w * uAlpha);
}
`;

export const BALL_FS = `#version 300 es
precision highp float;
uniform sampler2D uFlags;
uniform float uFlagH;      // the flag atlas's height, texels
uniform float uDpr;
in vec2 vP;
in vec4 vColor;
in float vSlot;
in vec2 vFlagOrigin;
in vec2 vLook;
in vec2 vAim;
flat in int vClass;
in float vPxP;
in float vEyes;
in float vOpen;
in float vAngry;
out vec4 outColor;
const float R = ${f(BALL_R)};
const vec3 OUTLINE = vec3(${OUTLINE_RGB.map(f).join(', ')});
// Distances (negative inside), ball units.
float sdBox(vec2 p, vec2 c, vec2 h, float r) {
  vec2 d = abs(p - c) - h + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}
float sdSegment(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float sdEllipse(vec2 p, vec2 c, vec2 r) {
  return (length((p - c) / r) - 1.0) * min(r.x, r.y);
}
// Which side of the line a→b p is on: negative on the left as a→b goes (y down).
float sdLine(vec2 p, vec2 a, vec2 b) {
  vec2 n = normalize(vec2(b.y - a.y, a.x - b.x));
  return dot(p - a, n);
}
// A shape of distance d over (c, a): its fill with the outline at its edge.
void over(inout vec3 c, inout float a, float d, vec3 fill, float w, float aa) {
  float cover = 1.0 - smoothstep(-aa, aa, d);
  if (cover <= 0.0) return;
  vec3 col = mix(fill, OUTLINE, smoothstep(-w - aa, -w + aa, d));
  c = mix(c, col, cover);
  a = a + (1.0 - a) * cover;
}
// An oval eye at c, open: the share of its height shown, its brow cut falling toward the side inward (±1) when angry: 1 inside
// it, and 1 inside its white (the edge out to its outline).
vec2 eye(vec2 p, vec2 c, float open, float inward, float w, float aa) {
  float ry = ${f(EYE_RY)} * open;
  float d = (length((p - c) / vec2(${f(EYE_RX)}, ry)) - 1.0) * min(${f(EYE_RX)}, ry);
  if (vAngry > 0.5) d = max(d, (c.y - ry * (1.0 - 2.0 * ${f(ANGRY_CUT)}) + ${f(ANGRY_SLOPE)} * (p.x - c.x) * inward) - p.y);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  float white = 1.0 - smoothstep(-w - aa, -w + aa, d);
  return vec2(inside, white);
}
void main() {
  float r = length(vP);
  float aa = vPxP;
  float w = max(${f(OUTLINE_SHARE)}, ${f(OUTLINE_PX)} * uDpr * vPxP * vEyes);
  float pw = min(w, ${f(PROP_OUTLINE_MAX)});   // the props' outline
  vec2 q = vec2(vP.x * vLook.x, vP.y);   // x toward the facing
  vec3 c = vec3(0.0);
  float a = 0.0;
  bool props = vEyes > 0.0;
  // A turret is its barrel alone, out of its hull's ball.
  if (vClass == ${BallClass.turret}) {
    if (!props) discard;
    float d = sdSegment(vP, vec2(0.0), vAim * ${f(TURRET_BARREL_LEN)}, ${f(TURRET_BARREL_HALF)});
    over(c, a, max(d, R - w * 0.5 - r), ${v3(STEEL_RGB)}, pw * ${f(BARREL_OUTLINE)}, aa);
    a *= vEyes * vColor.a;
    if (a < 0.02) discard;
    outColor = vec4(c * a, a);
    return;
  }
  // Behind the ball.
  if (props) {
    if (vClass == ${BallClass.tank} || vClass == ${BallClass.carrier}) {
      float d = sdBox(vP, vec2(0.0, ${f((TREADS.top + TREADS.bottom) / 2)}), vec2(${f(TREADS.x)}, ${f((TREADS.bottom - TREADS.top) / 2)}), ${f(TREADS.round)});
      over(c, a, d, ${v3(TREAD_RGB)}, pw, aa);
      // Road wheels on the treads: the nearest of five, on the treads only.
      if (d < 0.0) {
        float k = clamp(floor(vP.x / 0.42 + 0.5), -2.0, 2.0);
        float dw = length(vP - vec2(k * 0.42, ${f((TREADS.top + TREADS.bottom) / 2 + 0.1)})) - 0.13;
        over(c, a, max(dw, d), ${v3(STEEL_RGB)}, pw * 0.6, aa);
      }
    } else if (vClass == ${BallClass.gun}) {
      over(c, a, length(q - vec2(${f(GUN_WHEEL.at[0])}, ${f(GUN_WHEEL.at[1])})) - ${f(GUN_WHEEL.r)}, ${v3(TREAD_RGB)}, pw, aa);
      over(c, a, length(q - vec2(${f(GUN_WHEEL.at[0])}, ${f(GUN_WHEEL.at[1])})) - ${f(GUN_WHEEL.r * 0.35)}, ${v3(STEEL_RGB)}, pw * 0.6, aa);
      over(c, a, sdSegment(q, vec2(${f(GUN_BARREL.from[0])}, ${f(GUN_BARREL.from[1])}), vec2(${f(GUN_BARREL.to[0])}, ${f(GUN_BARREL.to[1])}), ${f(GUN_BARREL.half)}), ${v3(STEEL_RGB)}, pw * ${f(BARREL_OUTLINE)}, aa);
    } else if (vClass == ${BallClass.aircraft}) {
      over(c, a, sdEllipse(vP, vec2(0.0, ${f(WINGS.y)}), vec2(${f(WINGS.rx)}, ${f(WINGS.ry)})), ${v3(WING_RGB)}, pw, aa);
    }
    a *= vEyes;
  }
  // The ball.
  float disc = 1.0 - smoothstep(R - aa, R + aa, r);
  if (disc > 0.0) {
    vec3 b = vColor.rgb;
    if (vSlot >= 0.0) {
      vec2 uv = clamp(0.5 + vP / (2.0 * R), 0.0, 1.0);
      vec2 texel = vFlagOrigin + uv * vec2(${f(FLAG_W)}, ${f(FLAG_H)});
      b = texture(uFlags, texel / vec2(${f(FLAG_ATLAS_W)}, uFlagH)).rgb;
    }
    // Round: darker toward the rim, a soft light up and to the left.
    float shade = 1.0 - ${f(SHADE_RIM)} * smoothstep(${f(SHADE_FROM)}, R, r) + ${f(LIGHT)} * (1.0 - smoothstep(0.0, ${f(LIGHT_R)}, length(vP - vec2(${f(LIGHT_AT[0])}, ${f(LIGHT_AT[1])}))));
    b *= shade;
    // Small, the outline is its share alone: a few px of ball are its flag, not a dark ring.
    b = mix(b, OUTLINE, smoothstep(R - w - aa, R - w + aa, r));
    vec2 centre = vec2(${f(EYES_ACROSS)} * vLook.x, ${f(EYES_UP)} + ${f(EYES_TILT)} * vLook.y);
    // The eyes' box: both ovals and an aa.
    if (props && abs(vP.y - centre.y) < ${f(EYE_RY)} + aa && abs(vP.x - centre.x) < ${f(EYE_GAP + EYE_RX)} + aa) {
      float ew = min(w, 0.45 * ${f(EYE_RY)});
      vec2 e1 = eye(vP, centre - vec2(${f(EYE_GAP)}, 0.0), vOpen, 1.0, ew, aa);
      vec2 e2 = eye(vP, centre + vec2(${f(EYE_GAP)}, 0.0), vOpen, -1.0, ew, aa);
      float inside = max(e1.x, e2.x) * vEyes;
      float white = max(e1.y, e2.y);
      b = mix(b, mix(OUTLINE, vec3(1.0), white), inside);
    }
    c = mix(c, b, disc);
    a = a + (1.0 - a) * disc;
  }
  // In front of the ball.
  if (props) {
    vec3 c0 = c;
    float a0 = a;
    if (vClass == ${BallClass.infantry}) {
      float dome = max(sdEllipse(vP, vec2(${f(HELMET_AT[0])}, ${f(HELMET_AT[1])}), vec2(${f(HELMET_R[0])}, ${f(HELMET_R[1])})), vP.y - ${f(HELMET_BRIM_Y)});
      float brim = sdBox(vP, vec2(0.0, ${f(HELMET_BRIM_Y)}), vec2(${f(HELMET_BRIM_X)}, 0.06), 0.05);
      over(c, a, min(dome, brim), ${v3(HELMET_RGB)}, pw, aa);
    } else if (vClass == ${BallClass.ship}) {
      float d = max(max(${f(SHIP_HULL.deck)} - vP.y, vP.y - ${f(SHIP_HULL.keel)}),
                    max(sdLine(q, vec2(${f(SHIP_HULL.bowDeck)}, ${f(SHIP_HULL.deck)}), vec2(${f(SHIP_HULL.bowKeel)}, ${f(SHIP_HULL.keel)})),
                        sdLine(q, vec2(${f(SHIP_HULL.sternKeel)}, ${f(SHIP_HULL.keel)}), vec2(${f(SHIP_HULL.sternDeck)}, ${f(SHIP_HULL.deck)}))));
      over(c, a, d, ${v3(HULL_RGB)}, pw, aa);
    }
    c = mix(c0, c, vEyes);
    a = mix(a0, a, vEyes);
  }
  a *= vColor.a;
  if (a < 0.02) discard;
  outColor = vec4(c * a, a);
}
`;
