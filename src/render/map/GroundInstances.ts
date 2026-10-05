/**
 * The trees, rocks and buildings of T2 and T3 (PLAN 2.8c2, ADR-78): the scatter's instances
 * (`scatter.ts`), one instanced draw over the map and under the units. The fragment shader
 * draws each thing in its square: a crown, a block of rock, a roof, lit from the north-west as
 * the ground is, with its shadow to the south-east.
 *
 * Places come from the scatter as CSS px from the view's centre, so a float32 holds them at any
 * zoom; they are uploaded again whenever the camera moves.
 */
import * as twgl from 'twgl.js';
import { SCATTER_STRIDE } from './scatter';

const VS = `#version 300 es
precision highp float;
in vec2 aCorner;        // per-vertex corner in [-0.5, 0.5]
in vec3 aPlace;         // per-instance: x and y from the view's centre, and size, CSS px
in vec3 aLook;          // per-instance: kind, opacity, variant (0..1)
uniform vec2 uViewport; // CSS px
uniform float uDpr;
uniform float uShare;   // the layer's opacity (the handover's share)
out vec2 vP;            // the fragment's place in the instance's square, in sizes: the thing is within 0.5 of the middle
out vec3 vLook;
out float vPx;          // the size in device px
void main() {
  // The square is 1.7 sizes wide: the thing and its shadow.
  vec2 corner = aCorner * 1.7;
  vP = corner;
  vec2 px = aPlace.xy + corner * aPlace.z;
  gl_Position = vec4(px.x / (0.5 * uViewport.x), -px.y / (0.5 * uViewport.y), 0.0, 1.0);
  vLook = vec3(aLook.x, aLook.y * uShare, aLook.z);
  vPx = aPlace.z * uDpr;
}
`;

const FS = `#version 300 es
precision highp float;
in vec2 vP;
in vec3 vLook;
in float vPx;
out vec4 outColor;

// On the ground, towards the light: north-west (x grows east, y south).
const vec2 TO_LIGHT = vec2(-0.7071, -0.7071);

vec2 turn(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
}

// How far p is outside a block of rock with cut corners (negative: inside).
float rock(vec2 q) {
  return max(max(abs(q.x), abs(q.y) * 1.2), (abs(q.x) + abs(q.y)) * 0.78) - 0.36;
}

// How far q is outside a house of half sizes h.
float house(vec2 q, vec2 h) {
  return max(abs(q.x) - h.x, abs(q.y) - h.y);
}

void main() {
  float v = vLook.z;
  float soft = 1.0 / max(vPx, 1.0); // a device px, in sizes
  vec3 col;
  float body;   // how much of the pixel the thing covers
  float shade;  // and its shadow
  if (vLook.x < 0.5) {
    // A tree: a crown with a lobed edge, light on the side of the light.
    float r = length(vP);
    float edge = 0.45 * (0.9 + 0.1 * sin(atan(vP.y, vP.x) * 5.0 + v * 40.0));
    body = 1.0 - smoothstep(edge - soft, edge + soft, r);
    float lit = clamp(0.5 + dot(vP, TO_LIGHT) / 0.9, 0.0, 1.0);
    col = mix(vec3(0.09, 0.22, 0.10), vec3(0.25, 0.44, 0.19), lit) * (0.9 + 0.2 * v);
    shade = 1.0 - smoothstep(0.45 - 2.0 * soft, 0.45 + 2.0 * soft, length(vP - vec2(0.2)));
  } else if (vLook.x < 1.5) {
    // A rock: one face to the light, one away from it.
    float a = v * 6.2832;
    float d = rock(turn(vP, a));
    body = 1.0 - smoothstep(-soft, soft, d);
    col = dot(vP, TO_LIGHT) > -0.04 ? vec3(0.64, 0.62, 0.58) : vec3(0.38, 0.37, 0.36);
    col = mix(col, vec3(0.22), smoothstep(-0.07, 0.0, d) * 0.6);
    shade = 1.0 - smoothstep(-2.0 * soft, 2.0 * soft, rock(turn(vP - vec2(0.15), a)));
  } else {
    // A building: a roof of two slopes along its length, along one of two streets that cross, give or take a little.
    float a = floor(v * 2.0) * 1.5708 + (fract(v * 16.0) - 0.5) * 0.25;
    vec2 h = vec2(0.42, 0.26 + 0.08 * fract(v * 7.0));
    vec2 q = turn(vP, a);
    float d = house(q, h);
    body = 1.0 - smoothstep(-soft, soft, d);
    // The slope this pixel is on faces across the ridge: towards the light, or away.
    vec2 across = turn(vec2(0.0, q.y < 0.0 ? -1.0 : 1.0), -a);
    vec3 roof = fract(v * 3.0) < 0.6 ? vec3(0.62, 0.34, 0.26) : vec3(0.50, 0.49, 0.50);
    col = roof * (dot(across, TO_LIGHT) > 0.0 ? 1.14 : 0.8);
    // The ridge, a dark line, once the roof is large enough to have one (a symbol of 7 px is
    // two slopes and an outline: a line between them would leave two sticks).
    col *= mix(1.0, mix(0.6, 1.0, smoothstep(0.02, 0.05 + soft, abs(q.y))), smoothstep(10.0, 18.0, vPx));
    col = mix(col, vec3(0.16), smoothstep(-0.06, 0.0, d) * 0.7);
    shade = 1.0 - smoothstep(-2.0 * soft, 2.0 * soft, house(turn(vP - vec2(0.13), a), h));
  }
  float shadow = 0.34 * shade * (1.0 - body);
  float alpha = body + shadow;
  if (alpha * vLook.y < 0.01) discard;
  // The shadow is black: the thing's colour by its share of what is drawn here.
  outColor = vec4(col * (body / alpha), alpha * vLook.y);
}
`;

