# PLAN 7.111: the late tick's exact remainder (ADR-694, ADR-695)

2026-10-24. Year 21 of 4877 from `critic/c13_seed4877_y20.bin`, `npm run sim -- --affinity 0xFFFF --profile`.

| | read 1 | read 2 | hash |
|---|---|---|---|
| HEAD `3e58eb61` (after ADR-693 b) | 4.457 | 4.431 | dba7fdae |
| the three cuts (`bc9192ca`) | 4.242 | 4.220 | dba7fdae |

The bar (ADR-694: HEAD's 4.44 less 7.105's 0.32): 4.12. **Missed** by 0.10–0.12; the cut is 0.21 ms (× 0.95).

## Each cut, by its function's time in a `--cpu-prof` of the year

An esbuild bundle of `tools/headless/cli.ts` per commit, two at once on 0x0F00, `docs/evidence/7.105/top.mjs`
(inclusive ms in the year of 8,760 ticks). Paired reads of the whole tick swing ±5 % on untouched systems, more
than a cut: each is read by its own function.

| cut | commit | function | before → after (ms a year) | ms a tick |
|---|---|---|---|---|
| `snapTarget`'s kept answers by landmass, then cell (one key past the small integers before) | `a974233f` | `snapTarget` | 1,860 → 430 | −0.16 |
| `sectorShape`'s sectors by stamped bucket, the sort of distinct keys as numbers | `f0731f48` | `sectorShape` | 3,124 → 2,766 | −0.04 |
| `industryHeld` over the cells with industry (kept per array, by `citiesVersion`) | `bc9192ca` | `industryHeld` | 820 → 254 | −0.065 |

About 0.27 ms by the functions, 0.21 by the reads. ADR-680 sized them at 0.18 together and the bar was 0.32.

## What is left

`sectorShape`'s inner loop over the parts' keys (the `holders` line takes the loop's cost in the profile, ~0.05 ms)
and its sort (~0.03); the pockets (PLAN 7.112, a rule, ~0.2–0.3); the operational AI's cadence (~1.0, against
R13-B1). The tick rose 0.2 ms with ADR-693 (b): more formations live.
