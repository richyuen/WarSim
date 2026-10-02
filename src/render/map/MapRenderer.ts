/**
 * WebGL2 strategic map renderer: owner/controller id textures (R16UI) + a 256×256 RGBA8
 * palette, drawn by one full-screen pass (see mapShader.ts). Dirty 64×64 tiles from
 * snapshots are uploaded with texSubImage2D, so the grid is never re-sent whole.
 */
import * as twgl from 'twgl.js';
import { splitCoord, type Camera } from '../camera';
import { MAP_FS, MAP_VS } from './mapShader';

export interface MapRendererOptions {
  wrapX: boolean;
  borderPx?: number;
  warp?: number;
}

/**
 * Border width in CSS px for a zoom level: the base width at overview scales, growing with
 * sqrt(px per cell) up to 3.5 px at operational zoom. AoC's thick dark outlines are what make
 * nations readable (reference comparison, Phase 0 audit); a constant hairline reads weakly.
 */
export function borderWidthPx(base: number, scale: number): number {
  return Math.min(3.5, base * Math.max(1, Math.sqrt(scale / 2)));
}

export class MapRenderer {
  readonly gl: WebGL2RenderingContext;
  readonly w: number;
  readonly h: number;
  private readonly program: twgl.ProgramInfo;
  private readonly owner: WebGLTexture;
  private readonly controller: WebGLTexture;
  private readonly paletteTex: WebGLTexture;
  readonly palette = new Uint8Array(256 * 256 * 4);
  private paletteDirty = true;
  private readonly vao: WebGLVertexArrayObject;
  opts: Required<MapRendererOptions>;

  constructor(gl: WebGL2RenderingContext, w: number, h: number, opts: MapRendererOptions) {
    this.gl = gl;
    this.w = w;
    this.h = h;
    this.opts = { borderPx: 1.25, warp: 0.32, ...opts };
    this.program = twgl.createProgramInfo(gl, [MAP_VS, MAP_FS]);
    this.owner = this.makeIdTexture();
    this.controller = this.makeIdTexture();
    this.paletteTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 256, 256);
    this.setFilter(gl.NEAREST);
    this.vao = gl.createVertexArray()!;
  }

  private setFilter(mode: number): void {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mode);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mode);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private makeIdTexture(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16UI, this.w, this.h);
    this.setFilter(gl.NEAREST); // integer textures must not be filtered
    return t;
  }

  /** Sets the colour of id (0 = water / unowned). */
  setColor(id: number, rgb: number): void {
    const o = id * 4;
    this.palette[o] = (rgb >> 16) & 255;
    this.palette[o + 1] = (rgb >> 8) & 255;
    this.palette[o + 2] = rgb & 255;
    this.palette[o + 3] = 255;
    this.paletteDirty = true;
  }

  /** Uploads a full owner/controller grid (w·h each, row-major). */
  setGrid(owner: Uint16Array, controller: Uint16Array): void {
    this.uploadRect(this.owner, 0, 0, this.w, this.h, owner);
    this.uploadRect(this.controller, 0, 0, this.w, this.h, controller);
  }

  /**
   * Uploads one dirty tile. `owner`/`controller` hold `size²` cells per tile (snapshot layout),
   * starting at element `offset`; parts past the map edge are clipped.
   */
  updateTile(tx: number, ty: number, size: number, owner: Uint16Array, controller: Uint16Array, offset: number): void {
    const x0 = tx * size;
    const y0 = ty * size;
    const tw = Math.min(size, this.w - x0);
    const th = Math.min(size, this.h - y0);
    if (tw <= 0 || th <= 0) return;
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, size);
    this.uploadRect(this.owner, x0, y0, tw, th, owner.subarray(offset, offset + size * size));
    this.uploadRect(this.controller, x0, y0, tw, th, controller.subarray(offset, offset + size * size));
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
  }

  private uploadRect(tex: WebGLTexture, x: number, y: number, w: number, h: number, data: Uint16Array): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 2);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RED_INTEGER, gl.UNSIGNED_SHORT, data);
  }

  draw(cam: Camera, dpr: number): void {
    const gl = this.gl;
    if (this.paletteDirty) {
      gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, this.palette);
      this.paletteDirty = false;
    }
    const [cxi, cxf] = splitCoord(cam.cx);
    const [cyi, cyf] = splitCoord(cam.cy);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(this.program.program);
    twgl.setUniforms(this.program, {
      uOwner: this.owner,
      uController: this.controller,
      uPalette: this.paletteTex,
      uMapSize: [this.w, this.h],
      uCenterCell: [cxi, cyi],
      uCenterFrac: [cxf, cyf],
      uScale: cam.scale * dpr,
      uViewport: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      uDpr: dpr,
      uWrapX: this.opts.wrapX ? 1 : 0,
      uBorderPx: borderWidthPx(this.opts.borderPx, cam.scale),
      uWarp: this.opts.warp,
    });
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.owner);
    gl.deleteTexture(this.controller);
    gl.deleteTexture(this.paletteTex);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program.program);
  }
}
