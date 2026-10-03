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
  /** Fine land coverage and terrain (PLAN 1.28b); 1×1 placeholders until the worker sends them. */
  private landTex: WebGLTexture;
  private terrainTex: WebGLTexture;
  private hasLand = false;
  private provinceTex: WebGLTexture;
  private unrestTex: WebGLTexture;
  private terrainColors = new Float32Array(12 * 3);
  /** 0 = palette fills (political, alliances, puppets, …), 1 = terrain colours, 2 = unrest. */
  fillMode = 0;

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
    this.landTex = this.makeTexture(gl.R8, gl.RED, gl.UNSIGNED_BYTE, 1, 1, new Uint8Array([0]), gl.LINEAR);
    this.terrainTex = this.makeTexture(gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE, 1, 1, new Uint8Array([0]), gl.NEAREST);
    this.provinceTex = this.makeTexture(gl.R16UI, gl.RED_INTEGER, gl.UNSIGNED_SHORT, 1, 1, new Uint16Array([0]), gl.NEAREST);
    this.unrestTex = this.makeTexture(gl.R8, gl.RED, gl.UNSIGNED_BYTE, 1, 1, new Uint8Array([0]), gl.NEAREST);
  }

  /** Province per cell (map size) for the revolts mode (PLAN 1.30b). */
  setProvinces(w: number, h: number, data: Uint16Array): void {
    this.gl.deleteTexture(this.provinceTex);
    this.provinceTex = this.makeTexture(this.gl.R16UI, this.gl.RED_INTEGER, this.gl.UNSIGNED_SHORT, w, h, data, this.gl.NEAREST);
  }

  /** Unrest per province id (0..100), laid out 128 per row. */
  setUnrest(unrest: Uint8Array): void {
    const rows = Math.max(1, Math.ceil(unrest.length / 128));
    const data = new Uint8Array(rows * 128);
    for (let i = 0; i < unrest.length; i++) data[i] = Math.round((Math.min(100, unrest[i]!) * 255) / 100);
    this.gl.deleteTexture(this.unrestTex);
    this.unrestTex = this.makeTexture(this.gl.R8, this.gl.RED, this.gl.UNSIGNED_BYTE, 128, rows, data, this.gl.NEAREST);
  }

  private makeTexture(internal: number, format: number, type: number, w: number, h: number, data: ArrayBufferView, filter: number): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    this.setFilter(filter);
    return t;
  }

  /** Fine land coverage (0..255 land fraction per texel) for the coastline. */
  /** Uses (true) or ignores (false) the fine land coverage; off, coasts follow the cells. */
  useLand(on: boolean): void {
    this.hasLand = on && this.landLoaded;
  }

  private landLoaded = false;
  private hasTerrain = false;

  setLand(w: number, h: number, data: Uint8Array): void {
    this.landLoaded = true;
    this.gl.deleteTexture(this.landTex);
    this.landTex = this.makeTexture(this.gl.R8, this.gl.RED, this.gl.UNSIGNED_BYTE, w, h, data, this.gl.LINEAR);
    this.hasLand = true;
  }

  /** Terrain class per cell (w × h = map size) and colours per class (0xRRGGBB). */
  setTerrain(w: number, h: number, data: Uint8Array, colors: readonly number[]): void {
    this.gl.deleteTexture(this.terrainTex);
    this.terrainTex = this.makeTexture(this.gl.R8UI, this.gl.RED_INTEGER, this.gl.UNSIGNED_BYTE, w, h, data, this.gl.NEAREST);
    this.hasTerrain = true;
    colors.slice(0, 12).forEach((c, i) => {
      this.terrainColors[i * 3] = ((c >> 16) & 255) / 255;
      this.terrainColors[i * 3 + 1] = ((c >> 8) & 255) / 255;
      this.terrainColors[i * 3 + 2] = (c & 255) / 255;
    });
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
      uLand: this.landTex,
      uHasLand: this.hasLand ? 1 : 0,
      uHasTerrain: this.hasTerrain ? 1 : 0,
      uTerrain: this.terrainTex,
      uMode: this.fillMode,
      uProvince: this.provinceTex,
      uUnrest: this.unrestTex,
      uTerrainCol: this.terrainColors,
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
    gl.deleteTexture(this.landTex);
    gl.deleteTexture(this.terrainTex);
    gl.deleteTexture(this.provinceTex);
    gl.deleteTexture(this.unrestTex);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program.program);
  }
}
