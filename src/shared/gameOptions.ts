/** New-game options (PLAN 1.39b1; applied by src/sim/gameOptions.ts). */
export interface GameOptions {
  loopingMap?: boolean;
  aggression?: 'scenario' | 'random';
  traits?: 'scenario' | 'random';
  gold?: 'scenario' | 'random' | 'equal';
  ceMode?: 'dynamic' | 'progressive' | 'static' | 'locked' | 'random';
}
