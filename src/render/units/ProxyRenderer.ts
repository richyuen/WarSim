/**
 * Instanced unit-proxy renderer (SPEC §8 "Units"): one draw call for all sprites of an
 * atlas. Per-instance prev/cur positions are uploaded once per snapshot; the vertex shader
 * interpolates with a uniform `uT`, so per-frame CPU cost is constant regardless of count.
 *
 * Positions are f32 offsets from an integer origin chosen at upload time (camera-relative
 * precision, SPEC §8); the camera offset from that origin is computed in f64 on the CPU.
 */
import * as twgl from 'twgl.js';
import type { Camera } from '../camera';
import { ATLAS_FRAMES } from './atlas';

const VS = `#version 300 es
precision highp float;
in vec2 aCorner;            // per-vertex quad corner in [-0.5, 0.5]
in vec4 aPrevCur;           // per-instance prev.xy, cur.xy (cells, relative to origin)
in vec4 aMisc;              // facing (rad), size (cells), frame, alpha
in vec4 aColor;             // tint (normalised u8)
uniform vec2 uCam;          // camera centre relative to origin (cells)
uniform float uScale;       // device px per cell
uniform vec2 uViewport;     // device px
uniform float uT;           // interpolation factor in [0, 1]
uniform float uMinPx;       // minimum sprite size in device px
uniform float uMaxPx;       // maximum sprite size in device px
uniform float uSizeMul;     // unit-size setting (PLAN 1.39a)
uniform float uTime;        // seconds, for the walk/drive animation (PLAN 2.3)
uniform float uAlpha;       // layer opacity (tier fades)
out vec2 vUv;
out vec4 vColor;
void main() {
  vec2 pos = mix(aPrevCur.xy, aPrevCur.zw, uT);
  float sizePx = min(max(aMisc.y * uScale, uMinPx), uMaxPx) * uSizeMul;
  float frame = floor(aMisc.z);
  // Moving (frame + 0.5): infantry sway side to side at a walking cadence, vehicles judder.
  float moving = step(0.25, aMisc.z - frame);
  float phase = float(gl_InstanceID) * 1.618;
  vec2 local = aCorner;
  if (frame < 0.5) local += moving * vec2(0.0, 0.07 * sin(uTime * 9.0 + phase));
  else local += moving * vec2(0.03 * sin(uTime * 31.0 + phase), 0.0);
  float c = cos(aMisc.x);
  float s = sin(aMisc.x);
  vec2 corner = vec2(c * local.x - s * local.y, s * local.x + c * local.y) * sizePx;
  vec2 px = (pos - uCam) * uScale + corner;
  gl_Position = vec4(px.x / (0.5 * uViewport.x), -px.y / (0.5 * uViewport.y), 0.0, 1.0);
  vUv = vec2((frame + aCorner.x + 0.5) / ${ATLAS_FRAMES.toFixed(1)}, aCorner.y + 0.5);
  vColor = vec4(aColor.rgb, aColor.a * aMisc.w * uAlpha);
}
`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uAtlas;
in vec2 vUv;
in vec4 vColor;
out vec4 outColor;
void main() {
  vec4 t = texture(uAtlas, vUv);
  // White silhouette → tint; dark outline stays dark.
  outColor = vec4(t.rgb * vColor.rgb, t.a * vColor.a);
  if (outColor.a < 0.02) discard;
}
`;

/** No upper limit to a sprite's size (a finite number: the shader takes it as a float). */
const NO_MAX_PX = 1e9;

/** Floats per instance in the position/misc buffer. */
export const PROXY_STRIDE = 8;
const STRIDE = PROXY_STRIDE;

export class ProxyRenderer {
  readonly gl: WebGL2RenderingContext;
  private readonly program: twgl.ProgramInfo;
  private readonly vao: WebGLVertexArrayObject;
  private readonly instBuf: WebGLBuffer;
  private readonly colorBuf: WebGLBuffer;
  private readonly atlas: WebGLTexture;
  private capacity = 0;
  count = 0;
  /** Integer origin (cells) of the uploaded positions. */
  originX = 0;
  originY = 0;
  /** CPU-side instance data: [prevX, prevY, curX, curY, facing, size, frame, alpha]. */
  data = new Float32Array(0);
  colors = new Uint8Array(0);

  constructor(gl: WebGL2RenderingContext, atlasCanvas: HTMLCanvasElement) {
    this.gl = gl;
    this.program = twgl.createProgramInfo(gl, [VS, FS]);
    this.atlas = twgl.createTexture(gl, { src: atlasCanvas, min: gl.LINEAR_MIPMAP_LINEAR, mag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const corner = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, corner);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    const loc = (n: string): number => gl.getAttribLocation(this.program.program, n);
    gl.enableVertexAttribArray(loc('aCorner'));
    gl.vertexAttribPointer(loc('aCorner'), 2, gl.FLOAT, false, 0, 0);
    this.instBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.enableVertexAttribArray(loc('aPrevCur'));
    gl.vertexAttribPointer(loc('aPrevCur'), 4, gl.FLOAT, false, STRIDE * 4, 0);
    gl.vertexAttribDivisor(loc('aPrevCur'), 1);
    gl.enableVertexAttribArray(loc('aMisc'));
    gl.vertexAttribPointer(loc('aMisc'), 4, gl.FLOAT, false, STRIDE * 4, 16);
    gl.vertexAttribDivisor(loc('aMisc'), 1);
    this.colorBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuf);
    gl.enableVertexAttribArray(loc('aColor'));
    gl.vertexAttribPointer(loc('aColor'), 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.vertexAttribDivisor(loc('aColor'), 1);
    gl.bindVertexArray(null);
  }

  /** Ensures CPU arrays hold `n` instances (contents preserved). */
  reserve(n: number): void {
    if (n <= this.data.length / STRIDE) return;
    const d = new Float32Array(n * STRIDE);
    d.set(this.data);
    this.data = d;
    const c = new Uint8Array(n * 4);
    c.set(this.colors);
    this.colors = c;
  }

  /** Uploads the first `count` instances of `data`/`colors` (call once per snapshot). */
  upload(count: number): void {
    const gl = this.gl;
    this.count = count;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    if (count > this.capacity) {
      this.capacity = Math.max(count, this.capacity * 2);
      gl.bufferData(gl.ARRAY_BUFFER, this.capacity * STRIDE * 4, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.capacity * 4, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, count * STRIDE);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.colors, 0, count * 4);
  }

  /**
   * Draws all instances; `wrapOffsets` are world x-shifts (cells) of extra copies for a looping
   * map (see camera.wrapOffsets), so sprites near the seam appear on both sides. A sprite is its
   * size in cells at the zoom, at least `minPx` and at most `maxPx` CSS px (before `sizeMul`).
   */
  draw(cam: Camera, dpr: number, t: number, minPx = 3, wrapOffsets: readonly number[] = [0], sizeMul = 1, timeS = 0, alpha = 1, maxPx = NO_MAX_PX): void {
    if (this.count === 0) return;
    const gl = this.gl;
    gl.enable(gl.BLEND);
    // Colour over what is there, by the source's alpha; the canvas itself stays opaque (PLAN 2.11m).
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program.program);
    twgl.setUniforms(this.program, {
      uAtlas: this.atlas,
      uScale: cam.scale * dpr,
      uViewport: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      uT: Math.min(1, Math.max(0, t)),
      uMinPx: minPx * dpr,
      uMaxPx: maxPx * dpr,
      uSizeMul: sizeMul,
      uTime: timeS,
      uAlpha: alpha,
    });
    gl.bindVertexArray(this.vao);
    for (const off of wrapOffsets) {
      // A copy shifted by +off appears where the camera is shifted by −off.
      twgl.setUniforms(this.program, { uCam: [cam.cx - off - this.originX, cam.cy - this.originY] });
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    }
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }
}
