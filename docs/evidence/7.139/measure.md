# PLAN 7.139 — R16-B2: the late tick under 5.5 ms (ADR-729)

Reads: `npm run sim -- --load … --years 1 --profile --affinity 0xFFFF`, "alone" = pinned with nothing else
running. The screen: `tools/diag/yearScreen.ts <seed> 30`, eight at once, one P-core each (≈ 1.13 × a read
alone), each year saved (`.cache/7139/screen/`, deleted after the AT).

## 1. Where the late tick goes (HEAD `d246579a`)

| save | tick | operational AI | hash |
|---|---|---|---|
| 3847 y27 (`critic/c16_seed3847_y26.bin`) | 6.21 | 3.16 | 653f4785 |
| 5683 y26 (`critic/c16_seed5683_y25.bin`) | 6.09 | 3.05 | 72d1b001 |

The operational AI runs every 6 hours, ~19 ms a call. `tools/diag/opCalls.ts` on 60 days of 3847: 2,469 plans,
2,184 of them on ~3,000 sectors; nations with 2–3 free formations (TRJ, GRE, ITA, DEN, POR) at 2–3 ms a plan.
Each plan copied every sector, sorted all of them by threat, counted each class's pool over all of them, and
looked buckets up in `Map`s; each tick's first plan of a side made every holder's front part again. New tool
`tools/diag/lineProf.ts` (a CPU profile by source line, bundled with esbuild: tsx puts a module on one line).

## 2. The changes (no rule moved: both hashes and the pin unchanged at every step)

| step | 3847 y27 | 5683 y26 |
|---|---|---|
| HEAD | 6.21 | 6.09 |
| sectors pooled per shape, threat order cached, pool count banded to the class's rows, stamped bucket counts | 6.05 | 5.75 |
| front parts kept between ticks (`frontPartsOf`) | 5.99 | 5.67 |
| reset only what the last plan wrote; own sectors from the part's keys; the class's front sorted by threat alone; the side in a bucket once a plan | 5.67 | 5.30 |
| a bomber's targets once a nation and day (`Bombable`; a first, eager version read 0.53 ms of air AI, undone) | 5.61 | 5.25 |
| one pool for all plans; `frontPart` with stamped arrays; keys sorted as integers | 5.43 | 5.13 |

Front parts: 2 of 3 kept from tick to tick (30 days of 3847); whole shapes could have been kept for 47 of 525,
so they are not. `frontParts1938.test.ts`: no kept part stale and the world's hash as with none kept, hour by
hour over 30 days of seed 99; red (hour 4589) with the flip's neighbours' holders not dropped.

## 3. The AT

| clause | bar | read |
|---|---|---|
| 3847's year 27, alone, twice | ≤ 5.5 | **5.39, 5.40** (hash 653f4785, operational AI 2.53) |
| 5683's year 26, alone, twice | ≤ 5.5 | **5.12, 5.11** (hash 72d1b001) |
| worst year of 1212, 1214–1222 × 30 | ≤ 5.5 | screen **5.06** (1216 y29); alone from its year-28 save **4.27** (hash ebffe97d) |
| the pin | unchanged | unchanged |
| the gate | green | green (`162010d2`, `b68b99ce`) |

The worst year of each seed on the screen: 1212 y20 4.52, 1214 y26 4.39, 1215 y1 4.14, 1216 y29 5.06, 1217 y24
4.51, 1218 y1 3.93, 1219 y24 3.89, 1220 y1 4.12, 1221 y17 4.20, 1222 y30 3.22. No other year over 4.7.

**Met.** Seeds 1212, 1214–1222 spent.
