/**
 * Deterministic math (SPEC §2.6, ADR-5).
 *
 * `Math.sin/cos/atan2/exp/log/pow` are not required by ECMAScript to be correctly
 * rounded, so V8, SpiderMonkey and JavaScriptCore may return different last bits.
 * These versions use only IEEE-754 `+ - * /`, exact `Math.floor/round/abs/sqrt` and
 * bit manipulation, so every engine produces identical bits. JS never contracts
 * `a * b + c` into an FMA, so evaluation order fully determines the result.
 *
 * Algorithms and minimax coefficients follow Sun's fdlibm (k_sin.c, k_cos.c,
 * e_rem_pio2.c, s_atan.c, e_atan2.c, e_exp.c, e_log.c), whose notice permits use,
 * copying and modification. Accuracy is about 1 ulp for sin/cos/atan/exp/log
 * (|x| ≤ 1e6 for sin/cos) and ~|y·ln x|·2^-53 relative for non-integer pow.
 */

// --- bit access (explicit little-endian so the layout is platform-independent) ---
const view = new DataView(new ArrayBuffer(8));

function hiWord(x: number): number {
  view.setFloat64(0, x, true);
  return view.getInt32(4, true);
}

function loWord(x: number): number {
  view.setFloat64(0, x, true);
  return view.getUint32(0, true);
}

function withHiWord(x: number, hi: number): number {
  view.setFloat64(0, x, true);
  view.setInt32(4, hi, true);
  return view.getFloat64(0, true);
}

function fromWords(hi: number, lo: number): number {
  view.setUint32(0, lo >>> 0, true);
  view.setInt32(4, hi | 0, true);
  return view.getFloat64(0, true);
}

/** Exact 2^k for normal exponents (−1022 ≤ k ≤ 1023). */
function pow2(k: number): number {
  return fromWords((k + 1023) << 20, 0);
}

/** y · 2^k, exact unless the result is subnormal (then a single deterministic rounding). */
export function ldexp(y: number, k: number): number {
  if (k > 1023) return y * pow2(1023) * pow2(k - 1023);
  if (k < -1022) return y * pow2(k + 1000) * pow2(-1000);
  return y * pow2(k);
}

export const PI = 3.141592653589793;
export const TAU = 6.283185307179586;
export const HALF_PI = 1.5707963267948966;

// --- sin / cos -------------------------------------------------------------------
const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.08757232129817482790e-9;
const C6 = -1.13596475577881948265e-11;

/** sin(x + y) for |x| ≤ π/4, y the tail of x. */
function kSin(x: number, y: number): number {
  const z = x * x;
  const w = z * z;
  const r = S2 + z * (S3 + z * S4) + z * w * (S5 + z * S6);
  const v = z * x;
  return x - ((z * (0.5 * y - v * r) - y) - v * S1);
}

/** cos(x + y) for |x| ≤ π/4. */
function kCos(x: number, y: number): number {
  const z = x * x;
  let w = z * z;
  const r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6));
  const hz = 0.5 * z;
  w = 1 - hz;
  return w + (((1 - w) - hz) + (z * r - x * y));
}

const INV_PIO2 = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417; // first 33 bits of π/2: n·PIO2_1 is exact for |n| < 2^20
const PIO2_2 = 6.07710050630396597660e-11;
const PIO2_2T = 2.02226624879595063154e-21;

// Reduction outputs (module scratch, avoids allocating per call).
let remY0 = 0;
let remY1 = 0;

/** x = n·π/2 + (remY0 + remY1); returns n. Cody–Waite with a 33+33+(tail)-bit split of π/2. */
function remPio2(x: number): number {
  const n = Math.round(x * INV_PIO2);
  const r0 = x - n * PIO2_1;
  // fdlibm's second round, always taken: guards against cancellation near multiples of π/2.
  const t = r0;
  let w = n * PIO2_2;
  const r = t - w;
  w = n * PIO2_2T - ((t - r) - w);
  const y0 = r - w;
  remY0 = y0;
  remY1 = (r - y0) - w;
  return n;
}

const PIO4 = 7.85398163397448278999e-1;

export function sin(x: number): number {
  if (x !== x || x === Infinity || x === -Infinity) return NaN;
  if (Math.abs(x) <= PIO4) return x === 0 ? x : kSin(x, 0);
  const n = remPio2(x) & 3;
  if (n === 0) return kSin(remY0, remY1);
  if (n === 1) return kCos(remY0, remY1);
  if (n === 2) return -kSin(remY0, remY1);
  return -kCos(remY0, remY1);
}

export function cos(x: number): number {
  if (x !== x || x === Infinity || x === -Infinity) return NaN;
  if (Math.abs(x) <= PIO4) return kCos(x, 0);
  const n = remPio2(x) & 3;
  if (n === 0) return kCos(remY0, remY1);
  if (n === 1) return -kSin(remY0, remY1);
  if (n === 2) return -kCos(remY0, remY1);
  return kSin(remY0, remY1);
}

