/**
 * Map import in the browser (PLAN 1.37a): decodes an image file and maps it to a terrain or
 * nation layer (`paletteMap`), returning the runs for the `importLayer` command.
 */
import { encodeRuns, paletteMap, type PaletteEntry } from '../shared/mapImport';

/** Nation colours farther than this (RGB distance) import as unowned. */
export const NATION_MAX_DIST = 40;
/** Terrain always takes the nearest class. */
export const TERRAIN_MAX_DIST = 1000;

export async function imageToRuns(file: Blob, w: number, h: number, palette: readonly PaletteEntry[], maxDist: number, fallback: number): Promise<number[]> {
  const bmp = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close();
  return encodeRuns(paletteMap(img.data, img.width, img.height, w, h, palette, maxDist, fallback));
}
