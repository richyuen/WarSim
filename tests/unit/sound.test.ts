import { describe, expect, it } from 'vitest';
import { Sound, type SoundContext } from '../../src/app/sound';
import { EventKind } from '../../src/shared/events';
import { TICKER_KINDS, type TickerRow } from '../../src/shared/history';
import { CUE_NOTES, CUES, cueOfKind, cueOfTicker, cueSeconds } from '../../src/shared/sound';

// PLAN 3.12d AT (critic R3-B6): a cue is asked for on a declaration of war. No audio runs in
// Node: the cue of an event is a function, and the player is given a context that counts.

const row = (i: number, kind: number): TickerRow => ({ i, kind, tick: i, a: 1, b: 2, x: 0, y: 0, an: '=A', bn: '=B', of: '' });

/** An audio context that records what was made on it. */
function fakeContext(state: AudioContextState = 'running') {
  const made = { oscillators: [] as { type: string; hz: number; start: number; stop: number }[], peaks: [] as number[], resumed: 0 };
  const param = (onSet: (v: number) => void) => ({
    setValueAtTime: (v: number) => onSet(v),
    linearRampToValueAtTime: (v: number) => onSet(v),
    exponentialRampToValueAtTime: (v: number) => onSet(v),
  });
  const ctx = {
    currentTime: 10,
    destination: {},
    state,
    resume: () => {
      made.resumed++;
      ctx.state = 'running';
      return Promise.resolve();
    },
    createGain: () => {
      let peak = 0;
      const at = made.peaks.push(0) - 1;
      return { gain: param((v) => (made.peaks[at] = peak = Math.max(peak, v))), connect: () => {} };
    },
    createOscillator: () => {
      const o = { type: 'sine', hz: 0, start: 0, stop: 0 };
      made.oscillators.push(o);
      return {
        set type(v: string) {
          o.type = v;
        },
        frequency: param((v) => (o.hz ||= v)),
        connect: () => {},
        start: (t: number) => (o.start = t),
        stop: (t: number) => (o.stop = t),
      };
    },
  };
  return { ctx: ctx as unknown as SoundContext, made };
}

