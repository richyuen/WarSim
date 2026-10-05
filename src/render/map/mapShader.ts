/**
 * T0 map shader (SPEC §8 "Rendering techniques").
 *
 * Ownership is classified per fragment from the 4×4 cell neighbourhood with cubic
 * B-spline weights: each distinct controller id accumulates its weight (a smoothed
 * indicator field) and the largest wins. Iso-contours of B-spline-smoothed indicators are
 * C2-smooth curves, so borders stay smooth at any zoom instead of showing cell stairs.
 * A small value-noise domain warp (≤ uWarp cells, < 0.5) makes borders organic; it is
 * bounded so the drawn owner never differs from the sim's by more than half a cell.
 *
 * Borders are drawn where the best and second-best weights meet, with a width that is
 * constant in screen pixels (d / |∇d| from the analytic B-spline derivatives; PLAN 1.28). Occupied land (controller ≠ owner, smoothed
 * the same way) gets screen-space diagonal hatching.
 */

import { SHORE_NOISE } from '../../shared/landMask';
import { HATCH_AT_GROUND } from './ground';

export const MAP_VS = `#version 300 es
precision highp float;
// Full-screen triangle; no attributes.
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const MAP_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

uniform usampler2D uOwner;
uniform usampler2D uController;
uniform sampler2D uPalette;
uniform ivec2 uMapSize;
uniform ivec2 uCenterCell;
uniform vec2 uCenterFrac;
uniform float uScale;      // screen px per cell
uniform vec2 uViewport;    // drawing-buffer px
uniform float uDpr;        // device px per CSS px (border width is in CSS px)
uniform int uWrapX;
uniform float uBorderPx;   // border width (CSS px)
uniform float uWarp;       // domain-warp amplitude (cells), must stay < 0.5
uniform sampler2D uLand;   // fine land coverage, 0..1, bilinear (PLAN 1.28b)
uniform int uHasLand;
uniform int uHasTerrain;           // a real terrain layer is loaded (water from terrain, PLAN 1.37a)
uniform highp usampler2D uTerrain;  // terrain class per cell
uniform int uMode;         // 0 = palette fills, 1 = terrain colours, 2 = province unrest
uniform highp usampler2D uProvince; // admin-1 province per cell
uniform sampler2D uUnrest;          // unrest per province id, 128 wide, 0..1
uniform vec3 uTerrainCol[12];
#ifdef GROUND
uniform highp isampler2D uElevation; // the land's height in metres, one texel a cell (PLAN 2.8a)
uniform float uDetail;     // how much of the ground of T2 and T3 shows, 0..1; 0: the map of T0 and T1
uniform float uCellM;      // metres to a cell
uniform float uRelief;     // how much steeper than it is the ground is shaded
uniform vec3 uGround[12];  // the ground of each terrain class: (bump, grain, shade) (PLAN 2.8b, ground.ts)
uniform float uBump;       // the slope the small relief of mountains is shaded with
uniform highp usampler2D uMask;  // the fine land mask, eight of its pixels to a texel, the lowest bit first (PLAN 2.9b)
uniform int uHasMask;
uniform ivec2 uMaskSize;   // the mask's size in its pixels
uniform int uMaskPerCell;  // mask pixels to a cell
#endif

out vec4 outColor;

ivec2 wrapCell(ivec2 c) {
  if (uWrapX == 1) c.x = ((c.x % uMapSize.x) + uMapSize.x) % uMapSize.x;
  return c;
}

bool inMap(ivec2 c) {
  return c.x >= 0 && c.y >= 0 && c.x < uMapSize.x && c.y < uMapSize.y;
}

uint ctrlAt(ivec2 c) {
  c = wrapCell(c);
  return inMap(c) ? texelFetch(uController, c, 0).r : 0u;
}

uint terrainAt(ivec2 c) {
  c = wrapCell(c);
  return inMap(c) ? texelFetch(uTerrain, c, 0).r : 0u;
}

vec3 terrainCol(uint t) {
  return uTerrainCol[min(int(t), 11)];
}

#ifdef GROUND
// Height of a cell for the shading: the sea is level, and past the map's top and bottom the edge row goes on.
float heightAt(ivec2 c) {
  c = wrapCell(c);
  if (c.x < 0 || c.x >= uMapSize.x) return 0.0;
  c.y = clamp(c.y, 0, uMapSize.y - 1);
  return max(float(texelFetch(uElevation, c, 0).r), 0.0);
}

vec3 groundOf(ivec2 c) {
  return uGround[min(int(terrainAt(c)), 11)];
}

// The ground's noise (PLAN 2.8b). Octave k has 2^k lattice points to a cell. A lattice point is
// named by integers and hashed as integers: at 1 m/px a pixel is 5e-5 of a cell, and a float that
// carried the cell and the place in it would be too coarse by then (streaks). Only the place
// between two lattice points is a float, and that is small.
vec2 latticeGrad(ivec2 p, int k) {
  uint h = uint(p.x) * 0x9E3779B1u ^ uint(p.y) * 0x85EBCA6Bu ^ uint(k) * 0xC2B2AE35u;
  h ^= h >> 15;
  h *= 0x2C1B3C6Du;
  h ^= h >> 12;
  h *= 0x297A2D39u;
  h ^= h >> 15;
  // Two numbers in [-1, 1) from the two halves of the hash.
  return vec2(float(h & 0xFFFFu), float(h >> 16)) * (1.0 / 32768.0) - 1.0;
}

// Gradient noise of octave k at local (cells from the centre cell): xy its slope to a lattice
// step, z its value (about -0.7 to 0.7). Gradient noise and not value noise: the slope of value
// noise is nought along every lattice line, and the shading showed the lattice as a grid.
// Its period along x is the map's width, so the seam of a looping map has no line.
vec3 groundOctave(int k, vec2 local) {
  int f = 1 << k;
  vec2 p = local * float(f);
  vec2 ip = floor(p);
  vec2 t = p - ip;
  // (Rows above the map are sea and never come here; the bias keeps both numbers positive.)
  ivec2 i0 = uCenterCell * f + ivec2(ip) + ivec2(0, 1 << 20);
  ivec2 i1 = i0 + 1;
  if (uWrapX == 1) {
    int period = uMapSize.x * f;
    i0.x = (i0.x + 4 * period) % period;
    i1.x = (i1.x + 4 * period) % period;
  } else {
    i0.x += 1 << 20;
    i1.x += 1 << 20;
  }
  vec2 ga = latticeGrad(i0, k);
  vec2 gb = latticeGrad(ivec2(i1.x, i0.y), k);
  vec2 gc = latticeGrad(ivec2(i0.x, i1.y), k);
  vec2 gd = latticeGrad(i1, k);
  float va = dot(ga, t);
  float vb = dot(gb, t - vec2(1.0, 0.0));
  float vc = dot(gc, t - vec2(0.0, 1.0));
  float vd = dot(gd, t - vec2(1.0, 1.0));
  vec2 u = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * t * t * (t * (t - 2.0) + 1.0);
  float kxy = va - vb - vc + vd;
  vec2 slope = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (u.yx * kxy + vec2(vb, vc) - va);
  return vec3(slope, va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * kxy);
}

// The fine mask's bit at pixel p (PLAN 2.9b): 1 land, 0 water; none beyond its rows.
float maskBitAt(ivec2 p) {
  if (p.y < 0 || p.y >= uMaskSize.y) return 0.0;
  int x = (p.x + 4 * uMaskSize.x) % uMaskSize.x;
  uint b = texelFetch(uMask, ivec2(x >> 3, p.y), 0).r;
  return float((b >> uint(x & 7)) & 1u);
}

// How much land there is at local (cells from the centre cell) by the fine mask, 0..1, the
// coast at a half: the four mask pixels round the place, blended, and the shore moved inside
// them by the ground's noise. Where the four agree it is 0 or 1 and nothing moves it: the drawn
// coast never leaves the squares between a land pixel's middle and a water pixel's.
float maskField(vec2 local, float pxPerCell) {
  vec2 m = local * float(uMaskPerCell) - 0.5;
  vec2 fm = floor(m);
  vec2 t = m - fm;
  ivec2 p = uCenterCell * uMaskPerCell + ivec2(fm);
  float f = mix(mix(maskBitAt(p), maskBitAt(p + ivec2(1, 0)), t.x), mix(maskBitAt(p + ivec2(0, 1)), maskBitAt(p + ivec2(1, 1)), t.x), t.y);
  if (f <= 0.0 || f >= 1.0) return f;
  // A shore, not a ruler's edge: octaves from a mask pixel's width down to 4 px on screen.
  float n = 0.0;
  float amp = 1.0;
  float sum = 0.0;
  for (int k = 3; k < 14; k++) {
    if (pxPerCell / float(1 << k) < 4.0) break;
    n += groundOctave(k, local).z * amp;
    sum += amp;
    amp *= 0.6;
  }
  if (sum > 0.0) f += ${SHORE_NOISE.toFixed(3)} * clamp(n / (0.7 * sum), -1.0, 1.0) * 4.0 * f * (1.0 - f);
  return f;
}
#endif

uint provinceAt(ivec2 c) {
  c = wrapCell(c);
  return inMap(c) ? texelFetch(uProvince, c, 0).r : 0u;
}

// Unrest ramp: calm (pale) → may revolt at 0.5 (orange) → 1 (dark red).
vec3 unrestCol(float u) {
  vec3 calm = vec3(0.91, 0.89, 0.81);
  vec3 warm = vec3(0.94, 0.63, 0.31);
  vec3 hot = vec3(0.56, 0.11, 0.06);
  return u < 0.5 ? mix(calm, warm, u * 2.0) : mix(warm, hot, (u - 0.5) * 2.0);
}

uint ownerAt(ivec2 c) {
  c = wrapCell(c);
  return inMap(c) ? texelFetch(uOwner, c, 0).r : 0u;
}

vec3 pal(uint id) {
  return texelFetch(uPalette, ivec2(int(id & 255u), int(id >> 8u)), 0).rgb;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(mod(i, 256.0));
  float b = hash12(mod(i + vec2(1.0, 0.0), 256.0));
  float c = hash12(mod(i + vec2(0.0, 1.0), 256.0));
  float d = hash12(mod(i + vec2(1.0, 1.0), 256.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec2 px = gl_FragCoord.xy - 0.5 * uViewport;
  // World y grows downwards (row index); screen y grows upwards in gl_FragCoord.
  vec2 local = uCenterFrac + vec2(px.x, -px.y) / uScale;

  // Periodic noise coordinates stay small, so f32 precision holds anywhere on the map.
  vec2 np = vec2(uCenterCell % 256) + local;
  vec2 warp = (vec2(vnoise(np * 0.45), vnoise(np * 0.45 + 17.31)) - 0.5) * 2.0 * uWarp;

  // Cubic B-spline weights over the 4×4 cell neighbourhood (C2-smooth indicator fields).
  vec2 q = local + warp - 0.5;           // relative to cell centres
  vec2 fq = floor(q);
  vec2 t = q - fq;                        // [0, 1)
  ivec2 base = uCenterCell + ivec2(fq) - 1;
  vec2 t2 = t * t;
  vec2 t3 = t2 * t;
  vec2 omt = 1.0 - t;
  vec4 wx = vec4(omt.x * omt.x * omt.x, 3.0 * t3.x - 6.0 * t2.x + 4.0, -3.0 * t3.x + 3.0 * t2.x + 3.0 * t.x + 1.0, t3.x) / 6.0;
  vec4 wy = vec4(omt.y * omt.y * omt.y, 3.0 * t3.y - 6.0 * t2.y + 4.0, -3.0 * t3.y + 3.0 * t2.y + 3.0 * t.y + 1.0, t3.y) / 6.0;
  // Analytic derivatives of the weights (per cell): the border distance uses the exact gradient
  // of the indicator fields instead of fwidth, which spiked where the second-strongest id changed
  // between neighbouring pixels and was undefined inside the n > 1 branch (dashed stair lines
  // inside nations, PLAN 1.28).
  vec4 dwx = vec4(-0.5 * omt.x * omt.x, 1.5 * t2.x - 2.0 * t.x, -1.5 * t2.x + t.x + 0.5, 0.5 * t2.x);
  vec4 dwy = vec4(-0.5 * omt.y * omt.y, 1.5 * t2.y - 2.0 * t.y, -1.5 * t2.y + t.y + 0.5, 0.5 * t2.y);

  uint ids[16];
  float acc[16];
  float occ[16];   // weight of cells of this controller that are occupied (owner ≠ controller)
  uint occOwner[16];
  int n = 0;
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      ivec2 c = base + ivec2(i, j);
      uint id = ctrlAt(c);
      uint own = ownerAt(c);
      float w = wx[i] * wy[j];
      bool occupied = id != 0u && own != 0u && own != id;
      int k = 0;
      for (; k < n; k++) {
        if (ids[k] == id) {
          acc[k] += w;
          if (occupied) { occ[k] += w; occOwner[k] = own; }
          break;
        }
      }
      if (k == n) {
        ids[n] = id;
        acc[n] = w;
        occ[n] = occupied ? w : 0.0;
        occOwner[n] = own;
        n++;
      }
    }
  }
  int bi = 0;
  for (int k = 1; k < n; k++) if (acc[k] > acc[bi]) bi = k;
  float second = 0.0;
  uint secondId = ids[bi];
  for (int k = 0; k < n; k++) if (k != bi && acc[k] > second) { second = acc[k]; secondId = ids[k]; }
  uint best = ids[bi];

  // Fine coastline (PLAN 1.28b): land/water from the bilinear coverage of the 16k land mask.
  // Computed in uniform control flow so its screen derivatives are defined.
  vec2 cellPos = vec2(uCenterCell) + local;
  vec2 luv = vec2(fract(cellPos.x / float(uMapSize.x)), cellPos.y / float(uMapSize.y));
  float cov = texture(uLand, luv).r;
  float covW = max(fwidth(cov), 1e-6);
#ifdef GROUND
  // The coast of T2 and T3 is the fine mask's (PLAN 2.9b, ADR-79), the mask the sim stands its
  // formations on; the coverage is a quarter as fine. The two coasts cross-fade by the
  // handover's share, as every tier change does: a place that is sea by the one and land by
  // the other fades. (A blend of the two fields moved the shore across such places instead,
  // and each pixel it passed went from sea to land in one frame.)
  float fine = cov;
  float fineShare = 0.0;
  if (uDetail > 0.0 && uHasMask == 1 && uHasLand == 1) {
    fine = maskField(local, uScale / uDpr);
    fineShare = uDetail;
  }
  float fineW = max(fwidth(fine), 1e-6);
#endif
  // Off-map rows (above the top, below the bottom) are sea: clamped coverage would otherwise
  // stretch the polar rows into grey stripes when fully zoomed out (review after PLAN 1.31).
  bool offMap = cellPos.y < 0.0 || cellPos.y >= float(uMapSize.y);
  // Water: fine coverage when loaded; else the terrain layer (unowned land stays land); else the
  // cell rule (toy map: unowned = sea).
  bool water = offMap || (uHasLand == 1 ? cov <= 0.5 : uHasTerrain == 1 ? terrainAt(ivec2(floor(cellPos))) == 0u : best == 0u);
#ifdef GROUND
  // How much of this pixel is land: by the coverage's coast and the mask's, each by its share.
  // What follows draws it as land when any of it is.
  bool coarseLand = !water;
  bool fineLand = !offMap && fine > 0.5;
  float landShare = fineShare > 0.0 ? mix(coarseLand ? 1.0 : 0.0, fineLand ? 1.0 : 0.0, fineShare) : (coarseLand ? 1.0 : 0.0);
  water = landShare <= 0.0;
#endif
  // Land the cell rule called water takes the strongest land id around it.
  uint fid = best != 0u ? best : secondId;

  vec3 col;
  if (water) {
    col = pal(0u);
  } else if (uMode == 1) {
    // Terrain mode: bilinear blend of the four nearest cells' terrain colours.
    vec2 tq = cellPos - 0.5;
    ivec2 t0 = ivec2(floor(tq));
    vec2 tf = tq - floor(tq);
    col = mix(mix(terrainCol(terrainAt(t0)), terrainCol(terrainAt(t0 + ivec2(1, 0))), tf.x),
              mix(terrainCol(terrainAt(t0 + ivec2(0, 1))), terrainCol(terrainAt(t0 + ivec2(1, 1))), tf.x), tf.y);
  } else if (uMode == 2) {
    uint pid = provinceAt(ivec2(floor(cellPos)));
    float u = texelFetch(uUnrest, ivec2(int(pid % 128u), int(pid / 128u)), 0).r;
    col = unrestCol(u);
  } else {
    col = fid == 0u ? vec3(0.62, 0.62, 0.58) : pal(fid);
  }

  // Occupation (controller ≠ rightful owner), smoothed with the same weights so the
  // hatched region has smooth edges and never leaks across the controller border.
  if (!water && uMode == 0 && occ[bi] > 0.5 * acc[bi]) {
    float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / (7.0 * uDpr)));
#ifdef GROUND
    // With the ground of T2 and T3 the hatching gives way to it (PLAN 2.11f): the two stripes
    // close on the tint between them, by the ground's share, and a little of each is left.
    stripe = mix(stripe, 0.5, uDetail * ${(1 - HATCH_AT_GROUND).toFixed(3)});
#endif
    col = mix(col * 0.72, mix(col, pal(occOwner[bi]), 0.35), stripe);
  }

  // Hillshade (PLAN 2.8a, ADR-78): the fill is lit by the slope of the ground, the light from
  // the north-west. The height is smoothed over the 4×4 cells around by the cubic B-spline the
  // borders use, and its slope taken from the spline's own derivative: one sample a cell would
  // otherwise show every cell as a facet. Not warped: the ground is where it is.
  // Only in the program that draws the ground (GROUND): the pass of T0 and T1 is compiled
  // without it. (A branch on the share was not enough: with the texture's loop inside it, the
  // pass cost half as much again at T0, where the branch is never taken.)
#ifdef GROUND
  if (uDetail > 0.0 && !water) {
    vec2 e = local - 0.5;
    vec2 fe = floor(e);
    vec2 s = e - fe;
    vec2 s2 = s * s;
    vec2 s3 = s2 * s;
    vec2 oms = 1.0 - s;
    vec4 hx = vec4(oms.x * oms.x * oms.x, 3.0 * s3.x - 6.0 * s2.x + 4.0, -3.0 * s3.x + 3.0 * s2.x + 3.0 * s.x + 1.0, s3.x) / 6.0;
    vec4 hy = vec4(oms.y * oms.y * oms.y, 3.0 * s3.y - 6.0 * s2.y + 4.0, -3.0 * s3.y + 3.0 * s2.y + 3.0 * s.y + 1.0, s3.y) / 6.0;
    vec4 dhx = vec4(-0.5 * oms.x * oms.x, 1.5 * s2.x - 2.0 * s.x, -1.5 * s2.x + s.x + 0.5, 0.5 * s2.x);
    vec4 dhy = vec4(-0.5 * oms.y * oms.y, 1.5 * s2.y - 2.0 * s.y, -1.5 * s2.y + s.y + 0.5, 0.5 * s2.y);
    ivec2 hb = uCenterCell + ivec2(fe) - 1;
    vec2 rise = vec2(0.0); // metres to a cell, east and south
    for (int j = 0; j < 4; j++) {
      for (int i = 0; i < 4; i++) {
        rise += heightAt(hb + ivec2(i, j)) * vec2(dhx[i] * hy[j], hx[i] * dhy[j]);
      }
    }
    vec2 slope = rise * (uRelief / uCellM);

    // Ground texture (PLAN 2.8b). The data has one height in 20 km: the small relief and the
    // grain of the ground are noise, by the kind of ground of the four cells around.
    ivec2 gc = uCenterCell + ivec2(fe);
    vec3 ground = mix(mix(groundOf(gc), groundOf(gc + ivec2(1, 0)), s.x), mix(groundOf(gc + ivec2(0, 1)), groundOf(gc + ivec2(1, 1)), s.x), s.y);
    // Octaves by their wavelength on screen (CSS px): from 256 px down to the finest that is
    // drawn, 16 px at the far end of T2 and 2.5 px from 20 m/px in. So the nearer the camera,
    // the finer the ground; and an octave comes and goes by its weight, a function of the zoom.
    float sc = uScale / uDpr;
    float nearness = 1.0 - smoothstep(4.32, 8.23, log2(uCellM / sc)); // log2 of 20 and of 300 m/px
    float lmin = mix(16.0, 2.5, nearness);
    int k0 = max(0, int(floor(log2(sc / 256.0))));
    vec2 bump = vec2(0.0);
    float grain = 0.0;
    for (int n = 0; n < 10; n++) {
      int k = k0 + n;
      float lambda = sc / float(1 << k);
      if (lambda < lmin * 0.5) break;
      float w = smoothstep(lmin * 0.5, lmin, lambda) * (1.0 - smoothstep(128.0, 256.0, lambda));
      if (w <= 0.0) continue;
      vec3 o = groundOctave(k, local);
      // The broader a rise, the higher it stands: its slope counts for more, by the fourth root of its width.
      bump += o.xy * (w * pow(lambda / 16.0, 0.25));
      grain += o.z * w;
    }
    slope += bump * (uBump * ground.x);

    // The light: from the north-west (x grows east, y south), 41° above the horizon.
    const vec3 light = vec3(-0.5206, -0.5206, 0.6768);
    float lit = dot(normalize(vec3(-slope, 1.0)), light) / light.z - 1.0; // 0 on level ground
    // A soft limit, not a hard one: a slope is from 0.58 to 1.28 of its fill, and the steepest
    // run into the limit gently (a hard one made two tones of a mountainside).
    float shade = 1.0 + (lit > 0.0 ? 0.28 : 0.42) * tanh(lit * (lit > 0.0 ? 2.2 : 1.5));
    col *= mix(1.0, shade * (1.0 + ground.y * grain) * ground.z, uDetail);
  }
#endif

  float d = acc[bi] - second;
  float halfW = 0.5 * uBorderPx * uDpr;
  float fade = smoothstep(0.35, 1.5, uScale / uDpr); // borders fade below ~1.5 px per cell
  bool cellCoast = best == 0u || secondId == 0u;
  // Borders between the two strongest ids (land–land only when the fine coast is drawn), constant
  // width in screen px. |∇d| ≤ 2√2 per cell (each axis' derivative weights sum to ≤ 1), so
  // pixels with d·uScale beyond (halfW + 1)·2√2 are surely off the border and skip the pass.
  if (!water && n > 1 && !(uHasLand == 1 && cellCoast) && d * uScale < (halfW + 1.0) * 2.83) {
    // Distance to the iso-line d = 0 in device px: d / |∇d|, with ∇ per cell → per px (÷ uScale).
    vec2 gd = vec2(0.0);
    for (int j = 0; j < 4; j++) {
      for (int i = 0; i < 4; i++) {
        uint id = ctrlAt(base + ivec2(i, j));
        vec2 dw = vec2(dwx[i] * wy[j], wx[i] * dwy[j]);
        if (id == best) gd += dw;
        else if (id == secondId) gd -= dw;
      }
    }
    float pxDist = d * uScale / max(length(gd), 1e-6);
    float a = (1.0 - smoothstep(halfW - 0.5, halfW + 0.5, pxDist)) * fade;
    vec3 lineCol = cellCoast ? col * 0.8 : mix(col, vec3(0.06, 0.06, 0.08), 0.8);
    col = mix(col, lineCol, a * (cellCoast ? 0.55 : 1.0));
  }
  // Fine coast line on the land side.
#ifdef GROUND
  if (uHasLand == 1 && !water) {
    // Each coast has its line, by its share; then the pixel is land by as much as the two say.
    float a = coarseLand ? (1.0 - smoothstep(halfW - 0.5, halfW + 0.5, (cov - 0.5) / covW)) * (1.0 - fineShare) : 0.0;
    if (fineLand) a += (1.0 - smoothstep(halfW - 0.5, halfW + 0.5, (fine - 0.5) / fineW)) * fineShare;
    col = mix(col, col * 0.62, a * 0.8);
    col = mix(pal(0u), col, landShare);
  }
#else
  if (uHasLand == 1 && !water) {
    float cpx = (cov - 0.5) / covW;
    float a = 1.0 - smoothstep(halfW - 0.5, halfW + 0.5, cpx);
    col = mix(col, col * 0.62, a * 0.8);
  }
#endif
  outColor = vec4(col, 1.0);
}
`;

/** The pass with the ground of T2 and T3 in it (PLAN 2.8): the same source, compiled with GROUND. */
export const MAP_FS_GROUND = MAP_FS.replace('#version 300 es\n', '#version 300 es\n#define GROUND\n');
