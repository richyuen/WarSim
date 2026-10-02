import type { Protocol } from '../shared/protocol';
import { dsin } from './core/dmath';
import { z } from 'zod';

export type P = Protocol;
export const schema = z.object({ id: z.number() });
export function step(xs: readonly number[]): number {
  let acc = 0;
  for (const x of xs) acc += Math.sqrt(Math.abs(x)) + Math.floor(x) + Math.imul(x, 3) + dsin(x);
  return acc * acc;
}
