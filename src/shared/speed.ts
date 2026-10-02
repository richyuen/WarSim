/**
 * Game speed levels (PLAN 1.8): AoC-style "Speed ×N" steps plus Max. A level maps to ticks
 * (sim hours) per wall-clock second; ×5 = 24 h/s = one day per second (the default).
 */
import type { Speed } from './protocol';

export const SPEED_LEVELS: readonly Speed[] = [1, 3, 6, 12, 24, 48, 96, 256, 'max'];
export const DEFAULT_SPEED_LEVEL = 4;

export function clampSpeedLevel(level: number): number {
  return Number.isInteger(level) ? Math.min(SPEED_LEVELS.length - 1, Math.max(0, level)) : DEFAULT_SPEED_LEVEL;
}

export function speedOfLevel(level: number): Speed {
  return SPEED_LEVELS[clampSpeedLevel(level)]!;
}
