/**
 * Nation flags in the app (PLAN 1.37b): a nation's custom pixel flag if it has one, else its
 * scenario flag (data/scenarios/1938/flags.json, rasterized to 36×24), else a flag made from its
 * id and colour (`foundedFlag`, PLAN 2.15c: the nations founded in a game). Cached as canvases
 * (map overlay) and data URLs (panels).
 */
import presetsJson from '../../data/flags/presets.json' with { type: 'json' };
import flagsJson from '../../data/scenarios/1938/flags.json' with { type: 'json' };
import nationsJson from '../../data/scenarios/1938/nations.json' with { type: 'json' };
import type { FlagPresets, FlagSpec } from '../shared/flags';
import { FLAG_H, FLAG_W, foundedFlag, specToPixels } from '../shared/flagPixels';
import { decodeRunsU32 } from '../shared/mapImport';

const SPECS = flagsJson.flags as unknown as Record<string, FlagSpec>;
const PRESETS = presetsJson.presets as unknown as FlagPresets;
/** What a cached flag was made from: a painted flag, the scenario's, or (0 and up) a colour. */
const CUSTOM = -1;
const SCENARIO = -2;
/** The colour of a nation the view has no row of yet. */
const UNKNOWN = 0x888888;

export class FlagStore {
  private custom = new Map<number, Uint32Array>();
  private pixels = new Map<number, Uint32Array>();
  private madeFrom = new Map<number, number>();
  private canvases = new Map<number, HTMLCanvasElement>();
  private urls = new Map<number, string>();
  /** Bumped when custom flags change (UI re-renders). */
  version = 0;

  /**
   * `colorOf`: the nation's colour, once known. `foundedOf`: whether the nation was founded in
   * the game, so that one on the id of a scenario nation does not fly that nation's flag.
   */
  constructor(
    private readonly colorOf: (id: number) => number | undefined,
    private readonly foundedOf: (id: number) => boolean = () => false,
  ) {}

  setCustom(custom: [number, number[]][]): void {
    this.custom = new Map();
    for (const [n, runs] of custom) {
      const px = decodeRunsU32(runs, FLAG_W * FLAG_H);
      if (px) this.custom.set(n, px);
    }
    this.pixels.clear();
    this.madeFrom.clear();
    this.canvases.clear();
    this.urls.clear();
    this.version++;
  }

  /** The 36×24 pixels of nation `id`'s flag (a copy is safe to edit). */
  pixelsOf(id: number): Uint32Array {
    const custom = this.custom.get(id);
    const tag = this.foundedOf(id) ? undefined : nationsJson.nations[id - 1]?.tag;
    const spec = tag ? SPECS[tag] : undefined;
    const colour = (this.colorOf(id) ?? UNKNOWN) & 0xffffff;
    // A made flag follows the nation's colour and whether it was founded: a flag asked for
    // before the first snapshot was kept in grey for the rest of the game (PLAN 2.15c).
    const from = custom ? CUSTOM : spec ? SCENARIO : colour;
    let px = this.pixels.get(id);
    if (!px || this.madeFrom.get(id) !== from) {
      px = custom ?? specToPixels(spec ?? foundedFlag(id, colour), PRESETS);
      this.pixels.set(id, px);
      this.madeFrom.set(id, from);
      this.canvases.delete(id);
      this.urls.delete(id);
    }
    return px;
  }

  canvasOf(id: number): HTMLCanvasElement {
    const px = this.pixelsOf(id); // first: it drops the canvas of a flag that has changed
    let c = this.canvases.get(id);
    if (!c) {
      c = document.createElement('canvas');
      c.width = FLAG_W;
      c.height = FLAG_H;
      const img = new ImageData(FLAG_W, FLAG_H);
      for (let i = 0; i < px.length; i++) img.data.set([(px[i]! >> 16) & 255, (px[i]! >> 8) & 255, px[i]! & 255, 255], i * 4);
      c.getContext('2d')!.putImageData(img, 0, 0);
      this.canvases.set(id, c);
    }
    return c;
  }

  urlOf(id: number): string {
    const c = this.canvasOf(id);
    let u = this.urls.get(id);
    if (!u) {
      u = c.toDataURL();
      this.urls.set(id, u);
    }
    return u;
  }
}
