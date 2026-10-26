import { describe, expect, it } from 'vitest';
import { joinWideAfresh, wideLinked, wideNode } from '../../src/sim/nav/provinceGraph';
import type { Passage } from '../../src/sim/nav/grid';
import { passageOf } from '../../src/sim/systems/movement';
import { navOf } from '../../src/sim/world';
import { at1938 } from '../helpers/checkpoint';

// PLAN 7.129: `wideLinked` walks the runs of open cells pair by pair, outwards from the two wide
// grounds, where `joinWide` walks them all; its answer is `joinWide`'s for every pair.
describe('wideLinked (PLAN 7.129)', () => {
  it("answers every pair of wide grounds as joinWide's walk of all the runs does, on each warring nation's passage", () => {
    const s = at1938(1938, 24 * 730);
    const w = s.world;
    const nav = navOf(w);
    const nations = [...w.wars.nations()].filter((n) => w.nations.cols.living[n] === 1).sort((a, b) => a - b);
    expect(nations.length).toBeGreaterThan(4);
    let pairs = 0;
    let apart = 0;
    let passages = 0;
    const seen = new Set<string>();
    for (const n of nations) {
      const made = passageOf(w, n);
      const key = made.ok.join('');
      if (seen.has(key)) continue;
      seen.add(key);
      passages++;
      // A passage of its own, with nothing of `joined` kept: `wideLinked` walks.
      const pass: Passage = { ...made };
      delete pass.joined;
      delete pass.keep;
      delete pass.link;
      const wide = new Set<number>();
      for (let node = 1; node < nav.graph.nodeCount; node++) {
        if (pass.open![node] !== 1 || pass.shut![node] === 1) continue;
        const g = wideNode(nav.graph, pass, node);
        if (g > 0) wide.add(g);
      }
      const grounds = [...wide].sort((a, b) => a - b);
      const all = joinWideAfresh(nav.grid, nav.graph, { ...pass });
      // Every pair of wide grounds, and (`joined` is by node) pairs of nodes drawn from those of
      // open ground alone and of open and closed ground, in a scrambled order, so that later asks
      // read what earlier ones walked.
      const asks: [number, number][] = [];
      for (let i = 0; i < grounds.length; i++) for (let j = i + 1; j < grounds.length; j++) asks.push([grounds[i]!, grounds[j]!]);
      const nodes: number[] = [];
      for (let node = 1; node < nav.graph.nodeCount; node++) if (pass.open![node] === 1) nodes.push(node);
      let r = (n * 2654435761) >>> 0;
      const next = (m: number): number => {
        r = (Math.imul(r, 1103515245) + 12345) >>> 0;
        return r % m;
      };
      for (let k = 0; k < 400; k++) asks.push([nodes[next(nodes.length)]!, nodes[next(nodes.length)]!]);
      for (let i = asks.length - 1; i > 0; i--) {
        const k = next(i + 1);
        [asks[i], asks[k]] = [asks[k]!, asks[i]!];
      }
      for (const [a, b] of asks) {
        const want = all[a] === all[b];
        expect(wideLinked(nav.grid, nav.graph, pass, a, b), `nation ${n}: nodes ${a} and ${b}`).toBe(want);
        pairs++;
        if (!want) apart++;
      }
      expect(pass.joined).toBeUndefined();
    }
    // Both answers are asked of it, on several passages.
    expect(passages).toBeGreaterThan(2);
    expect(apart).toBeGreaterThan(0);
    expect(pairs - apart).toBeGreaterThan(0);
  });
});
