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
 * The geometry is in ball units, p in [-1, 1]² over the sprite's square, y down; `eyeCentres` is
 * the shader's own sum, for tests.
 */
import { ATLAS_FRAMES } from './atlas';
import { FLAG_ATLAS_COLS, FLAG_ATLAS_W, FLAG_PAD, FLAG_SLOT_H, FLAG_SLOT_W } from './flagAtlas';
import { FLAG_H, FLAG_W } from '../../shared/flagPixels';

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

const f = (v: number): string => v.toFixed(4);

export const BALL_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aPrevCur;
layout(location = 2) in vec4 aMisc;    // facing, size (cells), frame (+ march), alpha
layout(location = 3) in vec4 aColor;
layout(location = 4) in float aFlag;   // the nation's flag slot, -1 none
uniform vec2 uCam;
uniform float uScale;
uniform vec2 uViewport;
uniform float uT;
uniform float uMinPx;
uniform float uMaxPx;
uniform float uSizeMul;
uniform float uAlpha;
uniform float uDpr;
uniform float uFrameMinPx[${ATLAS_FRAMES}];
out vec2 vP;
out vec4 vColor;
out float vSlot;
out vec2 vFlagOrigin;
out vec2 vLook;
out float vPxP;      // ball units a device px
out float vEyes;     // the eyes' share, 0–1
void main() {
  vec2 pos = mix(aPrevCur.xy, aPrevCur.zw, uT);
  int frame = int(floor(aMisc.z));
  float sizePx = min(max(aMisc.y * uScale, max(uMinPx, uFrameMinPx[frame])), uMaxPx) * uSizeMul;
  vec2 px = (pos - uCam) * uScale + aCorner * sizePx;
  gl_Position = vec4(px.x / (0.5 * uViewport.x), -px.y / (0.5 * uViewport.y), 0.0, 1.0);
  vP = aCorner * 2.0;
  vPxP = 2.0 / sizePx;
  vEyes = smoothstep(${f(EYES_NONE_PX)}, ${f(EYES_FULL_PX)}, sizePx / uDpr);
  vLook = vec2(cos(aMisc.x) >= 0.0 ? 1.0 : -1.0, sin(aMisc.x));
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
in float vPxP;
in float vEyes;
out vec4 outColor;
const float R = ${f(BALL_R)};
const vec3 OUTLINE = vec3(${OUTLINE_RGB.map(f).join(', ')});
// An oval eye at c: 1 inside its white, the white's edge out to its outline.
vec2 eye(vec2 p, vec2 c, float w, float aa) {
  vec2 q = (p - c) / vec2(${f(EYE_RX)}, ${f(EYE_RY)});
  float d = length(q) * ${f(EYE_RY)};   // ball units, about
  float inside = 1.0 - smoothstep(${f(EYE_RY)} - aa, ${f(EYE_RY)} + aa, d);
  float white = 1.0 - smoothstep(${f(EYE_RY)} - w - aa, ${f(EYE_RY)} - w + aa, d);
  return vec2(inside, white);
}
void main() {
  float r = length(vP);
  float aa = vPxP;
  float disc = 1.0 - smoothstep(R - aa, R + aa, r);
  if (disc <= 0.0) discard;
  vec3 c = vColor.rgb;
  if (vSlot >= 0.0) {
    vec2 uv = clamp(0.5 + vP / (2.0 * R), 0.0, 1.0);
    vec2 texel = vFlagOrigin + uv * vec2(${f(FLAG_W)}, ${f(FLAG_H)});
    c = texture(uFlags, texel / vec2(${f(FLAG_ATLAS_W)}, uFlagH)).rgb;
  }
  // Round: darker toward the rim, a soft light up and to the left.
  float shade = 1.0 - ${f(SHADE_RIM)} * smoothstep(${f(SHADE_FROM)}, R, r) + ${f(LIGHT)} * (1.0 - smoothstep(0.0, ${f(LIGHT_R)}, length(vP - vec2(${f(LIGHT_AT[0])}, ${f(LIGHT_AT[1])}))));
  c *= shade;
  // Small, the outline is its share alone: a few px of ball are its flag, not a dark ring.
  float w = max(${f(OUTLINE_SHARE)}, ${f(OUTLINE_PX)} * uDpr * vPxP * vEyes);
  c = mix(c, OUTLINE, smoothstep(R - w - aa, R - w + aa, r));
  if (vEyes > 0.0) {
    vec2 centre = vec2(${f(EYES_ACROSS)} * vLook.x, ${f(EYES_UP)} + ${f(EYES_TILT)} * vLook.y);
    float ew = min(w, 0.45 * ${f(EYE_RY)});
    vec2 a = eye(vP, centre - vec2(${f(EYE_GAP)}, 0.0), ew, aa);
    vec2 b = eye(vP, centre + vec2(${f(EYE_GAP)}, 0.0), ew, aa);
    float inside = max(a.x, b.x) * vEyes;
    float white = max(a.y, b.y);
    c = mix(c, mix(OUTLINE, vec3(1.0), white), inside);
  }
  float alpha = disc * vColor.a;
  outColor = vec4(c * alpha, alpha);
  if (outColor.a < 0.02) discard;
}
`;
