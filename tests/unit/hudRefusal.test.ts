import { describe, expect, it } from 'vitest';
import { Hud } from '../../src/app/hud';
import type { SimClient } from '../../src/app/simClient';
import { Refusal, type Command } from '../../src/shared/commands';

// PLAN 2.17e2: the words of a refusal are for the nation whose panel sent the command. The worker
// answers after the click, so the selection may have moved on by then: that cannot be timed in a
// browser, and is held here on a client that answers when it is told to.

function hudOnStub(): { hud: Hud; refuse: (reason: number) => void; sent: Command[] } {
  let refused: (reason: number) => void = () => undefined;
  const sent: Command[] = [];
  const on = () => () => undefined;
  const sim = {
    onStats: on,
    onMapLayers: on,
    onLoad: on,
    onSnapshotReceived: on,
    onRefused: (l: (reason: number) => void) => {
      refused = l;
      return () => undefined;
    },
    command: (cmd: Command) => void sent.push(cmd),
  } as unknown as SimClient;
  return { hud: new Hud(sim, 0), refuse: (reason) => refused(reason), sent };
}

const ally: Command = { kind: 'joinAlliance', nation: 1, with: 2 } as unknown as Command;

describe('the words of a refused command (PLAN 2.17e2)', () => {
  it('are shown to the nation whose panel sent the command', () => {
    const { hud, refuse, sent } = hudOnStub();
    hud.selected.value = 1;
    hud.command(ally);
    expect(sent).toHaveLength(1);
    refuse(Refusal.NoOtherName);
    expect(hud.refusal.value).toBe(Refusal.NoOtherName);
  });

  it('are gone when another nation is selected, and do not come back with the first', () => {
    const { hud, refuse } = hudOnStub();
    hud.selected.value = 1;
    hud.command(ally);
    refuse(Refusal.NoOtherName);
    hud.selected.value = 2;
    expect(hud.refusal.value).toBe(0);
    hud.selected.value = 1;
    expect(hud.refusal.value).toBe(0);
  });

  it('are not shown when they arrive after the selection has moved on', () => {
    const { hud, refuse } = hudOnStub();
    hud.selected.value = 1;
    hud.command(ally);
    hud.selected.value = 2;
    refuse(Refusal.NoOtherName);
    expect(hud.refusal.value).toBe(0);
  });

  it('are gone when God Mode is switched on or off', () => {
    const { hud, refuse } = hudOnStub();
    hud.selected.value = 1;
    hud.command(ally);
    refuse(Refusal.NoOtherName);
    hud.toggleGod();
    expect(hud.refusal.value).toBe(0);
    hud.command(ally);
    refuse(Refusal.NoOtherName);
    hud.toggleGod();
    expect(hud.refusal.value).toBe(0);
  });
});
