/** New-game options (PLAN 1.39b1; applied by src/sim/gameOptions.ts). */
export interface GameOptions {
  loopingMap?: boolean;
  aggression?: 'scenario' | 'random';
  traits?: 'scenario' | 'random';
  gold?: 'scenario' | 'random' | 'equal';
  /** The random world only (PLAN 2.16): how many nations it starts with. */
  nations?: number;
  ceMode?: 'dynamic' | 'progressive' | 'static' | 'locked' | 'random';
}
