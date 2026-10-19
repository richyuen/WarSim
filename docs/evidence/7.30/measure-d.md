# PLAN 7.30d — the AT: seed 732 × 50 years after 7.30b and 7.30c2

2026-10-19, code of `bf69569` (pin 94235073).

## 1. The run

`npm run sim -- --scenario 1938 --seed 732 --years 50 --affinity 0xFFFF --profile --save
.cache/730d/s732-y50.bin --out .cache/730d/p732.json`, as 7.27d's (`docs/evidence/7.27/measure-d.md`
§1), with no gate and no sweep beside it. The one difference from "alone": a sampler of the
process's memory every 15 s (one `Win32_Process` query, under 1 % of a core; `.cache/730d/mem.tsv`).

- **Hashes:** all 50 years' hashes and the final hash equal 7.27d's `p732.json` `yearly`. 7.30b
  (ADR-523) and 7.30c2 (ADR-524) changed no answer over the whole run, as their one-year checks
  said. Nothing to bisect.
- **Wall:** 851.3 s (7.27d 921.7); mean tick 1.938 ms (2.100).

## 2. The operational AI against 7.27d's

Mean ms a tick by band. "Load" divides each year by that year's ratio of five systems neither
rule touches (movement, supply, combat, territory, navalCombat; summed): the run is a pair taken
one after the other, not at the same time.

| band | 7.27d | 7.30d | ratio | 7.30d by load | ratio by load | load, median (range) |
|---|---|---|---|---|---|---|
| 1–5 | 0.255 | 0.263 | 1.03 | 0.247 | 0.97 | 1.01 (1.00–1.18) |
| 6–25 | 0.837 | 0.807 | 0.96 | 0.749 | 0.89 | 1.01 (0.72–1.53) |
| 26–50 | 1.072 | 0.753 | 0.70 | 0.785 | 0.73 | 0.98 (0.69–1.48) |

**The AT is not met.** The bar is 26–50 at most half of 7.27d's, 0.536; the run reads 0.753 (0.785
by load).

- **Years 18–25 and 45 were the machine's load, not the code:** every untouched system is 1.35–1.6 ×
  7.27d's in them (year 23: movement 1.59, supply 1.55, combat 1.49, territory 1.48, navalCombat
  1.45; the operational AI 1.52), and the hashes are the same.
- **No early cost from the state kept:** both rules keep more (corridors, runs). Years 1–5 read
  0.97 by load.
- **The heavy years fell:** year 31 4.376 → 1.159, 41 1.785 → 0.596, 30 1.867 → 0.974, 40 1.295
  → 0.740, 44 2.838 → 1.656, 8 1.504 → 0.935, 9 1.815 → 1.463.
- **What is left, by year** (26–50 by load, sum 19.63 over 25 years): 47 1.84, 44 1.47, 31 1.21,
  46 1.08, 40 1.08, 30 1.02, 26 0.88, 28 0.85: those eight 9.42 of it. The median late year is
  0.746. Brought to that median, the heavy years would leave the band at about 0.65, still over
  0.536: the bar needs the cost of every year, not of the heavy ones.

## 3. What is left, by part

`opCalls.ts` for 365 days from `.cache/730/s732-y30.bin` (year 31), `s732-y43.bin` (year 44) and
`.cache/730d/s732-y46.bin` (year 47, made from y43; its hashes after years 44–46 equal 7.27d's).
The three ran side by side under the probe: shares only, no absolute times (`.cache/730d/opCalls_732_y*.txt`).

- **Year 47** (the top late year): orders 86 % of plan time; the asks answered **'long'** and searched
  in full: 1,523 with no kept answer (14.3 s, 9.4 ms each, a mean 32 cells apart) and 1,014 kept
  for another cell (7.9 s). France (12.9 s of 26.1; 324 sectors, 48 free formations, ~25 asks a
  plan of ~9 ms) and nation 106 (5.7 s), then Belgium. A 'long' answer is kept only while no cell
  anywhere has flipped between an open and a closed holder (`same` in `asked`), and none is kept
  for a formation on the move: whether these are moving formations is not measured.
- **Year 44:** the classes 28 % (`groundOf` among them), orders 31 % (refused, searched again: for
  another cell 503, 2.5 s; none kept 169; flips 213), far marches 22 %. The USA 6.9 s of 16.9.
- **Year 31:** far marches 83 %: refusals still searched (flips that opened a corridor's cell 441,
  4.8 s; other holders open 325; first asks 262; another cell 181), nation 106 and France.
- **The broad years:** measure-a §2's year 51 (from y50; no repeated refusal) stands, since neither
  7.30b nor 7.30c2 touches it: the classes and `reached` 49 %, `groundOf` 2.16 M calls; CPU
  self time `pocketOf` 38 %, `findPath` 16 %, `planNation` 15 %.

## 4. `pocketOf` weighed as a rule

Even with all of `pocketOf`'s self time gone from every late year (38 % of year 51's), 0.785 × 0.62
≈ 0.49: under the bar only if its whole cost went. Its answers depend on the order of the walks of
a passage (ADR-192; measure-a §3.3): an answer kept across ticks is a new rule, with the pin moved
and an A/B to show the war unchanged. The late years have no budget (SPEC; 7.27d §1: a cost of a
50-year run, not of the game's pace at its budgeted size). Not taken here: the bar is put to the
user (ADR-525). The exact part of what is left, year 47's 'long' orders and year 44's refusals for
another cell, is PLAN 7.30e; at most it brings the heavy years down, about 0.65 on the band.

## 5. Memory

The process's working set (not the heap), sampled every 15 s and taken at its highest a year: 567
MB at the start, 580 after year 1, 700 at year 8, 750–775 in years 18–31, a step of ~150 MB at year
32 (757 → 909), 920–975 in years 32–49 (private bytes 30 MB above). 7.27d's run was not sampled, so
no part of this is put on ADR-524's runs (measured at most 6.2 MB live in 7.30c2) or on the
world's growth.
