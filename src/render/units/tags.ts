/**
 * Formation tags (PLAN 2.14a): at T2 and T3, where the marker's box has given way to the
 * formation's own elements, every formation in the view keeps a small label by them: its
 * nation's flag, its strength and its name. Until then a close view said nothing of whose the
 * elements were or what they were part of.
 *
 * A tag stands above the part of its formation that is in the view (so a division that fills
 * the screen at T3, or reaches out of it, still has one), and gives way to a stronger
 * formation's tag: below its formation, left of it, right of it, then further out on each
 * side. One that finds no free place is left out and counted.
 *
 * It is tied to its elements (ADR-168, PLAN 3.7g): it does not stand on another formation's
 * elements where a place clear of them is free, and one that stands off its own has a line to
 * them in its nation's colour. Where blocks stand side by side in a contact, the strongest
 * one's tag lay on the others' sprites and nothing said which block a tag was of.
 * So has one that stands by its elements while another formation's tag is nearer to their
 * middle (ADR-188, PLAN 3.10c1b). A tag does not take such a place itself where another by
 * its block is free: one nearer to the middle of another block than that block's own tag,
 * placed before it (ADR-207, PLAN 3.11f1).
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
  /** Whether it has a line to its elements: it stands off them (ADR-168), or another tag is nearer to their middle (ADR-188). */
  line: boolean;
  /** The middle of its formation's elements in the view, CSS px: where the line ends. */
  tx: number;
  ty: number;
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
/** How many rings of places a tag tries before it is left out: in each, above, below, left and right, a step further out. */
export const TAG_TRIES = 5;
/** The places of a ring. */
export const TAG_SIDES = 4;
/** A tag further than this from its elements has a line to them: the gap, and a px for the rounding of its place. */
export const TAG_LINE_FROM = TAG_GAP + 1;
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

/** From a point to a box, px: 0 inside it. */
const far = (t: { x: number; y: number; w: number; h: number }, x: number, y: number): number => Math.hypot(Math.max(t.x - x, x - (t.x + t.w), 0), Math.max(t.y - y, y - (t.y + t.h), 0));

/**
 * Places the tags of `items` in a view of vw × vh px. `measure(text, font)` is the width of a
 * line. The picked formation first, then the stronger ones (the lower id on a tie), so the
 * layout does not depend on the order of the list. No tag stands on one of `avoid`, nor nearer to it than to another tag.
 * None stands on another formation's elements unless every place of its own is on some (ADR-168).
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
    const stepY = h + TAG_GAP;
    const stepX = w + TAG_GAP;
    const above = vy0 - TAG_GAP - h;
    const below = vy1 + TAG_GAP;
    const beside = (vy0 + vy1) / 2 - h / 2;
    const maxX = Math.max(edge, vw - w - edge);
    const maxY = Math.max(edge, vh - h - edge);
    const tries: { x: number; y: number }[] = [];
    /** How many of them are by the block: the first place on each side. */
    let byBlock = 0;
    // Above, then below, then left and right, then a place further out on each side: the
    // nearest free one. (Two formations in contact stand front to front, PLAN 2.14c1: one has
    // its tag above its block and the other below, each by its own. Blocks side by side,
    // ADR-168: the places beside a block are the ones clear of its neighbours.)
    for (let k = 0; k < TAG_TRIES; k++) {
      // In the view: one that would stand above its top edge stands at it, on its own elements.
      tries.push({ x, y: Math.round(Math.min(Math.max(above - k * stepY, edge), maxY)) }, { x, y: Math.round(Math.min(Math.max(below + k * stepY, edge), maxY)) });
      // A place beside the block that the view has no room for is none: held in the view it would be a place above or below again.
      const y = Math.round(Math.min(Math.max(beside, edge), maxY));
      const lx = Math.round(vx0 - TAG_GAP - w - k * stepX);
      const rx = Math.round(vx1 + TAG_GAP + k * stepX);
      if (lx >= edge) tries.push({ x: lx, y });
      if (rx <= maxX) tries.push({ x: rx, y });
      if (k === 0) byBlock = tries.length;
    }
    let done = false;
    // First a place by the block, clear of every other formation's elements, that is not
    // nearer to the middle of another block than that block's own tag, placed before it (PLAN
    // 3.11f: a reader would take it for that block's); then the nearest place clear of the
    // elements; with none, any free place.
    for (const pass of [0, 1, 2]) {
      const clear = pass < 2;
      for (const at of pass === 0 ? tries.slice(0, byBlock) : tries) {
        const box = { x: at.x, y: at.y, w, h };
        if (kept.some((o) => overlap(o, box)) || placed.some((p) => overlap(p, box))) continue;
        if (clear && items.some((o) => o !== it && box.x < o.x1 && o.x0 < box.x + w && box.y < o.y1 && o.y0 < box.y + h)) continue;
        if (pass === 0 && placed.some((p) => far(box, p.tx, p.ty) < far(p, p.tx, p.ty))) continue;
        // How far the tag's box is from its elements' (0 when it lies on them).
        const gap = Math.max(vx0 - (box.x + w), box.x - vx1, vy0 - (box.y + h), box.y - vy1, 0);
        placed.push({ id: it.id, nation: it.nation, strength: it.strength, text: it.text, name: it.name, engaged: it.engaged, picked: it.picked === true, ...box, gap, line: gap > TAG_LINE_FROM, tx: (vx0 + vx1) / 2, ty: (vy0 + vy1) / 2, flag: false });
        done = true;
        break;
      }
      if (done) break;
    }
    if (!done) left++;
  }
  // A tag by its own block is not always the one a reader takes for the block's (ADR-188):
  // by a tall block, "below" is further from its middle than a neighbour's tag over its top.
  // Such a tag has a line too.
  for (const t of placed) {
    if (t.line) continue;
    const own = far(t, t.tx, t.ty);
    if (placed.some((o) => o !== t && far(o, t.tx, t.ty) < own)) t.line = true;
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
  // The lines of the tags that stand off their elements (ADR-168), under every tag: dark
  // under the nation's colour, so a pale one reads on sand and a dark one on forest.
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  for (const [width, style] of [[3 * scale, () => 'rgba(14, 17, 22, 0.78)'], [1.25 * scale, hex]] as const) {
    ctx.lineWidth = width;
    for (const t of tags) {
      if (!t.line) continue;
      ctx.strokeStyle = style(t.nation);
      ctx.beginPath();
      ctx.moveTo(t.x + t.w / 2, t.y + t.h / 2);
      ctx.lineTo(t.tx, t.ty);
      ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';
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