/** The most instances drawn in a frame: a full view of forest at 1920 × 1080 has up to 10,900. */
export const GROUND_CAP = 12_000;

export class GroundInstances {
  private readonly program: twgl.ProgramInfo;
  private readonly vao: WebGLVertexArrayObject;
  private readonly buf: WebGLBuffer;
  /** The scatter writes here: `cap` × SCATTER_STRIDE floats. */
  readonly data: Float32Array;
  count = 0;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly cap = GROUND_CAP,
  ) {
    this.program = twgl.createProgramInfo(gl, [VS, FS]);
    this.data = new Float32Array(cap * SCATTER_STRIDE);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const corner = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, corner);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    const loc = (n: string): number => gl.getAttribLocation(this.program.program, n);
    gl.enableVertexAttribArray(loc('aCorner'));
    gl.vertexAttribPointer(loc('aCorner'), 2, gl.FLOAT, false, 0, 0);
    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    for (const [name, offset] of [['aPlace', 0], ['aLook', 12]] as const) {
      gl.enableVertexAttribArray(loc(name));
      gl.vertexAttribPointer(loc(name), 3, gl.FLOAT, false, SCATTER_STRIDE * 4, offset);
      gl.vertexAttribDivisor(loc(name), 1);
    }
    gl.bindVertexArray(null);
  }

  /** Takes the first `count` instances of `data` (after the scatter has written them). */
  upload(count: number): void {
    const gl = this.gl;
    this.count = Math.min(count, this.cap);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * SCATTER_STRIDE);
  }

  /** Draws them in a view of `viewW` × `viewH` CSS px, the layer at opacity `share`. */
  draw(viewW: number, viewH: number, dpr: number, share: number): void {
    if (this.count === 0 || share <= 0) return;
    const gl = this.gl;
    gl.enable(gl.BLEND);
    // Colour over what is there, by the source's alpha; the canvas itself stays opaque. (With
    // one function for both, a shadow left the canvas at an alpha of 0.54 to 0.78 and the
    // page's background showed through it: PLAN 2.11m.)
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program.program);
    twgl.setUniforms(this.program, { uViewport: [viewW, viewH], uDpr: dpr, uShare: share });
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  dispose(): void {
    this.gl.deleteBuffer(this.buf);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program.program);
  }
}
