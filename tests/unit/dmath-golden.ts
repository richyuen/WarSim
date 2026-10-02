// Shared by tests/unit/dmath.test.ts (Node) and tests/e2e/dmath.spec.ts (Chromium):
// both evaluate the same inputs and must reproduce the bit patterns in dmath-golden.json.

export interface GoldenCase {
  fn: string;
  /** Inputs as hex bit patterns, so the JSON round trip is exact. */
  args: string[];
  /** Expected result as a 16-hex-digit bit pattern. */
  bits: string;
}

export const DMATH_GOLDEN_FNS = ['sin', 'cos', 'tan', 'atan', 'atan2', 'asin', 'acos', 'exp', 'log', 'pow'] as const;

export type DmathLike = Record<(typeof DMATH_GOLDEN_FNS)[number], (...a: number[]) => number>;

export function toBits(x: number): string {
  const v = new DataView(new ArrayBuffer(8));
  v.setFloat64(0, x, true);
  return v.getBigUint64(0, true).toString(16).padStart(16, '0');
}

export function fromBits(hex: string): number {
  const v = new DataView(new ArrayBuffer(8));
  v.setBigUint64(0, BigInt(`0x${hex}`), true);
  return v.getFloat64(0, true);
}

export function evalGolden(dm: DmathLike, g: GoldenCase): string {
  const f = dm[g.fn as keyof DmathLike];
  return toBits(f(...g.args.map(fromBits)));
}
