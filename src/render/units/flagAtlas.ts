/**
 * Every living nation's flag in one texture (PLAN 7.174b, ADR-777), for the countryball look: an
 * element instance carries its nation's slot, and the ball's shader reads its flag from there, so
 * the units stay one draw call.
 *
 * A slot is a flag (FLAG_W × FLAG_H, `FlagStore.pixelsOf`) with a ring of FLAG_PAD px copied from
 * its edge, so that a linear sample at a flag's edge does not take its neighbour's colour. Slots go
 * in rows of FLAG_ATLAS_COLS across a texture FLAG_ATLAS_W wide; its height is the least power of
 * two that holds the rows in use (from FLAG_ATLAS_MIN_H to FLAG_ATLAS_MAX_H). A nation that is no
 * longer living frees its slot for the next one. More living nations than FLAG_ATLAS_SLOTS: those
 * without a slot are -1, and the ball shows its tint.
 *
 * The CPU side is pure (tests); `upload` writes the rows changed since the last upload.
 */
import { FLAG_H, FLAG_W } from '../../shared/flagPixels';

export const FLAG_PAD = 1;
export const FLAG_SLOT_W = FLAG_W + 2 * FLAG_PAD;
export const FLAG_SLOT_H = FLAG_H + 2 * FLAG_PAD;
export const FLAG_ATLAS_W = 2048;
export const FLAG_ATLAS_MIN_H = 128;
export const FLAG_ATLAS_MAX_H = 2048;
export const FLAG_ATLAS_COLS = Math.floor(FLAG_ATLAS_W / FLAG_SLOT_W);
export const FLAG_ATLAS_SLOTS = FLAG_ATLAS_COLS * Math.floor(FLAG_ATLAS_MAX_H / FLAG_SLOT_H);

/** No slot: the nation is not in the atlas. */
export const NO_FLAG_SLOT = -1;

/** The texel of a slot's flag pixel (fx, fy) (0 ≤ fx < FLAG_W, 0 ≤ fy < FLAG_H). */
export function flagTexel(slot: number, fx: number, fy: number): [number, number] {
  const col = slot % FLAG_ATLAS_COLS;
  const row = Math.floor(slot / FLAG_ATLAS_COLS);
  return [col * FLAG_SLOT_W + FLAG_PAD + fx, row * FLAG_SLOT_H + FLAG_PAD + fy];
}

/** The least texture height that holds `slots` slots. */
export function atlasHeightFor(slots: number): number {
  const rows = Math.ceil(Math.max(1, slots) / FLAG_ATLAS_COLS);
  let h = FLAG_ATLAS_MIN_H;
  while (h < rows * FLAG_SLOT_H && h < FLAG_ATLAS_MAX_H) h *= 2;
  return h;
}

export class FlagAtlas {
  /** RGBA, FLAG_ATLAS_W × `height`, row 0 at the top. */
  pixels = new Uint8Array(FLAG_ATLAS_W * FLAG_ATLAS_MIN_H * 4);
  height = FLAG_ATLAS_MIN_H;
  private readonly slots = new Map<number, number>();
  /** The flag pixels each slot was written from: `FlagStore.pixelsOf` gives a new array when a flag changes. */
  private readonly written = new Map<number, Uint32Array>();
  private readonly free: number[] = [];
  private next = 0;
  /** Rows of texels changed since the last upload, [from, to); from ≥ to: none. */
  private dirtyFrom = 0;
  private dirtyTo = 0;
  /** The texture's height on the GPU (0: none yet). */
  private gpuHeight = 0;
  private texture: WebGLTexture | null = null;

  /** The slot of nation `id`, or NO_FLAG_SLOT. */
  slotOf(id: number): number {
    return this.slots.get(id) ?? NO_FLAG_SLOT;
  }

  /** How many slots are in use. */
  get size(): number {
    return this.slots.size;
  }

  /**
   * Keeps a slot for each nation of `living` with its flag as `pixelsOf` has it now, and frees the
   * slots of the others. Cheap when nothing changed: a flag is written again only when `pixelsOf`
   * gives another array than the one it was written from.
   */
  sync(living: Iterable<number>, pixelsOf: (id: number) => Uint32Array): void {
    const keep = new Set(living);
    for (const [id, slot] of this.slots) {
      if (keep.has(id)) continue;
      this.slots.delete(id);
      this.written.delete(id);
      this.free.push(slot);
    }
    // The lowest free slots first, so the texture stays short.
    this.free.sort((a, b) => b - a);
    for (const id of keep) {
      let slot = this.slots.get(id);
      if (slot === undefined) {
        slot = this.free.pop() ?? (this.next < FLAG_ATLAS_SLOTS ? this.next++ : NO_FLAG_SLOT);
        if (slot === NO_FLAG_SLOT) continue;
        this.slots.set(id, slot);
      }
      const px = pixelsOf(id);
      if (this.written.get(id) === px) continue;
      this.write(slot, px);
      this.written.set(id, px);
    }
  }

  private write(slot: number, px: Uint32Array): void {
    this.grow(atlasHeightFor(slot + 1));
    const [x0, y0] = flagTexel(slot, 0, 0);
    for (let y = -FLAG_PAD; y < FLAG_H + FLAG_PAD; y++) {
      const fy = Math.min(FLAG_H - 1, Math.max(0, y));
      let o = ((y0 + y) * FLAG_ATLAS_W + x0 - FLAG_PAD) * 4;
      for (let x = -FLAG_PAD; x < FLAG_W + FLAG_PAD; x++, o += 4) {
        const c = px[fy * FLAG_W + Math.min(FLAG_W - 1, Math.max(0, x))]!;
        this.pixels[o] = (c >> 16) & 255;
        this.pixels[o + 1] = (c >> 8) & 255;
        this.pixels[o + 2] = c & 255;
        this.pixels[o + 3] = 255;
      }
    }
    this.markDirty(y0 - FLAG_PAD, y0 - FLAG_PAD + FLAG_SLOT_H);
  }

  private grow(h: number): void {
    if (h <= this.height) return;
    const p = new Uint8Array(FLAG_ATLAS_W * h * 4);
    p.set(this.pixels);
    this.pixels = p;
    this.height = h;
  }

  private markDirty(from: number, to: number): void {
    if (this.dirtyFrom >= this.dirtyTo) [this.dirtyFrom, this.dirtyTo] = [from, to];
    else [this.dirtyFrom, this.dirtyTo] = [Math.min(this.dirtyFrom, from), Math.max(this.dirtyTo, to)];
  }

  /** Nothing is left to upload (`upload`, and tests without a GL context). */
  markUploaded(): void {
    this.dirtyFrom = this.dirtyTo = 0;
  }

  /** The rows changed since the last upload, [from, to), or null (tests). */
  dirtyRows(): [number, number] | null {
    return this.dirtyFrom < this.dirtyTo ? [this.dirtyFrom, this.dirtyTo] : null;
  }

  /**
   * The texture, with what changed since the last call uploaded: the whole of it when it is new or
   * has grown, else the changed rows.
   */
  upload(gl: WebGL2RenderingContext): WebGLTexture {
    if (!this.texture) {
      this.texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    if (this.gpuHeight !== this.height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, FLAG_ATLAS_W, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
      this.gpuHeight = this.height;
    } else if (this.dirtyFrom < this.dirtyTo) {
      const rows = this.dirtyTo - this.dirtyFrom;
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, this.dirtyFrom, FLAG_ATLAS_W, rows, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels, this.dirtyFrom * FLAG_ATLAS_W * 4);
    }
    this.markUploaded();
    return this.texture;
  }
}
