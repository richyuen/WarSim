/**
 * Formation tags (PLAN 2.14a): at T2 and T3, where the marker's box has given way to the
 * formation's own elements, every formation in the view keeps a small label by them: its
 * nation's flag, its strength and its name. Until then a close view said nothing of whose the
 * elements were or what they were part of.
 *
 * A tag stands above the part of its formation that is in the view (so a division that fills
 * the screen at T3, or reaches out of it, still has one), and gives way to a stronger
 * formation's tag: below its formation, then further out above and below. One that finds no free place is left out and counted.
 *
 * It gives way likewise to what the page has above the map (PLAN 2.14f2): the war banners and
 * the bottom bar. A formation at the bottom edge had its tag under them.
 *
 * The tag of the formation whose panel is open is lit and framed (PLAN 2.14f3), and takes its
 * place before any other: it is not the one that gives way or is left out.
 */
import { PICKED_EDGE } from './markers';

/** A formation with something in the view: the box of its elements, CSS px. */
export interface TagInput {
  id: number;
  nation: number;
  strength: number;
  /** The strength as it is written ("12.4k"). */
  text: string;
  name: string;
  engaged: boolean;
  /** The formation whose panel is open (PLAN 2.14f3). */
  picked?: boolean;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PlacedTag {
  id: number;
  nation: number;
  strength: number;
  text: string;
  name: string;
  engaged: boolean;
  picked: boolean;
  /** The tag's box, CSS px. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The gap between the tag and the box of its elements, px (0 when it stands on them). */
  gap: number;
  /** Whether the nation's flag was drawn on it (set by `drawTags`). */
  flag: boolean;
}

export const TAG_FLAG_W = 15;
export const TAG_FLAG_H = 10;
export const TAG_PAD = 3;
/** Between a formation's elements and its tag, and between two tags, px. */
export const TAG_GAP = 4;
/** How far the frame of the picked formation's tag reaches out of its box, px: less than the gap, so it touches no neighbour. */
export const TAG_PICKED_REACH = 3;
/** How many places a tag tries above, then below, before it is left out. */
export const TAG_TRIES = 5;
export const TAG_STRENGTH_FONT = (s: number): string => `700 ${Math.round(10 * s)}px system-ui, sans-serif`;
export const TAG_NAME_FONT = (s: number): string => `500 ${Math.round(9 * s)}px system-ui, sans-serif`;

/** A box of the page above the map that no tag stands under, CSS px of the view. */
export interface TagObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Places the tags of `items` in a view of vw × vh px. `measure(text, font)` is the width of a
 * line. The picked formation first, then the stronger ones (the lower id on a tie), so the
 * layout does not depend on the order of the list. No tag stands on one of `avoid`, nor nearer to it than to another tag.
 * Returns the placed tags and how many found no place.
 */
export function layoutTags(items: readonly TagInput[], measure: (text: string, font: string) => number, vw: number, vh: number, scale = 1, avoid: readonly TagObstacle[] = []): { placed: PlacedTag[]; left: number } {
  const placed: PlacedTag[] = [];
  let left = 0;
  const pad = TAG_PAD * scale;
  const lineH = 12 * scale;
  const h = 2 * lineH + 2 * pad;
  const edge = 2;
  const kept = avoid.map((o) => ({ x: o.x - TAG_GAP, y: o.y - TAG_GAP, w: o.w + 2 * TAG_GAP, h: o.h + 2 * TAG_GAP }));
  const sorted = [...items].sort((a, b) => Number(b.picked === true) - Number(a.picked === true) || b.strength - a.strength || a.id - b.id);
  for (const it of sorted) {
    // The part of the formation that is in the view.
    const vx0 = Math.max(it.x0, 0);
    const vx1 = Math.min(it.x1, vw);
    const vy0 = Math.max(it.y0, 0);
    const vy1 = Math.min(it.y1, vh);
    if (vx1 < vx0 || vy1 < vy0) continue;
    const w = Math.ceil(Math.max(TAG_FLAG_W * scale + pad + measure(it.text, TAG_STRENGTH_FONT(scale)), measure(it.name, TAG_NAME_FONT(scale))) + 2 * pad);
    const x = Math.round(Math.min(Math.max((vx0 + vx1) / 2 - w / 2, edge), Math.max(edge, vw - w - edge)));
    const step = h + TAG_GAP;
    const above = vy0 - TAG_GAP - h;
    const below = vy1 + TAG_GAP;
    const tries: number[] = [];
    // Above, then below, then a place further out on each side: the nearest free one. (Two
    // formations in contact stand front to front, PLAN 2.14c1: one has its tag above its
    // block and the other below, each by its own.)
    for (let k = 0; k < TAG_TRIES; k++) tries.push(above - k * step, below + k * step);
    let done = false;
    for (const ty of tries) {
      // In the view: one that would stand above its top edge stands at it, on its own elements.
      const y = Math.round(Math.min(Math.max(ty, edge), Math.max(edge, vh - h - edge)));
      const box = { x, y, w, h };
      if (kept.some((o) => overlap(o, box)) || placed.some((p) => overlap(p, box))) continue;
      const gap = y + h <= vy0 ? vy0 - (y + h) : y >= vy1 ? y - vy1 : 0;
      placed.push({ id: it.id, nation: it.nation, strength: it.strength, text: it.text, name: it.name, engaged: it.engaged, picked: it.picked === true, ...box, gap, flag: false });
      done = true;
      break;
    }
    if (!done) left++;
  }
  return { placed, left };
}

/** Draws `tags` at `alpha`. `flagOf` is a nation's flag, `hex` its colour (the edge on the tag's left). */
export function drawTags(ctx: CanvasRenderingContext2D, tags: PlacedTag[], alpha: number, flagOf: (nation: number) => CanvasImageSource | null, hex: (nation: number) => string, scale = 1): void {
  if (alpha <= 0.01) return;
  const pad = TAG_PAD * scale;
  const lineH = 12 * scale;
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (const t of tags) {
    ctx.globalAlpha = alpha;
    if (t.picked) {
      // The frame, out of the box: the edge of a tag in contact stays as it is inside it.
      ctx.lineWidth = 2;
      ctx.strokeStyle = PICKED_EDGE;
      ctx.beginPath();
      ctx.roundRect(t.x - TAG_PICKED_REACH + 1, t.y - TAG_PICKED_REACH + 1, t.w + 2 * TAG_PICKED_REACH - 2, t.h + 2 * TAG_PICKED_REACH - 2, 3 * scale + 2);
      ctx.stroke();
    }
    ctx.fillStyle = t.picked ? 'rgba(24, 42, 58, 0.94)' : 'rgba(14, 17, 22, 0.78)';
    ctx.beginPath();
    ctx.roundRect(t.x, t.y, t.w, t.h, 3 * scale);
    ctx.fill();
    // In contact: the red edge the T1 marker has.
    ctx.lineWidth = t.engaged ? 1.5 : 1;
    ctx.strokeStyle = t.engaged ? '#ff4d3d' : 'rgba(255, 255, 255, 0.28)';
    ctx.stroke();
    ctx.fillStyle = hex(t.nation);
    ctx.fillRect(t.x, t.y + 3 * scale, 2 * scale, t.h - 6 * scale);
    const fx = t.x + pad + 1;
    const fy = t.y + pad + (lineH - TAG_FLAG_H * scale) / 2;
    const flag = flagOf(t.nation);
    if (flag) {
      ctx.drawImage(flag, fx, fy, TAG_FLAG_W * scale, TAG_FLAG_H * scale);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(fx - 0.5, fy - 0.5, TAG_FLAG_W * scale + 1, TAG_FLAG_H * scale + 1);
    }
    t.flag = flag !== null;
    ctx.font = TAG_STRENGTH_FONT(scale);
    ctx.fillStyle = '#ffe28a';
    ctx.fillText(t.text, fx + TAG_FLAG_W * scale + pad, t.y + pad + lineH / 2 + 0.5);
    ctx.font = TAG_NAME_FONT(scale);
    ctx.fillStyle = '#eef0f3';
    ctx.fillText(t.name, t.x + pad + 1, t.y + pad + lineH * 1.5 + 0.5);
  }
  ctx.restore();
}
