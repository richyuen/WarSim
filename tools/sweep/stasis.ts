/**
 * PLAN 7.27b: the five of each seed's longest stasis span (`criteria.ts`'s stasis: the five
 * largest nations by land, as a set, the same in yearly samples running), from sweep reports. Per
 * seed: the span's years, its length (failing at STASIS_YEARS or more), the five, the wars a year
 * and the share of the land changing controller a year in the span; then how many seeds of the
 * reports have each nation in their longest five.
 *
 * Usage: npx tsx tools/sweep/stasis.ts docs/sweeps/<report>.json [more reports...]
 */
import { readFileSync } from 'node:fs';
import { TAGS_1938 } from '../../src/sim/scenario1938';
import { STASIS_YEARS } from './criteria';
import type { SeedResult } from './seed';

const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const files = process.argv.slice(2);
if (files.length === 0) throw new Error('usage: tools/sweep/stasis.ts <report.json> [...]');

export interface Span {
  seed: number;
  from: number;
  to: number;
  years: number;
  five: number[];
  wars: [number, number];
  moved: [number, number];
}

/** The longest run of yearly samples with the same five largest, as `criteria.ts` counts it (the first such run on a tie). */
export function longestSpan(r: SeedResult): Span | null {
  const s = r.samples;
  if (s.length === 0) return null;
  let best = { end: 0, run: 1 };
  for (let i = 1, run = 1; i < s.length; i++) {
    const before = new Set(s[i - 1]!.top10.slice(0, 5));
    const five = s[i]!.top10.slice(0, 5);
    run = five.length === before.size && five.every((n) => before.has(n)) ? run + 1 : 1;
    if (run > best.run) best = { end: i, run };
  }
  const span = s.slice(best.end - best.run + 1, best.end + 1);
  const wars = span.map((y) => y.wars);
  const moved = span.map((y) => y.changedKm2 / r.landKm2);
  return {
    seed: r.seed,
    from: span[0]!.year,
    to: span[span.length - 1]!.year,
    years: best.run,
    five: [...span[0]!.top10.slice(0, 5)].sort((a, b) => a - b),
    wars: [Math.min(...wars), Math.max(...wars)],
    moved: [Math.min(...moved), Math.max(...moved)],
  };
}

const pct = (x: number): string => `${(100 * x).toFixed(1)} %`;
const count = new Map<number, number>();
let seeds = 0;
for (const f of files) {
  const report = JSON.parse(readFileSync(f, 'utf8')) as { results: SeedResult[] };
  console.log(`\n${f}\n\n| Seed | Span | The five | Wars a year | Land moved a year |\n|---|---|---|---|---|`);
  for (const r of report.results) {
    const sp = longestSpan(r);
    if (!sp) continue;
    seeds++;
    for (const n of sp.five) count.set(n, (count.get(n) ?? 0) + 1);
    const fail = sp.years >= STASIS_YEARS;
    const b = (x: string): string => (fail ? `**${x}**` : x);
    console.log(`| ${b(String(sp.seed))} | ${b(`${sp.from}–${sp.to} (${sp.years})`)} | ${b(sp.five.map(tag).join(' '))} | ${sp.wars[0]}–${sp.wars[1]} | ${pct(sp.moved[0])}–${pct(sp.moved[1])} |`);
  }
}
console.log(`\nIn the longest five, of ${seeds} seeds: ${[...count].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([n, k]) => `${tag(n)} ${k}`).join(', ')}`);
