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
uniform highp usampler2D uTerrain;  // terrain class per cell
uniform int uMode;         // 0 = palette fills, 1 = terrain colours
uniform vec3 uTerrainCol[12];

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
  bool water = uHasLand == 1 ? cov <= 0.5 : best == 0u;
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
  } else {
    col = fid == 0u ? vec3(0.62, 0.62, 0.58) : pal(fid);
  }

  // Occupation (controller ≠ rightful owner), smoothed with the same weights so the
  // hatched region has smooth edges and never leaks across the controller border.
  if (!water && uMode == 0 && occ[bi] > 0.5 * acc[bi]) {
    float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / (7.0 * uDpr)));
    col = mix(col * 0.72, mix(col, pal(occOwner[bi]), 0.35), stripe);
  }

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
  if (uHasLand == 1 && !water) {
    float cpx = (cov - 0.5) / covW;
    float a = 1.0 - smoothstep(halfW - 0.5, halfW + 0.5, cpx);
    col = mix(col, col * 0.62, a * 0.8);
  }
  outColor = vec4(col, 1.0);
}
`;