describe('sound cues (PLAN 3.12d)', () => {
  it('every major event has a cue, a declaration of war the war cue, and no other event has one', () => {
    expect(cueOfKind(EventKind.WarDeclared)).toBe('war');
    expect(cueOfKind(EventKind.PeaceSigned)).toBe('peace');
    expect(cueOfKind(EventKind.CapitalCaptured)).toBe('capital');
    expect(cueOfKind(EventKind.NationRevived)).toBe('return');
    for (const k of [EventKind.NationEliminated, EventKind.NationCollapsed, EventKind.NationAnnexed]) expect(cueOfKind(k)).toBe('death');
    for (const k of Object.values(EventKind)) expect(cueOfKind(k) !== null, `kind ${k}`).toBe(TICKER_KINDS.has(k));
  });

  it('each cue is a few notes that can be heard, over in a second and a half', () => {
    for (const cue of CUES) {
      const notes = CUE_NOTES[cue];
      expect(notes.length, cue).toBeGreaterThanOrEqual(2);
      expect(cueSeconds(cue), cue).toBeGreaterThan(0.3);
      expect(cueSeconds(cue), cue).toBeLessThanOrEqual(1.5);
      for (const n of notes) {
        for (const hz of [n.hz, n.to ?? n.hz]) {
          expect(hz, cue).toBeGreaterThanOrEqual(40);
          expect(hz, cue).toBeLessThanOrEqual(4000);
        }
        expect(n.dur, cue).toBeGreaterThan(0.05);
        expect(n.gain, cue).toBeGreaterThan(0);
        expect(n.gain, cue).toBeLessThanOrEqual(1);
      }
    }
    // No two cues are the same notes.
    expect(new Set(CUES.map((c) => JSON.stringify(CUE_NOTES[c]))).size).toBe(CUES.length);
  });

  it("a world's first message is its past; after it a new row asks for its cue, once", () => {
    const past = [row(3, EventKind.WarDeclared), row(5, EventKind.PeaceSigned)];
    const first = cueOfTicker(past, 1, null);
    expect(first).toEqual({ cue: null, heard: { world: 1, i: 5 } });
    // The same rows again: nothing new.
    expect(cueOfTicker(past, 1, first.heard).cue).toBeNull();
    const war = cueOfTicker([...past, row(8, EventKind.WarDeclared)], 1, first.heard);
    expect(war).toEqual({ cue: 'war', heard: { world: 1, i: 8 } });
    expect(cueOfTicker([...past, row(8, EventKind.WarDeclared)], 1, war.heard).cue).toBeNull();
    // The rows fell out of the ticker's month: what was heard is not forgotten.
    expect(cueOfTicker([], 1, war.heard)).toEqual({ cue: null, heard: { world: 1, i: 8 } });
    // A loaded game is another world: its rows are its past, whatever their numbers.
    expect(cueOfTicker([row(40, EventKind.WarDeclared)], 2, war.heard)).toEqual({ cue: null, heard: { world: 2, i: 40 } });
    // A world with no row yet, and then its first.
    const empty = cueOfTicker([], 3, null);
    expect(cueOfTicker([row(0, EventKind.WarDeclared)], 3, empty.heard).cue).toBe('war');
  });

  it('one cue a message: of several new rows the first in the order of the cues', () => {
    const heard = { world: 1, i: 0 };
    const rows = [row(1, EventKind.PeaceSigned), row(2, EventKind.NationRevived), row(3, EventKind.CapitalCaptured), row(4, EventKind.NationAnnexed), row(5, EventKind.PeaceSigned)];
    expect(cueOfTicker(rows, 1, heard).cue).toBe('death');
    expect(cueOfTicker([...rows, row(6, EventKind.WarDeclared)], 1, heard).cue).toBe('war');
    expect(cueOfTicker(rows.slice(0, 3), 1, heard).cue).toBe('capital');
    expect(cueOfTicker(rows.slice(0, 2), 1, heard).cue).toBe('return');
    expect(cueOfTicker(rows.slice(0, 1), 1, heard).cue).toBe('peace');
    // Rows already heard do not count.
    expect(cueOfTicker(rows, 1, { world: 1, i: 4 }).cue).toBe('peace');
  });

  // PLAN 3.12Rh2: at Max speed a message spans a fortnight and the ticker holds its last five
  // rows. The message's news is the kinds of every major row since the message before.
  it('a war followed by seven captured capitals in one message is the war cue: the news, not the five rows', () => {
    const heard = { world: 1, i: 0 };
    const log = [row(1, EventKind.WarDeclared), ...[2, 3, 4, 5, 6, 7, 8].map((i) => row(i, EventKind.CapitalCaptured))];
    const news = [EventKind.WarDeclared, EventKind.CapitalCaptured];
    expect(cueOfTicker(log.slice(-5), 1, heard, news)).toEqual({ cue: 'war', heard: { world: 1, i: 8 } });
    // News whose rows are all older than the ticker's month, or behind an event the ticker does not tell twice.
    expect(cueOfTicker([], 1, heard, [EventKind.PeaceSigned, EventKind.NationRevived]).cue).toBe('return');
    // No news and no new row; and a kind that has no cue.
    expect(cueOfTicker(log.slice(-5), 1, { world: 1, i: 8 }, []).cue).toBeNull();
    expect(cueOfTicker([], 1, heard, [EventKind.AllianceJoined]).cue).toBeNull();
    // A world's first message is its past, whatever it carries.
    expect(cueOfTicker(log.slice(-5), 2, heard, news).cue).toBeNull();
    expect(cueOfTicker(log.slice(-5), 1, null, news).cue).toBeNull();
    const { ctx } = fakeContext();
    const sound = new Sound(() => ctx);
    sound.unlock();
    sound.onTicker([], 1, []);
    sound.onTicker(log.slice(-5), 1, news);
    expect(sound.asked).toEqual(['war']);
  });

  it('a declaration of war asks the player for the war cue, and its notes are given to the context', () => {
    const { ctx, made } = fakeContext();
    const sound = new Sound(() => ctx);
    sound.unlock();
    sound.onTicker([], 1);
    expect(sound.asked).toEqual([]);
    sound.onTicker([row(0, EventKind.WarDeclared)], 1);
    expect(sound.asked).toEqual(['war']);
    expect(sound.sounded).toBe(1);
    expect(made.oscillators.map((o) => [o.type, o.hz])).toEqual(CUE_NOTES.war.map((n) => [n.wave, n.hz]));
    // Each note starts after now and stops after it starts.
    for (const o of made.oscillators) {
      expect(o.start).toBeGreaterThan(10);
      expect(o.stop).toBeGreaterThan(o.start);
    }
    // The same message again is no news.
    sound.onTicker([row(0, EventKind.WarDeclared)], 1);
    expect(sound.asked).toEqual(['war']);
  });

  it('the volume scales every note, and a muted cue is not asked for', () => {
    const peaks = (volume: number): number[] => {
      const { ctx, made } = fakeContext();
      const sound = new Sound(() => ctx);
      sound.unlock();
      sound.volume = volume;
      sound.play('war');
      return made.peaks;
    };
    const full = peaks(1);
    const quarter = peaks(0.25);
    expect(full.length).toBe(CUE_NOTES.war.length);
    full.forEach((p, i) => {
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThanOrEqual(1);
      expect(quarter[i]! / p).toBeCloseTo(0.25, 6);
    });

    const { ctx, made } = fakeContext();
    const sound = new Sound(() => ctx);
    sound.unlock();
    sound.muted = true;
    sound.onTicker([], 1);
    sound.onTicker([row(0, EventKind.WarDeclared)], 1);
    expect(sound.asked).toEqual([]);
    expect(made.oscillators).toEqual([]);
    // Unmuted, the war that was muted is not sounded late: the next news is.
    sound.muted = false;
    sound.onTicker([row(0, EventKind.WarDeclared)], 1);
    expect(sound.asked).toEqual([]);
    sound.onTicker([row(0, EventKind.WarDeclared), row(1, EventKind.PeaceSigned)], 1);
    expect(sound.asked).toEqual(['peace']);
  });

  it('before the first press a cue is asked for and not sounded; a suspended context is resumed; no audio at all is silence', () => {
    const { ctx, made } = fakeContext('suspended');
    const sound = new Sound(() => ctx);
    sound.play('war');
    expect(sound.asked).toEqual(['war']);
    expect(sound.sounded).toBe(0);
    sound.unlock();
    expect(made.resumed).toBe(1);
    // The cue asked for before the press was dropped, not kept.
    expect(made.oscillators).toEqual([]);
    sound.play('peace');
    expect(sound.sounded).toBe(1);

    const none = new Sound(() => {
      throw new Error('no audio');
    });
    none.unlock();
    none.play('war');
    expect(none.asked).toEqual(['war']);
    expect(none.sounded).toBe(0);
  });
});
