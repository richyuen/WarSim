# PLAN 7.131 — a late year at Max in the page (2026-10-26)

AT: in the page from `critic/c15_seed6421_y27.bin`, year 28 at Max at most 60 s, alone, two reads; no stall over
500 ms; 4877's late years at Max not above run 15's 112 s; the gate green.

Run: `npm run build`, `npx vite preview --port 5299`, then
`CAM=1100,267,3000 npx tsx tools/diag/maxStalls.ts <seed> <save> <years> <out.json>`: the critic's measure
(`critic/scripts/c15_l_lategame.mjs`: Max, the HUD's tick read every 20 ms, a nuclear alert's pause resumed), its view
(Berlin at 3,000 m/px), one run at a time, nothing else running. HEAD `a0dec592`.

| case | critic run 15 (`7739a78f`) | HEAD read 1 | HEAD read 2 | bar |
|---|---|---|---|---|
| 6421 year 28, wall s | 81.54 | **58.44** (`head_6421_a.json`) | **56.36** (`head_6421_b.json`) | ≤ 60 |
| 6421 year 28, longest gap ms (over 500) | 381 (0) | 261 (0) | 262 (0) | none over 500 |
| 4877 years 21–23, wall s | 35.18 + 36.22 + 40.27 = 111.7 | 33.20 + 31.20 + 35.19 = **99.6** (`head_4877.json`) | — | ≤ 112 |
| 4877 years 21–23, longest gap ms (over 500) | 320 (0) | 245 (0) | — | none over 500 |

Frames: 59.8–60 a second throughout.

**Met on HEAD, no rule and no code change in this task.** What moved the figure is PLAN 7.129's two commits
(`7be651ab`, ADR-719; `9ef07384`, ADR-720): 6421's year-28 tick 7.99 → 5.41 ms, 8,760 × 2.58 ms ≈ 22.6 s, which is the
81.5 → 57.4 s fall.

**Margin:** the worse read is 1.6 s (2.7 %) under the bar; two sequential reads on this machine differ by a few per
cent (here 3.6 %), so another read, the next critic's among them, may land either side of 60 s.
