/** What the sim and the page both read of nuclear weapons (PLAN 6.9). */

/** A warhead's blast radius at yield 1, km (PLAN 6.3a): the sim's blast, the page's effects (PLAN 6.6b). */
export const BLAST_KM = 25;

/**
 * A thermonuclear warhead's yield, in fission ones (PLAN 7.20, critic R8-B3: at 2 its blast was
 * 1.26 times as wide and it killed 3 to 11 % more): about 750 kilotons against 15. The one
 * source of it: the tech's `nukeYield` modifier, 2 and read by nothing, is gone (ADR-495).
 */
export const THERMO_YIELD = 50;

/**
 * The yield, in fission ones, of a warhead of class `kind` (PLAN 7.20): 1 a fission bomb, 2 a
 * thermonuclear one. The class is what events, the history and the bursts the sim remembers carry;
 * the yield is what the blast, the fallout, the flash and the ruin are sized by.
 */
export function yieldOf(kind: number): number {
  return kind >= 2 ? THERMO_YIELD : 1;
}
