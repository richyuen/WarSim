import { describe, expect, it } from 'vitest';
import {
  maxScale,
  minScale,
  normalize,
  panBy,
  scaleForZoom,
  screenToWorld,
  worldToScreen,
  wrapOffsets,
  zoomAt,
  zoomLevel,
  type MapGeometry,
} from '../../src/render/camera';

const GEO: MapGeometry = { w: 2048, h: 1024, kmPerCell: 40075 / 2048, wrapX: true };
const VW = 1280;
const VH = 720;

describe('camera math', () => {
  it('zoomAt keeps the world point under the cursor fixed', () => {
    const cam = { cx: 1000.25, cy: 400.5, scale: 3 };
    for (const [sx, sy, f] of [[100, 50, 2], [1200, 700, 0.5], [640, 360, 7.3]] as const) {
      const before = screenToWorld(cam, sx, sy, VW, VH);
      const z = zoomAt(cam, f, sx, sy, VW, VH);
      const after = screenToWorld(z, sx, sy, VW, VH);
      expect(after[0]).toBeCloseTo(before[0], 9);
      expect(after[1]).toBeCloseTo(before[1], 9);
      expect(z.scale).toBeCloseTo(cam.scale * f, 12);
    }
  });

  it('screen/world transforms are inverse; panning moves content with the pointer', () => {
    const cam = { cx: 10, cy: 20, scale: 4 };
    const [wx, wy] = screenToWorld(cam, 300, 200, VW, VH);
    expect(worldToScreen(cam, wx, wy, VW, VH)).toEqual([300, 200]);
    const p = panBy(cam, 40, -8); // drag right/up by (40, -8) px
    expect(worldToScreen(p, wx, wy, VW, VH)).toEqual([340, 192]);
  });

  it('z = log2(px per km) round-trips through scaleForZoom', () => {
    const cam = { cx: 0, cy: 0, scale: 12.5 };
    expect(scaleForZoom(zoomLevel(cam, GEO), GEO)).toBeCloseTo(12.5, 12);
    expect(zoomLevel({ cx: 0, cy: 0, scale: maxScale(GEO) }, GEO)).toBeCloseTo(Math.log2(1000), 12); // 1 m/px
  });

  it('normalize wraps x on looping maps and clamps zoom and y', () => {
    const n = normalize({ cx: -10.5, cy: 5000, scale: 1e9 }, GEO, VW, VH);
    expect(n.cx).toBeCloseTo(2037.5, 12);
    expect(n.scale).toBe(maxScale(GEO));
    expect(n.cy).toBeCloseTo(GEO.h - VH / 2 / n.scale, 9);
    const out = normalize({ cx: 2048 * 3 + 7, cy: 500, scale: 1e-9 }, GEO, VW, VH);
    expect(out.cx).toBeCloseTo(7, 9);
    expect(out.scale).toBe(minScale(GEO, VW, VH));
    expect(out.cy).toBe(GEO.h / 2); // whole height visible → centred
  });

  it('normalize clamps x on non-looping maps', () => {
    const geo = { ...GEO, wrapX: false };
    const n = normalize({ cx: -100, cy: 500, scale: 2 }, geo, VW, VH);
    expect(n.cx).toBeCloseTo(VW / 2 / 2, 9);
  });

  it('wrapOffsets lists the map copies that intersect the view', () => {
    expect(wrapOffsets({ cx: 1024, cy: 0, scale: 10 }, GEO, VW)).toEqual([0]);
    expect(wrapOffsets({ cx: 10, cy: 0, scale: 10 }, GEO, VW)).toEqual([-2048, 0]);
    expect(wrapOffsets({ cx: 2040, cy: 0, scale: 10 }, GEO, VW)).toEqual([0, 2048]);
    // 0.2 px/cell: a 6400-cell-wide view spans [-2176, 4224] → five copies.
    expect(wrapOffsets({ cx: 1024, cy: 0, scale: 0.2 }, GEO, VW)).toEqual([-4096, -2048, 0, 2048, 4096]);
    expect(wrapOffsets({ cx: 10, cy: 0, scale: 10 }, { ...GEO, wrapX: false }, VW)).toEqual([0]);
  });
});