export function tan(x: number): number {
  return sin(x) / cos(x);
}

// --- atan / atan2 ----------------------------------------------------------------
const ATAN_HI = [4.63647609000806093515e-1, 7.85398163397448278999e-1, 9.82793723247329054082e-1, 1.57079632679489655800];
const ATAN_LO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT0 = 3.33333333333329318027e-1;
const AT1 = -1.99999999998764832476e-1;
const AT2 = 1.42857142725034663711e-1;
const AT3 = -1.11111104054623557880e-1;
const AT4 = 9.09088713343650656196e-2;
const AT5 = -7.69187620504482999495e-2;
const AT6 = 6.66107313738753120669e-2;
const AT7 = -5.83357013379057348645e-2;
const AT8 = 4.97687799461593236017e-2;
const AT9 = -3.65315727442169155270e-2;
const AT10 = 1.62858201153657823623e-2;

export function atan(x: number): number {
  if (x !== x) return NaN;
  const neg = x < 0;
  let a = Math.abs(x);
  if (a >= 7.378697629483821e19) return neg ? -ATAN_HI[3]! - ATAN_LO[3]! : ATAN_HI[3]! + ATAN_LO[3]!; // 2^66
  let id: number;
  if (a < 0.4375) {
    if (a < 3.725290298461914e-9) return x; // 2^-28
    id = -1;
    a = x;
  } else if (a < 1.1875) {
    if (a < 0.6875) {
      id = 0;
      a = (2 * a - 1) / (2 + a);
    } else {
      id = 1;
      a = (a - 1) / (a + 1);
    }
  } else if (a < 2.4375) {
    id = 2;
    a = (a - 1.5) / (1 + 1.5 * a);
  } else {
    id = 3;
    a = -1 / a;
  }
  const z = a * a;
  const w = z * z;
  const s1 = z * (AT0 + w * (AT2 + w * (AT4 + w * (AT6 + w * (AT8 + w * AT10)))));
  const s2 = w * (AT1 + w * (AT3 + w * (AT5 + w * (AT7 + w * AT9))));
  if (id < 0) return a - a * (s1 + s2);
  const r = ATAN_HI[id]! - ((a * (s1 + s2) - ATAN_LO[id]!) - a);
  return neg ? -r : r;
}

const PI_LO = 1.2246467991473532e-16;

/** True for −0 (and only −0). */
function isNegZero(v: number): boolean {
  return v === 0 && 1 / v < 0;
}

export function atan2(y: number, x: number): number {
  if (x !== x || y !== y) return NaN;
  if (x === 1) return atan(y);
  const yNeg = y < 0 || isNegZero(y);
  if (y === 0) {
    if (x > 0 || (x === 0 && !isNegZero(x))) return y; // ±0
    return yNeg ? -PI : PI;
  }
  if (x === 0) return yNeg ? -HALF_PI : HALF_PI;
  if (x === Infinity || x === -Infinity) {
    if (y === Infinity || y === -Infinity) {
      const r = x > 0 ? PIO4 : 3 * PIO4;
      return yNeg ? -r : r;
    }
    const r = x > 0 ? 0 : PI;
    return yNeg ? -r : r;
  }
  if (y === Infinity || y === -Infinity) return yNeg ? -HALF_PI : HALF_PI;

  const q = Math.abs(y / x);
  let z: number;
  if (q > 1.152921504606847e18) z = HALF_PI + 0.5 * PI_LO; // |y/x| > 2^60
  else if (x < 0 && q < 8.673617379884035e-19) z = 0; // |y/x| < 2^-60
  else z = atan(q);

  if (x > 0) return yNeg ? -z : z;
  return yNeg ? (z - PI_LO) - PI : PI - (z - PI_LO);
}

export function asin(x: number): number {
  if (x > 1 || x < -1 || x !== x) return NaN;
  return atan2(x, Math.sqrt((1 - x) * (1 + x)));
}

export function acos(x: number): number {
  if (x > 1 || x < -1 || x !== x) return NaN;
  return atan2(Math.sqrt((1 - x) * (1 + x)), x);
}

// --- exp ------------------------------------------------------------------------
const O_THRESHOLD = 7.09782712893383973096e2;
const U_THRESHOLD = -7.45133219101941108420e2;
const LN2_HI = 6.93147180369123816490e-1;
const LN2_LO = 1.90821492927058770002e-10;
const INV_LN2 = 1.44269504088896338700;
const P1 = 1.66666666666666019037e-1;
const P2 = -2.77777777770155933842e-3;
const P3 = 6.61375632143793436117e-5;
const P4 = -1.65339022054652515390e-6;
const P5 = 4.13813679705723846039e-8;

