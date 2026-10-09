/**
 * Sound (PLAN 3.12d): the cue of a major event as the ticker tells it, made in code with the
 * Web Audio API. Which cue and which notes: `src/shared/sound.ts`. A browser lets a page sound
 * only after the player has pressed something, so the `AudioContext` is made at the first
 * press or key; a cue asked for before that is not heard and not kept for later.
 */
import { CUE_NOTES, cueOfTicker, type Cue, type Heard } from '../shared/sound';
import type { TickerRow } from '../shared/history';

/** What of an `AudioContext` a cue needs (a test gives its own). */
export type SoundContext = Pick<AudioContext, 'currentTime' | 'destination' | 'state' | 'createGain' | 'createOscillator' | 'resume'>;

const ASKED_KEPT = 32;
/** The whole of the cues at full volume: several notes sound at once. */
const MASTER = 0.35;
const ATTACK = 0.012;

export class Sound {
  /** The cues asked for, the newest last (the last `ASKED_KEPT`): a muted cue is not asked for. */
  readonly asked: Cue[] = [];
  /** How many cues were given to the audio context. */
  sounded = 0;
  volume = 0.5;
  muted = false;
  private ctx: SoundContext | null = null;
  private heard: Heard | null = null;

  constructor(private readonly make: () => SoundContext = () => new AudioContext()) {}

  /** The player pressed something: sound is allowed from now on. */
  unlock(): void {
    try {
      this.ctx ??= this.make();
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null; // no audio here: the game is silent
    }
  }

  /** The ticker's rows of a statistics message: the cue of what is new in them. */
  onTicker(rows: readonly TickerRow[], world: number): void {
    const next = cueOfTicker(rows, world, this.heard);
    this.heard = next.heard;
    if (next.cue) this.play(next.cue);
  }

  play(cue: Cue): void {
    if (this.muted) return;
    this.asked.push(cue);
    if (this.asked.length > ASKED_KEPT) this.asked.shift();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + 0.02;
    for (const n of CUE_NOTES[cue]) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = n.wave;
      osc.frequency.setValueAtTime(n.hz, t0 + n.at);
      if (n.to !== undefined) osc.frequency.exponentialRampToValueAtTime(n.to, t0 + n.at + n.dur);
      // A short attack and a decay to silence: no click at either end.
      env.gain.setValueAtTime(0, t0 + n.at);
      env.gain.linearRampToValueAtTime(n.gain * this.volume * MASTER, t0 + n.at + ATTACK);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
      osc.connect(env);
      env.connect(ctx.destination);
      osc.start(t0 + n.at);
      osc.stop(t0 + n.at + n.dur + 0.02);
    }
    this.sounded++;
  }
}
