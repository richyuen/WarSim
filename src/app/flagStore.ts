/**
 * Nation flags in the app (PLAN 1.37b): a nation's custom pixel flag if it has one, else its
 * scenario flag (data/scenarios/1938/flags.json, rasterized to 36×24), else a plain flag in its
 * colour (spawned nations). Cached as canvases (map overlay) and data URLs (panels).
 */
import presetsJson from '../../data/flags/presets.json' with { type: 'json' };
import flagsJson from '../../data/scenarios/1938/flags.json' with { type: 'json' };
import nationsJson from '../../data/scenarios/1938/nations.json' with { type: 'json' };
import type { FlagPresets, FlagSpec } from '../shared/flags';
import { FLAG_H, FLAG_W, plainFlag, specToPixels } from '../shared/flagPixels';
import { decodeRunsU32 } from '../shared/mapImport';

const SPECS = flagsJson.flags as unknown as Record<string, FlagSpec>;
const PRESETS = presetsJson.presets as unknown as FlagPresets;

export class FlagStore {
  private custom = new Map<number, Uint32Array>();
  private pixels = new Map<number, Uint32Array>();
  private canvases = new Map<number, HTMLCanvasElement>();
  private urls = new Map<number, string>();
  /** Bumped when custom flags change (UI re-renders). */
  version = 0;

  constructor(private readonly colorOf: (id: number) => number | undefined) {}

  setCustom(custom: [number, number[]][]): void {
    this.custom = new Map();
    for (const [n, runs] of custom) {
      const px = decodeRunsU32(runs, FLAG_W * FLAG_H);
      if (px) this.custom.set(n, px);
    }
    this.pixels.clear();
    this.canvases.clear();
    this.urls.clear();
    this.version++;
  }

  /** The 36×24 pixels of nation `id`'s flag (a copy is safe to edit). */
  pixelsOf(id: number): Uint32Array {
    let px = this.pixels.get(id);
    if (!px) {
      const tag = nationsJson.nations[id - 1]?.tag;
      const spec = tag ? SPECS[tag] : undefined;
      px = this.custom.get(id) ?? (spec ? specToPixels(spec, PRESETS) : plainFlag(this.colorOf(id) ?? 0x888888));
      this.pixels.set(id, px);
    }
    return px;
  }

  canvasOf(id: number): HTMLCanvasElement {
    let c = this.canvases.get(id);
    if (!c) {
      c = document.createElement('canvas');
      c.width = FLAG_W;
      c.height = FLAG_H;
      const px = this.pixelsOf(id);
      const img = new ImageData(FLAG_W, FLAG_H);
      for (let i = 0; i < px.length; i++) img.data.set([(px[i]! >> 16) & 255, (px[i]! >> 8) & 255, px[i]! & 255, 255], i * 4);
      c.getContext('2d')!.putImageData(img, 0, 0);
      this.canvases.set(id, c);
    }
    return c;
  }

  urlOf(id: number): string {
    let u = this.urls.get(id);
    if (!u) {
      u = this.canvasOf(id).toDataURL();
      this.urls.set(id, u);
    }
    return u;
  }
}
