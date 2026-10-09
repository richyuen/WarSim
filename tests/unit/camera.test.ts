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
  flight,
  type Camera,
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

  it('wrapOffsets with a margin lists the copies within it of the view (PLAN 3.12Rt)', () => {
    // A view of 2 cells that ends 0.25 short of the seam, on either side of it.
    const vw = 2 * 400;
    expect(wrapOffsets({ cx: GEO.w - 1.25, cy: 0, scale: 400 }, GEO, vw)).toEqual([0]);
    expect(wrapOffsets({ cx: GEO.w - 1.25, cy: 0, scale: 400 }, GEO, vw, 2)).toEqual([0, GEO.w]);
    expect(wrapOffsets({ cx: 1.25, cy: 0, scale: 400 }, GEO, vw, 2)).toEqual([-GEO.w, 0]);
    // 2.5 cells short of it: beyond the margin.
    expect(wrapOffsets({ cx: GEO.w - 3.5, cy: 0, scale: 400 }, GEO, vw, 2)).toEqual([0]);
    expect(wrapOffsets({ cx: 3.5, cy: 0, scale: 400 }, GEO, vw, 2)).toEqual([0]);
    // A view over the seam has both copies with the margin or without; a map with edges has one.
    expect(wrapOffsets({ cx: 0.5, cy: 0, scale: 400 }, GEO, vw, 2)).toEqual([-GEO.w, 0]);
    expect(wrapOffsets({ cx: 1.25, cy: 0, scale: 400 }, { ...GEO, wrapX: false }, vw, 2)).toEqual([0]);
  });
});

// PLAN 2.14f5b4: the click on a war's banner flies to the battle (`CameraController.flyTo`).
describe('flight', () => {
  const M = GEO.kmPerCell * 1000;
  /** The battle's view: 20 m/px. */
  const battle = normalize({ cx: 1105.3, cy: 251.7, scale: M / 20 }, GEO, VW, VH);
  const world = normalize({ cx: 1024, cy: 512, scale: 0 }, GEO, VW, VH);
  const path = (from: Camera, to: Camera, geo = GEO, n = 400): Camera[] => {
    const f = flight(from, to, geo, VW);
    return Array.from({ length: n + 1 }, (_, i) => f.at(i / n));
  };

  it('starts on the one camera and ends on the other, exactly', () => {
    const f = flight(world, battle, GEO, VW);
    expect(f.at(0)).toEqual(world);
    expect(f.at(1)).toEqual(battle);
    expect(f.at(1.7)).toEqual(battle);
    expect(f.at(-1)).toEqual(world);
  });

  it('from the world view it is a zoom towards the place, which stays in the view', () => {
    const steps = path(world, battle);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.scale, `step ${i}`).toBeGreaterThanOrEqual(steps[i - 1]!.scale * (1 - 1e-9));
      const [sx, sy] = worldToScreen(steps[i]!, battle.cx, battle.cy, VW, VH);
      expect(sx >= 0 && sx <= VW && sy >= 0 && sy <= VH, `step ${i}: the place at ${sx.toFixed(0)}, ${sy.toFixed(0)}`).toBe(true);
    }
  });

  it('between two places far apart at a close zoom it zooms out, crosses and zooms in', () => {
    const other = { cx: battle.cx + 300, cy: battle.cy + 120, scale: battle.scale }; // 6,300 km away, 225 views
    const steps = path(battle, other);
    const widest = Math.min(...steps.map((c) => c.scale));
    // At its widest the two places are within three views of each other.
    expect(Math.hypot(300, 120) * widest).toBeLessThan(3 * VW);
    expect(widest).toBeLessThan(battle.scale / 50);
    // Out, then in: the scale falls to its least and rises from it, and the camera never moves away from where it goes.
    const turn = steps.findIndex((c) => c.scale === widest);
    for (let i = 1; i < steps.length; i++) {
      if (i <= turn) expect(steps[i]!.scale, `step ${i}`).toBeLessThanOrEqual(steps[i - 1]!.scale * (1 + 1e-9));
      else expect(steps[i]!.scale, `step ${i}`).toBeGreaterThanOrEqual(steps[i - 1]!.scale * (1 - 1e-9));
      const left = (c: Camera): number => Math.hypot(other.cx - c.cx, other.cy - c.cy);
      expect(left(steps[i]!), `step ${i}`).toBeLessThanOrEqual(left(steps[i - 1]!) + 1e-9);
    }
    // No frame of it is a smear: at 60 frames a second the ground moves under half a view a frame.
    const f = flight(battle, other, GEO, VW);
    const frames = Math.round(f.ms / (1000 / 60));
    let most = 0;
    for (let i = 1; i <= frames; i++) {
      const a = f.at((i - 1) / frames);
      const b = f.at(i / frames);
      most = Math.max(most, Math.hypot(b.cx - a.cx, b.cy - a.cy) * Math.min(a.scale, b.scale));
    }
    expect(most).toBeLessThan(VW / 2);
  });

  it('on a looping map it goes the short way round', () => {
    const west = { cx: 12, cy: 300, scale: 40 };
    const east = { cx: 2040, cy: 300, scale: 40 };
    const steps = path(west, east);
    for (const c of steps.slice(0, -1)) expect(c.cx).toBeLessThanOrEqual(12);
    expect(steps.at(-2)!.cx).toBeCloseTo(2040 - 2048, 1);
    expect(normalize(steps.at(-2)!, GEO, VW, VH).cx).toBeCloseTo(2040, 1);
    // Where the map does not loop, the long way is the only one.
    const flat = path(west, east, { ...GEO, wrapX: false });
    for (const c of flat) expect(c.cx).toBeGreaterThanOrEqual(12);
  });

  it('to the same place it is a zoom on the spot', () => {
    for (const c of path({ ...battle, scale: 2 }, battle)) {
      expect(c.cx).toBe(battle.cx);
      expect(c.cy).toBe(battle.cy);
    }
  });

  it('takes a quarter of a second at least and 1.6 s at most, and every step of it is a camera', () => {
    const far = { cx: battle.cx + 1000, cy: 800, scale: M };
    const cases: [Camera, Camera][] = [[world, battle], [battle, world], [battle, { ...battle, cx: battle.cx + 0.01 }], [battle, battle], [{ ...battle, scale: M }, far], [far, battle]];
    for (const [a, b] of cases) {
      const f = flight(a, b, GEO, VW);
      expect(f.ms).toBeGreaterThanOrEqual(250);
      expect(f.ms).toBeLessThanOrEqual(1600);
      for (const c of path(a, b)) expect(Number.isFinite(c.cx) && Number.isFinite(c.cy) && c.scale > 0 && Number.isFinite(c.scale)).toBe(true);
    }
    expect(flight(battle, battle, GEO, VW).ms).toBe(250);
    expect(flight(world, battle, GEO, VW).ms).toBeGreaterThan(1000);
  });
});

describe('map border width', () => {
  it('grows with zoom from the base width and caps at 3.5 px', async () => {
    const { borderWidthPx } = await import('../../src/render/map/MapRenderer');
    expect(borderWidthPx(1.25, 0.5)).toBe(1.25);
    expect(borderWidthPx(1.25, 8)).toBeCloseTo(2.5, 9);
    expect(borderWidthPx(1.25, 100)).toBe(3.5);
  });
});
