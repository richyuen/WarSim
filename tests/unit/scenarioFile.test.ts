import { describe, expect, it } from 'vitest';
import { decodeScenarioFile, encodeScenarioFile, SCENARIO_FORMAT } from '../../src/shared/scenarioFile';
import { packSave } from '../../src/shared/saveCodec';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 1.38 (unit part): scenario export drops run history without touching the running game;
// the file round trip yields an identical scenario hash.

const { w: W, h: H } = SIZE_1938;
const [GER, POL] = ['GER', 'POL'].map(nationId) as number[];

describe('scenario files (PLAN 1.38)', () => {
  it('export: no run history in the scenario, the running game keeps its own', async () => {
    const s = new Sim({ scenario: '1938', seed: 3, assets: assets1938(W) });
    s.command({ kind: 'declareWar', attacker: GER!, defender: POL! });
    s.command({ kind: 'renameNation', nation: POL!, name: 'Rzeczpospolita' });
    s.step(24 * 40);
    const before = { hash: s.hash(), log: s.world.commandLog.length, history: s.world.history.length, stats: s.world.stats.length };
    expect(before.log).toBe(2);
    expect(before.history).toBeGreaterThan(0);
    const { bytes, hash } = s.exportScenario();
    // The running game is untouched.
    expect(s.hash()).toBe(before.hash);
    expect([s.world.commandLog.length, s.world.history.length, s.world.stats.length]).toEqual([before.log, before.history, before.stats]);
    // The scenario: same world, no run history; loading it gives its hash.
    const t = new Sim({ scenario: '1938', seed: 9, assets: assets1938(W) });
    t.load(bytes);
    expect(t.hash()).toBe(hash);
    expect([t.world.commandLog.length, t.world.history.length, t.world.stats.length, t.world.edits.undo.length]).toEqual([0, 0, 0, 0]);
    expect(t.world.names.get(POL!)).toBe('Rzeczpospolita');
    expect(t.world.wars.atWar(GER!, POL!)).toBe(true);
    expect(t.tick).toBe(s.tick);

    // The file round trip.
    const file = await encodeScenarioFile({ format: SCENARIO_FORMAT, name: 'Test', base: '1938', w: W, h: H, tick: t.tick, hash }, bytes);
    const back = await decodeScenarioFile(file);
    expect(back.header).toMatchObject({ name: 'Test', base: '1938', w: W, h: H, hash });
    expect(Buffer.from(back.bytes).equals(Buffer.from(bytes))).toBe(true);
    const u = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    u.load(back.bytes);
    expect(u.hash()).toBe(hash);
  }, 120_000);

  it('rejects other files and future formats with readable errors', async () => {
    await expect(decodeScenarioFile(await packSave(new TextEncoder().encode('hello')))).rejects.toThrow('not a WarSim scenario file');
    const future = await encodeScenarioFile({ format: 99, name: 'x', base: '1938', w: 1, h: 1, tick: 0, hash: 0 }, new Uint8Array([1]));
    await expect(decodeScenarioFile(future)).rejects.toThrow('format 99');
  });
});