export function exp(x: number): number {
  if (x !== x) return NaN;
  if (x > O_THRESHOLD) return Infinity;
  if (x < U_THRESHOLD) return 0;
  const a = Math.abs(x);
  let hi = 0;
  let lo = 0;
  let k = 0;
  if (a > 3.4657359027997264e-1) {
    // |x| > 0.5·ln2: reduce x = k·ln2 + r, |r| ≤ 0.5·ln2
    if (a < 1.0397207708399179) {
      k = x < 0 ? -1 : 1;
      hi = x - k * LN2_HI;
      lo = k * LN2_LO;
    } else {
      k = Math.trunc(INV_LN2 * x + (x < 0 ? -0.5 : 0.5));
      hi = x - k * LN2_HI;
      lo = k * LN2_LO;
    }
    x = hi - lo;
  } else if (a < 3.725290298461914e-9) {
    return 1 + x; // |x| < 2^-28
  }
  const t = x * x;
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((x * c) / (c - 2) - x);
  const y = 1 - ((lo - (x * c) / (2 - c)) - hi);
  return ldexp(y, k);
}

// --- log ------------------------------------------------------------------------
const TWO54 = 1.8014398509481984e16;
const LG1 = 6.666666666666735130e-1;
const LG2 = 3.999999999940941908e-1;
const LG3 = 2.857142874366239149e-1;
const LG4 = 2.222219843214978396e-1;
const LG5 = 1.818357216161805012e-1;
const LG6 = 1.531383769920937332e-1;
const LG7 = 1.479819860511658591e-1;

export function log(x: number): number {
  let hx = hiWord(x);
  const lx = loWord(x);
  let k = 0;
  if (hx < 0x00100000) {
    // x < 2^-1022: zero, negative or subnormal
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity;
    if (hx < 0) return NaN;
    k -= 54;
    x *= TWO54;
    hx = hiWord(x);
  }
  if (hx >= 0x7ff00000) return x + x; // Inf or NaN
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  const i0 = (hx + 0x95f64) & 0x100000;
  x = withHiWord(x, hx | (i0 ^ 0x3ff00000)); // normalise x into [√2/2, √2)
  k += i0 >> 20;
  const f = x - 1;
  const dk = k;
  if ((0x000fffff & (2 + hx)) < 3) {
    // -2^-20 ≤ f < 2^-20
    if (f === 0) return k === 0 ? 0 : dk * LN2_HI + dk * LN2_LO;
    const R = f * f * (0.5 - 0.3333333333333333 * f);
    return k === 0 ? f - R : dk * LN2_HI - ((R - dk * LN2_LO) - f);
  }
  const s = f / (2 + f);
  const z = s * s;
  let i = hx - 0x6147a;
  const w = z * z;
  const j = 0x6b851 - hx;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  i |= j;
  const R = t2 + t1;
  if (i > 0) {
    const hfsq = 0.5 * f * f;
    return k === 0 ? f - (hfsq - s * (hfsq + R)) : dk * LN2_HI - ((hfsq - (s * (hfsq + R) + dk * LN2_LO)) - f);
  }
  return k === 0 ? f - s * (f - R) : dk * LN2_HI - ((s * (f - R) - dk * LN2_LO) - f);
}

const INV_LN10 = 4.342944819032518e-1;
const INV_LN2_LOG = 1.4426950408889634;

export function log10(x: number): number {
  return log(x) * INV_LN10;
}

export function log2(x: number): number {
  return log(x) * INV_LN2_LOG;
}

// --- pow ------------------------------------------------------------------------
/** x^n for an integer n by binary exponentiation (≤ ~2·log2|n| roundings). */
function powInt(x: number, n: number): number {
  let e = Math.abs(n);
  let base = x;
  let result = 1;
  while (e > 0) {
    if (e % 2 === 1) result *= base;
    e = Math.floor(e / 2);
    if (e > 0) base *= base;
  }
  return n < 0 ? 1 / result : result;
}

export function pow(x: number, y: number): number {
  if (y === 0) return 1;
  if (x !== x || y !== y) return NaN;
  if (x === 1) return 1;
  const yInt = Math.floor(y) === y;
  if (yInt && Math.abs(y) <= 64) return powInt(x, y);
  if (x === 0) {
    const oddInt = yInt && Math.abs(y) < 9007199254740992 && Math.abs(y % 2) === 1;
    if (y > 0) return oddInt ? x : 0;
    return oddInt && isNegZero(x) ? -Infinity : Infinity;
  }
  if (x < 0) {
    if (!yInt) return NaN;
    const r = exp(y * log(-x));
    return Math.abs(y % 2) === 1 ? -r : r;
  }
  if (x === Infinity) return y > 0 ? Infinity : 0;
  return exp(y * log(x));
}

export function sqrt(x: number): number {
  return Math.sqrt(x);
}

export function hypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}
