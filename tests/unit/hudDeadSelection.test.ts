import { describe, expect, it } from 'vitest';
import { Hud } from '../../src/app/hud';
import type { NationStats, SimClient } from '../../src/app/simClient';
import { Refusal, type Command } from '../../src/shared/commands';

// PLAN 2.17e3: a nation that has died is not selected any more. The worker's `nations` are the
// living, so its panel closed with the next statistics while the legend, the diplomacy colours
// and the Territory brush were the dead nation's still.

function hudOnStub(): { hud: Hud; stats: (living: number[], dead: number[]) => void; refuse: (reason: number) => void; selections: number[] } {
  let onStats: (m: NationStats) => void = () => undefined;
  let refused: (reason: number) => void = () => undefined;
  const on = () => () => undefined;
  const sim = {
    onStats: (l: (m: NationStats) => void) => {
      onStats = l;
      return () => undefined;
    },
    onMapLayers: on,
    onLoad: on,
    onSnapshotReceived: on,
    onRefused: (l: (reason: number) => void) => {
      refused = l;
      return () => undefined;
    },
    command: () => undefined,
  } as unknown as SimClient;
  const hud = new Hud(sim, 0);
  // The map view's part: it is told of the selection, and tells the HUD.
  const selections: number[] = [];
  hud.onSelectNation = (id) => {
    selections.push(id);
    hud.selected.value = id;
  };
  const stats = (living: number[], dead: number[]): void =>
    onStats({ nations: living.map((id) => ({ id })), dead: dead.map((id) => ({ id, name: `=N${id}`, color: 0 })) } as unknown as NationStats);
  return { hud, stats, refuse: (reason) => refused(reason), selections };
}

const kill: Command = { kind: 'collapseNation', nation: 1 };

describe('the selection of a nation that dies (PLAN 2.17e3)', () => {
  it('is given up with the statistics that list it dead, through the map view', () => {
    const { hud, stats, selections } = hudOnStub();
    hud.selected.value = 1;
    stats([1, 2], []);
    expect(hud.selected.value).toBe(1);
    stats([2], [1]);
    expect(hud.selected.value).toBe(0);
    expect(selections).toEqual([0]);
  });

  it('is kept for a living nation, and for one the statistics do not list yet', () => {
    const { hud, stats, selections } = hudOnStub();
    hud.selected.value = 3;
    stats([1, 2], [4]);
    expect(hud.selected.value).toBe(3);
    hud.selected.value = 2;
    stats([1, 2], [4]);
    expect(hud.selected.value).toBe(2);
    expect(selections).toEqual([]);
  });

  it('is kept, with the words, when the Kill is refused', () => {
    const { hud, stats, refuse } = hudOnStub();
    hud.selected.value = 1;
    hud.command(kill);
    refuse(Refusal.LastNation);
    stats([1], []);
    expect(hud.selected.value).toBe(1);
    expect(hud.refusal.value).toBe(Refusal.LastNation);
  });

  it('takes the armed Territory brush with it, and leaves a tool that needs no nation', () => {
    const { hud, stats } = hudOnStub();
    hud.selected.value = 1;
    hud.setGodTool('brush');
    expect(hud.dragTool()).toBe('god');
    stats([2], [1]);
    expect(hud.godTool.value).toBeNull();
    expect(hud.dragTool()).toBeNull();
    // A map click is the map's again: no tool takes it.
    expect(hud.pick(10, 10, 1)).toBe(false);

    hud.selected.value = 2;
    hud.setGodTool('revolt');
    hud.selected.value = 0;
    expect(hud.godTool.value).toBe('revolt');
  });

  it('disarms the brush when the panel is closed too', () => {
    const { hud } = hudOnStub();
    hud.selected.value = 1;
    hud.setGodTool('brush');
    hud.selected.value = 2;
    expect(hud.godTool.value).toBe('brush');
    hud.selected.value = 0;
    expect(hud.godTool.value).toBeNull();
  });
});
